import { describe, expect, it, vi } from 'vitest';
import { PerfilesService, type ContextoDePerfiles } from '../../../src/modules/users/perfiles/perfiles.service';

/**
 * La pantalla que contesta «¿por qué esta persona ve esto?».
 *
 * Sin ella el modelo de perfiles no se puede administrar: quien reparte accesos no puede
 * comprobar lo que repartió. Y la Ley 21.719 no pide una pantalla, pide poder **demostrar** que
 * el acceso está limitado; esto es la demostración.
 *
 * Lo que estas pruebas defienden es la distinción que la hace útil: de dónde viene cada cosa.
 * Lo que trae el perfil se revisa en grupo; lo que alguien escribió para una persona concreta se
 * revisa una por una, y es donde aparecen los accesos que nadie recuerda haber dado.
 */
const ORG = 'org-1';
const EMPRESA = 'empresa-a';
const CTX: ContextoDePerfiles = { organizationId: ORG, clientId: EMPRESA, actorId: 'admin', esAgencia: false };

function montar(opciones: {
  perfil?: { id: string; nombre: string; areas: Record<string, string>; datosProtegidos: Record<string, string> } | null;
  extras?: Array<{ action: string; allowed: boolean; reason?: string; grantedBy?: string; expiresAt?: Date | null }>;
  pertenece?: boolean;
}) {
  const perfil = opciones.perfil === undefined
    ? { id: 'p1', nombre: 'Anfitrión', areas: { 'reservations.turno': 'hacer' }, datosProtegidos: { reservations: 'bajo_registro' } }
    : opciones.perfil;

  const asignaciones = {
    findOne: vi.fn().mockResolvedValue(perfil ? { perfilId: perfil.id, asignadoPor: 'u-jefe' } : null),
  };
  const perfiles = { findOne: vi.fn().mockResolvedValue(perfil) };
  const usuarios = {
    findOne: vi.fn().mockResolvedValue({ id: 'u1', name: 'Carla', email: 'carla@local.cl' }),
    find: vi.fn().mockResolvedValue([{ id: 'u-jefe', name: 'Pablo' }]),
  };
  const extras = { find: vi.fn().mockResolvedValue(opciones.extras ?? []) };
  // `perteneceAEmpresa` consulta las cesiones; por defecto la persona es del equipo.
  const accesos = { findOne: vi.fn().mockResolvedValue(opciones.pertenece === false ? null : { userId: 'u1' }), find: vi.fn().mockResolvedValue([]) };

  const servicio = new PerfilesService(
    perfiles as never, asignaciones as never, {} as never, usuarios as never, accesos as never,
    {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, extras as never,
  );
  // `perteneceAEmpresa` mira varias cosas según la implementación; se fija aquí para que estas
  // pruebas hablen de lo que explican y no de la pertenencia, que tiene las suyas.
  vi.spyOn(servicio, 'perteneceAEmpresa').mockResolvedValue(opciones.pertenece !== false);
  return servicio;
}

describe('qué ve una persona', () => {
  it('dice su perfil y quién se lo asignó', async () => {
    const vista = await montar({}).queVe(CTX, 'u1');

    expect(vista.nombre).toBe('Carla');
    expect(vista.perfil?.nombre).toBe('Anfitrión');
    expect(vista.asignadoPor).toBe('Pablo');
    expect(vista.sinPerfil).toBe(false);
  });

  it('lo que trae el perfil se marca como del perfil', async () => {
    const vista = await montar({}).queVe(CTX, 'u1');
    const turno = vista.areas.find((area) => area.clave === 'reservations.turno');

    expect(turno?.nivel).toBe('hacer');
    expect(turno?.origen).toBe('perfil');
    expect(turno?.porQuien).toBeNull();
  });

  /*
   * La distinción que justifica la pantalla: una excepción concedida a mano se revisa, y para
   * revisarla hace falta saber quién la dio, por qué y hasta cuándo.
   */
  it('una excepción concedida dice quién la dio, por qué y cuándo vence', async () => {
    const vence = new Date(Date.now() + 86_400_000);
    const vista = await montar({
      extras: [{ action: 'reservations.cupones', allowed: true, reason: 'cubre vacaciones', grantedBy: 'u-jefe', expiresAt: vence }],
    }).queVe(CTX, 'u1');
    const cupones = vista.areas.find((area) => area.clave === 'reservations.cupones');

    expect(cupones?.origen).toBe('concedido');
    expect(cupones?.nivel).toBe('hacer');
    expect(cupones?.motivo).toBe('cubre vacaciones');
    expect(cupones?.porQuien).toBe('Pablo');
    expect(cupones?.venceEl).toBe(vence.toISOString());
  });

  it('una excepción que quita se ve como quitada, no como ausente', async () => {
    const vista = await montar({
      perfil: { id: 'p1', nombre: 'Anfitrión', areas: { 'reservations.turno': 'hacer' }, datosProtegidos: {} },
      extras: [{ action: 'reservations.turno', allowed: false, reason: 'en formación', grantedBy: 'u-jefe' }],
    }).queVe(CTX, 'u1');
    const turno = vista.areas.find((area) => area.clave === 'reservations.turno');

    expect(turno?.origen).toBe('quitado');
    expect(turno?.nivel).toBe('ninguno');
    expect(turno?.motivo).toBe('en formación');
  });

  it('una excepción vencida no aparece como vigente', async () => {
    const vista = await montar({
      extras: [{ action: 'reservations.cupones', allowed: true, expiresAt: new Date(Date.now() - 1000) }],
    }).queVe(CTX, 'u1');

    expect(vista.areas.find((area) => area.clave === 'reservations.cupones')).toBeUndefined();
    expect(vista.avisoDeExtrasGlobales).toBe(false);
  });

  /*
   * Sin perfil manda el permiso de módulo, que es el comportamiento anterior. Decirlo evita que
   * una lista vacía se lea como «no ve nada», que es lo contrario de la verdad.
   */
  it('sin perfil lo dice, en vez de mostrar una lista vacía', async () => {
    const vista = await montar({ perfil: null }).queVe(CTX, 'u1');

    expect(vista.sinPerfil).toBe(true);
    expect(vista.perfil).toBeNull();
  });

  it('el nivel de datos protegidos sale por módulo, y lo ausente queda oculto', async () => {
    const vista = await montar({
      perfil: { id: 'p1', nombre: 'Ejecutivo', areas: {}, datosProtegidos: { crm: 'directo' } },
    }).queVe(CTX, 'u1');

    expect(vista.datosProtegidos.find((d) => d.modulo === 'crm')?.nivel).toBe('directo');
    expect(vista.datosProtegidos.find((d) => d.modulo === 'reservations')?.nivel).toBe('oculto');
    expect(vista.datosProtegidos.find((d) => d.modulo === 'reservations')?.incluyeSensibles).toBe(true);
  });

  /*
   * `user_action_override` guarda organización y persona, no empresa, así que una excepción
   * alcanza a esa persona en todas las empresas que atiende. Quien revisa tiene que saberlo:
   * creer que concedió algo en un local y haberlo concedido en los tres es el error que esta
   * pantalla existe para evitar.
   */
  it('avisa cuando hay excepciones, porque no distinguen empresa', async () => {
    const vista = await montar({ extras: [{ action: 'reservations.cupones', allowed: true }] }).queVe(CTX, 'u1');
    expect(vista.avisoDeExtrasGlobales).toBe(true);
  });

  it('no explica a quien no es del equipo de esa empresa', async () => {
    await expect(montar({ pertenece: false }).queVe(CTX, 'u1')).rejects.toThrow(/no pertenece/);
  });
});
