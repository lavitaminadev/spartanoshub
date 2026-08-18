import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutboxProcessor, type FailureVerdict } from '../../../core/outbox/outbox-processor.base';
import { GoogleConversionOutbox } from './google-conversion-outbox.entity';
import { GoogleClickConversion, GoogleConversionsService } from './google-conversions.service';
import { Integration } from '../integration.entity';
import { IntegrationAccount } from '../integration-account.entity';
import { IntegrationAccountType } from '../integration-account-type.enum';
import { IntegrationProvider } from '../integration-provider.enum';
import { revealSecret } from '../../../shared/security/integration-secrets';
import { GoogleOAuthService } from './google-oauth.service';

/** Config de Google Ads resuelta para un cliente y un tipo de evento. */
export interface ResolvedAdsConversionConfig {
  customerId: string;
  conversionAction: string;
}

@Injectable()
export class GoogleConversionOutboxService extends OutboxProcessor<GoogleConversionOutbox> {
  protected readonly logger = new Logger(GoogleConversionOutboxService.name);
  protected readonly entity = GoogleConversionOutbox;
  protected readonly label = 'Google Ads';

  constructor(
    @InjectRepository(GoogleConversionOutbox) protected readonly repository: Repository<GoogleConversionOutbox>,
    @InjectRepository(Integration) private readonly integrations: Repository<Integration>,
    @InjectRepository(IntegrationAccount) private readonly accounts: Repository<IntegrationAccount>,
    private readonly conversions: GoogleConversionsService,
    private readonly oauth: GoogleOAuthService,
  ) {
    super();
  }

  /**
   * Resuelve la cuenta de Google Ads del cliente y la acción de conversión
   * configurada para ese tipo de evento.
   *
   * La configuración vive en `IntegrationAccount.metadata.conversionActions`,
   * un mapa `{ [eventKey]: conversionActionId }`. Devuelve null si el cliente
   * no tiene Ads conectado o no configuró la acción, para que el llamador
   * simplemente omita el envío en vez de fallar la reserva.
   */
  async resolveConfig(organizationId: string, clientId: string, eventKey: string): Promise<ResolvedAdsConversionConfig | null> {
    const integration = await this.integrations.findOne({
      where: { organizationId, provider: IntegrationProvider.GOOGLE },
    });
    if (!integration) return null;

    const accounts = await this.accounts.find({
      where: { integrationId: integration.id, accountType: IntegrationAccountType.AD_ACCOUNT },
    });
    const account = accounts.find((item) => item.metadata?.clientId === clientId) ?? accounts[0];
    if (!account) return null;

    const actionId = account.metadata?.conversionActions?.[eventKey];
    if (!actionId) return null;

    const customerId = account.externalId.replace(/\D/g, '');
    return {
      customerId,
      conversionAction: `customers/${customerId}/conversionActions/${actionId}`,
    };
  }

  async enqueue(
    organizationId: string,
    config: ResolvedAdsConversionConfig,
    eventId: string,
    conversion: Omit<GoogleClickConversion, 'conversionAction'>,
  ): Promise<GoogleConversionOutbox> {
    if (!eventId) throw new Error('A stable eventId is required for Google Ads conversions');
    const existing = await this.repository.findOne({ where: { organizationId, eventId } });
    if (existing) return existing;
    return this.repository.save(this.repository.create({
      organizationId,
      eventId,
      customerId: config.customerId,
      conversionAction: config.conversionAction,
      conversionData: { ...conversion, conversionDateTime: conversion.conversionDateTime.toISOString() },
    }));
  }

  /**
   * Conteo de conversiones por estado de la cola.
   *
   * `processing` corresponde a las reservadas por una ejecución en curso; un valor que no
   * baja entre consultas indica lotes que no están completando el envío.
   */
  async stats(): Promise<{ pending: number; retry: number; processing: number; failed: number; processed: number; total: number }> {
    const countBy = (status?: string) => this.repository.count({ where: status ? { status } : {} });
    const [pending, retry, processing, failed, processed, total] = await Promise.all([
      countBy('pending'),
      countBy('retry'),
      countBy('processing'),
      countBy('failed'),
      countBy('processed'),
      countBy(),
    ]);
    return { pending, retry, processing, failed, processed, total };
  }

  protected async send(item: GoogleConversionOutbox): Promise<void> {
    const token = await this.resolveAccessToken(item.organizationId);
    if (!token) throw new Error('Google integration is not connected');

    const data = item.conversionData as Record<string, any>;
    await this.conversions.uploadClickConversions(item.customerId, token, [{
      ...data,
      conversionAction: item.conversionAction,
      // La fecha viaja como texto en el JSON de la bandeja; el cliente de Google la espera
      // como fecha.
      conversionDateTime: new Date(data.conversionDateTime),
    } as GoogleClickConversion]);
  }

  /**
   * Un payload malformado o una acción de conversión inexistente no se arreglan reintentando;
   * un 429 o un 5xx sí.
   *
   * Google no devuelve un código estable en estos casos, así que se reconoce por el texto. Es
   * menos robusto que mirar un código —lo que sí puede hacerse con Meta— pero es lo que la API
   * entrega.
   */
  protected classifyFailure(error: unknown): FailureVerdict {
    const message = error instanceof Error ? error.message : 'Unknown Google Ads error';
    const isNonRetryable = /INVALID_ARGUMENT|NOT_FOUND|PERMISSION_DENIED|no se requiere|Se requiere un identificador/i.test(message);
    const isExpiredToken = /expired|invalid.*token|unauthorized|UNAUTHENTICATED/i.test(message);

    return {
      retryable: !isNonRetryable && !isExpiredToken,
      tag: isExpiredToken ? '[TOKEN]' : undefined,
    };
  }

  /** Obtiene un access token válido, refrescándolo si está por expirar. */
  private async resolveAccessToken(organizationId: string): Promise<string | undefined> {
    let integration = await this.integrations.findOne({
      where: { organizationId, provider: IntegrationProvider.GOOGLE },
    });
    if (!integration) return undefined;

    const expiry = typeof integration.config?.expiryDate === 'string' ? Date.parse(integration.config.expiryDate) : Number.NaN;
    if (Number.isFinite(expiry) && expiry <= Date.now() + 60_000) {
      integration = await this.oauth.refreshIntegration(integration.id, organizationId);
    }
    return revealSecret(typeof integration?.config?.accessToken === 'string' ? integration.config.accessToken : undefined);
  }
}
