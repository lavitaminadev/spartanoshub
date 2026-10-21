import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Client } from '../clients/client.entity';
import { ActualizarVulneracionDto, CrearVulneracionDto } from './dto/vulneracion.dto';
import { plazoDeAviso } from './plazo-de-aviso';
import { Vulneracion } from './vulneracion.entity';

@Injectable()
export class VulneracionesService {
  constructor(
    @InjectRepository(Vulneracion) private readonly repo: Repository<Vulneracion>,
    @InjectRepository(Client) private readonly clients: Repository<Client>,
  ) {}

  async listar(organizationId: string) {
    const filas = await this.repo.find({ where: { organizationId }, order: { detectedAt: 'DESC' } });
    const ids = [...new Set(filas.flatMap((fila) => fila.clientIds ?? []))];
    const empresas = ids.length ? await this.clients.find({ where: { id: In(ids), organizationId }, select: { id: true, name: true } }) : [];
    const nombres = new Map(empresas.map((empresa) => [empresa.id, empresa.name]));
    return filas.map((fila) => this.presentar(fila, nombres));
  }

  async crear(organizationId: string, actorId: string | undefined, dto: CrearVulneracionDto) {
    const detectedAt = this.fecha(dto.detectedAt, 'detectedAt');
    this.noFutura(detectedAt);
    const clientIds = await this.empresasValidas(organizationId, dto.clientIds ?? []);
    const fila = this.repo.create({
      organizationId,
      descripcion: dto.descripcion.trim(),
      detectedAt,
      datosAfectados: dto.datosAfectados.trim(),
      titularesAfectados: dto.titularesAfectados ?? null,
      clientIds,
      medidas: dto.medidas?.trim() || null,
      avisoLocalAt: dto.avisoLocalAt ? this.fecha(dto.avisoLocalAt, 'avisoLocalAt') : null,
      avisoAgenciaAt: dto.avisoAgenciaAt ? this.fecha(dto.avisoAgenciaAt, 'avisoAgenciaAt') : null,
      createdBy: actorId ?? null,
    });
    return this.presentar(await this.repo.save(fila));
  }

  async actualizar(organizationId: string, id: string, dto: ActualizarVulneracionDto) {
    const fila = await this.repo.findOne({ where: { id, organizationId } });
    if (!fila) throw new NotFoundException('Vulneración no encontrada');
    if (dto.descripcion !== undefined) fila.descripcion = dto.descripcion.trim();
    if (dto.detectedAt !== undefined) {
      fila.detectedAt = this.fecha(dto.detectedAt, 'detectedAt');
      this.noFutura(fila.detectedAt);
    }
    if (dto.datosAfectados !== undefined) fila.datosAfectados = dto.datosAfectados.trim();
    if (dto.titularesAfectados !== undefined) fila.titularesAfectados = dto.titularesAfectados;
    if (dto.clientIds !== undefined) fila.clientIds = await this.empresasValidas(organizationId, dto.clientIds);
    if (dto.medidas !== undefined) fila.medidas = dto.medidas.trim() || null;
    if (dto.avisoLocalAt !== undefined) fila.avisoLocalAt = this.fecha(dto.avisoLocalAt, 'avisoLocalAt');
    if (dto.avisoAgenciaAt !== undefined) fila.avisoAgenciaAt = this.fecha(dto.avisoAgenciaAt, 'avisoAgenciaAt');
    return this.presentar(await this.repo.save(fila));
  }

  private presentar(fila: Vulneracion, nombres?: Map<string, string>) {
    const plazo = plazoDeAviso(fila.detectedAt, fila.avisoLocalAt);
    return {
      id: fila.id,
      descripcion: fila.descripcion,
      detectedAt: fila.detectedAt,
      datosAfectados: fila.datosAfectados,
      titularesAfectados: fila.titularesAfectados ?? null,
      clientIds: fila.clientIds ?? [],
      empresas: (fila.clientIds ?? []).map((id) => ({ id, name: nombres?.get(id) ?? null })),
      medidas: fila.medidas ?? null,
      avisoLocalAt: fila.avisoLocalAt ?? null,
      avisoAgenciaAt: fila.avisoAgenciaAt ?? null,
      plazo: { vence: plazo.vence, horasRestantes: Math.round(plazo.horasRestantes * 10) / 10, estado: plazo.estado },
      createdAt: fila.createdAt,
    };
  }

  private fecha(valor: string, campo: string): Date {
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) throw new BadRequestException(`Fecha inválida en ${campo}`);
    return fecha;
  }

  private noFutura(fecha: Date): void {
    if (fecha.getTime() > Date.now() + 5 * 60_000) throw new BadRequestException('La fecha de detección no puede ser futura');
  }

  private async empresasValidas(organizationId: string, ids: string[]): Promise<string[]> {
    const unicos = [...new Set(ids)];
    if (!unicos.length) return [];
    const encontradas = await this.clients.count({ where: { id: In(unicos), organizationId } });
    if (encontradas !== unicos.length) throw new BadRequestException('Alguna empresa indicada no existe en esta organización');
    return unicos;
  }
}
