import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { asegurarQueNoConcedePorEncima, validarJuegos } from '../../../src/modules/users/perfiles/concesion';
import { InvitacionesService } from '../../../src/modules/users/perfiles/invitaciones.service';
import { PerfilesService, type ContextoDePerfiles } from '../../../src/modules/users/perfiles/perfiles.service';
import { AdministradoresDeEmpresaService } from '../../../src/modules/users/administradores-de-empresa.service';
import { UserRole } from '../../../src/modules/organizations/user-role.enum';

/*
 * Un repositorio en memoria con la parte de la API de TypeORM que usan los servicios. Sirve para
 * probar las reglas —quién concede qué, qué responde una invitación, qué suma aceptarla— sin base.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Fila = Record<string, any>;
let secuencia = 0;

class Tabla {
  filas: Fila[] = [];
  constructor(inicial: Fila[] = []) {
    this.filas = inicial.map((fila) => ({ id: `id-${++secuencia}`, ...fila }));
  }
  private coincide(fila: Fila, where: Fila = {}): boolean {
    return Object.entries(where).every(([clave, valor]) => {
      const tipo = valor && typeof valor === 'object' ? (valor._type ?? valor.type) : undefined;
      if (tipo === 'isNull') return fila[clave] == null;
      if (tipo === 'in') return (valor._value ?? valor.value).includes(fila[clave]);
      return fila[clave] === valor;
    });
  }
  find = async (opciones: Fila = {}) => this.filas.filter((fila) => this.coincide(fila, opciones.where)).map((fila) => ({ ...fila }));
  findOne = async (opciones: Fila = {}) => {
    const fila = this.filas.find((candidata) => this.coincide(candidata, opciones.where));
    return fila ? { ...fila } : null;
  };
  count = async (opciones: Fila = {}) => this.filas.filter((fila) => this.coincide(fila, opciones.where)).length;
  create = (datos: Fila) => ({ ...datos });
  save = async (datos: Fila) => {
    const existente = datos.id ? this.filas.find((fila) => fila.id === datos.id) : undefined;
    if (existente) { Object.assign(existente, datos); return { ...existente }; }
    const nueva = { id: `id-${++secuencia}`, createdAt: new Date(), ...datos };
    this.filas.push(nueva);
    return { ...nueva };
  };
  update = async (where: Fila, parche: Fila) => { this.filas.filter((fila) => this.coincide(fila, where)).forEach((fila) => Object.assign(fila, parche)); };
  remove = async (datos: Fila) => { this.filas = this.filas.filter((fila) => fila.id !== datos.id); };
  delete = async (where: Fila) => { this.filas = this.filas.filter((fila) => !this.coincide(fila, where)); };
}

const ORG = 'org-1';
const PICADA = 'c-picada';
const OTRA = 'c-otra';
const CAPACIDADES = { reservations: true, crm: true, surveys: true, marketing: false };

const PERFIL_ADMIN = { id: 'p-admin', organizationId: ORG, clientId: PICADA, nombre: 'Jefe de local', areas: { 'reservations.turno': 'hacer', 'reservations.reservas': 'ver' }, datosProtegidos: { reservations: 'bajo_registro' } };
const PERFIL_ALTO = { id: 'p-alto', organizationId: ORG, clientId: PICADA, nombre: 'Dueño', areas: { 'reservations.turno': 'hacer', 'reservations.reservas': 'hacer', 'reservations.configurar': 'hacer' }, datosProtegidos: { reservations: 'directo' } };
const PERFIL_BAJO = { id: 'p-bajo', organizationId: ORG, clientId: PICADA, nombre: 'Garzón', areas: { 'reservations.turno': 'ver' }, datosProtegidos: {} };

const ADMIN = { id: 'u-admin', email: 'admin@picada.cl', name: 'Ana', role: UserRole.CLIENT, clientId: PICADA, organizationId: ORG, isActive: true };

function mundo(extra: { usuarios?: Fila[]; accesos?: Fila[]; asignaciones?: Fila[] } = {}) {
  const t = {
    perfiles: new Tabla([PERFIL_ADMIN, PERFIL_ALTO, PERFIL_BAJO]),
    asignaciones: new Tabla([{ organizationId: ORG, clientId: PICADA, userId: ADMIN.id, perfilId: PERFIL_ADMIN.id }, ...(extra.asignaciones ?? [])]),
    clientes: new Tabla([{ id: PICADA, organizationId: ORG, name: 'La Picada', capabilities: CAPACIDADES }, { id: OTRA, organizationId: ORG, name: 'Otra', capabilities: CAPACIDADES }]),
    usuarios: new Tabla([ADMIN, ...(extra.usuarios ?? []).map((u) => ({ organizationId: ORG, ...u }))]),
    accesos: new Tabla(extra.accesos ?? []),
    textos: new Tabla(),
    consentimientos: new Tabla(),
    invitaciones: new Tabla(),
  };
  const auditoria = { log: vi.fn(async () => undefined) };
  const permisos = { invalidateUser: vi.fn() };
  const administradores = { definir: vi.fn(async () => undefined), quienesAdministran: vi.fn(async () => [ADMIN.id, 'u-otro-admin']) };
  const correo = { send: vi.fn(async () => true) };
  const avisos = { notifyUser: vi.fn(async () => ({})), notifyMultiple: vi.fn(async () => []), notifyRole: vi.fn(async () => []) };
  const perfiles = new PerfilesService(t.perfiles as never, t.asignaciones as never, t.clientes as never, t.usuarios as never, t.accesos as never, t.textos as never, t.consentimientos as never, auditoria as never, permisos as never, administradores as never, t.invitaciones as never);
  const invitaciones = new InvitacionesService(t.invitaciones as never, t.usuarios as never, t.accesos as never, t.asignaciones as never, t.clientes as never, perfiles, correo as never, avisos as never, permisos as never, administradores as never);
  return { t, perfiles, invitaciones, correo, avisos, auditoria, administradores };
}

const comoAdmin: ContextoDePerfiles = { organizationId: ORG, clientId: PICADA, actorId: ADMIN.id, esAgencia: false, ip: '10.0.0.1' };
const comoAgencia: ContextoDePerfiles = { ...comoAdmin, actorId: 'u-agencia', esAgencia: true };

describe('nadie concede lo que no tiene', () => {
  it('la reja rechaza un área por encima del nivel de quien concede y deja pasar lo que alcanza', () => {
    const tope = { areas: { 'reservations.turno': 'ver' as const }, datos: { reservations: 'bajo_registro' as const } };
    expect(() => asegurarQueNoConcedePorEncima(tope, { 'reservations.turno': 'hacer' }, {})).toThrow(ForbiddenException);
    expect(() => asegurarQueNoConcedePorEncima(tope, { 'reservations.configurar': 'ver' }, {})).toThrow(ForbiddenException);
    expect(() => asegurarQueNoConcedePorEncima(tope, {}, { reservations: 'directo' })).toThrow(ForbiddenException);
    expect(() => asegurarQueNoConcedePorEncima(tope, { 'reservations.turno': 'ver' }, { reservations: 'bajo_registro' })).not.toThrow();
    expect(() => asegurarQueNoConcedePorEncima(tope, { 'reservations.turno': 'ninguno' }, { reservations: 'oculto' })).not.toThrow();
  });

  it('quien no tiene perfil en la empresa no concede nada, y la agencia no tiene tope', () => {
    expect(() => asegurarQueNoConcedePorEncima({ areas: {}, datos: {} }, { 'reservations.turno': 'ver' }, {})).toThrow(ForbiddenException);
    expect(() => asegurarQueNoConcedePorEncima(null, { 'reservations.configurar': 'hacer' }, { reservations: 'directo' })).not.toThrow();
  });

  it('el catálogo es cerrado: ni áreas inventadas ni niveles que el área no admite', () => {
    expect(() => validarJuegos({ 'reservations.inventada': 'ver' }, {})).toThrow(BadRequestException);
    expect(() => validarJuegos({ 'reservations.canjear_cupon': 'ver' }, {})).toThrow(BadRequestException);
    expect(() => validarJuegos({}, { reservations: 'total' as never })).toThrow(BadRequestException);
  });

  it('crear un perfil por encima del propio nivel se rechaza y por debajo se guarda', async () => {
    const { perfiles, t } = mundo();
    await expect(perfiles.crear(comoAdmin, { nombre: 'Nuevo', areas: { 'reservations.turno': 'hacer', 'reservations.reservas': 'hacer' } })).rejects.toThrow(ForbiddenException);
    expect(t.perfiles.filas.some((fila) => fila.nombre === 'Nuevo')).toBe(false);
    const ok = await perfiles.crear(comoAdmin, { nombre: 'Nuevo', areas: { 'reservations.turno': 'ver' } });
    expect(ok.areas).toEqual({ 'reservations.turno': 'ver' });
  });

  it('asignar un perfil por encima del propio se rechaza, y no se rebaja a quien está por encima', async () => {
    const jefe = { id: 'u-jefe', email: 'jefe@picada.cl', role: UserRole.CLIENT, clientId: PICADA, isActive: true };
    const { perfiles, t } = mundo({ usuarios: [jefe], asignaciones: [{ organizationId: ORG, clientId: PICADA, userId: jefe.id, perfilId: PERFIL_ALTO.id }] });
    await expect(perfiles.asignar(comoAdmin, jefe.id, PERFIL_BAJO.id)).rejects.toThrow(ForbiddenException);
    const otro = await t.usuarios.save({ email: 'otro@picada.cl', role: UserRole.CLIENT, clientId: PICADA });
    await expect(perfiles.asignar(comoAdmin, otro.id, PERFIL_ALTO.id)).rejects.toThrow(ForbiddenException);
    await perfiles.asignar(comoAdmin, otro.id, PERFIL_BAJO.id);
    expect(t.asignaciones.filas.find((fila) => fila.userId === otro.id)?.perfilId).toBe(PERFIL_BAJO.id);
  });

  it('invitar con un perfil por encima del propio se rechaza', async () => {
    const { invitaciones, t } = mundo();
    await expect(invitaciones.invitar(comoAdmin, { email: 'nuevo@x.cl', perfilId: PERFIL_ALTO.id }, ADMIN.id)).rejects.toThrow(ForbiddenException);
    expect(t.invitaciones.filas).toHaveLength(0);
  });

  it('la agencia puede dar lo que el catálogo y los módulos contratados permitan', async () => {
    const { perfiles } = mundo();
    await expect(perfiles.crear(comoAgencia, { nombre: 'Todo', areas: { 'reservations.configurar': 'hacer' } })).resolves.toBeTruthy();
    // El módulo de marketing no está contratado en esta empresa.
    await expect(perfiles.crear(comoAgencia, { nombre: 'Correo', areas: { 'marketing.campanas': 'ver' } })).rejects.toThrow(BadRequestException);
  });
});

describe('perfiles en uso', () => {
  it('guardar un perfil que otros usan exige haber dicho cuántos son', async () => {
    const { perfiles } = mundo();
    await expect(perfiles.actualizar(comoAdmin, PERFIL_ADMIN.id, { nombre: 'Jefe de local', areas: { 'reservations.turno': 'ver' } }))
      .rejects.toMatchObject({ response: { personas: 1 } });
    await expect(perfiles.actualizar(comoAdmin, PERFIL_ADMIN.id, { nombre: 'Jefe de local', areas: { 'reservations.turno': 'ver' }, confirmaPersonas: 1 })).resolves.toBeTruthy();
  });

  it('borrar un perfil en uso exige decir a quién pasan', async () => {
    const otro = { id: 'u-2', email: 'dos@picada.cl', role: UserRole.CLIENT, clientId: PICADA };
    const { perfiles, t } = mundo({ usuarios: [otro], asignaciones: [{ organizationId: ORG, clientId: PICADA, userId: otro.id, perfilId: PERFIL_BAJO.id }] });
    await expect(perfiles.borrar(comoAdmin, PERFIL_BAJO.id)).rejects.toThrow(ConflictException);
    expect(t.perfiles.filas.some((fila) => fila.id === PERFIL_BAJO.id)).toBe(true);
    await expect(perfiles.borrar(comoAdmin, PERFIL_BAJO.id, PERFIL_ALTO.id)).rejects.toThrow(ForbiddenException);
    await perfiles.borrar(comoAdmin, PERFIL_BAJO.id, PERFIL_ADMIN.id);
    expect(t.perfiles.filas.some((fila) => fila.id === PERFIL_BAJO.id)).toBe(false);
    expect(t.asignaciones.filas.find((fila) => fila.userId === otro.id)?.perfilId).toBe(PERFIL_ADMIN.id);
  });

  it('un perfil de otra empresa no se ve ni se toca', async () => {
    const { perfiles, t } = mundo();
    t.perfiles.filas.push({ id: 'p-ajeno', organizationId: ORG, clientId: OTRA, nombre: 'Ajeno', areas: {}, datosProtegidos: {} });
    await expect(perfiles.borrar(comoAdmin, 'p-ajeno')).rejects.toThrow(NotFoundException);
  });
});

describe('datos protegidos y aceptación', () => {
  it('subir datos del comensal exige aceptar el texto, y la aceptación queda con quién, cuándo y desde dónde', async () => {
    const { perfiles, t } = mundo();
    const datos = { reservations: 'bajo_registro' as const };
    await expect(perfiles.crear(comoAgencia, { nombre: 'Anfitrión', areas: { 'reservations.turno': 'ver' }, datosProtegidos: datos })).rejects.toMatchObject({ response: { requiereAceptacion: true } });
    const texto = await perfiles.textoDeConfidencialidad(ORG);
    await perfiles.crear(comoAgencia, { nombre: 'Anfitrión', areas: { 'reservations.turno': 'ver' }, datosProtegidos: datos, aceptacion: texto.id });
    expect(t.consentimientos.filas).toHaveLength(1);
    expect(t.consentimientos.filas[0]).toMatchObject({ userId: 'u-agencia', granted: true, ipAddress: '10.0.0.1' });
    expect(t.consentimientos.filas[0].action).toContain(texto.id);
    // El texto vive en ConsentVersion sin ser el vigente de los términos de uso.
    expect(t.textos.filas[0].active).toBe(false);
  });

  it('donde no hay datos de categoría especial no se pide aceptar', async () => {
    const { perfiles } = mundo();
    await expect(perfiles.crear(comoAgencia, { nombre: 'Comercial', areas: { 'crm.prospectos': 'ver' }, datosProtegidos: { crm: 'directo' } })).resolves.toBeTruthy();
  });
});

describe('invitar', () => {
  const existente = { id: 'u-ex', email: 'ya@tiene.cl', name: 'Ya', role: UserRole.CLIENT, clientId: OTRA, isActive: true };

  it('un correo con cuenta en otra empresa y uno nuevo reciben exactamente la misma respuesta', async () => {
    const { invitaciones, t, correo } = mundo({ usuarios: [existente] });
    const conCuenta = await invitaciones.invitar(comoAdmin, { email: 'ya@tiene.cl', perfilId: PERFIL_BAJO.id }, ADMIN.id);
    const sinCuenta = await invitaciones.invitar(comoAdmin, { email: 'nadie@tiene.cl', perfilId: PERFIL_BAJO.id }, ADMIN.id);
    const forma = (r: typeof conCuenta, email: string) => ({ ...r, email: r.email === email ? 'EL-CORREO' : r.email, venceEl: typeof r.venceEl });
    expect(forma(conCuenta, 'ya@tiene.cl')).toEqual(forma(sinCuenta, 'nadie@tiene.cl'));
    expect(conCuenta.estado).toBe('pendiente');
    // Lo escrito y lo enviado también es igual en los dos casos.
    expect(t.invitaciones.filas).toHaveLength(2);
    expect(Object.keys(t.invitaciones.filas[0]).sort()).toEqual(Object.keys(t.invitaciones.filas[1]).sort());
    expect(correo.send).toHaveBeenCalledTimes(2);
    expect(correo.send.mock.calls[0][1]).toBe(correo.send.mock.calls[1][1]);
  });

  it('un correo de la agencia tampoco se distingue: misma respuesta, y aceptar no suma nada', async () => {
    const interna = { id: 'u-int', email: 'cm@agencia.cl', name: 'CM', role: UserRole.COMMUNITY_MANAGER, clientId: null, isActive: true };
    const { invitaciones, t, correo } = mundo({ usuarios: [interna] });
    const respuesta = await invitaciones.invitar(comoAdmin, { email: 'cm@agencia.cl', perfilId: PERFIL_BAJO.id }, ADMIN.id);
    expect(respuesta.estado).toBe('pendiente');
    expect(correo.send).not.toHaveBeenCalled();
    expect(t.invitaciones.filas).toHaveLength(1);
  });

  it('un correo de la agencia que acepta con un enlace no queda sumado ni cambia de cargo', async () => {
    const interna = { id: 'u-int', email: 'cm@agencia.cl', name: 'CM', role: UserRole.COMMUNITY_MANAGER, clientId: null, isActive: true };
    const { invitaciones, t } = mundo({ usuarios: [interna] });
    await invitaciones.invitar(comoAdmin, { email: 'cm@agencia.cl', perfilId: PERFIL_BAJO.id }, ADMIN.id);
    // El enlace nunca salió, pero se prueba la defensa igual con uno fabricado.
    const crudo = 'a'.repeat(64);
    const { createHash } = await import('node:crypto');
    t.invitaciones.filas[0].tokenHash = createHash('sha256').update(crudo).digest('hex');
    await expect(invitaciones.aceptar(crudo, {})).rejects.toThrow(NotFoundException);
    expect(t.accesos.filas).toHaveLength(0);
    expect(t.asignaciones.filas.some((fila) => fila.userId === interna.id)).toBe(false);
    expect(t.usuarios.filas.find((fila) => fila.id === interna.id)?.role).toBe(UserRole.COMMUNITY_MANAGER);
  });

  it('invitar a quien ya está en esa empresa lo dice, porque es de su propia empresa', async () => {
    const { invitaciones } = mundo();
    await expect(invitaciones.invitar(comoAdmin, { email: ADMIN.email, perfilId: PERFIL_BAJO.id }, ADMIN.id)).rejects.toThrow('ya pertenece a tu equipo');
    const asignado = { id: 'u-as', email: 'as@x.cl', role: UserRole.CLIENT, clientId: OTRA, isActive: true };
    const m = mundo({ usuarios: [asignado], accesos: [{ organizationId: ORG, userId: asignado.id, clientId: PICADA }] });
    await expect(m.invitaciones.invitar(comoAdmin, { email: 'as@x.cl', perfilId: PERFIL_BAJO.id }, ADMIN.id)).rejects.toThrow(ConflictException);
  });

  it('una invitación nueva a la misma dirección deja sin efecto la anterior', async () => {
    const { invitaciones, t } = mundo();
    await invitaciones.invitar(comoAdmin, { email: 'n@x.cl', perfilId: PERFIL_BAJO.id }, ADMIN.id);
    await invitaciones.invitar(comoAdmin, { email: 'n@x.cl', perfilId: PERFIL_BAJO.id }, ADMIN.id);
    expect(t.invitaciones.filas.filter((fila) => !fila.revocadaEl)).toHaveLength(1);
    expect(await invitaciones.pendientes(comoAdmin)).toHaveLength(1);
  });
});

describe('aceptar', () => {
  const existente = { id: 'u-ex', email: 'ya@tiene.cl', name: 'Ya', role: UserRole.CLIENT, clientId: OTRA, isActive: true };

  function tokenDe(correo: { send: { mock: { calls: unknown[][] } } }, indice = 0): string {
    return /invitacion\/([0-9a-f]{64})/.exec(String(correo.send.mock.calls[indice][2]))![1];
  }

  it('si ya tenía cuenta se le suma la empresa, conserva la anterior y no se le cambia la activa', async () => {
    const m = mundo({ usuarios: [existente] });
    await m.invitaciones.invitar(comoAdmin, { email: 'ya@tiene.cl', perfilId: PERFIL_BAJO.id }, ADMIN.id);
    const resultado = await m.invitaciones.aceptar(tokenDe(m.correo), {});
    expect(resultado).toMatchObject({ empresaId: PICADA, cuentaNueva: false });
    const cuenta = m.t.usuarios.filas.find((fila) => fila.id === existente.id)!;
    expect(cuenta.clientId).toBe(OTRA);
    expect(m.t.accesos.filas.filter((fila) => fila.userId === existente.id).map((fila) => fila.clientId)).toEqual([PICADA]);
    expect(m.t.usuarios.filas.filter((fila) => fila.email === 'ya@tiene.cl')).toHaveLength(1);
    expect(m.t.asignaciones.filas.find((fila) => fila.userId === existente.id && fila.clientId === PICADA)?.perfilId).toBe(PERFIL_BAJO.id);
    expect(m.avisos.notifyUser).toHaveBeenCalledWith(ORG, existente.id, 'team_access_added', expect.stringContaining('La Picada'), expect.any(String), { clientId: PICADA });
  });

  it('si no tenía cuenta se crea una de empresa con la clave que elige, y no se acepta dos veces', async () => {
    const m = mundo();
    await m.invitaciones.invitar(comoAdmin, { email: 'nuevo@x.cl', perfilId: PERFIL_BAJO.id }, ADMIN.id);
    const token = tokenDe(m.correo);
    await expect(m.invitaciones.aceptar(token, { name: 'Nuevo' })).rejects.toThrow(BadRequestException);
    const resultado = await m.invitaciones.aceptar(token, { name: 'Nuevo', password: 'Clave1234' });
    expect(resultado.cuentaNueva).toBe(true);
    const cuenta = m.t.usuarios.filas.find((fila) => fila.email === 'nuevo@x.cl')!;
    expect(cuenta).toMatchObject({ role: UserRole.CLIENT, clientId: PICADA });
    expect(cuenta.password).not.toBe('Clave1234');
    await expect(m.invitaciones.aceptar(token, { name: 'Nuevo', password: 'Clave1234' })).rejects.toThrow(NotFoundException);
  });

  it('una invitación cancelada o vencida no se acepta', async () => {
    const m = mundo({ usuarios: [existente] });
    await m.invitaciones.invitar(comoAdmin, { email: 'ya@tiene.cl', perfilId: PERFIL_BAJO.id }, ADMIN.id);
    const [fila] = m.t.invitaciones.filas;
    await m.invitaciones.cancelar(comoAdmin, fila.id);
    await expect(m.invitaciones.aceptar(tokenDe(m.correo), {})).rejects.toThrow(NotFoundException);
    expect(m.t.accesos.filas).toHaveLength(0);
  });
});

describe('quitar del equipo', () => {
  it('quita sólo la empresa propia y conserva las demás', async () => {
    const persona = { id: 'u-p', email: 'p@x.cl', role: UserRole.CLIENT, clientId: PICADA, isActive: true };
    const m = mundo({ usuarios: [persona], accesos: [{ organizationId: ORG, userId: persona.id, clientId: OTRA }], asignaciones: [{ organizationId: ORG, clientId: PICADA, userId: persona.id, perfilId: PERFIL_BAJO.id }] });
    const resultado = await m.perfiles.quitarDelEquipo(comoAdmin, persona.id, 'Término de contrato');
    expect(resultado.desactivada).toBe(false);
    const cuenta = m.t.usuarios.filas.find((fila) => fila.id === persona.id)!;
    expect(cuenta.clientId).toBe(OTRA);
    expect(cuenta.isActive).toBe(true);
    expect(m.t.asignaciones.filas.some((fila) => fila.userId === persona.id)).toBe(false);
    expect(m.administradores.definir).toHaveBeenCalledWith(ORG, persona.id, PICADA, false, ADMIN.id, { esAgencia: false, motivo: 'Término de contrato', ip: '10.0.0.1' });
  });

  it('si era la última empresa la cuenta se desactiva y no se borra', async () => {
    const persona = { id: 'u-p', email: 'p@x.cl', role: UserRole.CLIENT, clientId: PICADA, isActive: true };
    const m = mundo({ usuarios: [persona] });
    const resultado = await m.perfiles.quitarDelEquipo(comoAdmin, persona.id, 'Término de contrato');
    expect(resultado.desactivada).toBe(true);
    const cuenta = m.t.usuarios.filas.find((fila) => fila.id === persona.id)!;
    expect(cuenta.isActive).toBe(false);
    expect(cuenta.clientId).toBeNull();
  });

  it('no quita a alguien de otra empresa, a una cuenta de la agencia ni a uno mismo', async () => {
    const ajena = { id: 'u-aj', email: 'aj@x.cl', role: UserRole.CLIENT, clientId: OTRA, isActive: true };
    const interna = { id: 'u-in', email: 'in@x.cl', role: UserRole.DESIGNER, clientId: PICADA, isActive: true };
    const m = mundo({ usuarios: [ajena, interna] });
    await expect(m.perfiles.quitarDelEquipo(comoAdmin, ajena.id, 'x motivo')).rejects.toThrow(NotFoundException);
    await expect(m.perfiles.quitarDelEquipo(comoAdmin, interna.id, 'x motivo')).rejects.toThrow(ForbiddenException);
    await expect(m.perfiles.quitarDelEquipo(comoAdmin, ADMIN.id, 'x motivo')).rejects.toThrow(BadRequestException);
    expect(m.t.usuarios.filas.find((fila) => fila.id === ajena.id)?.isActive).toBe(true);
  });
});

describe('retirar y volver a invitar', () => {
  const persona = { id: 'u-p', email: 'p@x.cl', name: 'Pía', role: UserRole.CLIENT, clientId: OTRA, isActive: true };
  const conAcceso = () => mundo({
    usuarios: [persona],
    accesos: [{ organizationId: ORG, userId: persona.id, clientId: PICADA, reason: 'Invitación' }],
    asignaciones: [{ organizationId: ORG, clientId: PICADA, userId: persona.id, perfilId: PERFIL_BAJO.id }],
  });
  const tokenDe = (correo: { send: { mock: { calls: unknown[][] } } }) => new RegExp('invitacion/([0-9a-f]{64})').exec(String(correo.send.mock.calls.at(-1)![2]))![1];

  it('retirar marca la pertenencia con quién, cuándo y por qué, y no la borra', async () => {
    const m = conAcceso();
    await expect(m.perfiles.quitarDelEquipo(comoAdmin, persona.id, '')).rejects.toThrow(BadRequestException);
    await m.perfiles.quitarDelEquipo(comoAdmin, persona.id, 'Término de contrato');
    const fila = m.t.accesos.filas.find((f) => f.userId === persona.id && f.clientId === PICADA)!;
    expect(fila).toMatchObject({ retiredBy: ADMIN.id, retiredReason: 'Término de contrato', retiredOutcome: 'retirado' });
    expect(fila.retiredAt).toBeInstanceOf(Date);
    expect(await m.perfiles.perteneceAEmpresa(PICADA, persona.id)).toBe(false);
    // Sigue activa en su otra empresa: el bloqueo es por empresa, no de la cuenta.
    expect(m.t.usuarios.filas.find((u) => u.id === persona.id)?.isActive).toBe(true);
  });

  it('al retirar a quien tenía como propia esa empresa queda la fila de constancia', async () => {
    const propia = { id: 'u-q', email: 'q@x.cl', role: UserRole.CLIENT, clientId: PICADA, isActive: true };
    const m = mundo({ usuarios: [propia] });
    await m.perfiles.quitarDelEquipo(comoAdmin, propia.id, 'Se fue', true);
    expect(m.t.accesos.filas.find((f) => f.userId === propia.id)).toMatchObject({ clientId: PICADA, retiredOutcome: 'vetado' });
  });

  it('reinvitar a quien se retiró muestra su historia en esta empresa y no restaura el perfil anterior', async () => {
    const m = conAcceso();
    await m.perfiles.quitarDelEquipo(comoAdmin, persona.id, 'Término de contrato');
    await expect(m.invitaciones.invitar(comoAdmin, { email: persona.email, perfilId: PERFIL_ADMIN.id }, ADMIN.id)).rejects.toThrow(BadRequestException);
    expect(m.t.invitaciones.filas).toHaveLength(0);
    const r = await m.invitaciones.invitar(comoAdmin, { email: persona.email, perfilId: PERFIL_ADMIN.id, motivoReingreso: 'Vuelve por temporada alta' }, ADMIN.id);
    expect(r.antecedente).toMatchObject({ resultado: 'retirado', retiradoPor: 'Ana', motivo: 'Término de contrato' });
    expect(m.t.asignaciones.filas.some((f) => f.userId === persona.id)).toBe(false);
    await m.invitaciones.aceptar(tokenDe(m.correo), {});
    const asignacion = m.t.asignaciones.filas.find((f) => f.userId === persona.id)!;
    expect(asignacion.perfilId).toBe(PERFIL_ADMIN.id);
    const filas = m.t.accesos.filas.filter((f) => f.userId === persona.id && f.clientId === PICADA);
    expect(filas).toHaveLength(1);
    expect(filas[0].retiredAt).toBeNull();
    // Queda dicho que reingresó, por qué, quién lo reinvitó y hasta cuándo estuvo antes.
    const [reingreso] = await m.perfiles.reingresos(comoAdmin);
    expect(reingreso).toMatchObject({ userId: persona.id, motivo: 'Vuelve por temporada alta', reinvitadoPor: 'Ana' });
    expect(reingreso.antesHasta).toBeTruthy();
    // Los demás administradores se enteran; quien reinvitó no necesita aviso.
    expect(m.avisos.notifyMultiple).toHaveBeenCalledWith(ORG, ['u-otro-admin'], 'team_reentry', expect.any(String), expect.stringContaining('Vuelve por temporada alta'), expect.any(Object));
    expect(m.avisos.notifyRole).not.toHaveBeenCalled();
    expect(m.t.usuarios.filas.filter((u) => u.email === persona.email)).toHaveLength(1);
  });

  it('un vetado no vuelve con una invitación corriente: exige confirmarlo, y el enlace lo deja dicho', async () => {
    const m = conAcceso();
    await m.perfiles.quitarDelEquipo(comoAdmin, persona.id, 'Fraude', true);
    await expect(m.invitaciones.invitar(comoAdmin, { email: persona.email, perfilId: PERFIL_BAJO.id, motivoReingreso: 'x motivo' }, ADMIN.id))
      .rejects.toMatchObject({ response: { vetado: true, antecedente: { resultado: 'vetado', motivo: 'Fraude' } } });
    expect(m.t.invitaciones.filas).toHaveLength(0);
    await m.invitaciones.invitar(comoAdmin, { email: persona.email, perfilId: PERFIL_BAJO.id, confirmaVeto: true, motivoReingreso: 'Se aclaró el caso' }, ADMIN.id);
    expect(m.t.invitaciones.filas[0].levantaVeto).toBe(true);
    // Levantar un veto avisa también a la agencia (el aviso sale sin esperarse).
    await new Promise((resolver) => setTimeout(resolver, 0));
    expect(m.avisos.notifyRole).toHaveBeenCalledWith(ORG, UserRole.OPERATIONS_DIRECTOR, 'team_ban_lifted', expect.any(String), expect.any(String), expect.any(Object));
    await m.invitaciones.aceptar(tokenDe(m.correo), {});
    expect(await m.perfiles.perteneceAEmpresa(PICADA, persona.id)).toBe(true);
  });

  it('una invitación pendiente no devuelve el acceso a quien se retira después', async () => {
    const m = conAcceso();
    await m.perfiles.quitarDelEquipo(comoAdmin, persona.id, 'Fraude', true);
    m.t.invitaciones.filas.push({ id: 'i-vieja', clientId: PICADA, email: persona.email, perfilId: PERFIL_BAJO.id, tokenHash: 'x', venceEl: new Date(Date.now() + 1e6), levantaVeto: false });
    await m.perfiles.quitarDelEquipo(comoAdmin, persona.id, 'otra vez').catch(() => undefined);
    // El vetado sin confirmar tampoco entra por una invitación fabricada sin levantar el veto.
    const { createHash } = await import('node:crypto');
    m.t.invitaciones.filas[0].tokenHash = createHash('sha256').update('b'.repeat(64)).digest('hex');
    await expect(m.invitaciones.aceptar('b'.repeat(64), {})).rejects.toThrow(NotFoundException);
    expect(await m.perfiles.perteneceAEmpresa(PICADA, persona.id)).toBe(false);
  });

  it('reinvitar a quien quedó sin empresas reactiva la misma cuenta y no crea otra', async () => {
    const sola = { id: 'u-s', email: 's@x.cl', name: 'Sol', role: UserRole.CLIENT, clientId: PICADA, isActive: true };
    const m = mundo({ usuarios: [sola] });
    await m.perfiles.quitarDelEquipo(comoAdmin, sola.id, 'Término de contrato');
    expect(m.t.usuarios.filas.find((u) => u.id === sola.id)).toMatchObject({ isActive: false, clientId: null });
    await m.invitaciones.invitar(comoAdmin, { email: sola.email, perfilId: PERFIL_BAJO.id, motivoReingreso: 'Vuelve a trabajar' }, ADMIN.id);
    await m.invitaciones.aceptar(tokenDe(m.correo), {});
    expect(m.t.usuarios.filas.filter((u) => u.email === sola.email)).toHaveLength(1);
    expect(m.t.usuarios.filas.find((u) => u.id === sola.id)).toMatchObject({ isActive: true, clientId: PICADA });
  });
});

describe('perfiles sugeridos', () => {
  it('se copian los de los módulos encendidos y no se pisa lo que la empresa ya cambió', async () => {
    const m = mundo();
    m.t.perfiles.filas.length = 0;
    m.t.perfiles.filas.push({ id: 'p-x', organizationId: ORG, clientId: PICADA, nombre: 'Garzón', areas: { 'reservations.turno': 'ver' }, datosProtegidos: {} });
    const copiados = await m.perfiles.sembrarSugeridos(ORG, PICADA);
    // Reservas y CRM encendidos: 6 sugeridos, uno ya existía con ese nombre.
    expect(copiados).toBe(5);
    expect(m.t.perfiles.filas.find((fila) => fila.nombre === 'Garzón')?.areas).toEqual({ 'reservations.turno': 'ver' });
    expect(await m.perfiles.sembrarSugeridos(ORG, PICADA)).toBe(0);
  });
});

describe('el último administrador de una empresa', () => {
  const persona = { id: 'u-p', email: 'p@x.cl', role: UserRole.CLIENT, clientId: PICADA, isActive: true };

  /** El servicio real de administradores sobre una tabla en memoria, para probar la regla donde vive. */
  function conServicioReal(administran: string[]) {
    const m = mundo({ usuarios: [persona], asignaciones: [{ organizationId: ORG, clientId: PICADA, userId: persona.id, perfilId: PERFIL_BAJO.id }] });
    const overrides = new Tabla(administran.map((userId) => ({ organizationId: ORG, userId, module: 'users', level: 'manage', clientId: PICADA })));
    const real = new AdministradoresDeEmpresaService(overrides as never, { invalidateUser: vi.fn() } as never, m.auditoria as never);
    const perfiles = new PerfilesService(m.t.perfiles as never, m.t.asignaciones as never, m.t.clientes as never, m.t.usuarios as never, m.t.accesos as never, m.t.textos as never, m.t.consentimientos as never, m.auditoria as never, { invalidateUser: vi.fn() } as never, real as never, m.t.invitaciones as never);
    return { m, overrides, real, perfiles };
  }

  it('no se puede retirar al último y el mensaje dice qué hacer', async () => {
    const { overrides, real } = conServicioReal([persona.id]);
    await expect(real.definir(ORG, persona.id, PICADA, false, 'u-x')).rejects.toThrow(/Nombra primero a otra/);
    expect(overrides.filas).toHaveLength(1);
  });

  it('con dos administradores sí se puede retirar a uno', async () => {
    const { overrides, real } = conServicioReal([persona.id, 'u-otro']);
    await real.definir(ORG, persona.id, PICADA, false, 'u-x');
    expect(overrides.filas.map((f) => f.userId)).toEqual(['u-otro']);
  });

  it('la agencia puede retirar al último sólo con motivo, y queda en auditoría', async () => {
    const { m, overrides, real } = conServicioReal([persona.id]);
    await expect(real.definir(ORG, persona.id, PICADA, false, 'u-ag', { esAgencia: true })).rejects.toThrow(BadRequestException);
    expect(overrides.filas).toHaveLength(1);
    await real.definir(ORG, persona.id, PICADA, false, 'u-ag', { esAgencia: true, motivo: 'La cuenta ya no existe', ip: '10.0.0.2' });
    expect(overrides.filas).toHaveLength(0);
    expect(m.auditoria.log).toHaveBeenCalledWith(expect.objectContaining({ actorId: 'u-ag', action: 'retirar_ultimo_administrador', after: expect.objectContaining({ motivo: 'La cuenta ya no existe' }) }));
  });

  it('quitar del equipo queda cubierto por la misma comprobación y no toca nada si la rechaza', async () => {
    const { m, perfiles } = conServicioReal([persona.id]);
    await expect(perfiles.quitarDelEquipo(comoAdmin, persona.id, 'Término de contrato')).rejects.toThrow(ConflictException);
    expect(m.t.asignaciones.filas.some((f) => f.userId === persona.id)).toBe(true);
    await expect(perfiles.quitarDelEquipo(comoAgencia, persona.id, 'Empresa sin nadie')).resolves.toBeTruthy();
    expect(m.t.asignaciones.filas.some((f) => f.userId === persona.id)).toBe(false);
  });
});
