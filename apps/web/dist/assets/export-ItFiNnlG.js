import{r as e}from"./rolldown-runtime-QTnfLwEv.js";import{an as t,gn as n}from"./vendor-BWcQgpUx.js";var r={meeting:`Reunión`,visit:`Visita`,call:`Llamada`,whatsapp:`WhatsApp`,email:`Correo`,note:`Nota`,task:`Tarea`},i=[{value:`meeting`,label:r.meeting},{value:`visit`,label:r.visit},{value:`call`,label:r.call},{value:`whatsapp`,label:r.whatsapp},{value:`email`,label:r.email},{value:`note`,label:r.note}],a=[{value:`meet`,label:`Google Meet`,pide:`enlace`},{value:`zoom`,label:`Zoom`,pide:`enlace`},{value:`teams`,label:`Microsoft Teams`,pide:`enlace`},{value:`presencial`,label:`Presencial`,pide:`direccion`},{value:`telefono`,label:`Telefónica`,pide:null}];function o(e){let t=a.find(t=>t.value===e);return t?.pide?t.pide===`enlace`?{etiqueta:`Enlace de la reunión`,ejemplo:`https://meet.google.com/abc-defg-hij`}:{etiqueta:`Dirección`,ejemplo:`Av. Providencia 1234, oficina 502`}:null}function s(e){return e===`meeting`||e===`visit`}var c=e(n(),1);function l(e,t){return e.columns.map(e=>{let n=e.value(t);return n==null?``:String(n)})}function u(e,t){return`${e.trim().toLowerCase().normalize(`NFD`).replace(/[̀-ͯ]/g,``).replace(/[^a-z0-9]+/g,`-`).replace(/^-+|-+$/g,``)||`export`}-${new Date().toISOString().slice(0,10)}.${t}`}function d(e){let t=/^[=+\-@]/.test(e)?`'${e}`:e;return/[",;\n\r]/.test(t)?`"${t.replace(/"/g,`""`)}"`:t}function f(e){let t=[d(e.title)];e.subtitle&&t.push(d(e.subtitle));for(let n of e.meta??[])t.push(`${d(n.label)};${d(n.value)}`);t.push(`${d(`Generado`)};${d(new Date().toLocaleString(`es-CL`,{dateStyle:`long`,timeStyle:`short`}))}`),t.length>1&&t.push(``),t.push(e.columns.map(e=>d(e.header)).join(`;`));for(let n of e.rows)t.push(l(e,n).map(d).join(`;`));return t.join(`\r
`)}function p(e){let t=new Blob([`﻿${f(e)}`],{type:`text/csv;charset=utf-8`}),n=URL.createObjectURL(t),r=window.document.createElement(`a`);r.href=n,r.download=u(e.fileName,`csv`),r.click(),URL.revokeObjectURL(n)}function m(e){return e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`)}var h=`#ec0b61`,g=`#0fb9b1`,_=`#151317`,v=`#706a73`,y=`#e7e1e5`,b=`
  @page { size: A4; margin: 1.5cm 1.4cm 1.8cm; }
  * { box-sizing: border-box; }
  body {
    margin: 0; color: ${_};
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    font-size: 10pt; line-height: 1.45;
  }

  /* Banda de marca: identifica el documento antes de leer una palabra. */
  .banda { height: 4px; background: linear-gradient(90deg, ${h}, ${g}); border-radius: 2px; }

  header { padding: 14px 0 12px; margin-bottom: 16px; border-bottom: 1px solid ${y}; }
  .marca {
    font-size: 7.5pt; letter-spacing: .18em; text-transform: uppercase;
    color: ${v}; margin-bottom: 6px;
  }
  h1 { margin: 0; font-size: 18pt; letter-spacing: -.015em; font-weight: 700; }
  .subtitulo { margin: 4px 0 0; color: ${v}; font-size: 9.5pt; }

  /*
   * El contexto va arriba y en tarjetas.
   *
   * El archivo se lee semanas después y fuera de la pantalla que lo generó: sin el filtro
   * anotado, nadie sabe si son todas las filas o solo las de un cliente.
   */
  .meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
  .meta div {
    padding: 6px 10px; border: 1px solid ${y}; border-radius: 6px;
    background: #fbfafb; min-width: 110px;
  }
  .meta span {
    display: block; color: ${v}; text-transform: uppercase;
    letter-spacing: .08em; font-size: 6.5pt; margin-bottom: 2px;
  }
  .meta b { font-weight: 600; font-size: 9pt; }

  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  th {
    padding: 8px 8px; text-align: left; background: #faf7f9;
    border-bottom: 1.5px solid ${h};
    font-size: 7pt; text-transform: uppercase; letter-spacing: .08em; color: ${_};
  }
  td { padding: 6px 8px; border-bottom: .5px solid ${y}; vertical-align: top; }
  tr { page-break-inside: avoid; }
  /* Filas alternas sin líneas verticales: las verticales ensucian al imprimir. */
  tbody tr:nth-child(even) { background: #fbfafb; }
  .der { text-align: right; font-variant-numeric: tabular-nums; }

  footer {
    margin-top: 18px; padding-top: 9px; border-top: 1px solid ${y};
    color: ${v}; font-size: 7.5pt;
    display: flex; justify-content: space-between; gap: 16px;
  }
  .vacio { padding: 28px; text-align: center; color: ${v}; }
`;function x(e){let t=window.open(``,`_blank`,`width=900,height=700`);if(!t)return!1;let n=e.columns.map(e=>{let t=e.width?` style="width:${e.width}%"`:``;return`<th class="${e.align===`right`?`der`:``}"${t}>${m(e.header)}</th>`}).join(``),r=e.rows.length?e.rows.map(t=>`<tr>${l(e,t).map((t,n)=>`<td class="${e.columns[n]?.align===`right`?`der`:``}">${m(t)}</td>`).join(``)}</tr>`).join(``):`<tr><td class="vacio" colspan="${e.columns.length}">Sin datos para el filtro aplicado.</td></tr>`,i=(e.meta??[]).map(e=>`<div><span>${m(e.label)}</span><b>${m(e.value)}</b></div>`).join(``),a=new Date().toLocaleString(`es-CL`,{dateStyle:`long`,timeStyle:`short`}),o=e.rows.length===1?`1 registro`:`${e.rows.length} registros`;return t.document.write(`<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${m(e.fileName)}</title><style>${b}</style></head>
<body>
  <div class="banda"></div>
  <header>
    <div class="marca">${m(e.footer??`Espartanos`)}</div>
    <h1>${m(e.title)}</h1>
    ${e.subtitle?`<p class="subtitulo">${m(e.subtitle)}</p>`:``}
    ${i?`<div class="meta">${i}</div>`:``}
  </header>
  <table><thead><tr>${n}</tr></thead><tbody>${r}</tbody></table>
  <footer>
    <span>${m(o)}</span>
    <span>Generado el ${m(a)}</span>
  </footer>
</body></html>`),t.document.close(),t.onload=()=>{t.focus(),t.print()},!0}var S=t();function C({document:e,csv:t=!0,pdf:n=!0}){let[r,i]=(0,c.useState)(null),a=e.rows.length===0;return(0,S.jsxs)(`div`,{className:`export-botones`,children:[t?(0,S.jsx)(`button`,{type:`button`,className:`btn btn-outline btn-sm`,disabled:a,title:a?`No hay filas que exportar`:`Descargar como CSV`,onClick:()=>p(e),children:`Exportar CSV`}):null,n?(0,S.jsx)(`button`,{type:`button`,className:`btn btn-outline btn-sm`,disabled:a,title:a?`No hay filas que exportar`:`Abrir para imprimir o guardar como PDF`,onClick:()=>i(x(e)?null:`El navegador bloqueó la ventana. Permite las ventanas emergentes de este sitio.`),children:`Descargar PDF`}):null,r?(0,S.jsx)(`span`,{className:`export-aviso`,role:`alert`,children:r}):null]})}export{s as a,r as i,a as n,o,i as r,C as t};