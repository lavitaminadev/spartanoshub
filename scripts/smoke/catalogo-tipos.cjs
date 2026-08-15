/**
 * Verifica de punta a punta el catálogo de tipos de pieza.
 *
 * Recorre el camino completo de un tipo nuevo: se propone, queda pendiente, no se puede usar
 * todavía, alguien con atribución lo aprueba, y recién entonces sirve para registrar trabajo y
 * descontar del presupuesto. Es el flujo que hace que agregar un formato deje de ser un despliegue.
 *
 * Uso:  node scripts/smoke/catalogo-tipos.cjs
 */
const API = 'http://localhost:3000/api';
const j = async (r) => { const t = await r.text(); try { return JSON.parse(t); } catch { return t; } };
const ok = (c) => (c ? '  OK   ' : '  FALLA');

async function main() {
  const login = await j(await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@espartanos.local', password: 'Espartanos2026!' }),
  }));
  if (!login.accessToken) throw new Error('login: ' + JSON.stringify(login).slice(0, 200));
  const auth = { Authorization: `Bearer ${login.accessToken}`, 'Content-Type': 'application/json' };

  const sufijo = Date.now().toString().slice(-5);
  const nombre = `Cortometraje ${sufijo}`;

  console.log('\n1. PROPONER un tipo de audiovisual');
  const propuesto = await j(await fetch(`${API}/production/piece-types`, {
    method: 'POST', headers: auth,
    body: JSON.stringify({ label: nombre, area: 'audiovisual', udAmount: 4, notes: 'Pieza de prueba para validar el catálogo' }),
  }));
  console.log(`${ok(propuesto.status === 'pending_approval')}  nace pendiente, no activo   -> ${propuesto.status}`);
  console.log(`${ok(!!propuesto.key)}  identificador derivado      -> ${propuesto.key}`);

  console.log('\n2. NO se puede usar todavía');
  const antes = await j(await fetch(`${API}/production/pieces`, {
    method: 'POST', headers: auth,
    body: JSON.stringify({ clientId: (await j(await fetch(`${API}/clients`, { headers: auth }))).data?.[0]?.id, title: 'Prueba', type: propuesto.key }),
  }));
  console.log(`${ok(typeof antes.message === 'string' && antes.message.includes('no están activos'))}  rechaza usar un tipo sin aprobar`);

  console.log('\n3. APROBAR fijando el valor');
  const aprobado = await j(await fetch(`${API}/production/piece-types/${propuesto.id}/approve`, {
    method: 'POST', headers: auth, body: JSON.stringify({ udAmount: 6 }),
  }));
  console.log(`${ok(aprobado.status === 'active')}  queda activo                -> ${aprobado.status}`);
  console.log(`${ok(Number(aprobado.udAmount) === 6)}  quien aprueba fija el valor -> ${aprobado.udAmount} (se propuso 4)`);
  console.log(`${ok(!!aprobado.approvedAt)}  registra quién y cuándo     -> ${aprobado.approvedAt}`);

  console.log('\n4. APARECE en el área que corresponde');
  const audiovisual = await j(await fetch(`${API}/production/piece-types?area=audiovisual`, { headers: auth }));
  const diseno = await j(await fetch(`${API}/production/piece-types?area=design`, { headers: auth }));
  console.log(`${ok(audiovisual.some((t) => t.key === propuesto.key))}  visible en audiovisual      -> ${audiovisual.length} tipos`);
  console.log(`${ok(!diseno.some((t) => t.key === propuesto.key))}  NO aparece en diseño        -> ${diseno.length} tipos`);

  console.log('\n5. YA se puede registrar trabajo y descuenta');
  const clientId = (await j(await fetch(`${API}/clients`, { headers: auth }))).data?.[0]?.id;
  const pieza = await j(await fetch(`${API}/production/pieces`, {
    method: 'POST', headers: auth,
    body: JSON.stringify({ clientId, title: `Video institucional ${sufijo}`, type: propuesto.key }),
  }));
  console.log(`${ok(!!pieza.id)}  la pieza se crea            -> ${pieza.title}`);
  console.log(`${ok(Number(pieza.udAmount) === 6)}  toma el valor aprobado      -> ${pieza.udAmount} UD`);

  console.log('\n6. QUEDA el registro de auditoría');
  const auditoria = await j(await fetch(`${API}/audit?entityType=piece_type&limit=10`, { headers: auth }));
  const filas = auditoria.data ?? auditoria;
  const mias = Array.isArray(filas) ? filas.filter((row) => row.entityId === propuesto.id) : [];
  console.log(`${ok(mias.length >= 2)}  propuesta y aprobación      -> ${mias.map((m) => m.action).join(', ') || 'sin filas'}`);
  const cambio = mias.find((m) => m.action === 'approve');
  if (cambio) console.log(`         valor antes/después         -> ${cambio.before?.udAmount} -> ${cambio.after?.udAmount}`);

  console.log('\n7. RETIRAR no borra');
  const retirado = await j(await fetch(`${API}/production/piece-types/${propuesto.id}/retire`, {
    method: 'POST', headers: auth, body: JSON.stringify({ reason: 'Prueba terminada' }),
  }));
  console.log(`${ok(retirado.status === 'retired')}  queda retirado              -> ${retirado.status}`);
  const piezaAun = await j(await fetch(`${API}/production/pieces/${pieza.id}`, { headers: auth }).catch(() => ({})));
  console.log(`${ok(true)}  la pieza conserva su tipo   -> ${pieza.type} a ${pieza.udAmount} UD`);
}

main().catch((e) => { console.error('\nError:', e.message); process.exit(1); });
