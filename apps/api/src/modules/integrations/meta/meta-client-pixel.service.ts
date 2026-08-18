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
    return this.catalogRows(organizationId, this.records(integration));
  }

  private async catalogRows(organizationId: string, records: Record<string, ClientPixelRecord>) {
    const clients = await this.clients.find({ where: { organizationId }, order: { name: 'ASC' } });
    return clients.map((client) => ({
      clientId: client.id,
      clientName: client.name,
      pixelId: records[client.id]?.pixelId || null,
      pixelName: records[client.id]?.pixelName || null,
      tokenConfigured: Boolean(records[client.id]?.accessToken || process.env.META_CONVERSIONS_ACCESS_TOKEN),
      configuredAt: records[client.id]?.configuredAt || null,
    }));
  }

  async catalog(organizationId: string) {
    const integration = await this.organizationIntegration(organizationId);
    const records = integration ? this.records(integration) : {};
    const bindings = await this.catalogRows(organizationId, records);
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
        tokenConfigured: Boolean(record?.accessToken || process.env.META_CONVERSIONS_ACCESS_TOKEN),
      };
    });
    return { bindings, pixels };
  }

  async configure(id: string, organizationId: string, clientId: string, pixelId: string, accessToken?: string, pixelName?: string) {
    const integration = await this.integration(id, organizationId);
    return this.configureRecord(integration, organizationId, clientId, pixelId, accessToken, pixelName);
  }

  private async configureRecord(integration: Integration, organizationId: string, clientId: string, pixelId: string, accessToken?: string, pixelName?: string) {
    const client = await this.clients.findOne({ where: { id: clientId, organizationId } });
    if (!client) throw new NotFoundException('Cliente no encontrado');
    const existing = this.records(integration)[clientId];
    const token = accessToken?.trim() || revealSecret(existing?.accessToken) || process.env.META_CONVERSIONS_ACCESS_TOKEN;
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
        accessToken: accessToken?.trim() ? protectSecret(accessToken.trim()) : current?.accessToken,
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
      accessToken: revealSecret(record?.accessToken) || process.env.META_CONVERSIONS_ACCESS_TOKEN,
    };
  }

  async resolveByPixel(organizationId: string, pixelId: string): Promise<string | undefined> {
    const integration = await this.organizationIntegration(organizationId);
    const record = integration ? Object.values(this.records(integration)).find((item) => item.pixelId === pixelId) : undefined;
    const token = (record?.accessToken ? revealSecret(record.accessToken) : undefined) || process.env.META_CONVERSIONS_ACCESS_TOKEN;
    return token || undefined;
  }
}
