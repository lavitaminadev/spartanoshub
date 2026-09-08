/*
 * Evita que una edición con codificación errónea vuelva a publicar textos como
 * "Ã±" o "â€“" dentro de Reservas. El alcance es deliberadamente el módulo:
 * no bloquea una entrega por contenido histórico ajeno a Reservas.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const targets = [
  'apps/web/src/features/reservations',
  'apps/web/src/styles/reservation-builder.css',
  'apps/web/src/styles/reservation-brand.css',
  'apps/api/src/modules/reservations',
];
const suspicious = /(?:Ã.|â.|�)/u;
const files = [];

function collect(entry) {
  const absolute = path.join(root, entry);
  if (!fs.existsSync(absolute)) return;
  const stat = fs.statSync(absolute);
  if (stat.isFile()) { files.push(absolute); return; }
  for (const child of fs.readdirSync(absolute, { withFileTypes: true })) {
    if (child.name === 'node_modules' || child.name === 'dist') continue;
    collect(path.join(entry, child.name));
  }
}

for (const target of targets) collect(target);
const findings = [];
for (const file of files) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    if (suspicious.test(line)) findings.push(`${path.relative(root, file)}:${index + 1}: ${line.trim()}`);
  });
}

if (findings.length) {
  console.error('Se detectó texto con codificación dañada en Reservas:');
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exit(1);
}
console.log(`Texto de Reservas verificado (${files.length} archivos).`);
