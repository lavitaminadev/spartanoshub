/**
 * Medición de capacidad de reservas.
 *
 * Responde dos preguntas distintas que suelen confundirse:
 *
 * 1. **Cuántas reservas simultáneas soporta UN formulario.** Todas se serializan: cada
 *    transacción bloquea la fila del formulario para impedir sobrecupo. El techo es
 *    `1 / duración de la transacción`, y no mejora con más usuarios ni más procesos.
 * 2. **Cuántas personas pueden estar navegando a la vez.** Eso no se serializa: lo limita el
 *    pool de conexiones y el procesador.
 *
 * El número de (1) se traslada a producción ajustado por la lentitud relativa del servidor,
 * porque el cuello es el bloqueo en la base, no la máquina. El de (2) no se traslada.
 *
 * Uso:  node scripts/smoke/carga-reservas.cjs [reservas] [lectores]
 */
const API = 'http://localhost:3000/api';
const RESERVAS = Number(process.argv[2] || 20);
const LECTORES = Number(process.argv[3] || 30);

const j = async (r) => { const t = await r.text(); try { return JSON.parse(t); } catch { return t; } };
const pct = (arr, p) => arr.slice().sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor(arr.length * p))];

async function main() {
  const login = await j(await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@espartanos.local', password: 'Espartanos2026!' }),
  }));
  if (!login.accessToken) throw new Error('login: ' + JSON.stringify(login).slice(0, 120));
  const auth = { Authorization: `Bearer ${login.accessToken}`, 'Content-Type': 'application/json' };

  const clients = await j(await fetch(`${API}/clients`, { headers: auth }));
  const clientId = (clients.data || clients)[0]?.id;

  const form = await j(await fetch(`${API}/reservations/forms`, {
    method: 'POST', headers: auth,
    body: JSON.stringify({ clientId, name: `Carga ${Date.now()}`, mode: 'appointment' }),
  }));
  // Cupo alto y sin tope diario: se mide velocidad, no rechazo por capacidad.
  const pub = await j(await fetch(`${API}/reservations/forms/${form.id}`, {
    method: 'PATCH', headers: auth,
    body: JSON.stringify({ dailyCapacity: 0, capacityPerSlot: 500, minimumNoticeHours: 0, status: 'published' }),
  }));
  if (pub.status !== 'published') throw new Error('publicar: ' + JSON.stringify(pub).slice(0, 200));

  const base = new Date();
  base.setUTCDate(base.getUTCDate() + 4);
  while ([0, 6].includes(base.getUTCDay())) base.setUTCDate(base.getUTCDate() + 1);
  base.setUTCHours(14, 0, 0, 0);

  console.log(`Formulario ${pub.publicSlug}\n`);

  // ---- 1. Reservas simultáneas sobre el mismo formulario ----
  const tiempos = [];
  const inicio = Date.now();
  const res = await Promise.all(Array.from({ length: RESERVAS }, (_, i) => {
    const t0 = Date.now();
    return fetch(`${API}/public/reservations/${pub.publicSlug}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startsAt: new Date(base.getTime() + i * 60000).toISOString(),
        guestName: `Comensal ${i}`, guestPhone: `+569220000${String(i).padStart(3, '0')}`, partySize: 1,
        answers: { name: `C${i}`, phone: `+569220000${String(i).padStart(3, '0')}`, consent: true },
        idempotencyKey: `carga-${Date.now()}-${i}-aaaaaaaaaaaaaaa`,
      }),
    }).then(async (r) => { tiempos.push(Date.now() - t0); return { status: r.status, body: await j(r) }; })
      .catch(() => ({ status: 0 }));
  }));
  const totalMs = Date.now() - inicio;
  const ok = res.filter((r) => r.status === 201 || r.status === 200).length;
  const limitadas = res.filter((r) => r.status === 429).length;

  console.log(`RESERVAS SIMULTÁNEAS (${RESERVAS} a la vez, mismo formulario)`);
  console.log(`  creadas            ${ok}`);
  if (limitadas) console.log(`  frenadas por límite ${limitadas}  ← sube THROTTLE_LIMIT para medir limpio`);
  if (ok > 0) {
    console.log(`  tiempo total       ${totalMs} ms`);
    console.log(`  por reserva        ${(totalMs / ok).toFixed(0)} ms  (serializadas por el bloqueo)`);
    console.log(`  mediana / p95      ${pct(tiempos, 0.5)} / ${pct(tiempos, 0.95)} ms`);
    console.log(`  techo del formulario ≈ ${(1000 / (totalMs / ok)).toFixed(1)} reservas/segundo`);
  }

  // ---- 2. Lecturas concurrentes ----
  const tl = [];
  const i2 = Date.now();
  const lec = await Promise.all(Array.from({ length: LECTORES }, () => {
    const t0 = Date.now();
    return fetch(`${API}/public/reservations/${pub.publicSlug}`)
      .then(async (r) => { tl.push(Date.now() - t0); return r.status; }).catch(() => 0);
  }));
  const t2 = Date.now() - i2;
  const ok2 = lec.filter((s) => s === 200).length;
  console.log(`\nLECTURAS CONCURRENTES (${LECTORES} a la vez)`);
  console.log(`  correctas          ${ok2}`);
  console.log(`  tiempo total       ${t2} ms`);
  console.log(`  mediana / p95      ${pct(tl, 0.5)} / ${pct(tl, 0.95)} ms`);
  if (ok2 > 0) console.log(`  throughput         ${(ok2 / (t2 / 1000)).toFixed(0)} lecturas/segundo`);
}

main().catch((e) => { console.error('\nError:', e.message); process.exit(1); });
