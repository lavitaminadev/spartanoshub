"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.partirLinea = partirLinea;
exports.interpretarCsv = interpretarCsv;
const COLUMNAS = {
    email: ['email', 'correo', 'correo electrónico', 'correo electronico', 'e-mail', 'mail', 'dirección de correo electrónico'],
    name: ['nombre', 'name', 'nombre completo', 'full name', 'apellido y nombre'],
    consent: ['acepta', 'acepto', 'consentimiento', 'promociones', 'novedades', 'newsletter', 'suscripción', 'suscripcion', 'marketing'],
};
const AFIRMATIVAS = new Set([
    'si', 'sí', 'yes', 'true', '1', 'acepto', 'de acuerdo', 'x', 'ok',
    'sí, acepto', 'si, acepto', 'acepto recibir novedades',
]);
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function clave(texto) {
    return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}
function columnaDe(encabezados, candidatos) {
    const normalizados = encabezados.map(clave);
    const buscados = candidatos.map(clave);
    const exacta = normalizados.findIndex((cabecera) => buscados.includes(cabecera));
    if (exacta >= 0)
        return exacta;
    return normalizados.findIndex((cabecera) => buscados.some((buscado) => cabecera.includes(buscado)));
}
function partirLinea(linea) {
    const campos = [];
    let actual = '';
    let entreComillas = false;
    for (let i = 0; i < linea.length; i += 1) {
        const caracter = linea[i];
        if (caracter === '"') {
            if (entreComillas && linea[i + 1] === '"') {
                actual += '"';
                i += 1;
                continue;
            }
            entreComillas = !entreComillas;
            continue;
        }
        if ((caracter === ',' || caracter === ';') && !entreComillas) {
            campos.push(actual);
            actual = '';
            continue;
        }
        actual += caracter;
    }
    campos.push(actual);
    return campos.map((campo) => campo.trim());
}
function interpretarCsv(contenido, maximo = 5000) {
    const lineas = contenido.split(/\r?\n/).filter((linea) => linea.trim().length > 0);
    if (lineas.length < 2) {
        return { filas: [], descartadas: [{ linea: 1, motivo: 'El archivo no tiene encabezado y datos' }] };
    }
    const encabezados = partirLinea(lineas[0]);
    const iEmail = columnaDe(encabezados, COLUMNAS.email);
    if (iEmail < 0) {
        return {
            filas: [],
            descartadas: [{ linea: 1, motivo: 'No se encontró una columna de correo' }],
        };
    }
    const iNombre = columnaDe(encabezados, COLUMNAS.name);
    const iConsent = columnaDe(encabezados, COLUMNAS.consent);
    const filas = [];
    const descartadas = [];
    const vistos = new Set();
    for (let n = 1; n < lineas.length && filas.length < maximo; n += 1) {
        const campos = partirLinea(lineas[n]);
        const email = (campos[iEmail] ?? '').trim().toLowerCase();
        if (!email) {
            descartadas.push({ linea: n + 1, motivo: 'Sin correo' });
            continue;
        }
        if (!CORREO.test(email)) {
            descartadas.push({ linea: n + 1, motivo: 'El correo no tiene forma de correo' });
            continue;
        }
        if (vistos.has(email)) {
            descartadas.push({ linea: n + 1, motivo: 'Repetido en el archivo' });
            continue;
        }
        vistos.add(email);
        const respuestaCruda = iConsent >= 0 ? (campos[iConsent] ?? '').trim() : undefined;
        filas.push({
            email,
            name: iNombre >= 0 ? (campos[iNombre] ?? '').trim() || undefined : undefined,
            acepta: respuestaCruda !== undefined && AFIRMATIVAS.has(clave(respuestaCruda)),
            respuestaCruda,
        });
    }
    return { filas, descartadas };
}
