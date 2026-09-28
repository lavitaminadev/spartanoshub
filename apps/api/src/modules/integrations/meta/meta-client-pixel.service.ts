import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Client } from '../../clients/client.entity';
import { protectSecret, revealSecret } from '../../../shared/security/integration-secrets';
import { Integration } from '../integration.entity';
import { IntegrationProvider } from '../integration-provider.enum';
import { IntegrationStatus } from '../integration-status.enum';
import { MetaPixelService } from './meta-pixel.service';
import { MetaPixel } from './meta-pixel.entity';
import { IsNull } from 'typeorm';

type ClientPixelRecord = { pixelId: string; pixelName?: string; accessToken?: string; configuredAt: string };

/**
 * Credencial de un Pixel, guardada por Pixel y no por empresa.
 *
 * El token pertenece al Pixel: es lo que da permiso para escribir **en ese conjunto de datos**.
 * Guardarlo dentro de la empresa —como se hacía— producía tres problemas a la vez: una empresa
 * no podía tener dos Pixels, había que reescribir el Pixel para cambiar el token, y al mover una
 * campaña a otra empresa la credencial se quedaba con la anterior y el envío moría con un token
 * del entorno que Meta rechaza.
 *
 * Se lee de acá primero y del registro antiguo después, así que lo ya configurado sigue
 * funcionando y se normaliza solo la primera vez que se guarda.
 */
type PixelCredential = { name?: string; accessToken?: string; updatedAt: string };

@Injectable()
export class MetaClientPixelService {
  constructor(
    @InjectRepository(Integration) private readonly integrations: Repository<Integration>,
    @InjectRepository(Client) private readonly clients: Repository<Client>,
    @InjectRepository(MetaPixel) private readonly pixelesGuardados: Repository<MetaPixel>,
    private readonly pixels: MetaPixelService,
  ) {}

  private async integration(id: string, organizationId: string) {
    const integration = await this.integrations.findOne({ where: { id, organizationId, provider: IntegrationProvider.META } });
    if (!integration) throw new NotFoundException('Integración Meta no encontrada');
    return integration;
  }

  private async organizationIntegration(organizationId: string, create = false) {
    let integration = await this.integrations.findOne({
      where: { organizationId, provider: IntegrationProvider.META },
      order: { createdAt: 'ASC' },
    });
    if (!integration && create) {
      integration = await this.integrations.save(this.integrations.create({
        organizationId,
        provider: IntegrationProvider.META,
        name: 'Meta CAPI',
        status: IntegrationStatus.PENDING,
        config: { directCapi: true, clientPixels: {} },
      }));
    }
    return integration;
  }

  /** Credenciales por Pixel. Vacío cuando la integración todavía usa solo la forma antigua. */
  private credenciales(integration: Integration): Record<string, PixelCredential> {
    const value = integration.config?.metaPixels;
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, PixelCredential> : {};
  }

  /**
   * El token de un Pixel, buscado en la tabla con dueño.
   *
   * En este orden: la credencial de esa empresa, y si no la tiene, la del registro por Pixel
   * —la declarada para ese destino, sin empresa—. Nunca la de otra empresa: la consulta no
   * puede devolverla, así que no depende de que alguien se acuerde de filtrar.
   *
   * Devuelve `undefined` cuando no hay fila, y entonces quien llama cae al JSON de siempre.
   * Mientras dure esa convivencia, lo configurado antes de la tabla sigue enviando igual.
   */
  private async tokenEnTabla(
    organizationId: string,
    pixelId: string,
    clientId?: string | null,
  ): Promise<string | undefined> {
    if (clientId) {
      const propia = await this.pixelesGuardados.findOne({
        where: { organizationId, clientId, pixelId },
      });
      if (propia?.accessToken) return revealSecret(propia.accessToken);
    }

    const registro = await this.pixelesGuardados.findOne({
      where: { organizationId, clientId: IsNull(), pixelId },
    });
    return registro?.accessToken ? revealSecret(registro.accessToken) : undefined;
  }

  /**
   * El mismo token, buscado en el JSON.
   *
   * Es la red mientras conviven las dos formas: lo configurado antes de la tabla se encuentra
   * donde estaba. Cuando el JSON se retire, este método desaparece con él.
   *
   * De la forma antigua, con empresa se usa la suya; sin empresa —el envío desde la cola solo
   * tiene organización y Pixel— la única que haya. Antes se recorrían las de todas y se tomaba la
   * primera que coincidiera, así que cuál se usaba dependía del orden de las claves.
   */
  private tokenDePixel(
    integration: Integration | null,
    pixelId: string,
    clientId?: string | null,
  ): string | undefined {
    if (!integration) return process.env.META_CONVERSIONS_ACCESS_TOKEN || undefined;

    const credencial = this.credenciales(integration)[pixelId];
    if (credencial?.accessToken) return revealSecret(credencial.accessToken);

    /*
     * De la forma antigua, con empresa se usa la suya y sin empresa solo si no hay duda.
     *
     * El envío desde la cola llega sin empresa —solo tiene organización y Pixel—, así que exigirla
     * dejaría sin credencial a todo lo configurado antes del registro por Pixel. La regla que sí
     * vale para los dos casos es la ambigüedad: si una sola empresa tiene token para ese Pixel, es
     * el que corresponde; si lo tienen dos, elegir sería quedarse con la primera del JSON, que es
     * el problema que esto viene a quitar.
     */
    if (clientId) {
      const deLaEmpresa = this.records(integration)[clientId];
      if (deLaEmpresa?.pixelId === pixelId && deLaEmpresa.accessToken) {
        return revealSecret(deLaEmpresa.accessToken);
      }
    } else {
      const unico = this.tokenSinAmbiguedad(integration, pixelId);
      if (unico) return revealSecret(unico);
    }

    return process.env.META_CONVERSIONS_ACCESS_TOKEN || undefined;
  }

  private records(integration: Integration): Record<string, ClientPixelRecord> {
    const value = integration.config?.clientPixels;
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, ClientPixelRecord> : {};
  }

  /**
   * Modifica el mapa de Pixeles por cliente sin perder cambios ajenos.
   *
   * Los Pixeles de todos los clientes viven en un único campo JSON de la integración, así que
   * configurar uno obliga a leer el mapa entero, cambiar una clave y volver a escribirlo
   * completo. Hecho sin bloqueo, dos configuraciones simultáneas leen la misma versión y la
   * segunda en guardar borra la primera: el Pixel recién configurado desaparece sin error, y
   * las conversiones de ese cliente dejan de enviarse hasta que alguien lo note.
   *
   * La fila se relee dentro de la transacción y con bloqueo de escritura, de modo que la
   * segunda operación espera y parte del mapa ya actualizado.
   *
   * @param mutate - Recibe el mapa vigente y devuelve el que debe quedar guardado.
   * @returns Lo que devuelva `mutate` como segundo valor, ya con la escritura confirmada.
   */
  private async mutateRecords<T>(
    integrationId: string,
    mutate: (records: Record<string, ClientPixelRecord>) => Promise<[Record<string, ClientPixelRecord>, T]> | [Record<string, ClientPixelRecord>, T],
  ): Promise<T> {
    return this.integrations.manager.transaction(async (manager) => {
      const repo = manager.getRepository(Integration);
      const fresh = await repo.findOne({ where: { id: integrationId }, lock: { mode: 'pessimistic_write' } });
      if (!fresh) throw new NotFoundException('Integración Meta no encontrada');

      const current = this.records(fresh);
      const [next, result] = await mutate(current);
      fresh.config = { ...fresh.config, clientPixels: next };
      await repo.save(fresh);
      return result;
    });
  }

  async list(id: string, organizationId: string) {
    const integration = await this.integration(id, organizationId);
    return this.catalogRows(organizationId, this.records(integration), this.credenciales(integration));
  }

  /**
   * Si esa empresa tiene un token que de verdad sirve para su Pixel.
   *
   * Mira primero el registro por Pixel y después lo que quedara dentro de la empresa. Devolver
   * falso acá es lo que enciende el aviso de «usando el token general», que es la causa más
   * frecuente de una cola de eventos rechazados.
   */
  private tokenPropioDe(
    record: ClientPixelRecord | undefined,
    credenciales: Record<string, PixelCredential>,
  ): boolean {
    if (!record) return false;
    return Boolean(credenciales[record.pixelId]?.accessToken || record.accessToken);
  }

  private async catalogRows(
    organizationId: string,
    records: Record<string, ClientPixelRecord>,
    credenciales: Record<string, PixelCredential> = {},
  ) {
    const clients = await this.clients.find({ where: { organizationId }, order: { name: 'ASC' } });
    return clients.map((client) => ({
      clientId: client.id,
      clientName: client.name,
      pixelId: records[client.id]?.pixelId || null,
      pixelName: records[client.id]?.pixelName || null,
      tokenConfigured: Boolean(records[client.id]?.accessToken || process.env.META_CONVERSIONS_ACCESS_TOKEN),
      /*
       * Propio y heredado se distinguen, y `tokenConfigured` los confundía.
       *
       * Decía «sí» también cuando lo único que había era el token del entorno, así que una
       * empresa sin token propio se veía correctamente configurada. Y un token de entorno
       * pertenece a una cuenta publicitaria concreta: casi nunca tiene permiso sobre el Pixel de
       * otra, de modo que sus conversiones se envían, Meta las rechaza y quedan en `failed` sin
       * que nadie sepa por qué.
       *
       * `tokenConfigured` se conserva porque otras pantallas ya lo consumen.
       */
      tokenPropio: Boolean(this.tokenPropioDe(records[client.id], credenciales)),
      tokenHeredado: !this.tokenPropioDe(records[client.id], credenciales)
        && Boolean(process.env.META_CONVERSIONS_ACCESS_TOKEN),
      configuredAt: records[client.id]?.configuredAt || null,
    }));
  }

  async catalog(organizationId: string) {
    const integration = await this.organizationIntegration(organizationId);
    const records = integration ? this.records(integration) : {};
    const credenciales = integration ? this.credenciales(integration) : {};
    const bindings = await this.catalogRows(organizationId, records, credenciales);
    const pixels = Array.from(new Set(Object.values(records).map((record) => record.pixelId))).map((pixelId) => {
      const matched = bindings.filter((binding) => binding.pixelId === pixelId);
      const clients = matched.map((binding) => binding.clientName);
      const names = matched.map((binding) => binding.pixelName).filter(Boolean) as string[];
      const record = Object.values(records).find((item) => item.pixelId === pixelId);
      return {
        pixelId,
        clientNames: clients,
        pixelNames: names,
        usageCount: clients.length,
        tokenConfigured: Boolean(
          credenciales[pixelId]?.accessToken || record?.accessToken || process.env.META_CONVERSIONS_ACCESS_TOKEN,
        ),
      };
    });
    /*
     * También los Pixels registrados que ninguna empresa usa todavía.
     *
     * Son los que una campaña necesita cuando se aparta del Pixel de su empresa: sin aparecer
     * acá quedaban invisibles, y no había forma de saber si tenían credencial.
     */
    const sinAsignar = Object.keys(credenciales)
      .filter((pixelId) => !pixels.some((registrado) => registrado.pixelId === pixelId))
      .map((pixelId) => ({
        pixelId,
        clientNames: [] as string[],
        pixelNames: credenciales[pixelId].name ? [credenciales[pixelId].name as string] : [],
        usageCount: 0,
        tokenConfigured: Boolean(credenciales[pixelId].accessToken),
      }));
    // La pantalla necesita saber cuál es el de la agencia para marcarlo y para poder cambiarlo.
    const agencyPixelId = typeof integration?.config?.agencyPixelId === 'string' ? integration.config.agencyPixelId : null;
    return { bindings, pixels: [...pixels, ...sinAsignar], agencyPixelId };
  }

  /**
   * Pixels entre los que un ámbito de esta empresa puede elegir.
   *
   * Son los mismos que `resolveForScope` sabe resolver: los de la empresa y los del registro sin
   * dueño. No incluye los de otras empresas —no podría enviarles nada— ni los nombra, porque esta
   * lista la lee quien administra Reservas, que no tiene por qué ver la cartera completa.
   *
   * `tieneToken` se calcula resolviendo cada candidato de verdad, y no mirando si existe la fila:
   * un Pixel sin credencial se guarda igual y después no envía nada sin avisar.
   */
  /**
   * Rechaza un Pixel que pertenece a otra empresa.
   *
   * La regla existía al registrarlo en Integraciones, pero no al asignarlo a un local: bastaba
   * escribir el número a mano para que las reservas de una empresa se contaran en el Events
   * Manager de otra, mezclando dos negocios en una misma cuenta publicitaria.
   *
   * Un Pixel sin dueño registrado es el de la agencia y se permite: es el que heredan los
   * locales de empresas que todavía no tienen el suyo.
   */
  async assertPixelDeLaEmpresa(organizationId: string, clientId: string, pixelId: string): Promise<void> {
    /*
     * Se miran todas las filas con dueño, no una cualquiera.
     *
     * Con `findOne` el resultado dependía del orden que devolviera el índice: un Pixel que por
     * arrastre histórico figura en dos empresas hacía que la comprobación fallara unas veces sí
     * y otras no sobre la misma empresa. Cambiar el dueño no arreglaba nada, porque la otra fila
     * seguía ahí y podía volver a ganar.
     *
     * Con la lista entera, la empresa que ya lo tiene asignado siempre pasa, y sólo se rechaza
     * cuando de verdad pertenece a otra.
     */
    const conDueno = await this.pixelesGuardados.find({
      where: { organizationId, pixelId, clientId: Not(IsNull()) },
      select: { id: true, clientId: true },
    });
    if (conDueno.some((fila) => fila.clientId === clientId)) return;

    /*
     * El registro antiguo cuenta como dueño igual que la tabla.
     *
     * La tabla se pobló con lo que había en una migración, pero lo que se configura desde
     * entonces sigue quedando también en el mapa por empresa de la integración. Mirando sólo la
     * tabla, un Pixel asignado a otra empresa después de esa migración pasaba la comprobación:
     * bastaba escribir el número a mano para medir sobre el Pixel de un negocio ajeno.
     */
    const integration = await this.organizationIntegration(organizationId);
    const deOtraEnElMapa = integration
      ? Object.entries(this.records(integration)).some(([dueno, registro]) => dueno !== clientId && registro?.pixelId === pixelId)
      : false;
    const suyoEnElMapa = integration ? this.records(integration)[clientId]?.pixelId === pixelId : false;
    if (suyoEnElMapa) return;

    if (conDueno.length === 0 && !deOtraEnElMapa) return;
    throw new BadRequestException(`El Pixel ${pixelId} es de otra empresa. Cada empresa mide en el suyo.`);
  }

  /**
   * Los Pixels entre los que puede elegir un ámbito de esta empresa.
   *
   * Sólo los suyos: los registrados a su nombre, el que tiene asignado, el que la organización
   * declaró como Pixel de la agencia, y los que sus propios formularios ya están usando.
   *
   * Antes se añadían además **todas** las credenciales de la organización, que es el registro de
   * Pixels de todas las empresas. El selector de un local mostraba así el Pixel de otro negocio, y
   * elegirlo pasaba la comprobación siempre que ese Pixel no estuviera en la tabla con dueño: las
   * reservas de una empresa se contaban en el Events Manager de otra.
   *
   * Los que ya están en uso se incluyen aunque no cumplan la regla. Si alguno quedó apuntando a un
   * Pixel ajeno de antes, esta lista no es el lugar donde se corrige: quitarlo de aquí lo dejaría
   * enviando igual pero con el selector en blanco, que es peor para quien lo mira.
   *
   * @param enUso - Pixels que los ámbitos de esta empresa ya tienen guardados.
   */
  async pixelesElegibles(organizationId: string, clientId: string, enUso: string[] = []) {
    const filas = await this.pixelesGuardados.find({
      where: { organizationId, clientId },
      order: { pixelId: 'ASC' },
    });
    const integration = await this.organizationIntegration(organizationId);
    const credenciales = integration ? this.credenciales(integration) : {};
    const porDefecto = await this.resolve(organizationId, clientId);
    const deLaAgencia = typeof integration?.config?.agencyPixelId === 'string' ? integration.config.agencyPixelId : null;

    const ids = new Set<string>([...filas.map((fila) => fila.pixelId), ...enUso.filter(Boolean)]);
    if (porDefecto.pixelId) ids.add(porDefecto.pixelId);
    if (deLaAgencia) ids.add(deLaAgencia);

    const pixels = [] as Array<{ pixelId: string; nombre: string | null; tieneToken: boolean; esDeLaEmpresa: boolean; esDeLaAgencia: boolean }>;
    for (const pixelId of ids) {
      const resuelto = await this.resolveForScope(organizationId, clientId, pixelId);
      pixels.push({
        pixelId,
        nombre: filas.find((fila) => fila.pixelId === pixelId)?.name ?? credenciales[pixelId]?.name ?? null,
        tieneToken: Boolean(resuelto.accessToken),
        esDeLaEmpresa: pixelId === porDefecto.pixelId,
        // Medir en el de la agencia mezcla este negocio con el embudo de Espartanos, así que la
        // pantalla tiene que poder decirlo antes de que alguien lo elija sin saberlo.
        esDeLaAgencia: pixelId === deLaAgencia,
      });
    }
    return {
      porDefecto: {
        pixelId: porDefecto.pixelId || null,
        pixelName: porDefecto.pixelName || null,
        tieneToken: Boolean(porDefecto.accessToken),
      },
      pixels,
    };
  }

  /**
   * Candidatos para una campaña del CRM, que puede ser de una empresa o de la propia agencia.
   *
   * Con empresa son los mismos que ve un local suyo. Sin empresa, la campaña es de Espartanos y
   * los candidatos son los Pixels registrados que no pertenecen a ninguna empresa: ofrecer el de
   * un cliente aquí mezclaría el embudo de la agencia con el de ese negocio.
   *
   * `tieneToken` sale de resolver cada candidato de verdad, no de que exista la fila: un Pixel sin
   * credencial se guardaría igual y después no enviaría nada sin avisar.
   */
  async elegiblesParaCampania(organizationId: string, clientId: string | null) {
    if (clientId) return this.pixelesElegibles(organizationId, clientId);

    const integration = await this.organizationIntegration(organizationId);
    const credenciales = integration ? this.credenciales(integration) : {};
    const deEmpresas = new Set(Object.values(integration ? this.records(integration) : {}).map((registro) => registro?.pixelId).filter(Boolean));
    const conDueno = await this.pixelesGuardados.find({
      where: { organizationId, clientId: Not(IsNull()) },
      select: { id: true, pixelId: true },
    });
    for (const fila of conDueno) deEmpresas.add(fila.pixelId);

    const sinDueno = await this.pixelesGuardados.find({ where: { organizationId, clientId: IsNull() }, order: { pixelId: 'ASC' } });
    const ids = new Set<string>([...sinDueno.map((fila) => fila.pixelId), ...Object.keys(credenciales)]);

    const pixels = [];
    for (const pixelId of ids) {
      if (deEmpresas.has(pixelId)) continue;
      pixels.push({
        pixelId,
        nombre: sinDueno.find((fila) => fila.pixelId === pixelId)?.name ?? credenciales[pixelId]?.name ?? null,
        tieneToken: Boolean(await this.resolveByPixel(organizationId, pixelId, null)),
        esDeLaEmpresa: false,
        esDeLaAgencia: pixelId === (typeof integration?.config?.agencyPixelId === 'string' ? integration.config.agencyPixelId : null),
      });
    }
    return { porDefecto: { pixelId: null, pixelName: null, tieneToken: false }, pixels };
  }

  async configure(id: string, organizationId: string, clientId: string, pixelId: string, accessToken?: string, pixelName?: string) {
    const integration = await this.integration(id, organizationId);
    return this.configureRecord(integration, organizationId, clientId, pixelId, accessToken, pixelName);
  }

  private async configureRecord(integration: Integration, organizationId: string, clientId: string, pixelId: string, accessToken?: string, pixelName?: string) {
    const client = await this.clients.findOne({ where: { id: clientId, organizationId } });
    if (!client) throw new NotFoundException('Cliente no encontrado');
    // Reservas es multiempresa: compartir un Pixel entre dos empresas mezcla sus conversiones
    // en el Events Manager aunque los formularios y la base estén aislados. La configuración
    // explícita de agencia sigue siendo otro camino (`agencyPixelId`), no una excepción acá.
    const assignedInLegacyMap = Object.entries(this.records(integration))
      .some(([ownerId, record]) => ownerId !== clientId && record?.pixelId === pixelId);
    const assignedInTable = await this.pixelesGuardados.findOne({
      where: { organizationId, pixelId, clientId: Not(clientId) },
      select: { id: true },
    });
    if (assignedInLegacyMap || assignedInTable) {
      throw new BadRequestException('Este Pixel ya está asignado a otra empresa de Reservas. Cada empresa debe usar su propio Pixel.');
    }
    const existing = this.records(integration)[clientId];
    const token = accessToken?.trim() || this.tokenDePixel(integration, pixelId);
    if (!token) throw new BadRequestException('Se requiere un token CAPI para este cliente');

    // La validación va antes de abrir la transacción: es una llamada a Meta que puede tardar
    // segundos, y hacerla con la fila bloqueada dejaría esperando a cualquier otra
    // configuración de la misma organización.
    /*
     * Solo una credencial que Meta declara invalida impide guardar.
     *
     * La comprobacion lee la ficha del Pixel, y leer exige permisos que escribir eventos no: un
     * token de la API de Conversiones suele poder `POST /events` y no ese `GET`. Bloquear por
     * eso —o por un tiempo de espera agotado— dejaba sin configurar algo que funciona.
     */
    const verificacion = await this.pixels.verificarPixel(pixelId, token);
    if (verificacion.bloquea) {
      throw new BadRequestException(`Meta rechazo la credencial: ${verificacion.motivo ?? 'token invalido'}`);
    }

    return this.mutateRecords(integration.id, (records) => {
      // Se relee el registro de dentro de la transacción y no el de antes: entre la
      // validación y esta escritura pudo cambiar.
      const current = records[clientId];
      const record: ClientPixelRecord = {
        pixelId,
        pixelName: pixelName?.trim() || current?.pixelName || client.name,
        /*
         * La asignación ya no guarda el token nuevo: es del Pixel y se escribe aparte, para que
         * cambiarlo no obligue a reescribir esto y para que sobreviva a que la empresa cambie de
         * Pixel. Lo que hubiera de la forma antigua se conserva hasta que ese Pixel tenga su
         * propia credencial: borrarlo acá dejaría sin token algo que estaba funcionando.
         */
        accessToken: current?.accessToken,
        configuredAt: new Date().toISOString(),
      };
      return [
        { ...records, [clientId]: record },
        { clientId, clientName: client.name, pixelId, pixelName: record.pixelName || client.name, tokenConfigured: true, configuredAt: record.configuredAt },
      ];
    });
  }

  async setup(
    organizationId: string,
    clientId: string,
    mode: 'none' | 'manual' | 'existing',
    input: { pixelId?: string; existingPixelId?: string; pixelName?: string; accessToken?: string },
  ) {
    const client = await this.clients.findOne({ where: { id: clientId, organizationId } });
    if (!client) throw new NotFoundException('Cliente no encontrado');
    const integration = await this.organizationIntegration(organizationId, mode !== 'none');
    if (!integration) return { clientId, clientName: client.name, pixelId: null, tokenConfigured: false, configuredAt: null };

    if (mode === 'none') {
      return this.mutateRecords(integration.id, (records) => {
        const { [clientId]: _removed, ...rest } = records;
        return [rest, { clientId, clientName: client.name, pixelId: null, tokenConfigured: false, configuredAt: null }];
      });
    }

    if (mode === 'existing') {
      /*
       * Un Pixel existente puede venir de dos sitios, y aquí solo se miraba uno.
       *
       * El desplegable se llena con `pixelesElegibles`, que lee la tabla de Pixeles **y** las
       * credenciales de la integración. Guardar, en cambio, buscaba solo en el mapa por empresa
       * de Reservas. Un Pixel creado desde una campaña del CRM vive en la tabla y no en ese
       * mapa: se ofrecía en la lista y al elegirlo respondía «no está disponible en esta
       * organización», que además señalaba al lugar equivocado.
       *
       * Se busca en los dos sitios, en el mismo orden en que se ofrecen.
       */
      const enLaTabla = input.existingPixelId
        ? await this.pixelesGuardados.findOne({ where: { organizationId, pixelId: input.existingPixelId } })
        : null;
      /*
       * Y también entre las credenciales, que es la tercera procedencia.
       *
       * «Agregar Pixel» guarda sólo en `config.metaPixels`; la tabla no la escribe nadie desde
       * que una migración la pobló. El catálogo que llena el desplegable sí lee esas
       * credenciales, así que ofrecía Pixels registrados hace un rato y al elegirlos respondía
       * que no existen —y remataba mandando a crearlos con el botón que acababa de usarse—.
       */
      const enLasCredenciales = input.existingPixelId
        ? this.credenciales(integration)[input.existingPixelId]
        : undefined;
      // La exclusividad sigue valiendo: un Pixel de otra empresa mezclaría sus conversiones.
      if (input.existingPixelId) await this.assertPixelDeLaEmpresa(organizationId, clientId, input.existingPixelId);

      return this.mutateRecords(integration.id, (records) => {
        const enElMapa = Object.values(records).find((record) => record.pixelId === input.existingPixelId);
        const desdeCredencial: ClientPixelRecord | undefined = enLasCredenciales && input.existingPixelId
          ? {
            pixelId: input.existingPixelId,
            pixelName: enLasCredenciales.name ?? undefined,
            accessToken: enLasCredenciales.accessToken ?? undefined,
            configuredAt: new Date().toISOString(),
          }
          : undefined;
        // Se busca en las tres, en el mismo orden en que el catálogo las ofrece.
        const source: ClientPixelRecord | undefined = enElMapa ?? (enLaTabla
          ? { pixelId: enLaTabla.pixelId, pixelName: enLaTabla.name ?? undefined, accessToken: enLaTabla.accessToken ?? undefined, configuredAt: new Date().toISOString() }
          : desdeCredencial);
        if (!source) {
          throw new BadRequestException(
            'Ese Pixel ya no está registrado en esta organización. Vuelve a agregarlo con su token en Integraciones.',
          );
        }
        const configuredAt = new Date().toISOString();
        const record: ClientPixelRecord = { ...source, pixelName: input.pixelName?.trim() || source.pixelName || client.name, configuredAt };
        return [
          { ...records, [clientId]: record },
          { clientId, clientName: client.name, pixelId: source.pixelId, pixelName: record.pixelName || null, tokenConfigured: Boolean(source.accessToken || process.env.META_CONVERSIONS_ACCESS_TOKEN), configuredAt },
        ];
      });
    }

    if (!input.pixelId) throw new BadRequestException('Debes indicar el ID del Pixel');
    // `configureRecord` ya aplica el nombre recibido. Antes había acá una segunda escritura
    // que volvía a guardarlo; ahora sobra, y además leería la integración tal como estaba
    // antes de la transacción, pisando con datos viejos lo que se acaba de escribir.
    return this.configureRecord(integration, organizationId, clientId, input.pixelId, input.accessToken, input.pixelName);
  }

  async resolve(organizationId: string, clientId: string) {
    const integration = await this.organizationIntegration(organizationId);
    const record = integration ? this.records(integration)[clientId] : undefined;
    return {
      pixelId: record?.pixelId || '',
      pixelName: record?.pixelName || null,
      // El token por cliente está acotado al Pixel de ese cliente; el token de entorno
      // es solo un fallback para configuraciones single-tenant donde no se configuró
      // un token por cliente. La prioridad debe favorecer el token del cliente — un
      // token global suele no tener permiso sobre el Pixel de un cliente dado en una
      // configuración de agencia multi-cuenta.
      // El token se busca por el Pixel, no por la empresa: el permiso depende del Pixel, y así
      // una empresa que cambia de Pixel no arrastra la credencial equivocada.
      accessToken: record?.pixelId
        ? this.tokenDePixel(integration, record.pixelId, clientId)
        : process.env.META_CONVERSIONS_ACCESS_TOKEN,
    };
  }

  /**
   * Pixel y token con los que debe medirse un ámbito concreto.
   *
   * Un ámbito es un formulario —de reserva o de encuesta— o una campaña del CRM. Los tres
   * caminos preguntan por aquí, así que el Pixel de una empresa se decide en un solo sitio y no
   * en cada módulo por su cuenta.
   *
   * **Sin `pixelId` propio hereda el de la empresa**, que es como funcionó siempre: por eso
   * agregar la columna no cambió el envío de nada existente.
   *
   * El token se busca **por Pixel** y no por empresa. Es la diferencia que importa cuando dos
   * ámbitos de la misma empresa miden contra Pixeles distintos: cada uno necesita el token que
   * tiene permiso sobre el suyo, y el de la empresa solo sirve para el que ella tiene por
   * defecto.
   *
   * @param organizationId - Organización dueña de la integración.
   * @param clientId - Empresa del ámbito. Sin ella no hay Pixel por defecto que heredar.
   * @param pixelPropio - Pixel declarado por el formulario o la campaña, si se apartó.
   * @returns El Pixel efectivo, su token, y de dónde salió cada uno. `tokenSource` existe para
   *   poder decir en pantalla que una empresa está usando el token del entorno: hoy eso es
   *   invisible y es justo lo que hace que las conversiones fallen sin que nadie lo sepa.
   */
  async resolveForScope(
    organizationId: string,
    clientId: string | null | undefined,
    pixelPropio?: string | null,
  ): Promise<{
    pixelId: string;
    pixelName: string | null;
    accessToken?: string;
    pixelSource: 'scope' | 'client' | 'none';
    tokenSource: 'pixel' | 'client' | 'environment' | 'none';
  }> {
    const porDefecto = clientId
      ? await this.resolve(organizationId, clientId)
      : { pixelId: '', pixelName: null as string | null, accessToken: undefined as string | undefined };

    const propio = pixelPropio?.trim();
    // El del ámbito manda; si no hay, el de la empresa. Un Pixel vacío no es «heredar»: es que
    // esa empresa todavía no tiene ninguno configurado.
    const pixelId = propio || porDefecto.pixelId || '';
    if (!pixelId) return { pixelId: '', pixelName: null, pixelSource: 'none', tokenSource: 'none' };

    const pixelSource = propio ? 'scope' : 'client';

    // Cuando el ámbito usa el Pixel de su empresa, el token de esa empresa es el correcto y se
    // toma directo. Solo hace falta rastrear por Pixel cuando el ámbito se apartó.
    if (pixelSource === 'client') {
      return {
        pixelId,
        pixelName: porDefecto.pixelName ?? null,
        accessToken: porDefecto.accessToken,
        pixelSource,
        tokenSource: porDefecto.accessToken
          ? (process.env.META_CONVERSIONS_ACCESS_TOKEN === porDefecto.accessToken ? 'environment' : 'client')
          : 'none',
      };
    }

    const integration = await this.organizationIntegration(organizationId);
    /*
     * El token se busca con dueño: el registro del Pixel, o la credencial de **esta** empresa.
     *
     * Antes se recorrían las credenciales de todas las empresas de la organización y se tomaba
     * la primera que usara ese Pixel. Con dos empresas compartiendo destino funcionaba por
     * casualidad, y cuál se usaba dependía del orden de las claves en un JSON.
     */
    const propioToken = await this.tokenEnTabla(organizationId, pixelId, clientId)
      ?? (integration ? this.tokenDePixel(integration, pixelId, clientId) : undefined);
    const registro = integration ? this.credenciales(integration)[pixelId] : undefined;
    if (propioToken && propioToken !== process.env.META_CONVERSIONS_ACCESS_TOKEN) {
      return { pixelId, pixelName: registro?.name ?? null, accessToken: propioToken, pixelSource, tokenSource: 'pixel' };
    }

    /*
     * Sin token propio para ese Pixel se recurre al del entorno, pero se declara.
     *
     * Un token de entorno pertenece a una cuenta publicitaria concreta y casi nunca tiene
     * permiso sobre el Pixel de otra: el evento se envía, Meta lo rechaza y queda en `failed`.
     * Devolver `tokenSource: 'environment'` permite avisarlo antes en vez de descubrirlo en la
     * cola de errores.
     */
    const entorno = process.env.META_CONVERSIONS_ACCESS_TOKEN;
    return {
      pixelId,
      pixelName: registro?.name ?? null,
      accessToken: entorno,
      pixelSource,
      tokenSource: entorno ? 'environment' : 'none',
    };
  }

  /**
   * Pixel con el que la agencia mide su propio embudo.
   *
   * Espartanos no es cliente de sí misma, así que no tiene fila en `clients` ni Pixel por
   * empresa. Sin esto, su conversión propia se resolvía contra el Pixel de la empresa recién
   * creada: el cliente veía en su Events Manager un evento valorado en lo que le paga a la
   * agencia. Es dato comercial de la agencia publicado en la cuenta del cliente.
   *
   * Que no haya Pixel marcado es la forma de tenerlo apagado: sin destino no se envía, y
   * marcarlo es el consentimiento explícito que en las empresas da la capacidad contratada.
   */
  async resolveAgencia(organizationId: string): Promise<{ pixelId: string; accessToken?: string }> {
    const integration = await this.organizationIntegration(organizationId);
    const pixelId = typeof integration?.config?.agencyPixelId === 'string' ? integration.config.agencyPixelId : '';
    if (!pixelId) return { pixelId: '' };
    return { pixelId, accessToken: this.tokenDePixel(integration, pixelId) };
  }

  /**
   * Marca cuál de los Pixels registrados es el de la agencia, o quita la marca.
   *
   * Uno solo: dos «Pixels de la agencia» obligarían a decidir en cada envío cuál usar, y esa
   * decisión no la puede tomar el código.
   */
  async marcarPixelDeAgencia(organizationId: string, pixelId: string | null): Promise<{ agencyPixelId: string | null }> {
    const integration = await this.organizationIntegration(organizationId, true);
    if (!integration) throw new NotFoundException('Integración Meta no encontrada');

    return this.integrations.manager.transaction(async (manager) => {
      const repo = manager.getRepository(Integration);
      const fresh = await repo.findOne({ where: { id: integration.id }, lock: { mode: 'pessimistic_write' } });
      if (!fresh) throw new NotFoundException('Integración Meta no encontrada');

      const limpio = pixelId?.trim() || null;
      // Marcar un Pixel sin credencial dejaría el embudo propio encolando eventos que Meta
      // rechaza, y el aviso aparecería en la cola en vez de acá, que es donde se puede corregir.
      if (limpio && !this.tokenDePixel(fresh, limpio)) {
        throw new BadRequestException('Ese Pixel no tiene token registrado: no podría enviar nada');
      }
      fresh.config = { ...fresh.config, agencyPixelId: limpio };
      await repo.save(fresh);
      return { agencyPixelId: limpio };
    });
  }

  async resolveByPixel(organizationId: string, pixelId: string, clientId?: string | null): Promise<string | undefined> {
    /*
     * La tabla primero, el JSON como red.
     *
     * Mientras conviven las dos formas, una credencial que todavía no se haya copiado sigue
     * encontrándose donde estaba. Cuando el JSON se retire, esta segunda consulta desaparece.
     */
    const enTabla = await this.tokenEnTabla(organizationId, pixelId, clientId);
    if (enTabla) return enTabla;

    const integration = await this.organizationIntegration(organizationId);
    return this.tokenDePixel(integration, pixelId, clientId);
  }

  /**
   * Guarda o reemplaza la credencial de un Pixel, sin tocar a qué empresa está asignado.
   *
   * Es la mitad que faltaba: cambiar un token obligaba a reescribir la asignación entera, y no
   * había forma de registrar un Pixel que ninguna empresa usara todavía —el que una campaña
   * necesita cuando se aparta del de su empresa—.
   *
   * Se valida contra Meta antes de guardar: un token que no abre ese Pixel, guardado en
   * silencio, reaparece días después como una cola de eventos fallidos.
   */
  async guardarCredencial(
    organizationId: string,
    pixelId: string,
    datos: { name?: string; accessToken?: string },
  ): Promise<{ pixelId: string; name: string | null; tokenConfigured: boolean; verificado: boolean; motivo?: string }> {
    const integration = await this.organizationIntegration(organizationId, true);
    if (!integration) throw new NotFoundException('Integración Meta no encontrada');

    const limpio = pixelId.trim();
    if (!limpio) throw new BadRequestException('Debes indicar el ID del Pixel');

    const nuevo = datos.accessToken?.trim();
    const token = nuevo || this.tokenDePixel(integration, limpio);
    if (!token) throw new BadRequestException('Se requiere un token CAPI para este Pixel');
    /*
     * Solo una credencial que Meta declara invalida impide guardar.
     *
     * La comprobacion lee la ficha del Pixel, y leer exige permisos que escribir eventos no: un
     * token de la API de Conversiones suele poder `POST /events` y no ese `GET`. Bloquear por
     * eso —o por un tiempo de espera agotado— dejaba sin configurar algo que funciona.
     */
    const verificacion = await this.pixels.verificarPixel(limpio, token);
    if (verificacion.bloquea) {
      throw new BadRequestException(`Meta rechazo la credencial: ${verificacion.motivo ?? 'token invalido'}`);
    }

    return this.integrations.manager.transaction(async (manager) => {
      const repo = manager.getRepository(Integration);
      const fresh = await repo.findOne({ where: { id: integration.id }, lock: { mode: 'pessimistic_write' } });
      if (!fresh) throw new NotFoundException('Integración Meta no encontrada');

      const actuales = this.credenciales(fresh);
      const previa = actuales[limpio];
      const credencial: PixelCredential = {
        name: datos.name?.trim() || previa?.name,
        // Sin token nuevo se conserva el que hubiera, incluido el de la forma antigua: así
        // registrar solo el nombre no deja el Pixel sin credencial.
        accessToken: nuevo ? protectSecret(nuevo) : previa?.accessToken ?? this.tokenSinAmbiguedad(fresh, limpio),
        updatedAt: new Date().toISOString(),
      };
      fresh.config = { ...fresh.config, metaPixels: { ...actuales, [limpio]: credencial } };
      await repo.save(fresh);
      return {
        pixelId: limpio,
        name: credencial.name ?? null,
        tokenConfigured: Boolean(credencial.accessToken),
        // Se guardo, pero no siempre pudo confirmarse contra Meta: la pantalla lo dice en vez de
        // dar por buena una credencial que quiza solo funcione a medias.
        verificado: verificacion.verificado,
        motivo: verificacion.verificado ? undefined : verificacion.motivo,
      };
    });
  }

  /**
   * Quita la credencial de un Pixel.
   *
   * No borra la asignación: una empresa puede seguir apuntando a ese Pixel y dejar de enviar, que
   * es distinto de no tenerlo. Se usa cuando el Pixel deja de ser tuyo, o cuando el token se
   * filtró y prefieres cortar antes que reemplazar.
   *
   * Si ese Pixel conserva un token de la forma antigua —dentro de una empresa—, se avisa en vez
   * de fingir que se cortó: seguiría enviando y nadie lo sabría.
   */
  async quitarCredencial(organizationId: string, pixelId: string): Promise<{ pixelId: string; quedaHeredado: boolean }> {
    const integration = await this.organizationIntegration(organizationId);
    if (!integration) throw new NotFoundException('Integración Meta no encontrada');

    return this.integrations.manager.transaction(async (manager) => {
      const repo = manager.getRepository(Integration);
      const fresh = await repo.findOne({ where: { id: integration.id }, lock: { mode: 'pessimistic_write' } });
      if (!fresh) throw new NotFoundException('Integración Meta no encontrada');

      const { [pixelId]: quitada, ...resto } = this.credenciales(fresh);
      if (!quitada) throw new NotFoundException('Ese Pixel no tiene credencial registrada');
      fresh.config = { ...fresh.config, metaPixels: resto };
      await repo.save(fresh);
      return { pixelId, quedaHeredado: Boolean(this.tokenSinAmbiguedad(fresh, pixelId)) };
    });
  }

  /**
   * El token de la forma antigua para un Pixel, **solo si no hay duda de cuál es**.
   *
   * Se usa en administración —registrar la credencial de un Pixel sin escribir el token otra vez,
   * y avisar de si al quitarla queda alguna heredada—, no para enviar.
   *
   * La regla es la ambigüedad, no la lectura. Si una sola empresa tiene credencial para ese
   * Pixel, adoptarla es lo que quien administra espera. Si la tienen dos, elegir una sería lo que
   * hacía antes: quedarse con la primera del JSON, o sea con la que salga.
   *
   * Devuelve el texto cifrado tal cual, para poder mudarlo sin descifrarlo.
   */
  private tokenSinAmbiguedad(integration: Integration, pixelId: string): string | undefined {
    const conEsePixel = Object.values(this.records(integration)).filter((item) => (
      item.pixelId === pixelId && item.accessToken
    ));
    return conEsePixel.length === 1 ? conEsePixel[0].accessToken : undefined;
  }
}
