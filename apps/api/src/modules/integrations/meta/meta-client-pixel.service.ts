import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '../../clients/client.entity';
import { protectSecret, revealSecret } from '../../../shared/security/integration-secrets';
import { Integration } from '../integration.entity';
import { IntegrationProvider } from '../integration-provider.enum';
import { IntegrationStatus } from '../integration-status.enum';
import { MetaPixelService } from './meta-pixel.service';

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
   * Token con el que se escribe en un Pixel.
   *
   * En este orden: la credencial del Pixel, la que quedó dentro de alguna empresa que lo usa
   * —compatibilidad con lo ya configurado—, y el token del entorno como último recurso. Ese
   * último casi nunca sirve: pertenece a otra cuenta publicitaria y Meta rechaza el evento.
   */
  private tokenDePixel(integration: Integration | null, pixelId: string): string | undefined {
    if (!integration) return process.env.META_CONVERSIONS_ACCESS_TOKEN || undefined;
    const credencial = this.credenciales(integration)[pixelId];
    if (credencial?.accessToken) return revealSecret(credencial.accessToken);
    const heredado = Object.values(this.records(integration)).find((item) => (
      item.pixelId === pixelId && item.accessToken
    ));
    return revealSecret(heredado?.accessToken) || process.env.META_CONVERSIONS_ACCESS_TOKEN || undefined;
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
    return { bindings, pixels: [...pixels, ...sinAsignar] };
  }

  async configure(id: string, organizationId: string, clientId: string, pixelId: string, accessToken?: string, pixelName?: string) {
    const integration = await this.integration(id, organizationId);
    return this.configureRecord(integration, organizationId, clientId, pixelId, accessToken, pixelName);
  }

  private async configureRecord(integration: Integration, organizationId: string, clientId: string, pixelId: string, accessToken?: string, pixelName?: string) {
    const client = await this.clients.findOne({ where: { id: clientId, organizationId } });
    if (!client) throw new NotFoundException('Cliente no encontrado');
    const existing = this.records(integration)[clientId];
    const token = accessToken?.trim() || this.tokenDePixel(integration, pixelId);
    if (!token) throw new BadRequestException('Se requiere un token CAPI para este cliente');

    // La validación va antes de abrir la transacción: es una llamada a Meta que puede tardar
    // segundos, y hacerla con la fila bloqueada dejaría esperando a cualquier otra
    // configuración de la misma organización.
    if (!await this.pixels.validatePixel(pixelId, token)) throw new BadRequestException('Meta no reconoció el Pixel con el token entregado');

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
      return this.mutateRecords(integration.id, (records) => {
        const source = Object.values(records).find((record) => record.pixelId === input.existingPixelId);
        if (!source) throw new BadRequestException('El Pixel existente no está disponible en esta organización');
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
        ? this.tokenDePixel(integration, record.pixelId)
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
    const registro = integration
      ? Object.values(this.records(integration)).find((item) => item.pixelId === pixelId)
      : undefined;
    const propioToken = revealSecret(registro?.accessToken);
    if (propioToken) return { pixelId, pixelName: registro?.pixelName ?? null, accessToken: propioToken, pixelSource, tokenSource: 'pixel' };

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
      pixelName: registro?.pixelName ?? null,
      accessToken: entorno,
      pixelSource,
      tokenSource: entorno ? 'environment' : 'none',
    };
  }

  async resolveByPixel(organizationId: string, pixelId: string): Promise<string | undefined> {
    const integration = await this.organizationIntegration(organizationId);
    return this.tokenDePixel(integration, pixelId);
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
  ): Promise<{ pixelId: string; name: string | null; tokenConfigured: boolean }> {
    const integration = await this.organizationIntegration(organizationId, true);
    if (!integration) throw new NotFoundException('Integración Meta no encontrada');

    const limpio = pixelId.trim();
    if (!limpio) throw new BadRequestException('Debes indicar el ID del Pixel');

    const nuevo = datos.accessToken?.trim();
    const token = nuevo || this.tokenDePixel(integration, limpio);
    if (!token) throw new BadRequestException('Se requiere un token CAPI para este Pixel');
    if (!await this.pixels.validatePixel(limpio, token)) {
      throw new BadRequestException('Meta no reconoció el Pixel con el token entregado');
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
        accessToken: nuevo ? protectSecret(nuevo) : previa?.accessToken ?? this.tokenGuardadoEnEmpresa(fresh, limpio),
        updatedAt: new Date().toISOString(),
      };
      fresh.config = { ...fresh.config, metaPixels: { ...actuales, [limpio]: credencial } };
      await repo.save(fresh);
      return { pixelId: limpio, name: credencial.name ?? null, tokenConfigured: Boolean(credencial.accessToken) };
    });
  }

  /** El token que quedó dentro de una empresa, ya cifrado, para poder mudarlo tal cual. */
  private tokenGuardadoEnEmpresa(integration: Integration, pixelId: string): string | undefined {
    return Object.values(this.records(integration)).find((item) => (
      item.pixelId === pixelId && item.accessToken
    ))?.accessToken;
  }
}
