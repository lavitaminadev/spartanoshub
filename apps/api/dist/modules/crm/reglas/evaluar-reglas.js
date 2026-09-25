"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.comparable = comparable;
exports.evaluarCondicion = evaluarCondicion;
exports.primeraReglaQueCalza = primeraReglaQueCalza;
function comparable(texto) {
    return String(texto ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}
function numeroDe(valor) {
    if (typeof valor === 'number')
        return Number.isFinite(valor) ? valor : undefined;
    const texto = String(valor ?? '');
    const encontrado = texto.match(/-?\d[\d.,]*/);
    if (!encontrado)
        return undefined;
    const limpio = encontrado[0].replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
    const numero = Number(limpio);
    return Number.isFinite(numero) ? numero : undefined;
}
function textosDe(lead, condicion) {
    const respuestas = Array.isArray(lead.respuestas) ? lead.respuestas : [];
    switch (condicion.donde) {
        case 'respuestas':
            return respuestas.map((fila) => String(fila?.respuesta ?? ''));
        case 'pregunta': {
            const buscada = comparable(condicion.clave);
            if (!buscada)
                return [];
            return respuestas
                .filter((fila) => comparable(fila?.pregunta).includes(buscada))
                .map((fila) => String(fila?.respuesta ?? ''));
        }
        case 'campo': {
            if (!condicion.clave)
                return [];
            const valor = lead.campos?.[condicion.clave];
            if (valor === undefined || valor === null)
                return [];
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
            return [];
    }
}
function evaluarCondicion(lead, condicion) {
    const textos = textosDe(lead, condicion);
    if (condicion.comparador === 'vacio')
        return { cumple: !textos.some((texto) => texto.trim()) };
    if (condicion.comparador === 'no_vacio') {
        const conValor = textos.find((texto) => texto.trim());
        return conValor ? { cumple: true, porque: conValor } : { cumple: false };
    }
    if (condicion.comparador === 'mayor_que' || condicion.comparador === 'menor_que') {
        const referencia = numeroDe(condicion.valor);
        if (referencia === undefined)
            return { cumple: false };
        for (const texto of textos) {
            const numero = numeroDe(texto);
            if (numero === undefined)
                continue;
            const cumple = condicion.comparador === 'mayor_que' ? numero > referencia : numero < referencia;
            if (cumple)
                return { cumple: true, porque: texto };
        }
        return { cumple: false };
    }
    const buscado = comparable(condicion.valor);
    if (!buscado)
        return { cumple: false };
    const coincide = (texto) => {
        const limpio = comparable(texto);
        return condicion.comparador === 'es' || condicion.comparador === 'no_es'
            ? limpio === buscado
            : limpio.includes(buscado);
    };
    const negativa = condicion.comparador === 'no_contiene' || condicion.comparador === 'no_es';
    const encontrado = textos.find(coincide);
    if (negativa)
        return { cumple: !encontrado };
    return encontrado ? { cumple: true, porque: encontrado } : { cumple: false };
}
function primeraReglaQueCalza(lead, reglas, modo = 'automatica') {
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
        if (!calza)
            continue;
        const motivos = resultados
            .filter((resultado) => resultado.cumple && resultado.porque)
            .map((resultado) => resultado.porque);
        const porque = motivos.length > 0 ? [...new Set(motivos)].join(' · ') : regla.nombre;
        return { reglaId: regla.id, nombre: regla.nombre, acciones: regla.acciones ?? {}, porque };
    }
    return null;
}
