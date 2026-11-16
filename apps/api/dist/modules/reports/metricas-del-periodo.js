"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.comoFecha = comoFecha;
exports.rangoDelMes = rangoDelMes;
exports.metricasDelPeriodo = metricasDelPeriodo;
exports.rangoDeComparacion = rangoDeComparacion;
function comoFecha(fecha) {
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}
function rangoDelMes(year, month) {
    return { desde: comoFecha(new Date(year, month - 1, 1)), hasta: comoFecha(new Date(year, month, 1)) };
}
async function metricasDelPeriodo(dataSource, organizationId, clientId, desde, hasta) {
    const params = [organizationId, clientId, desde, hasta];
    const [[ads], [bookings], [production], [meetings], [sales]] = await Promise.all([
        dataSource.query('SELECT COALESCE(SUM(spend),0) spend, COALESCE(SUM(impressions),0) impressions, COALESCE(SUM(clicks),0) clicks, COALESCE(SUM(leads),0) leads, COALESCE(SUM(conversions),0) conversions FROM integration_metrics WHERE organization_id = ? AND client_id = ? AND metric_date >= ? AND metric_date < ?', params),
        dataSource.query("SELECT COUNT(*) total, SUM(CASE WHEN status = 'attended' THEN 1 ELSE 0 END) attended, SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) noShow FROM reservations WHERE organization_id = ? AND client_id = ? AND starts_at >= ? AND starts_at < ?", params),
        dataSource.query("SELECT COUNT(*) delivered, COALESCE(SUM(ud_amount),0) ud FROM pieces WHERE organization_id = ? AND client_id = ? AND delivered_at >= ? AND delivered_at < ? AND status = 'delivered'", params),
        dataSource.query("SELECT COUNT(*) total, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) completed FROM meetings WHERE organization_id = ? AND client_id = ? AND scheduled_at >= ? AND scheduled_at < ?", params),
        dataSource.query("SELECT COALESCE(SUM(amount),0) total, COUNT(*) count FROM crm_opportunities WHERE organization_id = ? AND client_id = ? AND stage IN ('won','closed_won') AND updated_at >= ? AND updated_at < ?", params),
    ]);
    return {
        desde,
        hasta,
        metricas: {
            impressions: Number(ads?.impressions ?? 0),
            clicks: Number(ads?.clicks ?? 0),
            leads: Number(ads?.leads ?? 0),
            conversions: Number(ads?.conversions ?? 0),
            bookings: Number(bookings?.total ?? 0),
            attendedBookings: Number(bookings?.attended ?? 0),
            noShows: Number(bookings?.noShow ?? 0),
            deliveredPieces: Number(production?.delivered ?? 0),
            consumedUd: Number(production?.ud ?? 0),
            meetings: Number(meetings?.total ?? 0),
            completedMeetings: Number(meetings?.completed ?? 0),
            wonOpportunities: Number(sales?.count ?? 0),
        },
        inversion: Number(ads?.spend ?? 0),
        ventas: Number(sales?.total ?? 0),
    };
}
function rangoDeComparacion(desde, hasta, modo) {
    if (modo === 'ninguna')
        return null;
    const inicio = new Date(`${desde}T12:00:00`);
    const fin = new Date(`${hasta}T12:00:00`);
    if (modo === 'ano_anterior') {
        return {
            desde: comoFecha(new Date(inicio.getFullYear() - 1, inicio.getMonth(), inicio.getDate())),
            hasta: comoFecha(new Date(fin.getFullYear() - 1, fin.getMonth(), fin.getDate())),
        };
    }
    const esMesCompleto = inicio.getDate() === 1 && fin.getDate() === 1
        && (fin.getFullYear() * 12 + fin.getMonth()) - (inicio.getFullYear() * 12 + inicio.getMonth()) === 1;
    if (esMesCompleto) {
        return { desde: comoFecha(new Date(inicio.getFullYear(), inicio.getMonth() - 1, 1)), hasta: desde };
    }
    const dias = Math.max(1, Math.round((fin.getTime() - inicio.getTime()) / 86_400_000));
    return {
        desde: comoFecha(new Date(inicio.getTime() - dias * 86_400_000)),
        hasta: desde,
    };
}
