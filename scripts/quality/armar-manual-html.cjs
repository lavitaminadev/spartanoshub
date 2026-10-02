/**
 * @fileoverview Arma los manuales en un solo archivo HTML que se abre con doble clic.
 *
 * Un `.md` con imágenes relativas se ve bien en GitHub y en el editor, y en ninguna otra parte:
 * quien lo recibe por correo o lo abre desde el escritorio ve las rutas rotas. Esto produce un
 * archivo único —las imágenes van dentro, en base64— que funciona sin servidor, sin conexión y sin
 * el repositorio al lado, y que se imprime a PDF desde el propio navegador.
 *
 * El Markdown se convierte aquí y no con una librería porque los manuales usan un subconjunto
 * cerrado —títulos, párrafos, tablas, listas, citas, código, imágenes con pie— y sumar una
 * dependencia para eso es más coste que el que ahorra.
 *
 *   node scripts/quality/armar-manual-html.cjs
 */

const fs = require('node:fs');
const path = require('node:path');

const BASE = path.resolve(__dirname, '../../docs/manuales');
const SALIDA = path.join(BASE, 'manual.html');

const escapar = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Imagen en base64: es lo que hace que el archivo sirva solo. */
const imagenes = new Map();
function enLinea(ruta) {
  if (!imagenes.has(ruta)) {
    const completa = path.join(BASE, ruta);
    if (!fs.existsSync(completa)) return null;
    const tipo = path.extname(ruta).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
    imagenes.set(ruta, `data:${tipo};base64,${fs.readFileSync(completa).toString('base64')}`);
  }
  return imagenes.get(ruta);
}

/** Lo que va dentro de una línea: negrita, cursiva, código, enlaces. */
function enLineaTexto(t) {
  return escapar(t)
    .replace(/`([^`]+)`/g, (_m, c) => `<code>${c}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, texto, url) => {
      // Los enlaces entre manuales apuntan a otro `.md`; dentro del archivo único son anclas.
      const destino = /^\d{2}-[a-z-]+\.md$/.test(url) ? `#${url.replace(/\.md$/, '')}` : url;
      return `<a href="${destino}">${texto}</a>`;
    });
}

/** Una tabla de Markdown, con su fila de alineación descartada. */
function tabla(filas) {
  const celdas = (linea) => linea.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const cabecera = celdas(filas[0]);
  const cuerpo = filas.slice(2).map(celdas);
  return `<table><thead><tr>${cabecera.map((c) => `<th>${enLineaTexto(c)}</th>`).join('')}</tr></thead>`
    + `<tbody>${cuerpo.map((f) => `<tr>${f.map((c) => `<td>${enLineaTexto(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function convertir(md, id) {
  const lineas = md.split(/\r?\n/);
  const salida = [];
  let i = 0;
  let parrafo = [];
  let lista = null;

  const cerrarParrafo = () => {
    if (!parrafo.length) return;
    salida.push(`<p>${enLineaTexto(parrafo.join(' '))}</p>`);
    parrafo = [];
  };
  const cerrarLista = () => {
    if (!lista) return;
    salida.push(`</${lista}>`);
    lista = null;
  };
  const cerrarTodo = () => { cerrarParrafo(); cerrarLista(); };

  while (i < lineas.length) {
    const linea = lineas[i];

    if (!linea.trim()) { cerrarTodo(); i += 1; continue; }

    // Bloque de código: se copia tal cual, sin interpretar nada de dentro.
    if (linea.startsWith('```')) {
      cerrarTodo();
      const dentro = [];
      i += 1;
      while (i < lineas.length && !lineas[i].startsWith('```')) { dentro.push(lineas[i]); i += 1; }
      i += 1;
      salida.push(`<pre>${escapar(dentro.join('\n'))}</pre>`);
      continue;
    }

    // Imagen con su pie en la línea siguiente, en cursiva.
    const img = linea.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
    if (img) {
      cerrarTodo();
      const datos = enLinea(img[2]);
      const pie = (lineas[i + 1] || '').match(/^\*(.+)\*\s*$/);
      if (pie) i += 1;
      salida.push(datos
        ? `<figure><img alt="${escapar(img[1])}" src="${datos}">${pie ? `<figcaption>${enLineaTexto(pie[1])}</figcaption>` : ''}</figure>`
        : `<p class="falta">[Falta la imagen ${escapar(img[2])}]</p>`);
      i += 1;
      continue;
    }

    const titulo = linea.match(/^(#{1,4})\s+(.*)$/);
    if (titulo) {
      cerrarTodo();
      const nivel = titulo[1].length;
      salida.push(`<h${nivel}${nivel === 1 ? ` id="${id}"` : ''}>${enLineaTexto(titulo[2])}</h${nivel}>`);
      i += 1;
      continue;
    }

    if (/^---+\s*$/.test(linea)) { cerrarTodo(); salida.push('<hr>'); i += 1; continue; }

    if (linea.startsWith('|')) {
      cerrarTodo();
      const filas = [];
      while (i < lineas.length && lineas[i].startsWith('|')) { filas.push(lineas[i]); i += 1; }
      salida.push(tabla(filas));
      continue;
    }

    if (linea.startsWith('> ')) {
      cerrarTodo();
      const cita = [];
      while (i < lineas.length && lineas[i].startsWith('>')) { cita.push(lineas[i].replace(/^>\s?/, '')); i += 1; }
      salida.push(`<blockquote>${enLineaTexto(cita.join(' '))}</blockquote>`);
      continue;
    }

    const numerada = linea.match(/^(\d+)\.\s+(.*)$/);
    const punto = linea.match(/^[-*]\s+(.*)$/);
    if (numerada || punto) {
      cerrarParrafo();
      const quiero = numerada ? 'ol' : 'ul';
      if (lista !== quiero) { cerrarLista(); salida.push(`<${quiero}>`); lista = quiero; }
      /*
       * La continuación de un punto va pegada al mismo `li`.
       * Varios manuales parten una línea larga en dos, y sin esto la segunda mitad quedaba como
       * párrafo suelto debajo de la lista.
       */
      const partes = [numerada ? numerada[2] : punto[1]];
      i += 1;
      while (i < lineas.length && /^\s{2,}\S/.test(lineas[i]) && !/^\s{2,}[-*\d]/.test(lineas[i])) {
        partes.push(lineas[i].trim());
        i += 1;
      }
      salida.push(`<li>${enLineaTexto(partes.join(' '))}</li>`);
      continue;
    }

    cerrarLista();
    parrafo.push(linea.trim());
    i += 1;
  }

  cerrarTodo();
  return salida.join('\n');
}

const ORDEN = ['README.md', ...fs.readdirSync(BASE).filter((f) => /^\d{2}-.*\.md$/.test(f)).sort()];

const secciones = ORDEN.map((archivo) => {
  const id = archivo === 'README.md' ? 'indice' : archivo.replace(/\.md$/, '');
  const md = fs.readFileSync(path.join(BASE, archivo), 'utf8');
  const titulo = (md.match(/^#\s+(.*)$/m) || [, archivo])[1];
  return { id, titulo, html: convertir(md, id) };
});

const indice = secciones.map((s) => `<li><a href="#${s.id}">${escapar(s.titulo)}</a></li>`).join('');

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Manuales · Espartanos</title>
<style>
  :root { --tinta:#22242a; --suave:#6b6e78; --linea:#e7e7ec; --acento:#ea0f63; --fondo:#f6f6f8; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--fondo); color:var(--tinta);
         font:16px/1.65 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; }
  .envoltorio { display:grid; grid-template-columns:260px minmax(0,1fr); gap:0; max-width:1240px; margin:0 auto; }
  nav { position:sticky; top:0; align-self:start; max-height:100vh; overflow:auto; padding:28px 18px; }
  nav strong { display:block; margin-bottom:12px; font-size:12px; letter-spacing:.12em; color:var(--suave); }
  nav ol { margin:0; padding:0; list-style:none; }
  nav li { margin-bottom:4px; }
  nav a { display:block; padding:7px 10px; border-radius:8px; color:var(--tinta); font-size:13px; text-decoration:none; }
  nav a:hover { background:#fff; }
  main { padding:28px 34px 80px; background:#fff; border-left:1px solid var(--linea); }
  section { padding-bottom:40px; }
  section + section { margin-top:40px; border-top:3px solid var(--linea); padding-top:40px; }
  h1 { margin:0 0 6px; font-size:30px; line-height:1.2; letter-spacing:-.01em; }
  h2 { margin:34px 0 10px; font-size:19px; }
  h3 { margin:24px 0 8px; font-size:15px; }
  p { margin:0 0 12px; }
  a { color:var(--acento); }
  code { padding:1px 5px; border-radius:4px; background:#f1f1f4; font-family:ui-monospace,Menlo,Consolas,monospace; font-size:.88em; }
  pre { overflow:auto; margin:0 0 16px; padding:14px 16px; border-radius:10px; background:#1c1b1f; color:#e9eaee;
        font-family:ui-monospace,Menlo,Consolas,monospace; font-size:12.5px; line-height:1.55; }
  table { width:100%; margin:0 0 18px; border-collapse:collapse; font-size:14px; }
  th, td { padding:8px 10px; border-bottom:1px solid var(--linea); text-align:left; vertical-align:top; }
  th { color:var(--suave); font-size:12px; text-transform:uppercase; letter-spacing:.04em; }
  blockquote { margin:0 0 16px; padding:12px 16px; border-left:3px solid var(--acento); background:#fff5f8; }
  blockquote p:last-child { margin:0; }
  figure { margin:0 0 20px; }
  figure img { display:block; width:100%; border:1px solid var(--linea); border-radius:10px; }
  figcaption { margin-top:7px; color:var(--suave); font-size:13px; line-height:1.5; }
  hr { margin:26px 0; border:0; border-top:1px solid var(--linea); }
  ul, ol { margin:0 0 14px; padding-left:22px; }
  li { margin-bottom:5px; }
  .falta { color:#9b1c1c; }
  /* La barra que dice en qué manual estás. Se queda arriba y no se imprime. */
  .barra-actual {
    position:sticky; top:0; z-index:5; display:flex; align-items:center; justify-content:space-between;
    gap:16px; padding:11px 20px; background:rgba(255,255,255,.93); backdrop-filter:blur(8px);
    border-bottom:1px solid var(--linea); font-size:13px; font-weight:600;
  }
  .barra-actual a { font-size:12px; font-weight:500; text-decoration:none; }
  nav a.es-actual { background:#fff; color:var(--acento); font-weight:700; }
  @media (max-width:900px) {
    .envoltorio { grid-template-columns:1fr; }
    nav { position:static; max-height:none; }
    main { padding:20px 16px 60px; border-left:0; }
  }
  /* Para imprimir a PDF: sin menú, cada manual en su hoja y sin cortar una imagen por la mitad. */
  @media print {
    body { background:#fff; }
    nav, .barra-actual { display:none; }
    .envoltorio { display:block; max-width:none; }
    main { padding:0; border:0; }
    section { page-break-before:always; border:0; margin:0; padding-top:0; }
    section:first-child { page-break-before:auto; }
    figure, table, pre, blockquote { page-break-inside:avoid; }
    h1, h2, h3 { page-break-after:avoid; }
    a { color:var(--tinta); text-decoration:none; }
  }
</style>
</head>
<body>
<div class="barra-actual" id="barra"><span id="barra-titulo">Manuales</span><a href="#indice">Índice</a></div>
<div class="envoltorio">
  <nav><strong>MANUALES</strong><ol>${indice}</ol></nav>
  <main>
${secciones.map((s) => `    <section>\n${s.html}\n    </section>`).join('\n')}
  </main>
</div>
<script>
  /*
   * Qué manual estoy leyendo.
   *
   * En un archivo con nueve manuales seguidos, a mitad de uno largo no se sabe en cuál se está:
   * el titulo quedo quince pantallas atras y el menu lateral no marcaba nada. La barra de arriba
   * lo dice siempre, y el menu resalta la entrada que toca.
   */
  (function () {
    var secciones = Array.prototype.slice.call(document.querySelectorAll('main section'));
    var titulo = document.getElementById('barra-titulo');
    var enlaces = Array.prototype.slice.call(document.querySelectorAll('nav a'));
    function actual() {
      var elegida = secciones[0];
      for (var i = 0; i < secciones.length; i += 1) {
        if (secciones[i].getBoundingClientRect().top <= 90) elegida = secciones[i];
      }
      return elegida;
    }
    function pintar() {
      var seccion = actual();
      if (!seccion) return;
      var h1 = seccion.querySelector('h1');
      var id = h1 ? h1.id : '';
      if (h1) titulo.textContent = h1.textContent;
      enlaces.forEach(function (a) {
        a.classList.toggle('es-actual', a.getAttribute('href') === '#' + id);
      });
    }
    var pendiente = false;
    window.addEventListener('scroll', function () {
      if (pendiente) return;
      pendiente = true;
      window.requestAnimationFrame(function () { pendiente = false; pintar(); });
    }, { passive: true });
    pintar();
  }());
</script>
</body>
</html>`;

fs.writeFileSync(SALIDA, html);
const mb = (Buffer.byteLength(html) / 1024 / 1024).toFixed(1);
console.log(`${SALIDA}\n${secciones.length} manuales · ${imagenes.size} imágenes dentro · ${mb} MB`);
