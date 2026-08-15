/**
 * Prueba de reservas simultáneas.
 *
 * Publica un formulario con tope diario de 1 y dispara N reservas a la vez sobre el mismo
 * horario. Solo una debe quedar; el resto debe rechazarse con un conflicto explícito.
 *
 * Lo que verifica de verdad es que el bloqueo de la fila del formulario impida la inserción
 * fantasma: sin él, dos transacciones cuentan cero reservas y ambas insertan.
 */
const API = 'http://localhost:3000/api';
const CONCURRENTES = Number(process.argv[2] || 10);

const j = async (res) => { const t = await res.text(); try { return JSON.parse(t); } catch { return t; } };

async function main() {
  const login = await j(await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@espartanos.local', password: 'Espartanos2026!' }),
  }));
  if (!login.accessToken) throw new Error('login: ' + JSON.stringify(login).slice(0, 120));
  const auth = { Authorization: `Bearer ${login.accessToken}`, 'Content-Type': 'application/json' };

  const clients = await j(await fetch(`${API}/clients`, { headers: auth }));
  const clientId = (clients.data || clients)[0]?.id;
  if (!clientId) throw new Error('no hay clientes');

  const form = await j(await fetch(`${API}/reservations/forms`, {
    method: 'POST', headers: auth,
    body: JSON.stringify({ clientId, name: `Concurrencia ${Date.now()}`, mode: 'appointment' }),
  }));
  if (!form.id) throw new Error('crear formulario: ' + JSON.stringify(form).slice(0, 200));

  // Tope diario de 1: el segundo intento del mismo día debe rebotar.
  const publicado = await j(await fetch(`${API}/reservations/forms/${form.id}`, {
    method: 'PATCH', headers: auth,
    body: JSON.stringify({ dailyCapacity: 1, capacityPerSlot: 1, minimumNoticeHours: 0, status: 'published' }),
  }));
  if (publicado.status !== 'published') throw new Error('publicar: ' + JSON.stringify(publicado).slice(0, 200));

  // Un horario dentro de la ventana por defecto (lunes a viernes, 09:00–18:00).
  const cuando = new Date();
  cuando.setUTCDate(cuando.getUTCDate() + 3);
  while ([0, 6].includes(cuando.getUTCDay())) cuando.setUTCDate(cuando.getUTCDate() + 1);
  cuando.setUTCHours(17, 0, 0, 0); // 13:00 en Santiago

  console.log(`Formulario ${publicado.publicSlug} · tope diario 1 · ${CONCURRENTES} intentos simultáneos`);
  console.log(`Horario: ${cuando.toISOString()}\n`);

  const intentos = Array.from({ length: CONCURRENTES }, (_, i) => fetch(`${API}/public/reservations/${publicado.publicSlug}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      startsAt: cuando.toISOString(),
      guestName: `Comensal ${i + 1}`,
      guestPhone: `+5691100000${String(i).padStart(2, '0')}`,
      partySize: 1,
      answers: { name: `Comensal ${i + 1}`, phone: `+5691100000${String(i).padStart(2, '0')}`, consent: true },
      // Clave distinta por intento: se prueba la concurrencia, no la idempotencia.
      idempotencyKey: `concurrencia-${Date.now()}-${i}-aaaaaaaaaaaa`,
    }),
  }).then(async (r) => ({ status: r.status, body: await j(r) })).catch((e) => ({ status: 0, body: String(e) })));

  const res = await Promise.all(intentos);
  const porEstado = {};
  for (const r of res) porEstado[r.status] = (porEstado[r.status] || 0) + 1;

  console.log('Respuestas por código:');
  for (const [code, n] of Object.entries(porEstado).sort()) console.log(`  ${code}: ${n}`);

  const creadas = res.filter((r) => r.status === 201 || r.status === 200);
  const limitadas = res.filter((r) => r.status === 429);
  console.log(`\nReservas creadas: ${creadas.length}`);
  const mensajes = [...new Set(res.filter((r) => r.status >= 400).map((r) => r.body?.message).filter(Boolean))];
  if (mensajes.length) { console.log('Motivos de rechazo:'); for (const m of mensajes) console.log(`  - ${m}`); }

  // El limitador protege el endpoint público y cuenta por ventana de un minuto. Dos corridas
  // seguidas la agotan, y eso no dice nada sobre la concurrencia: la prueba queda sin
  // conclusión en vez de reportar un fallo que no ocurrió.
  if (limitadas.length && creadas.length === 0) {
    console.log(`\nSIN CONCLUSIÓN: el limitador rechazó ${limitadas.length} intentos.`);
    console.log('Espera un minuto entre corridas y vuelve a ejecutar.');
    process.exit(2);
  }

  console.log(creadas.length === 1
    ? '\nCORRECTO: el tope se respetó bajo concurrencia.'
    : `\nPROBLEMA: se esperaba 1 reserva y quedaron ${creadas.length}.`);
  process.exit(creadas.length === 1 ? 0 : 1);
}

main().catch((e) => { console.error('\nError:', e.message); process.exit(1); });
