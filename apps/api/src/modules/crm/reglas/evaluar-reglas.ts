/**
 * @fileoverview Qué regla le corresponde a un lead y qué hay que hacer con él.
 *
 * Vive aparte de la base y de Nest a propósito: decidir es lo único que puede equivocarse de
 * forma cara —calificar mal un lead, descartarlo sin que nadie lo mire— y así se puede probar
 * con un objeto en la mano, sin levantar nada.
 *
 * La regla no apunta a un campo que alguien tuvo que declarar antes: mira lo que el lead trae,
 * venga de donde venga. Si la pregunta llegó, la regla la encuentra; si mañana cambia su
 * redacción pero la respuesta sigue diciendo «contado», la regla sigue valiendo.
 */

/** Dónde mira una condición. */
export type DondeMira =
  /** En todo lo que contestó, sin importar en qué pregunta. Es lo que se usa casi siempre. */
  | 'respuestas'
  /** En una pregunta concreta, cuando dos preguntas comparten respuestas posibles. */
  | 'pregunta'
  /** En un campo propio, por su clave. */
  | 'campo'
  /** Datos del propio lead: de dónde vino, quién lo atiende, cuánto vale, qué campaña. */
  | 'fuente'
  | 'responsable'
  | 'monto'
  | 'campana';

/** Cómo se compara. Deliberadamente pocos: cubren el caso real sin volverse un lenguaje. */
export type Comparador =
  | 'contiene'
  | 'no_contiene'
  | 'es'
  | 'no_es'
  | 'vacio'
  | 'no_vacio'
  | 'mayor_que'
  | 'menor_que';

export interface Condicion {
  donde: DondeMira;
  /** Con `donde: 'pregunta'` o `'campo'`, cuál. Se ignora en el resto. */
  clave?: string;
  comparador: Comparador;
  valor?: string;
}

/** Lo que la regla hace cuando calza. Todo es opcional: una regla puede hacer una sola cosa. */
export interface Acciones {
  semaforo?: 'green' | 'yellow' | 'red';
  calificacion?: string;
  etapa?: string;
  responsable?: string;
  descartarMotivo?: string;
  tarea?: { titulo: string; enHoras?: number };
  avisarA?: string;
  nota?: string;
  /** Guarda la respuesta encontrada en un campo propio, para poder filtrar por ella. */
  guardarEnCampo?: string;
}

export interface Regla {
  id: string;
  nombre: string;
  /** El orden manda: se aplica la primera que calza. */
  posicion: number;
  activa: boolean;
  archivadaEn?: string | null;
  /** `todas` exige que se cumplan todas las condiciones; `alguna`, que se cumpla una. */
  unir: 'todas' | 'alguna';
  condiciones: Condicion[];
  acciones: Acciones;
  /** `true`: corre al entrar el lead. Si no, solo cuando alguien la aplica. */
  automatica: boolean;
}

/** El lead visto por las reglas. Solo lo que se puede mirar, ya reunido por quien llama. */
export interface LeadParaReglas {
  respuestas: Array<{ pregunta: string; respuesta: string }>;
  campos: Record<string, unknown>;
  fuente?: string | null;
  responsable?: string | null;
  monto?: number | null;
  campana?: string | null;
}

export interface ReglaAplicada {
  reglaId: string;
  nombre: string;
  acciones: Acciones;
  /** El texto que hizo que calzara. Es lo que se muestra en la tarjeta y en el historial. */
  porque: string;
}

/**
 * Deja un texto comparable: sin tildes, sin mayúsculas, sin signos ni espacios de más.
 *
 * Las respuestas llegan escritas por personas y por formularios: «Contado», «contado.»,
 * «CONTADO» y «con-tado» son la misma respuesta, y una regla que distinga entre ellas falla el
 * día que alguien cambia una letra. Es la misma normalización que ya usan los campos propios
 * para reconocer las preguntas de Meta.
 */
export function comparable(texto: unknown): string {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * El número que hay dentro de un texto, o `undefined` si no hay ninguno.
 *
 * Las respuestas de dinero llegan como «$60.000.000 a $80.000.000»: se toma el primero, que es
 * el piso del tramo, porque comparar contra el techo diría que alguien tiene más de lo que dijo.
 */
function numeroDe(valor: unknown): number | undefined {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : undefined;
  const texto = String(valor ?? '');
  const encontrado = texto.match(/-?\d[\d.,]*/);
  if (!encontrado) return undefined;
  // Se quitan los puntos que separan miles; la coma se trata como decimal.
  const limpio = encontrado[0].replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const numero = Number(limpio);
  return Number.isFinite(numero) ? numero : undefined;
}

/** Los textos donde busca una condición, según dónde mire. */
function textosDe(lead: LeadParaReglas, condicion: Condicion): string[] {
  const respuestas = Array.isArray(lead.respuestas) ? lead.respuestas : [];
  switch (condicion.donde) {
    case 'respuestas':
      return respuestas.map((fila) => String(fila?.respuesta ?? ''));
    case 'pregunta': {
      const buscada = comparable(condicion.clave);
      if (!buscada) return [];
      return respuestas
        .filter((fila) => comparable(fila?.pregunta).includes(buscada))
        .map((fila) => String(fila?.respuesta ?? ''));
    }
    case 'campo': {
      if (!condicion.clave) return [];
      const valor = lead.campos?.[condicion.clave];
      if (valor === undefined || valor === null) return [];
      // Un campo de varias opciones guarda una lista; cada opción se compara por separado.
      return Array.isArray(valor) ? valor.map((item) => String(item)) : [String(valor)];
    }
    case 'fuente':
      return lead.fuente ? [lead.fuente] : [];
    case 'responsable':
      return lead.responsable ? [lead.responsable] : [];
    case 'campana':
      return lead.campana ? [lead.campana] : [];
    case 'monto':
      return lead.monto === null || lead.monto === undefined ? [] : [String(lead.monto)];
    default:
      // Una condición guardada por una versión más nueva no se inventa un resultado: no calza.
      return [];
  }
}

/**
 * Si una condición se cumple, y con qué texto.
 *
 * Devuelve el texto que la hizo cumplirse para poder decir **por qué** quedó calificado así.
 * Sin eso, quien revisa ve un semáforo verde y no tiene forma de saber qué lo puso ahí.
 */
export function evaluarCondicion(lead: LeadParaReglas, condicion: Condicion): { cumple: boolean; porque?: string } {
  const textos = textosDe(lead, condicion);

  if (condicion.comparador === 'vacio') return { cumple: !textos.some((texto) => texto.trim()) };
  if (condicion.comparador === 'no_vacio') {
    const conValor = textos.find((texto) => texto.trim());
    return conValor ? { cumple: true, porque: conValor } : { cumple: false };
  }

  if (condicion.comparador === 'mayor_que' || condicion.comparador === 'menor_que') {
    const referencia = numeroDe(condicion.valor);
    // Sin un número con el que comparar no hay pregunta que responder: no calza.
    if (referencia === undefined) return { cumple: false };
    for (const texto of textos) {
      const numero = numeroDe(texto);
      if (numero === undefined) continue;
      const cumple = condicion.comparador === 'mayor_que' ? numero > referencia : numero < referencia;
      if (cumple) return { cumple: true, porque: texto };
    }
    return { cumple: false };
  }

  const buscado = comparable(condicion.valor);
  /*
   * Una condición sin valor no decide nada.
   *
   * Buscar la cadena vacía haría que «contiene» calzara con cualquier cosa —y que «no contiene»
   * no calzara nunca—, así que una regla a medio escribir calificaría todos los leads.
   */
  if (!buscado) return { cumple: false };

  const coincide = (texto: string): boolean => {
    const limpio = comparable(texto);
    return condicion.comparador === 'es' || condicion.comparador === 'no_es'
      ? limpio === buscado
      : limpio.includes(buscado);
  };

  const negativa = condicion.comparador === 'no_contiene' || condicion.comparador === 'no_es';
  const encontrado = textos.find(coincide);

  if (negativa) return { cumple: !encontrado };
  return encontrado ? { cumple: true, porque: encontrado } : { cumple: false };
}

/**
 * La primera regla que calza, o nada.
 *
 * El orden es la única forma de resolver reglas que se contradicen —quien paga al contado pero
 * compra en seis meses cumple dos— y se resuelve donde se ve: la lista que el equipo ordena.
 * Elegir «la mejor» por dentro obligaría a explicar un criterio que nadie pidió.
 *
 * Una regla sin condiciones se descarta: calzaría con todo y dejaría a la empresa calificando
 * cada lead que entra con la misma etiqueta.
 *
 * @param lead - Lo que el lead trae, ya reunido.
 * @param reglas - Todas las de esa empresa; aquí se descartan las archivadas y las apagadas.
 * @param modo - `automatica` filtra además las que solo corren a mano.
 */
export function primeraReglaQueCalza(
  lead: LeadParaReglas,
  reglas: Regla[],
  modo: 'automatica' | 'manual' = 'automatica',
): ReglaAplicada | null {
  const candidatas = (Array.isArray(reglas) ? reglas : [])
    .filter((regla) => regla && regla.activa && !regla.archivadaEn)
    .filter((regla) => (modo === 'automatica' ? regla.automatica : true))
    .filter((regla) => Array.isArray(regla.condiciones) && regla.condiciones.length > 0)
    .slice()
    .sort((a, b) => (a.posicion ?? 0) - (b.posicion ?? 0) || String(a.nombre).localeCompare(String(b.nombre)));

  for (const regla of candidatas) {
    const resultados = regla.condiciones.map((condicion) => evaluarCondicion(lead, condicion));
    const calza = regla.unir === 'alguna'
      ? resultados.some((resultado) => resultado.cumple)
      : resultados.every((resultado) => resultado.cumple);
    if (!calza) continue;

    /*
     * El porqué se arma con los textos que de verdad hicieron calzar la regla.
     *
     * Con `alguna` basta uno, y nombrar los demás sería mentir sobre lo que la disparó. Cuando
     * ninguna condición deja texto —«está vacío», por ejemplo— se nombra la regla, que es lo
     * único cierto que se puede decir.
     */
    const motivos = resultados
      .filter((resultado) => resultado.cumple && resultado.porque)
      .map((resultado) => resultado.porque as string);
    const porque = motivos.length > 0 ? [...new Set(motivos)].join(' · ') : regla.nombre;

    return { reglaId: regla.id, nombre: regla.nombre, acciones: regla.acciones ?? {}, porque };
  }

  return null;
}
