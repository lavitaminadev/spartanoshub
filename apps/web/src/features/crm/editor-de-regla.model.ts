import { CALIFICACION_ROTULOS } from './calificacion';

export interface Condicion { donde: string; clave?: string; comparador: string; valor?: string }
export interface Acciones {
  semaforo?: 'green' | 'yellow' | 'red';
  calificacion?: string;
  etapa?: string;
  descartarMotivo?: string;
  nota?: string;
}
export interface Borrador {
  nombre: string;
  unir: 'todas' | 'alguna';
  condiciones: Condicion[];
  acciones: Acciones;
}
export interface Pregunta {
  pregunta: string;
  total: number;
  respuestas: Array<{ respuesta: string; total: number; tieneRegla: boolean }>;
}
export interface EtapaDisponible { value: string; titulo: string }
export interface Falta { texto: string; ancla: string }

export const DONDE = [
  { value: 'respuestas', label: 'Lo que contestó en el formulario', enFrase: 'lo que contestó' },
  { value: 'pregunta', label: 'Su respuesta a una pregunta en particular', enFrase: 'su respuesta a esa pregunta' },
  { value: 'campo', label: 'Un dato tuyo del lead (campo propio)', enFrase: 'ese dato del lead' },
  { value: 'fuente', label: 'De dónde llegó el lead', enFrase: 'de dónde llegó' },
  { value: 'responsable', label: 'Quién lo está atendiendo', enFrase: 'quién lo atiende' },
  { value: 'monto', label: 'El monto de la venta', enFrase: 'el monto' },
  { value: 'campana', label: 'La campaña que lo trajo', enFrase: 'la campaña' },
];

export const COMPARADORES = [
  { value: 'contiene', label: 'incluye estas palabras', enFrase: 'incluye' },
  { value: 'no_contiene', label: 'NO incluye estas palabras', enFrase: 'no incluye' },
  { value: 'es', label: 'dice exactamente esto', enFrase: 'dice exactamente' },
  { value: 'no_es', label: 'dice cualquier cosa menos esto', enFrase: 'no dice' },
  { value: 'mayor_que', label: 'es un número mayor que', enFrase: 'es mayor que' },
  { value: 'menor_que', label: 'es un número menor que', enFrase: 'es menor que' },
  { value: 'vacio', label: 'viene en blanco (no contestó)', enFrase: 'viene en blanco' },
  { value: 'no_vacio', label: 'trae algo escrito, sea lo que sea', enFrase: 'trae algo escrito' },
];

export const SIN_VALOR = ['vacio', 'no_vacio'];
export const SEMAFOROS = [
  { value: 'green', titulo: 'Marcarlo VERDE', ayuda: 'Es un buen lead: hay que contactarlo.', enFrase: 'lo marco verde' },
  { value: 'yellow', titulo: 'Marcarlo AMARILLO', ayuda: 'Dudoso: alguien tiene que mirarlo antes.', enFrase: 'lo marco amarillo' },
  { value: 'red', titulo: 'Marcarlo ROJO', ayuda: 'No sirve: no vale la pena llamarlo.', enFrase: 'lo marco rojo' },
  { value: '', titulo: 'No tocar el color', ayuda: 'Sólo anotar el motivo o descartarlo, sin calificar.', enFrase: 'no le cambio el color' },
];
export const CONDICION_NUEVA: Condicion = { donde: 'respuestas', comparador: 'contiene', valor: '' };

export const NUMERICOS = ['mayor_que', 'menor_que'];

export function loQueFalta(borrador: Borrador): Falta[] {
  const faltas: Falta[] = [];
  borrador.condiciones.forEach((condicion, indice) => {
    const cual = borrador.condiciones.length > 1 ? ` de la comprobación ${indice + 1}` : '';
    if (['pregunta', 'campo'].includes(condicion.donde) && !String(condicion.clave ?? '').trim()) {
      faltas.push({
        texto: condicion.donde === 'pregunta' ? `Elige cuál pregunta mirar${cual}.` : `Escribe cuál de tus campos mirar${cual}.`,
        ancla: `regla-cual-${indice}`,
      });
    }
    if (!SIN_VALOR.includes(condicion.comparador) && !String(condicion.valor ?? '').trim()) {
      faltas.push({
        texto: NUMERICOS.includes(condicion.comparador)
          ? `Escribe el número con el que comparar${cual}.`
          : `Escribe el texto que hay que buscar${cual}.`,
        ancla: `regla-valor-${indice}`,
      });
    }
  });
  if (!borrador.acciones.semaforo && !borrador.acciones.etapa && !borrador.acciones.calificacion && !borrador.acciones.descartarMotivo) {
    faltas.push({
      texto: 'Elige qué hacer con esos leads: un color, una columna, una calificación, o varias de ellas.',
      ancla: 'regla-acciones',
    });
  }
  if (!borrador.nombre.trim()) faltas.push({ texto: 'Ponle un nombre a la regla.', ancla: 'regla-nombre' });
  return faltas;
}

export function comoSeLee(borrador: Borrador, etapas: EtapaDisponible[] = []): string {
  const partes = borrador.condiciones.map((condicion) => {
    const donde = DONDE.find((opcion) => opcion.value === condicion.donde)?.enFrase ?? condicion.donde;
    const compara = COMPARADORES.find((opcion) => opcion.value === condicion.comparador)?.enFrase ?? condicion.comparador;
    const valor = SIN_VALOR.includes(condicion.comparador) ? '' : ` «${String(condicion.valor ?? '').trim() || '…'}»`;
    const cual = condicion.clave ? ` (${condicion.clave})` : '';
    return `${donde}${cual} ${compara}${valor}`;
  });
  const unidas = partes.join(borrador.unir === 'alguna' ? ', o bien ' : ', y además ');
  const etapa = etapas.find((opcion) => opcion.value === (borrador.acciones.etapa ?? ''));
  const hechos = [
    borrador.acciones.semaforo
      ? SEMAFOROS.find((opcion) => opcion.value === borrador.acciones.semaforo)?.enFrase
      : '',
    etapa ? `lo muevo a «${etapa.titulo}»` : '',
    borrador.acciones.calificacion ? `lo dejo como «${CALIFICACION_ROTULOS[borrador.acciones.calificacion] ?? borrador.acciones.calificacion}»` : '',
    borrador.acciones.descartarMotivo ? `lo descarto («${borrador.acciones.descartarMotivo}»)` : '',
  ].filter(Boolean);
  return `Si ${unidas || '…'}, entonces ${hechos.join(' y ') || 'no hago nada todavía'}.`;
}
