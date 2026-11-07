/**
 * Qué nace activo para un cargo, y por qué lo que no nace está cerrado.
 *
 * Responde «¿qué puede hacer esta persona el día que entra?» cruzando las tres rejas en el orden
 * en que las evalúa el sistema: alcance de fase, matriz de cargo, interruptor de la organización.
 * Un módulo necesita las tres; con una sola cerrada no aparece, y la columna dice cuál falta.
 *
 * **Lee el código, no la base.** No se conecta a ningún servidor y no pide credenciales, así que
 * responde por los valores de fábrica: lo que recibe una organización nueva. Para saber qué tiene
 * una cuenta concreta hoy —con sus excepciones por persona y los interruptores ya cambiados— está
 * `permisos.cjs`, que pregunta al servidor.
 *
 * Uso:
 *   node scripts/diagnostico/perfil-de-cargo.cjs commercial_director
 *   node scripts/diagnostico/perfil-de-cargo.cjs            (lista los cargos)
 */
const modulos = require('../../packages/shared/dist/constants/modules.js');
const { ROLE_PERMISSIONS } = require('../../apps/api/dist/core/authorization/role-permissions.js');

const cargo = process.argv[2];
const cargos = Object.keys(ROLE_PERMISSIONS);

if (!cargo || !cargos.includes(cargo)) {
  console.log(`\nCargos: ${cargos.join(', ')}\n`);
  console.log('  node scripts/diagnostico/perfil-de-cargo.cjs commercial_director\n');
  process.exit(cargo ? 1 : 0);
}

const matriz = ROLE_PERMISSIONS[cargo] || {};
const defectos = modulos.DEFAULT_ORGANIZATION_FEATURES || {};

const filas = modulos.ORGANIZATION_MODULE_CATALOG.map((definicion) => {
  const fase = modulos.isModuleInInitialOperationScope(definicion.key, cargo);
  const permiso = matriz[definicion.key] ?? 'none';
  const interruptor = defectos[definicion.key] !== undefined ? defectos[definicion.key] : definicion.defaultEnabled;
  // El orden importa: es el mismo en que las evalúa `isPathEnabled`, y la primera que falla es la
  // que hay que mover. Decir «sin permiso» sobre un módulo cerrado por fase manda a cambiar la
  // matriz, que no habría abierto nada.
  const falta = !fase ? 'fase' : permiso === 'none' ? 'permiso' : !interruptor ? 'interruptor' : null;
  return { clave: definicion.key, fase, permiso, interruptor, falta };
});

const activos = filas.filter((fila) => !fila.falta);
const col = (valor, ancho) => String(valor).padEnd(ancho);

console.log(`\n  ${cargo}  —  ${activos.length} de ${filas.length} módulos nacen activos\n`);
console.log(`  ${col('MÓDULO', 22)}${col('FASE', 9)}${col('PERMISO', 10)}${col('INTERRUPTOR', 13)}FALTA`);
console.log(`  ${'-'.repeat(68)}`);
for (const fila of [...filas].sort((a, b) => Number(Boolean(a.falta)) - Number(Boolean(b.falta)) || a.clave.localeCompare(b.clave))) {
  console.log(`  ${col(fila.clave, 22)}${col(fila.fase ? 'abierta' : 'CERRADA', 9)}${col(fila.permiso, 10)}${col(fila.interruptor ? 'encendido' : 'APAGADO', 13)}${fila.falta ?? '— activo'}`);
}

/*
 * El permiso concedido que no significa nada.
 *
 * Es el caso que más confunde al revisar un cargo: la matriz dice «administrar» y la pantalla
 * responde «no tienes acceso», porque lo cierra una reja anterior. Se lista aparte porque es
 * trabajo pendiente —o un interruptor sin encender—, no una decisión de permisos.
 */
const concedidoYcerrado = filas.filter((fila) => fila.falta && fila.permiso !== 'none');
if (concedidoYcerrado.length) {
  console.log(`\n  Con permiso y cerrado —el permiso no significa nada hasta mover esto—:\n`);
  for (const fila of concedidoYcerrado) {
    console.log(`  · ${col(fila.clave, 22)}${col(fila.permiso, 10)}cierra: ${fila.falta}`);
  }
}
console.log('');
