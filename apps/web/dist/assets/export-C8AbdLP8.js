import{r as e}from"./rolldown-runtime-QTnfLwEv.js";import{nn as t,pn as n}from"./vendor-DKtWMgk0.js";var r=e(n(),1);function i(e,t){return e.columns.map(e=>{let n=e.value(t);return n==null?``:String(n)})}function a(e,t){return`${e.trim().toLowerCase().normalize(`NFD`).replace(/[̀-ͯ]/g,``).replace(/[^a-z0-9]+/g,`-`).replace(/^-+|-+$/g,``)||`export`}-${new Date().toISOString().slice(0,10)}.${t}`}function o(e){let t=/^[=+\-@]/.test(e)?`'${e}`:e;return/[",;\n\r]/.test(t)?`"${t.replace(/"/g,`""`)}"`:t}function s(e){let t=[o(e.title)];e.subtitle&&t.push(o(e.subtitle));for(let n of e.meta??[])t.push(`${o(n.label)};${o(n.value)}`);t.length>1&&t.push(``),t.push(e.columns.map(e=>o(e.header)).join(`;`));for(let n of e.rows)t.push(i(e,n).map(o).join(`;`));return t.join(`\r
`)}function c(e){let t=new Blob([`﻿${s(e)}`],{type:`text/csv;charset=utf-8`}),n=URL.createObjectURL(t),r=window.document.createElement(`a`);r.href=n,r.download=a(e.fileName,`csv`),r.click(),URL.revokeObjectURL(n)}function l(e){return e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`)}var u=`
  @page { size: A4; margin: 1.6cm 1.4cm; }
  * { box-sizing: border-box; }
  body {
    margin: 0; color: #14161c;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    font-size: 10pt; line-height: 1.45;
  }
  header { border-bottom: 2px solid #17c78a; padding-bottom: 10px; margin-bottom: 14px; }
  h1 { margin: 0; font-size: 16pt; letter-spacing: -.01em; }
  .subtitulo { margin: 3px 0 0; color: #5a6470; font-size: 9.5pt; }

  /* El contexto va arriba: el archivo se lee fuera de la pantalla que lo generó. */
  .meta { display: flex; flex-wrap: wrap; gap: 4px 22px; margin-top: 9px; }
  .meta div { font-size: 8.5pt; }
  .meta span { color: #7a838d; text-transform: uppercase; letter-spacing: .06em; font-size: 7.5pt; }
  .meta b { display: block; font-weight: 600; }

  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  th {
    padding: 6px 7px; text-align: left; border-bottom: 1.5px solid #14161c;
    font-size: 7.5pt; text-transform: uppercase; letter-spacing: .07em; color: #4a545e;
  }
  td { padding: 5px 7px; border-bottom: .5px solid #d8dde1; vertical-align: top; }
  tr { page-break-inside: avoid; }
  /* Las filas alternas se distinguen sin líneas verticales, que ensucian al imprimir. */
  tbody tr:nth-child(even) { background: #f5f7f8; }
  .der { text-align: right; font-variant-numeric: tabular-nums; }

  footer { margin-top: 16px; padding-top: 8px; border-top: .5px solid #d8dde1; color: #7a838d; font-size: 8pt; }
  .vacio { padding: 24px; text-align: center; color: #7a838d; }
`;function d(e){let t=window.open(``,`_blank`,`width=900,height=700`);if(!t)return!1;let n=e.columns.map(e=>{let t=e.width?` style="width:${e.width}%"`:``;return`<th class="${e.align===`right`?`der`:``}"${t}>${l(e.header)}</th>`}).join(``),r=e.rows.length?e.rows.map(t=>`<tr>${i(e,t).map((t,n)=>`<td class="${e.columns[n]?.align===`right`?`der`:``}">${l(t)}</td>`).join(``)}</tr>`).join(``):`<tr><td class="vacio" colspan="${e.columns.length}">Sin datos para el filtro aplicado.</td></tr>`,a=(e.meta??[]).map(e=>`<div><span>${l(e.label)}</span><b>${l(e.value)}</b></div>`).join(``),o=new Date().toLocaleString(`es-CL`,{dateStyle:`long`,timeStyle:`short`});return t.document.write(`<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${l(e.fileName)}</title><style>${u}</style></head>
<body>
  <header>
    <h1>${l(e.title)}</h1>
    ${e.subtitle?`<p class="subtitulo">${l(e.subtitle)}</p>`:``}
    ${a?`<div class="meta">${a}</div>`:``}
  </header>
  <table><thead><tr>${n}</tr></thead><tbody>${r}</tbody></table>
  <footer>${l(e.footer??``)}${e.footer?` · `:``}Generado el ${l(o)} · ${e.rows.length} registro(s)</footer>
</body></html>`),t.document.close(),t.onload=()=>{t.focus(),t.print()},!0}var f=t();function p({document:e,pdf:t=!0}){let[n,i]=(0,r.useState)(null),a=e.rows.length===0;return(0,f.jsxs)(`div`,{className:`export-botones`,children:[(0,f.jsx)(`button`,{type:`button`,className:`btn btn-outline btn-sm`,disabled:a,title:a?`No hay filas que exportar`:`Descargar como CSV`,onClick:()=>c(e),children:`Exportar CSV`}),t?(0,f.jsx)(`button`,{type:`button`,className:`btn btn-outline btn-sm`,disabled:a,title:a?`No hay filas que exportar`:`Abrir para imprimir o guardar como PDF`,onClick:()=>i(d(e)?null:`El navegador bloqueó la ventana. Permite las ventanas emergentes de este sitio.`),children:`Descargar PDF`}):null,n?(0,f.jsx)(`span`,{className:`export-aviso`,role:`alert`,children:n}):null]})}export{p as t};