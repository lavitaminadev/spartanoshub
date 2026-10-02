"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dominioDelRemitente = dominioDelRemitente;
exports.revisarFirmaDelDominio = revisarFirmaDelDominio;
const promises_1 = require("node:dns/promises");
const SELECTOR_POR_OMISION = 'default';
function dominioDelRemitente(remitente) {
    const texto = (remitente ?? '').trim();
    const dentro = texto.match(/<([^>]+)>/);
    const direccion = (dentro ? dentro[1] : texto).trim();
    const arroba = direccion.lastIndexOf('@');
    if (arroba < 1 || arroba === direccion.length - 1)
        return null;
    const dominio = direccion.slice(arroba + 1).toLowerCase();
    return dominio.includes('.') ? dominio : null;
}
function etiqueta(registro, clave) {
    for (const parte of registro.split(';')) {
        const [nombre, ...resto] = parte.trim().split('=');
        if (nombre.trim().toLowerCase() === clave)
            return resto.join('=').trim();
    }
    return null;
}
function unir(registros) {
    return registros.map((trozos) => trozos.join(''));
}
async function revisarFirmaDelDominio(remitente, selector = SELECTOR_POR_OMISION) {
    const dominio = dominioDelRemitente(remitente);
    if (!dominio)
        return null;
    const resolver = new promises_1.Resolver({ timeout: 3_000, tries: 2 });
    const txt = async (nombre) => {
        try {
            return unir(await resolver.resolveTxt(nombre));
        }
        catch (error) {
            const codigo = error.code;
            return codigo === 'ENOTFOUND' || codigo === 'ENODATA' ? [] : null;
        }
    };
    const [spfTxt, dkimTxt, dmarcTxt] = await Promise.all([
        txt(dominio),
        txt(`${selector}._domainkey.${dominio}`),
        txt(`_dmarc.${dominio}`),
    ]);
    if (spfTxt === null && dkimTxt === null && dmarcTxt === null) {
        return {
            dominio,
            spf: { publicado: false, registro: null, politica: null },
            dkim: { publicado: false, selector },
            dmarc: { publicado: false, registro: null, politica: null, informes: false },
            problemas: [],
            consultado: false,
        };
    }
    const spf = (spfTxt ?? []).find((fila) => fila.toLowerCase().startsWith('v=spf1')) ?? null;
    const dkim = (dkimTxt ?? []).some((fila) => fila.toLowerCase().includes('p='));
    const dmarc = (dmarcTxt ?? []).find((fila) => fila.toLowerCase().startsWith('v=dmarc1')) ?? null;
    const problemas = [];
    if (!spf)
        problemas.push({ nivel: 'error', texto: `Falta el SPF en ${dominio}. Sin él Gmail y Yahoo mandan a spam los envíos en volumen.` });
    if (!dkim)
        problemas.push({ nivel: 'error', texto: `Falta la clave DKIM en ${selector}._domainkey.${dominio}. Es la firma que prueba que el correo salió de este dominio.` });
    const politicaSpf = spf ? (spf.match(/[~\-+?]all\b/)?.[0] ?? null) : null;
    if (politicaSpf === '+all')
        problemas.push({ nivel: 'error', texto: `El SPF de ${dominio} termina en «+all», que autoriza a cualquier servidor a enviar en su nombre. Debe ser «-all» o «~all».` });
    else if (politicaSpf === '?all')
        problemas.push({ nivel: 'aviso', texto: `El SPF de ${dominio} termina en «?all», que no afirma nada. «-all» es lo que protege el dominio.` });
    const politicaDmarc = dmarc ? (etiqueta(dmarc, 'p')?.toLowerCase() ?? null) : null;
    const informes = Boolean(dmarc && etiqueta(dmarc, 'rua'));
    if (!dmarc) {
        problemas.push({ nivel: 'error', texto: `Falta el DMARC en _dmarc.${dominio}. Empieza por «v=DMARC1; p=none; rua=mailto:dmarc@${dominio}», que no rechaza nada y deja ver quién envía.` });
    }
    else {
        if (politicaDmarc === 'none') {
            problemas.push({
                nivel: 'aviso',
                texto: `El DMARC de ${dominio} está en «p=none»: cumple el requisito de Gmail y no rechaza nada, pero tampoco impide que alguien suplante el dominio. El paso siguiente es «p=quarantine» después de mirar unas semanas de informes.`,
            });
        }
        if (!informes) {
            problemas.push({
                nivel: 'aviso',
                texto: `El DMARC de ${dominio} no tiene «rua=», así que nadie recibe los informes y no hay cómo saber si algo se está rechazando. Agrega «rua=mailto:dmarc@${dominio}».`,
            });
        }
    }
    return {
        dominio,
        spf: { publicado: Boolean(spf), registro: spf, politica: politicaSpf },
        dkim: { publicado: dkim, selector },
        dmarc: { publicado: Boolean(dmarc), registro: dmarc, politica: politicaDmarc, informes },
        problemas,
        consultado: true,
    };
}
