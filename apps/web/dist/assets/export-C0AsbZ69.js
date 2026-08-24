import{r as e}from"./rolldown-runtime-QTnfLwEv.js";import{mn as t,rn as n}from"./vendor-kytm9r6D.js";var r=e(t(),1);function i(e,t){return e.columns.map(e=>{let n=e.value(t);return n==null?``:String(n)})}function a(e,t){return`${e.trim().toLowerCase().normalize(`NFD`).replace(/[̀-ͯ]/g,``).replace(/[^a-z0-9]+/g,`-`).replace(/^-+|-+$/g,``)||`export`}-${new Date().toISOString().slice(0,10)}.${t}`}function o(e){let t=/^[=+\-@]/.test(e)?`'${e}`:e;return/[",;\n\r]/.test(t)?`"${t.replace(/"/g,`""`)}"`:t}function s(e){let t=[o(e.title)];e.subtitle&&t.push(o(e.subtitle));for(let n of e.meta??[])t.push(`${o(n.label)};${o(n.value)}`);t.push(`${o(`Generado`)};${o(new Date().toLocaleString(`es-CL`,{dateStyle:`long`,timeStyle:`short`}))}`),t.length>1&&t.push(``),t.push(e.columns.map(e=>o(e.header)).join(`;`));for(let n of e.rows)t.push(i(e,n).map(o).join(`;`));return t.join(`\r
`)}function c(e){let t=new Blob([`﻿${s(e)}`],{type:`text/csv;charset=utf-8`}),n=URL.createObjectURL(t),r=window.document.createElement(`a`);r.href=n,r.download=a(e.fileName,`csv`),r.click(),URL.revokeObjectURL(n)}function l(e){return e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`)}var u=`#ec0b61`,d=`#0fb9b1`,f=`#151317`,p=`#706a73`,m=`#e7e1e5`,h=`
  @page { size: A4; margin: 1.5cm 1.4cm 1.8cm; }
  * { box-sizing: border-box; }
  body {
    margin: 0; color: ${f};
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    font-size: 10pt; line-height: 1.45;
  }

  /* Banda de marca: identifica el documento antes de leer una palabra. */
  .banda { height: 4px; background: linear-gradient(90deg, ${u}, ${d}); border-radius: 2px; }

  header { padding: 14px 0 12px; margin-bottom: 16px; border-bottom: 1px solid ${m}; }
  .marca {
    font-size: 7.5pt; letter-spacing: .18em; text-transform: uppercase;
    color: ${p}; margin-bottom: 6px;
  }
  h1 { margin: 0; font-size: 18pt; letter-spacing: -.015em; font-weight: 700; }
  .subtitulo { margin: 4px 0 0; color: ${p}; font-size: 9.5pt; }

  /*
   * El contexto va arriba y en tarjetas.
   *
   * El archivo se lee semanas después y fuera de la pantalla que lo generó: sin el filtro
   * anotado, nadie sabe si son todas las filas o solo las de un cliente.
   */
  .meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
  .meta div {
    padding: 6px 10px; border: 1px solid ${m}; border-radius: 6px;
    background: #fbfafb; min-width: 110px;
  }
  .meta span {
    display: block; color: ${p}; text-transform: uppercase;
    letter-spacing: .08em; font-size: 6.5pt; margin-bottom: 2px;
  }
  .meta b { font-weight: 600; font-size: 9pt; }

  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  th {
    padding: 8px 8px; text-align: left; background: #faf7f9;
    border-bottom: 1.5px solid ${u};
    font-size: 7pt; text-transform: uppercase; letter-spacing: .08em; color: ${f};
  }
  td { padding: 6px 8px; border-bottom: .5px solid ${m}; vertical-align: top; }
  tr { page-break-inside: avoid; }
  /* Filas alternas sin líneas verticales: las verticales ensucian al imprimir. */
  tbody tr:nth-child(even) { background: #fbfafb; }
  .der { text-align: right; font-variant-numeric: tabular-nums; }

  footer {
    margin-top: 18px; padding-top: 9px; border-top: 1px solid ${m};
    color: ${p}; font-size: 7.5pt;
    display: flex; justify-content: space-between; gap: 16px;
  }
  .vacio { padding: 28px; text-align: center; color: ${p}; }
`;function g(e){let t=window.open(``,`_blank`,`width=900,height=700`);if(!t)return!1;let n=e.columns.map(e=>{let t=e.width?` style="width:${e.width}%"`:``;return`<th class="${e.align===`right`?`der`:``}"${t}>${l(e.header)}</th>`}).join(``),r=e.rows.length?e.rows.map(t=>`<tr>${i(e,t).map((t,n)=>`<td class="${e.columns[n]?.align===`right`?`der`:``}">${l(t)}</td>`).join(``)}</tr>`).join(``):`<tr><td class="vacio" colspan="${e.columns.length}">Sin datos para el filtro aplicado.</td></tr>`,a=(e.meta??[]).map(e=>`<div><span>${l(e.label)}</span><b>${l(e.value)}</b></div>`).join(``),o=new Date().toLocaleString(`es-CL`,{dateStyle:`long`,timeStyle:`short`}),s=e.rows.length===1?`1 registro`:`${e.rows.length} registros`;return t.document.write(`<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${l(e.fileName)}</title><style>${h}</style></head>
<body>
  <div class="banda"></div>
  <header>
    <div class="marca">${l(e.footer??`Espartanos`)}</div>
    <h1>${l(e.title)}</h1>
    ${e.subtitle?`<p class="subtitulo">${l(e.subtitle)}</p>`:``}
    ${a?`<div class="meta">${a}</div>`:``}
  </header>
  <table><thead><tr>${n}</tr></thead><tbody>${r}</tbody></table>
  <footer>
    <span>${l(s)}</span>
    <span>Generado el ${l(o)}</span>
  </footer>
</body></html>`),t.document.close(),t.onload=()=>{t.focus(),t.print()},!0}var _=n();function v({document:e,csv:t=!0,pdf:n=!0}){let[i,a]=(0,r.useState)(null),o=e.rows.length===0;return(0,_.jsxs)(`div`,{className:`export-botones`,children:[t?(0,_.jsx)(`button`,{type:`button`,className:`btn btn-outline btn-sm`,disabled:o,title:o?`No hay filas que exportar`:`Descargar como CSV`,onClick:()=>c(e),children:`Exportar CSV`}):null,n?(0,_.jsx)(`button`,{type:`button`,className:`btn btn-outline btn-sm`,disabled:o,title:o?`No hay filas que exportar`:`Abrir para imprimir o guardar como PDF`,onClick:()=>a(g(e)?null:`El navegador bloqueó la ventana. Permite las ventanas emergentes de este sitio.`),children:`Descargar PDF`}):null,i?(0,_.jsx)(`span`,{className:`export-aviso`,role:`alert`,children:i}):null]})}export{v as t};