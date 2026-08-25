import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { cerrarBanco, levantarBanco, type Banco } from './util/banco';

/**
 * Radiografía de acceso: qué responde cada ruta a cada cargo.
 *
 * Las pruebas anteriores comprueban casos concretos —que este no vea aquello—. Esta recorre la
 * combinación completa de cargos y rutas y deja la tabla escrita en `docs`. Sirve para dos cosas
 * distintas y las dos hacen falta:
 *
 * 1. **Afirmar invariantes** que deben cumplirse en toda la tabla, sin listarlos uno a uno: que
 *    ninguna ruta reviente con 500, que ninguna responda 200 sin sesión, y que el portal del
 *    cliente no consiga administrar cuentas ni configuración, aunque sí trabaje su CRM.
 * 2. **Dejar constancia.** Un cambio de permisos que hoy nadie nota se ve al comparar la tabla
 *    de una versión con la de la siguiente. Es la diferencia entre enterarse al revisar y
 *    enterarse cuando un cliente ve algo que no era suyo.
 */
describe('matriz de acceso', () => {
  let banco: Banco;
  const resultados: Array<{ ruta: string; metodo: string; cargo: string; status: number }> = [];

  beforeAll(async () => {
    banco = await levantarBanco();
  }, 180_000);

  afterAll(async () => {
    if (!banco) return;
    escribirTabla();
    await cerrarBanco(banco);
  });

  /**
   * Rutas de solo lectura, una por módulo con datos de empresa.
   *
   * Son `GET` a propósito: una escritura dejaría rastro y la tabla dejaría de ser repetible.
   * Las escrituras se comprueban aparte, y solo para confirmar que el portal no las consigue.
   */
  const RUTAS_LECTURA: Array<[string, string]> = [
    ['CRM · leads', '/crm/leads?domain=audience&limit=5'],
    ['CRM · inicio', '/crm/home?domain=commercial'],
    ['CRM · panel', '/crm/home/dashboard?days=30&domain=commercial'],
    ['CRM · rótulos de etapa', '/crm/stage-labels'],
    ['Clientes', '/clients'],
    ['Usuarios', '/users'],
    ['Reservas', '/reservations'],
    ['Reservas · formularios', '/reservations/forms'],
    ['Aprobaciones', '/approvals'],
    ['Reuniones', '/meetings'],
    ['Contenido · grillas', '/content/grids'],
    ['Informes · panel', '/reporting/dashboard'],
    ['Tareas · mías', '/tasks/mine'],
  ];

  /** Escrituras administrativas que el portal del cliente no debe conseguir en ningún caso. */
  const ESCRITURAS_PROHIBIDAS_AL_PORTAL: Array<[string, 'POST' | 'PUT' | 'PATCH', string, unknown]> = [
    ['crear un cliente', 'POST', '/clients', { name: 'Empresa inventada' }],
    ['crear un usuario', 'POST', '/users', { name: 'Cuenta inventada', email: 'colado@prueba.local', password: 'Colado2026!', role: 'admin' }],
    ['renombrar etapas', 'PUT', '/crm/stage-labels', { labels: { new: 'Mío' } }],
  ];

  const CARGOS = ['dev', 'admin', 'equipoUno', 'portalCrmUno', 'portalReservasUno'] as const;

  it('recorre cada ruta con cada cargo y anota la respuesta', async () => {
    for (const [nombre, ruta] of RUTAS_LECTURA) {
      for (const cargo of CARGOS) {
        const { status } = await banco.pedir('GET', ruta, banco.cuentas[cargo].token);
        resultados.push({ ruta: nombre, metodo: 'GET', cargo, status });
      }
    }
    expect(resultados.length).toBe(RUTAS_LECTURA.length * CARGOS.length);
  }, 120_000);

  it('ninguna ruta revienta: no hay un solo error del servidor', () => {
    const rotas = resultados.filter((r) => r.status >= 500);
    expect(
      rotas.map((r) => `${r.ruta} · ${r.cargo} · ${r.status}`),
      // El registro de la API acompaña al fallo: sin él, un 500 obliga a reproducirlo a mano
      // para saber qué se rompió, y eso es media hora cada vez.
      `Rutas que responden con error del servidor.
--- registro de la API ---
${banco.registro()}`,
    ).toEqual([]);
  });

  it('ninguna ruta responde sin sesión', async () => {
    const abiertas: string[] = [];
    for (const [nombre, ruta] of RUTAS_LECTURA) {
      const { status } = await banco.pedir('GET', ruta);
      if (status !== 401) abiertas.push(`${nombre} → ${status}`);
    }
    expect(abiertas, 'Rutas que atienden a quien no ha entrado').toEqual([]);
  }, 60_000);

  it('un token inventado no abre ninguna puerta', async () => {
    const falso = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmYWxzbyJ9.firmainventada';
    const abiertas: string[] = [];
    for (const [nombre, ruta] of RUTAS_LECTURA) {
      const { status } = await banco.pedir('GET', ruta, falso);
      if (status !== 401) abiertas.push(`${nombre} → ${status}`);
    }
    expect(abiertas, 'Rutas que aceptan un token que nadie firmó').toEqual([]);
  }, 60_000);

  it('el portal del cliente no consigue escrituras administrativas', async () => {
    const conseguidas: string[] = [];
    for (const [nombre, metodo, ruta, cuerpo] of ESCRITURAS_PROHIBIDAS_AL_PORTAL) {
      const { status } = await banco.pedir(metodo, ruta, banco.cuentas.portalCrmUno.token, cuerpo);
      // 4xx cualquiera está bien: lo que no puede es crear o modificar.
      if (status < 400) conseguidas.push(`${nombre} → ${status}`);
    }
    expect(conseguidas, 'Escrituras que el portal logró').toEqual([]);
  }, 60_000);

  it('el portal crea un lead únicamente dentro de su propia empresa', async () => {
    const creado = await banco.pedir('POST', '/crm/leads', banco.cuentas.portalCrmUno.token, {
      name: 'Lead creado por su empresa',
      // Ambos campos se falsifican a propósito: la sesión debe prevalecer.
      clientId: banco.empresas.crmDos,
      domain: 'audience',
    });
    expect([200, 201], JSON.stringify(creado.body)).toContain(creado.status);
    expect(creado.body.clientId).toBe(banco.empresas.crmUno);
    expect(creado.body.domain).toBe('commercial');
  });

  it('el portal no creó cuentas ni usuarios pese a los intentos', async () => {
    const [clientes]: any = await banco.db.query(
      'SELECT COUNT(*) AS n FROM clients WHERE name = ?', ['Empresa inventada'],
    );
    const [usuarios]: any = await banco.db.query(
      'SELECT COUNT(*) AS n FROM users WHERE email = ?', ['colado@prueba.local'],
    );
    expect({
      clientes: Number(clientes[0].n),
      usuarios: Number(usuarios[0].n),
    }).toEqual({ clientes: 0, usuarios: 0 });
  });

  it('cada portal alcanza solo los servicios contratados por su empresa', () => {
    const estado = (cargo: string, ruta: string) =>
      resultados.find((fila) => fila.cargo === cargo && fila.ruta === ruta)?.status;

    for (const ruta of ['CRM · leads', 'CRM · inicio', 'CRM · panel']) {
      expect(estado('portalCrmUno', ruta), `CRM contratado: ${ruta}`).toBe(200);
      expect(estado('portalReservasUno', ruta), `CRM no contratado: ${ruta}`).toBe(403);
    }
    for (const ruta of ['Reservas', 'Reservas · formularios']) {
      expect(estado('portalCrmUno', ruta), `Reservas no contratadas: ${ruta}`).toBe(403);
      expect(estado('portalReservasUno', ruta), `Reservas contratadas: ${ruta}`).toBe(200);
    }
  });

  /** Deja la tabla en `docs`, para poder comparar una versión con la siguiente. */
  function escribirTabla(): void {
    if (!resultados.length) return;
    const cargos = [...CARGOS];
    const lineas: string[] = [
      '# Matriz de acceso',
      '',
      'Generada por `test/e2e/matriz-de-acceso.e2e.spec.ts`. **No se edita a mano.**',
      '',
      'Qué responde cada ruta a cada cargo, con una sesión válida. `200` es que atiende;',
      '`403` es que el cargo, la empresa o el servicio contratado no alcanzan; `404` es que',
      'además se oculta la existencia.',
      '',
      `| Ruta | ${cargos.join(' | ')} |`,
      `| --- | ${cargos.map(() => '---').join(' | ')} |`,
    ];

    for (const [nombre] of RUTAS_LECTURA) {
      const celdas = cargos.map((cargo) => {
        const fila = resultados.find((r) => r.ruta === nombre && r.cargo === cargo);
        return fila ? String(fila.status) : '—';
      });
      lineas.push(`| ${nombre} | ${celdas.join(' | ')} |`);
    }

    lineas.push(
      '',
      '## Cómo leerla',
      '',
      '- **dev** y **admin** atraviesan la organización entera: es su trabajo.',
      '- **equipoUno** es un community manager sin cuentas asignadas en este escenario, así que',
      '  ve las pantallas que su cargo permite pero sin datos de ninguna empresa.',
      '- **portalCrmUno** y **portalReservasUno** son el mismo cargo (`client`) sobre empresas con',
      '  servicios distintos. Sus respuestas de CRM y Reservas deben diferir: cada portal alcanza',
      '  únicamente el servicio que su empresa contrató.',
      '',
    );

    const destino = resolve(__dirname, '../../../../docs/pruebas/matriz-de-acceso.md');
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, lineas.join('\n'), 'utf8');
  }
});
