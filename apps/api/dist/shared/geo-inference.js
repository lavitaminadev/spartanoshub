"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeGeoValue = normalizeGeoValue;
exports.inferLocationFromPhone = inferLocationFromPhone;
const CL_AREA_CODES = {
    '2': { region: 'Region Metropolitana de Santiago', city: 'Santiago' },
    '32': { region: 'Valparaiso', city: 'Valparaiso' },
    '33': { region: 'Valparaiso', city: 'Quillota' },
    '34': { region: 'Valparaiso', city: 'San Felipe' },
    '35': { region: 'Valparaiso', city: 'San Antonio' },
    '41': { region: 'Biobio', city: 'Concepcion' },
    '42': { region: 'Nuble', city: 'Chillan' },
    '43': { region: 'Biobio', city: 'Los Angeles' },
    '45': { region: 'La Araucania', city: 'Temuco' },
    '51': { region: 'Coquimbo', city: 'La Serena' },
    '52': { region: 'Atacama', city: 'Copiapo' },
    '53': { region: 'Coquimbo', city: 'Ovalle' },
    '55': { region: 'Antofagasta', city: 'Antofagasta' },
    '57': { region: 'Tarapaca', city: 'Iquique' },
    '58': { region: 'Arica y Parinacota', city: 'Arica' },
    '61': { region: 'Magallanes', city: 'Punta Arenas' },
    '63': { region: 'Los Rios', city: 'Valdivia' },
    '64': { region: 'Los Lagos', city: 'Osorno' },
    '65': { region: 'Los Lagos', city: 'Puerto Montt' },
    '67': { region: 'Aysen', city: 'Coyhaique' },
    '71': { region: 'Maule', city: 'Talca' },
    '72': { region: "O'Higgins", city: 'Rancagua' },
    '73': { region: 'Maule', city: 'Linares' },
    '75': { region: 'Maule', city: 'Curico' },
};
const COUNTRY_PREFIXES = [
    { prefix: '56', country: 'cl' },
    { prefix: '54', country: 'ar' },
    { prefix: '51', country: 'pe' },
    { prefix: '591', country: 'bo' },
    { prefix: '598', country: 'uy' },
    { prefix: '595', country: 'py' },
    { prefix: '57', country: 'co' },
    { prefix: '52', country: 'mx' },
    { prefix: '34', country: 'es' },
    { prefix: '1', country: 'us' },
];
function normalizeGeoValue(value) {
    return value
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}
function digitsOnly(phone) {
    return phone.replace(/\D/g, '');
}
function inferLocationFromPhone(phone, defaultCountryPrefix = '56') {
    if (!phone)
        return {};
    let digits = digitsOnly(phone);
    if (!digits)
        return {};
    if (digits.length <= 9)
        digits = `${defaultCountryPrefix}${digits}`;
    const match = COUNTRY_PREFIXES
        .filter((entry) => digits.startsWith(entry.prefix))
        .sort((a, b) => b.prefix.length - a.prefix.length)[0];
    if (!match)
        return {};
    const result = { country: match.country };
    if (match.country !== 'cl')
        return result;
    const national = digits.slice(match.prefix.length);
    if (national.startsWith('9'))
        return result;
    const area = national.startsWith('2') ? '2' : national.slice(0, 2);
    const location = CL_AREA_CODES[area];
    if (!location)
        return result;
    return {
        country: match.country,
        region: normalizeGeoValue(location.region),
        city: normalizeGeoValue(location.city),
    };
}
