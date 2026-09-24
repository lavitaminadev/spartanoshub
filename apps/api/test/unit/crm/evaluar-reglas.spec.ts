import { describe, expect, it } from 'vitest';
import {
  comparable,
  evaluarCondicion,
  primeraReglaQueCalza,
  type LeadParaReglas,
  type Regla,
} from '../../../src/modules/crm/reglas/evaluar-reglas';

/** Un lead como los que llegan de un formulario instantáneo. */
const lead = (parcial: Partial<LeadParaReglas> = {}): LeadParaReglas => ({
  respuestas: [],
  campos: {},
  ...parcial,
});

/** Una regla mínima, para que cada prueba solo escriba lo que le importa. */
const regla = (parcial: Partial<Regla> = {}): Regla => ({
  id: 'r1',
  nombre: 'Regla',
  posicion: 1,
  activa: true,
  unir: 'todas',
  automatica: true,
  condiciones: [{ donde: 'respuestas', comparador: 'contiene', valor: 'contado' }],
  acciones: { semaforo: 'green' },
  ...parcial,
});

describe('comparable', () => {
  it('iguala una misma respuesta escrita de varias formas', () => {
    const formas = ['Contado', 'CONTADO', 'contado.', ' Contado  '];
    expect(new Set(formas.map(comparable)).size).toBe(1);
  });

  /*
   * El caso que de verdad ocurre: Meta entrega la misma respuesta con guiones bajos en el
   * formulario y con espacios y tildes en el panel. Las dos formas tienen que encontrarse.
   */
  it('iguala la forma con guiones bajos de Meta y la escrita a mano', () => {
    expect(comparable('credito_directo')).toBe(comparable('Crédito Directo'));
  });

  it('no junta palabras que el texto separa', () => {
    // «con-tado» son dos palabras: igualarlo a «contado» haría calzar reglas por accidente.
    expect(comparable('con-tado')).not.toBe(comparable('contado'));
  });

  it('quita las tildes, que es donde falla comparar a mano', () => {
    expect(comparable('Crédito Directo')).toBe(comparable('credito directo'));
  });

  it('trata lo vacío sin reventar', () => {
    expect(comparable(null)).toBe('');
    expect(comparable(undefined)).toBe('');
  });
});

describe('evaluarCondicion', () => {
  it('encuentra la respuesta sin importar en qué pregunta vino', () => {
    const resultado = evaluarCondicion(
      lead({ respuestas: [{ pregunta: '¿Cómo pagas?', respuesta: 'Contado' }] }),
      { donde: 'respuestas', comparador: 'contiene', valor: 'contado' },
    );
    expect(resultado.cumple).toBe(true);
    // El texto original, no el normalizado: es lo que se le muestra a una persona.
    expect(resultado.porque).toBe('Contado');
  });

  it('con una pregunta concreta ignora lo que contestó en las demás', () => {
    const datos = lead({
      respuestas: [
        { pregunta: '¿Cómo pagas?', respuesta: 'Crédito Banco' },
        { pregunta: '¿Tienes el pie?', respuesta: 'Sí' },
      ],
    });
    expect(evaluarCondicion(datos, { donde: 'pregunta', clave: 'pie', comparador: 'contiene', valor: 'si' }).cumple).toBe(true);
    expect(evaluarCondicion(datos, { donde: 'pregunta', clave: 'como pagas', comparador: 'contiene', valor: 'si' }).cumple).toBe(false);
  });

  it('«es» exige la respuesta completa y «contiene» acepta parte', () => {
    const datos = lead({ respuestas: [{ pregunta: 'p', respuesta: 'Crédito Directo' }] });
    expect(evaluarCondicion(datos, { donde: 'respuestas', comparador: 'es', valor: 'credito' }).cumple).toBe(false);
    expect(evaluarCondicion(datos, { donde: 'respuestas', comparador: 'contiene', valor: 'credito' }).cumple).toBe(true);
  });

  /*
   * Una condición a medio escribir no puede calificar a nadie.
   *
   * Es el fallo caro: alguien abre el formulario, deja el valor vacío y se va. Si «contiene ''»
   * calzara con todo, la regla marcaría cada lead que entre con la misma etiqueta.
   */
  it('una condición sin valor no calza con nada', () => {
    const datos = lead({ respuestas: [{ pregunta: 'p', respuesta: 'Contado' }] });
    expect(evaluarCondicion(datos, { donde: 'respuestas', comparador: 'contiene', valor: '' }).cumple).toBe(false);
    expect(evaluarCondicion(datos, { donde: 'respuestas', comparador: 'no_contiene', valor: undefined }).cumple).toBe(false);
  });

  it('lee el número dentro de un tramo de dinero, tomando el piso', () => {
    const datos = lead({ respuestas: [{ pregunta: 'cuánto', respuesta: '$60.000.000 a $80.000.000' }] });
    expect(evaluarCondicion(datos, { donde: 'respuestas', comparador: 'mayor_que', valor: '50000000' }).cumple).toBe(true);
    expect(evaluarCondicion(datos, { donde: 'respuestas', comparador: 'mayor_que', valor: '70000000' }).cumple).toBe(false);
  });

  it('comparar contra algo que no es número no calza', () => {
    const datos = lead({ monto: 100 });
    expect(evaluarCondicion(datos, { donde: 'monto', comparador: 'mayor_que', valor: 'mucho' }).cumple).toBe(false);
  });

  it('mira un campo de varias opciones opción por opción', () => {
    const datos = lead({ campos: { servicios: ['Meta Ads', 'Branding'] } });
    expect(evaluarCondicion(datos, { donde: 'campo', clave: 'servicios', comparador: 'contiene', valor: 'branding' }).cumple).toBe(true);
    expect(evaluarCondicion(datos, { donde: 'campo', clave: 'servicios', comparador: 'contiene', valor: 'sitio web' }).cumple).toBe(false);
  });

  it('mira los datos del propio lead', () => {
    const datos = lead({ fuente: 'meta_lead_ads', responsable: 'Sergio', campana: 'Primavera' });
    expect(evaluarCondicion(datos, { donde: 'fuente', comparador: 'es', valor: 'meta_lead_ads' }).cumple).toBe(true);
    expect(evaluarCondicion(datos, { donde: 'responsable', comparador: 'no_vacio' }).cumple).toBe(true);
    expect(evaluarCondicion(datos, { donde: 'campana', comparador: 'contiene', valor: 'primavera' }).cumple).toBe(true);
  });

  it('reconoce que nadie lo ha tomado todavía', () => {
    expect(evaluarCondicion(lead({ responsable: null }), { donde: 'responsable', comparador: 'vacio' }).cumple).toBe(true);
  });

  it('«no contiene» se cumple cuando no está, y no cuando está', () => {
    const datos = lead({ respuestas: [{ pregunta: 'p', respuesta: 'Contado' }] });
    expect(evaluarCondicion(datos, { donde: 'respuestas', comparador: 'no_contiene', valor: 'credito' }).cumple).toBe(true);
    expect(evaluarCondicion(datos, { donde: 'respuestas', comparador: 'no_contiene', valor: 'contado' }).cumple).toBe(false);
  });

  it('un lead sin respuestas no rompe ninguna comparación', () => {
    const vacio = lead();
    expect(evaluarCondicion(vacio, { donde: 'respuestas', comparador: 'contiene', valor: 'contado' }).cumple).toBe(false);
    expect(evaluarCondicion(vacio, { donde: 'respuestas', comparador: 'vacio' }).cumple).toBe(true);
    expect(evaluarCondicion(vacio, { donde: 'campo', clave: 'nada', comparador: 'contiene', valor: 'x' }).cumple).toBe(false);
  });

  it('una condición de una versión más nueva no se inventa un resultado', () => {
    const datos = lead({ respuestas: [{ pregunta: 'p', respuesta: 'Contado' }] });
    const desconocida = { donde: 'algo_que_no_existe', comparador: 'contiene', valor: 'contado' } as never;
    expect(evaluarCondicion(datos, desconocida).cumple).toBe(false);
  });
});

describe('primeraReglaQueCalza', () => {
  it('aplica la primera por posición, no la que calce mejor', () => {
    const datos = lead({
      respuestas: [
        { pregunta: '¿Cómo pagas?', respuesta: 'Contado' },
        { pregunta: '¿Cuándo compras?', respuesta: 'Solo estoy cotizando' },
      ],
    });
    const reglas = [
      regla({ id: 'r2', nombre: 'Cotizando', posicion: 2, acciones: { semaforo: 'red' }, condiciones: [{ donde: 'respuestas', comparador: 'contiene', valor: 'solo estoy cotizando' }] }),
      regla({ id: 'r1', nombre: 'Contado', posicion: 1, acciones: { semaforo: 'green' } }),
    ];
    expect(primeraReglaQueCalza(datos, reglas)?.reglaId).toBe('r1');
  });

  it('con «todas» exige que se cumplan las dos condiciones', () => {
    const conAmbas = lead({
      respuestas: [
        { pregunta: 'crédito', respuesta: 'Crédito aprobado por el banco' },
        { pregunta: 'pie', respuesta: 'Tengo el 30%' },
      ],
    });
    const soloUna = lead({ respuestas: [{ pregunta: 'crédito', respuesta: 'Crédito aprobado por el banco' }] });
    const r = regla({
      unir: 'todas',
      condiciones: [
        { donde: 'respuestas', comparador: 'contiene', valor: 'credito aprobado' },
        { donde: 'respuestas', comparador: 'contiene', valor: '30' },
      ],
    });
    expect(primeraReglaQueCalza(conAmbas, [r])).not.toBeNull();
    expect(primeraReglaQueCalza(soloUna, [r])).toBeNull();
  });

  it('con «alguna» basta una, y el porqué nombra solo la que calzó', () => {
    const datos = lead({ respuestas: [{ pregunta: 'cuándo', respuesta: 'Está juntando el pie' }] });
    const aplicada = primeraReglaQueCalza(datos, [regla({
      unir: 'alguna',
      condiciones: [
        { donde: 'respuestas', comparador: 'contiene', valor: 'juntando el pie' },
        { donde: 'respuestas', comparador: 'contiene', valor: 'esperando aprobacion' },
      ],
    })]);
    expect(aplicada?.porque).toBe('Está juntando el pie');
  });

  it('no aplica una regla apagada ni una archivada', () => {
    const datos = lead({ respuestas: [{ pregunta: 'p', respuesta: 'Contado' }] });
    expect(primeraReglaQueCalza(datos, [regla({ activa: false })])).toBeNull();
    expect(primeraReglaQueCalza(datos, [regla({ archivadaEn: '2026-09-01T00:00:00.000Z' })])).toBeNull();
  });

  /*
   * Una regla manual no puede correr sola.
   *
   * Es la red de seguridad de la puesta en marcha: se escribe la regla, se prueba sobre unos
   * pocos leads a mano, y solo después se activa. Si corriera igual al entrar, esa prueba no
   * existiría y el primer error se descubriría con cien leads mal calificados.
   */
  it('una regla manual solo corre cuando alguien la aplica', () => {
    const datos = lead({ respuestas: [{ pregunta: 'p', respuesta: 'Contado' }] });
    const manual = [regla({ automatica: false })];
    expect(primeraReglaQueCalza(datos, manual, 'automatica')).toBeNull();
    expect(primeraReglaQueCalza(datos, manual, 'manual')).not.toBeNull();
  });

  it('una regla sin condiciones no califica a nadie', () => {
    const datos = lead({ respuestas: [{ pregunta: 'p', respuesta: 'Contado' }] });
    expect(primeraReglaQueCalza(datos, [regla({ condiciones: [] })])).toBeNull();
  });

  it('sin reglas, o con datos ausentes, devuelve nada sin romperse', () => {
    expect(primeraReglaQueCalza(lead(), [])).toBeNull();
    expect(primeraReglaQueCalza(lead(), undefined as never)).toBeNull();
  });

  it('el porqué no repite el mismo texto dos veces', () => {
    const datos = lead({ respuestas: [{ pregunta: 'p', respuesta: 'Contado' }] });
    const aplicada = primeraReglaQueCalza(datos, [regla({
      unir: 'todas',
      condiciones: [
        { donde: 'respuestas', comparador: 'contiene', valor: 'contado' },
        { donde: 'respuestas', comparador: 'contiene', valor: 'conta' },
      ],
    })]);
    expect(aplicada?.porque).toBe('Contado');
  });

  it('cuando ninguna condición deja texto, el porqué nombra la regla', () => {
    const aplicada = primeraReglaQueCalza(lead({ responsable: null }), [regla({
      nombre: 'Sin responsable',
      condiciones: [{ donde: 'responsable', comparador: 'vacio' }],
    })]);
    expect(aplicada?.porque).toBe('Sin responsable');
  });

  /*
   * El caso real que originó todo esto: la calificación de una inmobiliaria, escrita tal como
   * la pasó el equipo comercial por WhatsApp. Si esto no se puede expresar, las reglas no
   * sirven para lo que se pidieron.
   */
  describe('la calificación de una inmobiliaria, de punta a punta', () => {
    const REGLAS: Regla[] = [
      regla({ id: 'contado', nombre: 'Contado', posicion: 1, acciones: { semaforo: 'green', calificacion: 'qualified' }, condiciones: [{ donde: 'respuestas', comparador: 'contiene', valor: 'contado' }] }),
      regla({ id: 'aprobado', nombre: 'Crédito aprobado con pie', posicion: 2, unir: 'todas', acciones: { semaforo: 'green', calificacion: 'qualified' }, condiciones: [
        { donde: 'respuestas', comparador: 'contiene', valor: 'credito aprobado' },
        { donde: 'respuestas', comparador: 'contiene', valor: '30' },
      ] }),
      regla({ id: 'medio', nombre: 'En camino', posicion: 3, unir: 'alguna', acciones: { semaforo: 'yellow', calificacion: 'in_review' }, condiciones: [
        { donde: 'respuestas', comparador: 'contiene', valor: 'juntando el pie' },
        { donde: 'respuestas', comparador: 'contiene', valor: 'tramitandolo' },
      ] }),
      regla({ id: 'no', nombre: 'Sin capacidad', posicion: 4, unir: 'alguna', acciones: { semaforo: 'red', descartarMotivo: 'Solo consultaba (sin intención)' }, condiciones: [
        { donde: 'respuestas', comparador: 'contiene', valor: 'solo estoy cotizando' },
        { donde: 'respuestas', comparador: 'contiene', valor: 'no califica' },
      ] }),
    ];

    it.each([
      ['Contado', 'green', 'contado'],
      ['Tramitandolo', 'yellow', 'medio'],
      ['Solo estoy cotizando', 'red', 'no'],
    ])('«%s» queda %s', (respuesta, semaforo, reglaId) => {
      const aplicada = primeraReglaQueCalza(lead({ respuestas: [{ pregunta: '¿Cómo pagas?', respuesta }] }), REGLAS);
      expect(aplicada?.reglaId).toBe(reglaId);
      expect(aplicada?.acciones.semaforo).toBe(semaforo);
    });

    it('quien paga al contado pero solo cotiza queda verde: manda el orden', () => {
      const datos = lead({
        respuestas: [
          { pregunta: '¿Cómo pagas?', respuesta: 'Contado' },
          { pregunta: '¿Cuándo compras?', respuesta: 'Solo estoy cotizando' },
        ],
      });
      expect(primeraReglaQueCalza(datos, REGLAS)?.reglaId).toBe('contado');
    });

    it('una respuesta que ninguna regla contempla no se califica sola', () => {
      const datos = lead({ respuestas: [{ pregunta: '¿Cómo pagas?', respuesta: 'Crédito con subsidio' }] });
      expect(primeraReglaQueCalza(datos, REGLAS)).toBeNull();
    });
  });
});
