import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from '../../clients/client.entity';
import { Integration } from '../integration.entity';
import { MetaClientPixelService } from './meta-client-pixel.service';
import { MetaPixel } from './meta-pixel.entity';
import { MetaPixelService } from './meta-pixel.service';

/**
 * Los Pixels de Meta y a qué empresa pertenece cada uno.
 *
 * Está separado de `MetaModule` para que se pueda usar desde el CRM sin arrastrar un ciclo:
 * `MetaModule` depende del CRM —los leads de Meta entran por `LeadIntakeService`— y las campañas
 * necesitan comprobar su Pixel antes de guardarlo. Importar uno desde el otro obligaría a un
 * `forwardRef` en ambos lados, que funciona hasta que alguien mueve un proveedor y el contenedor
 * falla al arrancar, no al compilar.
 *
 * Aquí dentro no hay nada que sepa de leads ni de reservas: sólo el registro de Pixels, sus
 * credenciales y la regla de que cada empresa mide en el suyo.
 */
@Module({
  imports: [HttpModule, TypeOrmModule.forFeature([Integration, Client, MetaPixel])],
  providers: [MetaPixelService, MetaClientPixelService],
  exports: [MetaPixelService, MetaClientPixelService],
})
export class MetaPixelsModule {}
