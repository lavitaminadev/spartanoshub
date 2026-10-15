"use strict";
/**
 * @fileoverview Editar una encuesta que ya tiene respuestas sin perder nada.
 *
 * Reglas, iguales en el editor y en el servidor:
 *
 * - Cambiar la redacción, agregar, reordenar, cambiar reglas u opciones: permitido. La pregunta
 *   conserva su identificador, así que sus respuestas anteriores siguen contando en ella.
 * - Quitar una pregunta que ya pudo tener respuestas la **archiva**: deja de mostrarse a quien
 *   responde, pero sus respuestas siguen visibles en resultados, marcadas como archivadas.
 * - Cambiar el **tipo**, o declarar que la pregunta ahora pregunta otra cosa, abre una **versión
 *   nueva**: la anterior se cierra con su fecha y la nueva nace con identificador propio, así que
 *   sus respuestas nunca se suman. El criterio es uno solo: mismo identificador, misma cosa medida.
 *
 * Cada edición devuelve la lista de cambios en palabras, que se guarda como historial visible.
 * Esa lista es el registro de auditoría: nombra la pregunta, su versión y el motivo, de modo que
 * meses después se pueda reconstruir por qué un resultado quedó partido en dos bloques.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAXIMO_HISTORIAL = void 0;
exports.raizDePregunta = raizDePregunta;
exports.versionesDePregunta = versionesDePregunta;
exports.aplicarEdicionDePreguntas = aplicarEdicionDePreguntas;
const TIPOS = { nps: 'recomendación 0-10', rating: 'estrellas', text: 'texto libre', 'multiple-choice': 'opción múltiple' };
const corto = (texto) => (texto.length > 70 ? `${texto.slice(0, 67)}…` : texto);
/** Fecha corta para el historial: el día basta para ubicar el corte entre dos versiones. */
const dia = (iso) => {
    const [anio, mes, jornada] = iso.slice(0, 10).split('-');
    return jornada ? `${jornada}/${mes}/${anio}` : iso;
};
/** La familia a la que pertenece una pregunta: el id de su primera versión. */
function raizDePregunta(pregunta) {
    return pregunta.raizId ?? pregunta.id;
}
/** Todas las versiones de una misma pregunta, de la más nueva a la más antigua. */
function versionesDePregunta(preguntas, pregunta) {
    const raiz = raizDePregunta(pregunta);
    return preguntas.filter((otra) => raizDePregunta(otra) === raiz).sort((a, b) => (b.version ?? 1) - (a.version ?? 1));
}
/** Identificador de la versión siguiente, siempre libre dentro de la encuesta. */
function idDeVersion(raiz, version, ocupados) {
    let candidato = `${raiz}~v${version}`;
    let siguiente = version;
    while (ocupados.has(candidato))
        candidato = `${raiz}~v${++siguiente}`;
    return candidato;
}
/**
 * Compara las preguntas guardadas con las editadas y aplica las reglas.
 *
 * @param conRespuestas Si la encuesta ya recibió respuestas: sólo entonces se archiva en vez de
 *   quitar y un cambio de tipo abre versión nueva.
 * @param ahora Fecha de la edición, para marcar las preguntas cuya redacción cambió.
 * @param versionar Ids que quien edita declaró que «ahora preguntan otra cosa»: su cambio de
 *   redacción abre versión nueva en vez de conservar el identificador. Un cambio de tipo abre
 *   versión esté o no en esta lista, porque dos tipos distintos no se pueden agregar juntos.
 */
function aplicarEdicionDePreguntas(anteriores, editadas, conRespuestas, ahora, versionar = []) {
    const cambios = [];
    const previas = new Map(anteriores.map((pregunta) => [pregunta.id, pregunta]));
    const idsEditadas = new Set(editadas.map((pregunta) => pregunta.id));
    const resultado = [];
    // Qué preguntas abren versión nueva se decide antes de recorrer: las reglas que apuntaban a la
    // versión anterior tienen que repuntarse aunque la pregunta que las lleva venga antes en la lista.
    const pedidas = new Set(versionar);
    const ocupados = new Set([...previas.keys(), ...idsEditadas]);
    const versionados = new Map();
    if (conRespuestas) {
        for (const nueva of editadas) {
            const vieja = previas.get(nueva.id);
            if (!vieja || vieja.archivada || nueva.archivada)
                continue;
            const porTipo = vieja.type !== nueva.type;
            const otraPregunta = pedidas.has(nueva.id) && vieja.question.trim() !== nueva.question.trim();
            if (!porTipo && !otraPregunta)
                continue;
            const raiz = raizDePregunta(vieja);
            const version = Math.max(...versionesDePregunta(anteriores, vieja).map((q) => q.version ?? 1)) + 1;
            const nuevoId = idDeVersion(raiz, version, ocupados);
            ocupados.add(nuevoId);
            versionados.set(vieja.id, { vieja, nuevoId, version, porTipo, enunciado: nueva.question });
        }
    }
    for (const nueva of editadas) {
        const vieja = previas.get(nueva.id);
        if (!vieja) {
            cambios.push(nueva.dato ? `Se pide un dato nuevo: «${corto(nueva.question)}»` : `Pregunta agregada: «${corto(nueva.question)}»`);
            resultado.push({ ...nueva, archivada: undefined });
            continue;
        }
        const versionado = versionados.get(vieja.id);
        if (versionado) {
            const { nuevoId, version, porTipo } = versionado;
            const motivo = porTipo
                ? `el tipo cambió de ${TIPOS[vieja.type] ?? vieja.type} a ${TIPOS[nueva.type] ?? nueva.type}`
                : `ahora pregunta otra cosa («${corto(vieja.question)}» → «${corto(nueva.question)}»)`;
            cambios.push(`Versión nueva de «${corto(nueva.question)}» (v${version}): ${motivo}. La v${vieja.version ?? 1} queda cerrada el ${dia(ahora)} y sus resultados se muestran aparte.`);
            // La versión nueva nace limpia; la anterior queda cerrada con su fecha y sus respuestas.
            resultado.push({ ...nueva, id: nuevoId, raizId: raizDePregunta(vieja), version, vigenteDesde: ahora, vigenteHasta: undefined, archivada: undefined, editadaEn: undefined });
            resultado.push({ ...vieja, archivada: true, vigenteHasta: ahora });
            continue;
        }
        // El editor no maneja el versionado: su rastro se conserva desde lo guardado.
        const siguiente = { ...nueva, raizId: vieja.raizId, version: vieja.version, vigenteDesde: vieja.vigenteDesde, vigenteHasta: vieja.vigenteHasta };
        if (vieja.archivada && !nueva.archivada)
            cambios.push(`Pregunta restaurada: «${corto(nueva.question)}»`);
        if (!vieja.archivada && nueva.archivada)
            cambios.push(`Pregunta archivada: «${corto(nueva.question)}» (sus respuestas se conservan)`);
        if (vieja.question.trim() !== nueva.question.trim()) {
            cambios.push(`Redacción cambiada: «${corto(vieja.question)}» → «${corto(nueva.question)}»`);
            if (conRespuestas)
                siguiente.editadaEn = ahora;
        }
        else if (vieja.editadaEn) {
            siguiente.editadaEn = vieja.editadaEn;
        }
        if (Boolean(vieja.sensible) !== Boolean(nueva.sensible))
            cambios.push(`«${corto(nueva.question)}» ${nueva.sensible ? 'ahora se marca como dato sensible (pide autorización expresa)' : 'ya no se marca como dato sensible'}`);
        if (vieja.required !== nueva.required)
            cambios.push(`«${corto(nueva.question)}» ahora es ${nueva.required ? 'obligatoria' : 'opcional'}`);
        if (!vieja.archivada && conRespuestas === false && vieja.type !== nueva.type)
            cambios.push(`«${corto(nueva.question)}» cambió a ${TIPOS[nueva.type] ?? nueva.type}`);
        const opcionesViejas = vieja.options ?? [];
        const opcionesNuevas = nueva.options ?? [];
        const agregadas = opcionesNuevas.filter((opcion) => !opcionesViejas.includes(opcion));
        const quitadas = opcionesViejas.filter((opcion) => !opcionesNuevas.includes(opcion));
        if (agregadas.length || quitadas.length) {
            cambios.push(`Opciones de «${corto(nueva.question)}»${agregadas.length ? `: se agregó ${agregadas.map((o) => `«${o}»`).join(', ')}` : ''}${quitadas.length ? `${agregadas.length ? ';' : ':'} se quitó ${quitadas.map((o) => `«${o}»`).join(', ')} (las respuestas con esas opciones se conservan)` : ''}`);
        }
        const reglaVieja = JSON.stringify(vieja.mostrarSi ?? null);
        const reglaNueva = JSON.stringify(nueva.mostrarSi ?? null);
        if (reglaVieja !== reglaNueva)
            cambios.push(nueva.mostrarSi ? `Cambió cuándo se muestra «${corto(nueva.question)}»` : `«${corto(nueva.question)}» ahora se muestra siempre`);
        resultado.push(siguiente);
    }
    // Lo que ya no viene: con respuestas se archiva y queda al final; sin respuestas se quita.
    for (const vieja of anteriores) {
        if (idsEditadas.has(vieja.id))
            continue;
        if (conRespuestas) {
            if (!vieja.archivada)
                cambios.push(`Pregunta archivada: «${corto(vieja.question)}» (sus respuestas se conservan)`);
            resultado.push({ ...vieja, archivada: true });
        }
        else {
            cambios.push(vieja.dato ? `Ya no se pide: «${corto(vieja.question)}»` : `Pregunta quitada: «${corto(vieja.question)}»`);
        }
    }
    // Los datos de contacto se ordenan solos al principio: no cuentan como un cambio de orden.
    const ordenViejo = anteriores.filter((pregunta) => idsEditadas.has(pregunta.id) && !pregunta.dato).map((pregunta) => pregunta.id).join('|');
    const ordenNuevo = editadas.filter((pregunta) => previas.has(pregunta.id) && !pregunta.dato).map((pregunta) => pregunta.id).join('|');
    if (ordenViejo !== ordenNuevo)
        cambios.push('Cambió el orden de las preguntas');
    // Las reglas que apuntaban a una pregunta versionada tienen que repuntarse o caerse: si quedaran
    // apuntando a la versión cerrada, `preguntaVisible` ocultaría la pregunta dependiente para
    // siempre y sin aviso, porque una pregunta archivada nunca se muestra.
    if (versionados.size) {
        for (const [indice, pregunta] of resultado.entries()) {
            const destino = pregunta.mostrarSi && !pregunta.archivada ? versionados.get(pregunta.mostrarSi.preguntaId) : undefined;
            if (!destino)
                continue;
            if (destino.porTipo) {
                cambios.push(`«${corto(pregunta.question)}» ahora se muestra siempre: la pregunta de la que dependía cambió de tipo y sus respuestas ya no sirven como condición.`);
                resultado[indice] = { ...pregunta, mostrarSi: undefined };
            }
            else {
                cambios.push(`«${corto(pregunta.question)}» ahora depende de la v${destino.version} de «${corto(destino.enunciado)}».`);
                resultado[indice] = { ...pregunta, mostrarSi: { ...pregunta.mostrarSi, preguntaId: destino.nuevoId } };
            }
        }
    }
    return { preguntas: resultado, cambios };
}
/** Máximo de ediciones que se guardan: suficiente para auditar sin que el registro crezca sin fin. */
exports.MAXIMO_HISTORIAL = 100;
//# sourceMappingURL=survey-edits.js.map