/**
 * Verifica el hilo de comentarios de un trabajo.
 *
 * Comprueba lo que hace que los dos flujos sean utiles: que el hilo pertenezca al trabajo, que
 * la observacion interna y el comentario del cliente no se mezclen, que aparezca quien escribio,
 * y que editar deje marca.
 *
 * Uso:  node scripts/smoke/comentarios-proceso.cjs
 */
const API = 'http://localhost:3000/api';
const j = async (r) => { const t = await r.text(); try { return JSON.parse(t); } catch { return t; } };
const ok = (c) => (c ? '  OK   ' : '  FALLA');

async function main() {
  const login = await j(await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@espartanos.local', password: 'Espartanos2026!' }),
  }));
  const auth = { Authorization: `Bearer ${login.accessToken}`, 'Content-Type': 'application/json' };

  const clientId = (await j(await fetch(`${API}/clients`, { headers: auth }))).data?.[0]?.id;
  const pieza = await j(await fetch(`${API}/production/pieces`, {
    method: 'POST', headers: auth,
    body: JSON.stringify({ clientId, title: `Pieza con hilo ${Date.now().toString().slice(-5)}`, type: 'post_simple' }),
  }));
  console.log(`\nTrabajo: ${pieza.title}\n`);

  const url = `${API}/production/pieces/${pieza.id}/comments`;

  console.log('1. El hilo vive DENTRO del trabajo');
  const vacio = await j(await fetch(url, { headers: auth }));
  console.log(`${ok(Array.isArray(vacio.proceso) && Array.isArray(vacio.revision))}  nace con las dos secciones  -> proceso ${vacio.proceso?.length}, revision ${vacio.revision?.length}`);

  console.log('\n2. Los dos flujos NO se mezclan');
  await fetch(url, { method: 'POST', headers: auth, body: JSON.stringify({ body: 'Uso la paleta nueva de la marca', visibility: 'internal' }) });
  await fetch(url, { method: 'POST', headers: auth, body: JSON.stringify({ body: 'Falta ajustar el margen inferior', visibility: 'internal' }) });
  await fetch(url, { method: 'POST', headers: auth, body: JSON.stringify({ body: 'Al cliente le gusto, aprobado', visibility: 'client' }) });

  const hilo = await j(await fetch(url, { headers: auth }));
  console.log(`${ok(hilo.proceso.length === 2)}  observaciones de proceso    -> ${hilo.proceso.length}`);
  console.log(`${ok(hilo.revision.length === 1)}  conversacion con el cliente -> ${hilo.revision.length}`);
  console.log(`${ok(!hilo.revision.some((c) => c.body.includes('paleta')))}  lo interno NO esta en revision`);

  console.log('\n3. Aparece quien lo escribio y en que orden');
  hilo.proceso.forEach((c, i) => console.log(`         ${i + 1}. ${c.authorName ?? 'sin nombre'} (${c.authorRole}) -> "${c.body}"`));

  console.log('\n4. Editar deja marca');
  const primero = hilo.proceso[0];
  const editado = await j(await fetch(`${url}/${primero.id}`, {
    method: 'PATCH', headers: auth, body: JSON.stringify({ body: 'Uso la paleta nueva de la marca (v2)' }),
  }));
  console.log(`${ok(!!editado.editedAt)}  queda marcado como editado  -> ${editado.editedAt}`);
  console.log(`${ok(editado.body.includes('v2'))}  el texto cambia             -> "${editado.body}"`);

  console.log('\n5. Queda en la bitacora');
  const bitacora = await j(await fetch(`${API}/audit?entityType=process_comment&limit=5`, { headers: auth }));
  const filas = bitacora.data ?? bitacora;
  const mia = Array.isArray(filas) ? filas.find((row) => row.entityId === primero.id) : null;
  console.log(`${ok(!!mia)}  registra el texto anterior  -> ${mia ? `"${mia.before?.body}" -> "${mia.after?.body}"` : 'sin fila'}`);
}

main().catch((e) => { console.error('\nError:', e.message); process.exit(1); });
