/**
 * @fileoverview Compone los correos de ejemplo que ilustran los manuales.
 *
 * Usa `componerCorreo`, la misma función que arma los correos que salen de verdad, y los textos de
 * fábrica del catálogo. Dibujarlos a mano en una herramienta de diseño habría dado un manual que
 * enseña algo que el sistema no manda, y ese manual envejece el día que alguien toca la plantilla.
 *
 * Deja los archivos en `apps/web/public/_correos/` para poder abrirlos en el navegador y
 * fotografiarlos. Esa carpeta no se publica: la borra el propio script al terminar si se le pasa
 * `--limpiar`.
 *
 *   node scripts/quality/generar-correos-de-ejemplo.cjs
 *   node scripts/quality/generar-correos-de-ejemplo.cjs --limpiar
 */

const fs = require('node:fs');
const path = require('node:path');

const { componerCorreo } = require('../../apps/api/dist/core/notifications/plantilla-de-correo.js');

const DESTINO = path.resolve(__dirname, '../../apps/web/public/_correos');
const BAJA = 'https://cuartel.espartanos.cl/api/marketing/suscriptores/baja/tok-de-ejemplo';

if (process.argv.includes('--limpiar')) {
  fs.rmSync(DESTINO, { recursive: true, force: true });
  console.log('Carpeta de ejemplos borrada.');
  process.exit(0);
}

fs.mkdirSync(DESTINO, { recursive: true });

/** Cada ejemplo: el nombre del archivo y los argumentos tal como los pasa el código que lo manda. */
const EJEMPLOS = [
  {
    archivo: 'campana-con-cupon',
    args: [
      'Vuelve este fin de semana, {{nombre}}',
      'Hola {{nombre}}:\n\nEste sábado estrenamos la carta de primavera, con tres platos nuevos y una barra de coctelería que se nos fue de las manos (para bien).\n\nTe dejamos un código para que vengas con alguien.',
      { nombre: 'Ana', cupon: 'VUELVE20' },
      undefined,
      undefined,
      [
        { etiqueta: 'Tu código', valor: 'VUELVE20' },
        { etiqueta: 'Válido hasta', valor: '31 de diciembre de 2026' },
      ],
      BAJA,
    ],
  },
  {
    archivo: 'equipo-reserva-nueva',
    args: [
      'Nueva reserva - {{local}}',
      '{{nombre}} reservó {{local}} para el {{fecha}}, {{personas}} personas.\n\nCódigo: {{codigo}}',
      {
        nombre: 'Camila Rojas', local: 'Casa Costanera - Providencia', personas: 4,
        codigo: 'CC-7H2K', fecha: 'sábado, 24 de octubre de 2026, 21:00',
      },
    ],
  },
  {
    archivo: 'equipo-solicitud-de-grupo',
    args: [
      'Nueva solicitud de grupo - {{local}}',
      '{{nombre}} pidió un evento en {{local}}.\n\nOcasión: {{ocasion}}\nPersonas: {{personas}}\nCuándo lo quiere: {{fecha}}\nTeléfono: {{telefono}}\nCorreo: {{correo}}\n\nLo que contó: {{notas}}\n\nNo toma cupo hasta que el equipo acuerde fecha y hora desde Reservas → Grupos y eventos.',
      {
        nombre: 'Rodrigo Pérez', local: 'Casa Costanera - Providencia', ocasion: 'Empresa',
        personas: 18, fecha: 'viernes 13 de noviembre, en la noche',
        telefono: '+56 9 8765 4321', correo: 'rodrigo@empresa.cl',
        notas: 'Somos el equipo de ventas, cierre de año. Necesitamos un espacio aparte y una persona es celíaca.',
      },
    ],
  },
  {
    archivo: 'equipo-reservas-pausadas',
    args: [
      '{{titulo}} - {{local}}',
      '{{detalle}}\n\nLo hizo {{quien}}.',
      {
        titulo: 'Reservas pausadas', local: 'Casa Costanera - Providencia',
        detalle: 'Casa Costanera - Providencia dejó de ofrecer horarios hasta el 3 de noviembre de 2026, 18:00.',
        quien: 'Paula Navarro',
      },
    ],
  },
  {
    archivo: 'equipo-mensaje-de-encuesta',
    args: [
      'Mensaje de {{nombre}} sobre su visita',
      'Calificó su visita a {{local}} con {{nota}} de 5 y quiso contarles esto antes de publicar nada:\n\n«{{mensaje}}»\n\nPueden responderle directo a este correo.',
      {
        nombre: 'Carmen Soto', local: 'Casa Costanera - Providencia', nota: 2,
        mensaje: 'La mesa estaba fría y tardaron 40 minutos en tomarnos el pedido. La comida después estuvo muy bien.',
        encuesta: 'Tu visita',
      },
      undefined,
      undefined,
      [
        { etiqueta: 'Encuesta', valor: 'Tu visita' },
        { etiqueta: 'Nota', valor: '2 de 5' },
        { etiqueta: 'Correo', valor: 'carmen@correo.cl' },
      ],
    ],
  },
  {
    archivo: 'invitacion-a-encuesta',
    args: [
      '{{encuesta}}',
      'Nos gustaría saber cómo te fue. Es un minuto y lo lee el equipo.',
      { encuesta: 'Tu visita a Casa Costanera' },
      { texto: 'Responder la encuesta', url: 'https://cuartel.espartanos.cl/survey/enc-1?src=email' },
    ],
  },
];

for (const { archivo, args } of EJEMPLOS) {
  const { subject, html } = componerCorreo(...args);
  /*
   * Encima del correo va una barra con el asunto.
   *
   * El asunto no es parte del HTML del mensaje —lo lleva la cabecera— y es justo lo que decide si
   * alguien lo abre, así que una captura sin él enseña la mitad de la carta.
   */
  const conAsunto = html.replace(
    /<body([^>]*)>/i,
    `<body$1><div style="max-width:620px;margin:16px auto 0;padding:10px 14px;border-radius:10px;background:#1c1b1f;color:#fff;font:600 13px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">`
    + `<span style="opacity:.55;font-weight:400">Asunto:</span> ${subject}</div>`,
  );
  fs.writeFileSync(path.join(DESTINO, `${archivo}.html`), conAsunto);
  console.log(`${archivo}.html  ·  ${subject}`);
}

console.log(`\n${EJEMPLOS.length} correos en ${DESTINO}`);
console.log('Ábrelos en http://localhost:5176/_correos/<nombre>.html');
