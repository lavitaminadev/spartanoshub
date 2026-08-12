"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertTimeZone = assertTimeZone;
exports.zonedParts = zonedParts;
exports.localToUtc = localToUtc;
exports.tryLocalToUtc = tryLocalToUtc;
exports.startOfLocalDayUtc = startOfLocalDayUtc;
exports.addPlainDays = addPlainDays;
exports.plainDateParts = plainDateParts;
const common_1 = require("@nestjs/common");
function assertTimeZone(timeZone) {
    try {
        new Intl.DateTimeFormat('en-US', { timeZone }).format();
    }
    catch {
        throw new common_1.BadRequestException('Zona horaria inválida');
    }
}
const FORMATTERS = new Map();
function formatterFor(timeZone) {
    const cached = FORMATTERS.get(timeZone);
    if (cached)
        return cached;
    assertTimeZone(timeZone);
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' });
    FORMATTERS.set(timeZone, formatter);
    return formatter;
}
function zonedParts(date, timeZone) {
    const parts = Object.fromEntries(formatterFor(timeZone).formatToParts(date).map((part) => [part.type, part.value]));
    const weekdays = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), hour: Number(parts.hour), minute: Number(parts.minute), weekday: weekdays[parts.weekday] };
}
function localToUtc(date, time, timeZone) {
    assertTimeZone(timeZone);
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    if (![year, month, day, hour, minute].every(Number.isFinite))
        throw new common_1.BadRequestException('Fecha u hora inválida');
    let guess = Date.UTC(year, month - 1, day, hour, minute);
    for (let attempt = 0; attempt < 2; attempt += 1) {
        const parts = zonedParts(new Date(guess), timeZone);
        const represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
        guess -= represented - Date.UTC(year, month - 1, day, hour, minute);
    }
    const result = new Date(guess);
    const check = zonedParts(result, timeZone);
    if (check.year !== year || check.month !== month || check.day !== day || check.hour !== hour || check.minute !== minute)
        throw new common_1.BadRequestException('La hora no existe en esa zona horaria');
    return result;
}
function tryLocalToUtc(date, time, timeZone) {
    try {
        return localToUtc(date, time, timeZone);
    }
    catch {
        return null;
    }
}
function startOfLocalDayUtc(date, timeZone) {
    for (let hour = 0; hour < 4; hour += 1) {
        const candidate = tryLocalToUtc(date, `${String(hour).padStart(2, '0')}:00`, timeZone);
        if (candidate)
            return candidate;
    }
    throw new common_1.BadRequestException('No se pudo determinar el inicio del día en esa zona horaria');
}
function addPlainDays(value, days) {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + days));
    return date.toISOString().slice(0, 10);
}
function plainDateParts(value) { const [year, month, day] = value.split('-').map(Number); return { year, month, day, weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay() }; }
