import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { IngestLeadDto } from '../../../src/modules/crm/leads/dto/ingest-lead.dto';
import { normalizarCuerpoEntrada } from '../../../src/modules/crm/leads/normalizar-cuerpo-entrada';

/** Cuerpo tal como lo arma un escenario de Make sobre Facebook Lead Ads. */
const CUERPO_DE_META = {
  full_name: 'Juan Pérez',
  phone_number: '+56912345678',
  email: 'Juan@Email.com',
  leadgen_id: '123456789012345',
  created_time: '2026-08-21T15:30:00+0000',
  // Lo que Meta agrega por su cuenta y no podemos declarar: cambia con cada formulario.
  form_id: '987654321',
  campaign_id: '2233445566',
  ad_id: '6677889900',
  ciudad: 'Santiago',
};

/** El recorrido real: se traduce y después se valida, que es lo que hace el controlador. */
function recibir(cuerpo: Record<string, unknown>) {
  const dto = plainToInstance(IngestLeadDto, normalizarCuerpoEntrada(cuerpo));
  return { dto, errores: validateSync(dto, { whitelist: true }) };
}

describe('Entrada de leads · el cuerpo que manda Meta', () => {
  it('acepta el cuerpo de Meta con sus nombres y sus campos de más', () => {
    const { errores } = recibir(CUERPO_DE_META);

    // Antes fallaba dos veces: por traer campos no declarados y porque `nombre` llegaba vacío.
    expect(errores.map((e) => e.property), JSON.stringify(errores)).toEqual([]);
  });

  it('traduce los nombres de Meta a los campos del dominio', () => {
    const { dto } = recibir(CUERPO_DE_META);

    expect(dto.nombre).toBe('Juan Pérez');
    expect(dto.telefono).toBe('+56912345678');
    // En minúsculas: el mismo buzón escrito con mayúsculas no puede entrar como otra persona.
    expect(dto.email).toBe('juan@email.com');
    // Es lo que evita que un reintento de Make convierta un lead en tres.
    expect(dto.idExterno).toBe('123456789012345');
    expect(dto.fechaOrigen).toBe('2026-08-21T15:30:00+0000');
  });

  it('descarta lo que no conoce en vez de arrastrarlo al dominio', () => {
    const { dto } = recibir(CUERPO_DE_META);

    expect(Object.keys(dto)).not.toContain('form_id');
    expect(Object.keys(dto)).not.toContain('ciudad');
    expect(Object.keys(dto)).not.toContain('ad_id');
  });

  it('sigue aceptando los nombres en español, que es lo que ya usaba Zapier', () => {
    const { dto, errores } = recibir({ nombre: 'Ana Rojas', telefono: '+56911111111' });

    expect(errores).toEqual([]);
    expect(dto.nombre).toBe('Ana Rojas');
  });

  it('prefiere el identificador específico sobre un `id` genérico', () => {
    // Muchos sistemas mandan un `id` propio que no identifica al lead; el de Meta manda.
    const { dto } = recibir({ nombre: 'Ana', leadgen_id: 'meta-1', id: 'otro-9' });

    expect(dto.idExterno).toBe('meta-1');
  });

  it('sigue exigiendo el nombre', () => {
    const { errores } = recibir({ email: 'juan@email.com' });

    expect(errores.map((e) => e.property)).toEqual(['nombre']);
  });

  it('rechaza un correo que no tiene forma de correo', () => {
    const { errores } = recibir({ full_name: 'Juan', email: 'juan[arroba]email.com' });

    expect(errores.map((e) => e.property)).toEqual(['email']);
  });
});

describe('Entrada de leads · atribución del anuncio', () => {
  it('acepta formulario, campaña, anuncio y página con los nombres de Meta', () => {
    const { dto, errores } = recibir({
      full_name: 'Ana Rojas',
      email: 'ana@correo.cl',
      form_id: '987654321',
      campaign_id: '2233445566',
      ad_id: '6677889900',
      page_id: '1122334455',
    });

    expect(errores).toEqual([]);
    // Son las mismas cuatro columnas que llena el webhook firmado: un lead debe verse igual
    // sin importar por cuál de los dos caminos entró.
    expect(dto.formId).toBe('987654321');
    expect(dto.campanaId).toBe('2233445566');
    expect(dto.anuncioId).toBe('6677889900');
    expect(dto.paginaId).toBe('1122334455');
  });

  it('acepta también los nombres en español y en camello', () => {
    const { dto } = recibir({ nombre: 'Ana', email: 'a@b.cl', campanaId: 'c1', adId: 'a1' });

    expect(dto.campanaId).toBe('c1');
    expect(dto.anuncioId).toBe('a1');
  });

  it('sigue entrando sin atribución', () => {
    const { dto, errores } = recibir({ nombre: 'Ana', email: 'a@b.cl' });

    expect(errores).toEqual([]);
    expect(dto.formId).toBeUndefined();
  });
});
