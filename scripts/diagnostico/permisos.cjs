/**
 * Diagnóstico de permisos de una cuenta contra el servidor.
 *
 * Responde por qué una ruta manda a `/404`: entra con las credenciales que se le indican, pide el
 * perfil y los permisos efectivos, y escribe un informe con lo que el servidor realmente devuelve.
 *
 * **Las credenciales se piden por teclado y no se guardan en ninguna parte.** No aparecen en el
 * informe, ni en el archivo, ni quedan en el historial del terminal: es el motivo de que el script
 * las pida en vez de leerlas de una variable dentro del propio archivo.
 *
 * Uso:
 *   node scripts/diagnostico/permisos.cjs
 *   node scripts/diagnostico/permisos.cjs https://refugio.espartanos.cl/api
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const API = process.argv[2] || 'https://refugio.espartanos.cl/api';
const SALIDA = path.join(process.cwd(), 'diagnostico-permisos.txt');

/** Rutas cuyo módulo conviene revisar cuando algo manda a `/404`. */
const RUTAS = {
  '/dashboard': 'dashboard',
  '/clients': 'clients',
  '/reservations': 'reservations',
  '/intake': 'intake',
  '/production': 'production',
  '/settings': 'settings',
  '/users': 'users',
  '/governance': 'governance',
};

function preguntar(texto, oculto = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    if (!oculto) {
      rl.question(texto, (valor) => { rl.close(); resolve(valor.trim()); });
      return;
    }
    // Se silencia el eco para que la contraseña no quede visible en pantalla ni al desplazarse
    // hacia atrás en el terminal.
    process.stdout.write(texto);
    const onData = (char) => {
      if (['\n', '\r', ''].includes(String(char))) process.stdin.removeListener('data', onData);
      else process.stdout.write('*');
    };
    process.stdin.on('data', onData);
    rl.question('', (valor) => { rl.close(); process.stdout.write('\n'); resolve(valor.trim()); });
  });
}

const j = async (r) => { const t = await r.text(); try { return JSON.parse(t); } catch { return t; } };

async function main() {
  console.log(`\nDiagnóstico contra ${API}\n`);
  const email = await preguntar('Correo: ');
  const password = await preguntar('Contraseña (no se guarda): ', true);

  const login = await j(await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }));

  if (!login.accessToken) {
    console.log(`\nNo se pudo entrar: ${login.message || JSON.stringify(login).slice(0, 200)}`);
    // Se escribe igual: un fallo de ingreso también es un diagnóstico, y su mensaje distingue
    // credenciales incorrectas de cuenta bloqueada o inactiva.
    fs.writeFileSync(SALIDA, `INGRESO FALLIDO\n${API}\n${new Date().toISOString()}\n\n${login.message || JSON.stringify(login)}\n`);
    console.log(`Informe en ${SALIDA}`);
    return;
  }

  const auth = { Authorization: `Bearer ${login.accessToken}` };
  const [perfil, permisos] = await Promise.all([
    j(await fetch(`${API}/auth/me`, { headers: auth })),
    j(await fetch(`${API}/me/permissions`, { headers: auth })),
  ]);

  const niveles = permisos?.permissions ?? {};
  const lineas = [
    'DIAGNÓSTICO DE PERMISOS',
    `Servidor: ${API}`,
    `Fecha: ${new Date().toISOString()}`,
    '',
    'CUENTA',
    `  cargo            ${perfil?.role}`,
    `  activa           ${perfil?.isActive}`,
    `  cambiar clave    ${perfil?.mustChangePassword}`,
    `  completar perfil ${perfil?.mustCompleteProfile}`,
    `  aceptar términos ${perfil?.mustAcceptTerms}`,
    '',
    'RUTAS: módulo → permiso · módulo encendido · estado de liberación',
  ];

  for (const [ruta, modulo] of Object.entries(RUTAS)) {
    const nivel = niveles[modulo] ?? '(sin dato)';
    const encendido = perfil?.features?.[modulo];
    const estado = perfil?.moduleLifecycle?.[modulo] ?? '(sin dato)';
    // Un permiso `none` es lo que hace que `ProtectedRoute` mande a /404, asi que se marca.
    const marca = nivel === 'none' || nivel === '(sin dato)' ? '  <-- BLOQUEA' : '';
    lineas.push(`  ${ruta.padEnd(16)} ${modulo.padEnd(14)} ${String(nivel).padEnd(8)} ${String(encendido).padEnd(6)} ${estado}${marca}`);
  }

  lineas.push('', 'CÓMO LEERLO', [
    '  permiso `none`        el servidor no autoriza; la ruta manda a /404',
    '  módulo `false`        está apagado en configuración; no es un fallo de código',
    '  estado distinto de    `active`/`pilot`/`maintenance` esconde el módulo salvo para',
    '  desarrollo',
  ].join('\n'));

  fs.writeFileSync(SALIDA, `${lineas.join('\n')}\n`);
  console.log(`\n${lineas.slice(4).join('\n')}\n`);
  console.log(`Informe guardado en ${SALIDA}`);
}

main().catch((error) => {
  console.error('\nError:', error.message);
  process.exit(1);
});
