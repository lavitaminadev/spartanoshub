/**
 * @fileoverview Documentos legales de Espartanos y de cada local, generados desde una sola fuente.
 *
 * Espartanos es dueña de la plataforma y siempre publica sus propios documentos: política de
 * privacidad, condiciones de uso, medición y cookies, ejercicio de derechos y contrato de encargo.
 * Cada local es el responsable de los datos de sus clientes; si no publica su propia política, se
 * genera una con esta plantilla y **sus datos reales** (razón social, RUT, correo). Nunca con datos
 * inventados: sin esos datos la reserva o encuesta no se publica (`faltantesDeIdentidadLegal`).
 *
 * Los plazos de conservación salen de `PLAZOS_DE_CONSERVACION`, el mismo valor que usa el borrado
 * automático: el texto y el sistema no pueden contradecirse. Lo que se afirma sobre seguridad,
 * proveedores y decisiones automatizadas describe lo que la plataforma hace hoy; si eso cambia,
 * cambia el texto y su versión.
 *
 * Marco considerado: Ley 19.628 sobre protección de la vida privada, modificada por la Ley 21.719
 * (vigente desde el 1 de diciembre de 2026); Ley 19.496 de protección de los derechos de los
 * consumidores; Ley 19.799 sobre documentos y firma electrónica. Deben revisarse con asesoría
 * jurídica antes de su publicación definitiva y cada vez que la Agencia de Protección de Datos
 * Personales dicte instrucciones o normas de aplicación.
 */

import { rutValido } from './survey-rules';

/** Identidad de Espartanos como operador de la plataforma. Lo que aún no se conoce queda en `null` y no se muestra. */
export const OPERADOR_ESPARTANOS = {
  marca: 'Espartanos',
  correo: 'hola@espartanos.cl',
  sitio: 'https://espartanos.cl',
  razonSocial: null as string | null,
  rut: null as string | null,
  domicilio: null as string | null,
  /** Proveedor de alojamiento de la plataforma y de los correos que envía. */
  alojamiento: 'iHosting',
  /** Punto de contacto de privacidad: un cargo directivo, nunca un trabajador sin atribuciones. */
  contactoPrivacidad: 'Encargado de Protección de Datos de Espartanos, cargo directivo a cargo del desarrollo y la seguridad de la plataforma',
};

/** Meses que se conserva cada tipo de dato antes de anonimizarlo. */
export const PLAZOS_DE_CONSERVACION = {
  /**
   * Datos de quien reserva, contados desde la fecha de la visita: cubre el plazo para reclamar
   * como consumidor por esa reserva.
   */
  reservasMeses: 24,
  /** Solicitudes de evento o grupo, contadas desde que se enviaron. */
  solicitudesDeGrupoMeses: 24,
  /** Respuestas de encuestas con datos de contacto, contadas desde que se respondieron. */
  encuestasMeses: 24,
  /**
   * Identificadores de medición (cookies de Meta, IP y navegador) guardados junto a una reserva.
   * Meta sólo acepta conversiones de hasta 7 días; el resto cubre revisión y reportes del período.
   */
  medicionMeses: 6,
  /**
   * Con el permiso de beneficios vigente, el historial de visitas y preferencias se conserva para
   * personalizar, hasta este máximo contado desde la última visita. Sin permiso rigen los plazos normales.
   */
  clientesConBeneficiosMeses: 60,
} as const;

/** Versión del permiso de beneficios y novedades. */
export const VERSION_BENEFICIOS = 'beneficios-v1';

/** Días corridos para responder una solicitud de derechos, prorrogables una vez por el mismo plazo. */
export const PLAZO_RESPUESTA_DERECHOS_DIAS = 30;

/** Horas máximas para que Espartanos avise al local de una vulneración que afecte sus datos. */
export const PLAZO_AVISO_VULNERACION_HORAS = 48;

/** Versión vigente del conjunto de documentos. */
export const VERSION_DOCUMENTOS_LEGALES = 'legal-2026-09-15c';
export const VIGENCIA_DOCUMENTOS_LEGALES = '2026-09-15';

export type IdDocumentoLegal = 'privacidad' | 'terminos' | 'servicio' | 'medicion' | 'encargo' | 'derechos';

export interface TablaLegal {
  columnas: string[];
  filas: string[][];
}

export interface SeccionLegal {
  titulo: string;
  parrafos: string[];
  lista?: string[];
  tabla?: TablaLegal;
  /** Párrafos que van después de la lista o la tabla. */
  cierre?: string[];
}

export interface DocumentoLegal {
  id: IdDocumentoLegal | 'privacidad-local';
  titulo: string;
  version: string;
  vigenteDesde: string;
  resumen: string;
  secciones: SeccionLegal[];
}

/** Datos legales de un local tal como están en su ficha. */
export interface IdentidadLegal {
  razonSocial?: string | null;
  rut?: string | null;
  correo?: string | null;
  nombreComercial?: string | null;
}

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Lo que falta para que un local pueda publicar algo que recoge datos personales. Vacío si está completo. */
export function faltantesDeIdentidadLegal(identidad: IdentidadLegal): string[] {
  const faltan: string[] = [];
  if (!identidad.razonSocial?.trim()) faltan.push('razón social');
  if (!identidad.rut?.trim() || !rutValido(identidad.rut)) faltan.push('RUT válido');
  if (!identidad.correo?.trim() || !CORREO.test(identidad.correo.trim())) faltan.push('correo para consultas de privacidad');
  return faltan;
}

/** Mensaje para quien intenta publicar sin los datos legales del local. */
export function mensajeDeIdentidadIncompleta(faltan: string[]): string {
  return `Para publicar, completa los datos legales de la empresa: ${faltan.join(', ')}. Quien reserve o responda debe saber quién es responsable de sus datos. Se completan en «Datos legales».`;
}

/** Cómo se nombra a Espartanos en los textos: con razón social y RUT cuando se conozcan. */
export function nombreLegalDelOperador(): string {
  const { marca, razonSocial, rut } = OPERADOR_ESPARTANOS;
  if (razonSocial) return `${razonSocial}${rut ? `, RUT ${rut}` : ''} («${marca}»)`;
  return marca;
}

/** Cómo se nombra al local en los textos. */
export function nombreLegalDelLocal(identidad: IdentidadLegal): string {
  const razon = identidad.razonSocial?.trim() || identidad.nombreComercial?.trim() || 'el local';
  const rut = identidad.rut?.trim();
  const comercial = identidad.nombreComercial?.trim();
  const marca = comercial && comercial !== razon ? ` («${comercial}»)` : '';
  return `${razon}${rut ? `, RUT ${rut}` : ''}${marca}`;
}

const DERECHOS = 'acceso, rectificación, supresión, oposición, portabilidad y bloqueo';
const AGENCIA = 'Agencia de Protección de Datos Personales';
const RECLAMO = `Si tu solicitud es rechazada, no se responde dentro de plazo o la respuesta no te satisface, puedes reclamar ante la ${AGENCIA}, sin perjuicio de las acciones judiciales que correspondan.`;

function identidadDelOperador(): string[] {
  const { correo, sitio, domicilio } = OPERADOR_ESPARTANOS;
  return [
    `${nombreLegalDelOperador()}, operador de la plataforma disponible en ${sitio}.`,
    ...(domicilio ? [`Domicilio: ${domicilio}.`] : []),
    `Correo de contacto y de privacidad: ${correo}.`,
  ];
}

const DEFINICIONES: SeccionLegal = {
  titulo: 'Definiciones',
  parrafos: ['Para leer estos documentos:'],
  lista: [
    'Titular: la persona a quien se refieren los datos; por ejemplo, quien reserva o responde una encuesta.',
    'Responsable: quien decide para qué y cómo se usan los datos. En una reserva o encuesta, el local.',
    'Encargado: quien trata los datos por cuenta del responsable y según sus instrucciones. En Reservas y Encuestas, Espartanos.',
    'Local o empresa cliente: el restaurante, bar, local o empresa que usa Espartanos para recibir reservas o encuestas.',
    'Dato sensible: el que se refiere a la salud, la vida sexual, el origen étnico, las creencias, la afiliación política o sindical, datos biométricos u otros cuyo uso indebido puede causar discriminación. Una alergia, una intolerancia alimentaria o una condición de movilidad son datos de salud.',
    'Anonimizar: eliminar de forma irreversible lo que permite identificar a una persona, de modo que lo que queda son cifras o hechos sin nombre.',
    'Plataforma: el sistema de Espartanos, incluidas las páginas públicas de reserva y encuesta y el panel que usan los locales.',
  ],
};

/** Política de privacidad de la plataforma Espartanos. */
export function politicaDePrivacidadDeEspartanos(): DocumentoLegal {
  const p = PLAZOS_DE_CONSERVACION;
  const { correo, alojamiento, contactoPrivacidad } = OPERADOR_ESPARTANOS;
  return {
    id: 'privacidad',
    titulo: 'Política de privacidad de Espartanos',
    version: VERSION_DOCUMENTOS_LEGALES,
    vigenteDesde: VIGENCIA_DOCUMENTOS_LEGALES,
    resumen: 'Espartanos es la plataforma con la que restaurantes, bares y otros locales reciben reservas, solicitudes de eventos y encuestas. Cuando usas una de esas páginas, el responsable de tus datos es el local y Espartanos sólo los trata por su encargo. Espartanos es responsable directo únicamente de los datos de su relación con las empresas que la contratan, de sus cuentas de acceso y de la seguridad del sistema. Aquí se explica qué datos se tratan, para qué, con qué fundamento, con quién se comparten, cuánto tiempo se guardan y cómo ejercer tus derechos.',
    secciones: [
      { titulo: '1. Quién opera la plataforma', parrafos: identidadDelOperador() },
      {
        titulo: '2. Encargado de Protección de Datos',
        parrafos: [
          `Las consultas y solicitudes sobre datos personales las atiende el ${contactoPrivacidad}, en ${correo}. Tiene atribuciones para revisar el tratamiento, ordenar correcciones y responder a las autoridades; no es un canal de atención general.`,
        ],
      },
      { ...DEFINICIONES, titulo: '3. Definiciones' },
      {
        titulo: '4. Dos roles distintos',
        parrafos: [
          'Cuando reservas, solicitas un evento o respondes una encuesta de un local, el responsable de tus datos es ese local, identificado con su razón social y RUT en el mismo formulario. Espartanos actúa como encargado: trata los datos sólo por cuenta del local, según sus instrucciones y un contrato de encargo aceptado por el local. Espartanos no usa esos datos para fines propios, no crea perfiles propios con ellos, no los vende ni los cede.',
          'Espartanos es responsable de los datos de las empresas que contratan la plataforma, de las personas que la usan en su nombre (cuentas de acceso), de las solicitudes que le envías directamente y de los registros de seguridad y funcionamiento del sistema.',
        ],
      },
      {
        titulo: '5. Qué datos se tratan, para qué y con qué fundamento',
        parrafos: ['Cada uso tiene una finalidad concreta y un fundamento legal. No se usan datos para una finalidad distinta de la informada.'],
        tabla: {
          columnas: ['Datos', 'Finalidad', 'Fundamento', 'Plazo'],
          filas: [
            ['Nombre, teléfono, correo, fecha, hora, cantidad de personas y respuestas del formulario de reserva o solicitud', 'Gestionar, confirmar, recordar, modificar o cancelar la reserva o solicitud y comunicarse contigo por ese motivo', 'Ejecución de lo que tú solicitas (relación con el local)', `Hasta ${p.reservasMeses} meses después de la visita; solicitudes de grupo ${p.solicitudesDeGrupoMeses} meses desde su envío`],
            ['Información de salud o alimentación que decidas indicar, como alergias o movilidad reducida', 'Que el local te atienda de forma segura', 'Tu consentimiento expreso, en una casilla separada', 'Igual que la reserva o respuesta en que la indicaste'],
            ['Respuestas de encuestas y, si los entregas, nombre, RUT, correo, teléfono o fecha de nacimiento', 'Conocer tu opinión, mejorar la atención y, si lo pides, contactarte sobre tu respuesta', 'Tu consentimiento cuando entregas datos de contacto; interés legítimo del local en evaluar su servicio cuando la encuesta es anónima', `${p.encuestasMeses} meses desde la respuesta`],
            ['Correo y teléfono de quien asistió a una reserva', 'Invitarte, una vez por visita, a una encuesta sobre cómo te atendieron', 'Interés legítimo del local en evaluar el servicio que prestó; puedes pedir no recibirlas', 'Igual que la reserva'],
            ['Correo, teléfono, fecha de nacimiento si la entregas, historial de visitas y preferencias (nunca datos de salud)', 'Enviarte beneficios y novedades del local (y de los locales de su grupo si así lo indica la casilla): promociones, beneficio de cumpleaños, invitaciones a eventos y encuestas, por correo, WhatsApp o SMS, elegidos según tus visitas y preferencias', 'Tu consentimiento', `Mientras mantengas el permiso, hasta ${p.clientesConBeneficiosMeses} meses desde tu última visita`],
            ['Cookies de medición, dirección IP, navegador, correo y teléfono cifrados', 'Medir qué anuncios traen reservas y mostrarte anuncios relevantes del local en Meta y Google, incluidas audiencias de clientes', 'Tu consentimiento', `${p.medicionMeses} meses en la plataforma; en Meta y Google, según sus políticas`],
            ['Nombre, contacto y preferencias de visita compartidos con otros locales de la red', 'No repetir tus datos al reservar en otro local de la misma red', 'Tu consentimiento', 'Hasta que lo retires o se cumpla el plazo de cada reserva'],
            ['Dirección IP, navegador, fecha y hora de acceso, intentos fallidos', 'Seguridad de la plataforma, prevenir reservas falsas o automatizadas y resolver fallas', 'Interés legítimo del local y de Espartanos en proteger el servicio', 'El necesario para la seguridad del servicio y la investigación de incidentes'],
            ['Nombre, correo, rol y actividad de las cuentas de acceso de las empresas', 'Prestar el servicio contratado, dar soporte, auditar cambios y mantener la seguridad', 'Ejecución del contrato con la empresa e interés legítimo en la seguridad', 'Mientras dure el contrato y luego el plazo legal de prescripción'],
            ['Nombre, correo, RUT o teléfono y mensaje de solicitudes enviadas a Espartanos', 'Responder, dar seguimiento y dejar constancia de cómo y cuándo se atendió', 'Cumplimiento de obligaciones legales e interés legítimo', `${p.solicitudesDeGrupoMeses} meses desde su cierre`],
          ],
        },
        cierre: [
          'Sobre el interés legítimo: se usa sólo para seguridad, prevención de abusos y evaluación del servicio, con el mínimo de datos y sin decisiones que te afecten. Puedes oponerte escribiendo al correo de privacidad; se dejará de tratar el dato salvo que exista un motivo de seguridad o legal que prevalezca, lo que se te informará.',
          'Entregar los datos de contacto de la reserva es necesario para que el local pueda gestionarla. Todo lo demás es voluntario.',
        ],
      },
      {
        titulo: '6. Datos sensibles',
        parrafos: [
          'Los formularios de reserva y encuesta pueden preguntar por alergias, restricciones alimentarias, embarazo, movilidad reducida u otras condiciones para atenderte mejor. Esa información es un dato sensible de salud.',
          'Sólo se trata si decides entregarla y das tu consentimiento expreso en una casilla específica, separada de las demás. Se usa exclusivamente para que el local adapte la atención, no se usa para publicidad ni medición, no se envía a Meta, Google ni a otros locales, y se anonimiza en el mismo plazo que la reserva o respuesta. Puedes pedir su supresión en cualquier momento.',
          'No completes esos campos con datos de otra persona sin su autorización.',
        ],
      },
      {
        titulo: '7. A quiénes se refieren los datos',
        parrafos: ['Personas que reservan, solicitan eventos, se anotan en lista de espera o responden encuestas en páginas de los locales; personas que usan el panel en nombre de una empresa cliente; representantes y contactos de las empresas clientes; y personas que escriben directamente a Espartanos.'],
      },
      {
        titulo: '8. De dónde vienen los datos',
        parrafos: ['La mayoría los entregas tú en el formulario. Algunos se generan al usar la página, como la dirección IP, el navegador o las cookies. Si llegas desde un anuncio, el enlace puede traer un identificador de clic de Meta o Google, que sólo se guarda si aceptas la medición. Espartanos no compra ni recibe bases de datos de terceros.'],
      },
      {
        titulo: '9. Con quién se comparten',
        parrafos: ['Nunca se venden. Se comunican sólo a:'],
        lista: [
          'El local responsable de tu reserva, solicitud o encuesta, y su personal autorizado.',
          'Otros locales de la misma red, sólo si lo autorizaste.',
          `${alojamiento}, proveedor que aloja la plataforma y envía sus correos, como subencargado y bajo deber de confidencialidad.`,
          'Meta Platforms y Google, sólo si aceptaste la medición y exclusivamente con los datos descritos en «Medición y cookies».',
          'Tribunales, el Ministerio Público u otras autoridades, cuando una ley o una resolución lo exija.',
        ],
        tabla: {
          columnas: ['Proveedor', 'Servicio', 'Datos que recibe', 'País'],
          filas: [
            [alojamiento, 'Alojamiento de la plataforma y base de datos, envío de correos', 'Todos los datos de la plataforma', 'Chile'],
            ['Cloudinary', 'Almacenamiento y entrega de imágenes de los locales', 'Fotos y logos; no recibe datos de clientes', 'Estados Unidos'],
            ['Meta Platforms', 'Medición publicitaria, sólo con tu autorización', 'Eventos, cookies, IP, navegador, correo y teléfono cifrados', 'Estados Unidos'],
            ['Google', 'Analítica y medición publicitaria, sólo con tu autorización', 'Eventos, cookies, IP y navegador', 'Estados Unidos'],
          ],
        },
        cierre: ['Cada proveedor está obligado a confidencialidad y a usar los datos sólo para prestar su servicio. Si la lista cambia, se actualiza esta política con una nueva versión.'],
      },
      {
        titulo: '10. Transferencias fuera de Chile',
        parrafos: [
          'Espartanos no envía tus datos fuera de Chile por decisión propia. La transferencia internacional ocurre si aceptas la medición: Meta Platforms y Google tratan los datos en servidores ubicados principalmente en Estados Unidos y la Unión Europea, amparados en sus cláusulas contractuales tipo y acuerdos de tratamiento de datos, que los obligan a estándares de protección equivalentes a la ley chilena. Las imágenes de los locales se almacenan en Estados Unidos, pero no contienen datos de clientes. Si no aceptas la medición, tus datos personales no salen de Chile. Puedes pedir información sobre estas garantías al correo de privacidad.',
        ],
      },
      {
        titulo: '11. Decisiones automatizadas y perfiles',
        parrafos: ['Espartanos no toma decisiones basadas únicamente en tratamiento automatizado que produzcan efectos jurídicos para ti o te afecten de forma significativa. Lo automático se limita a:'],
        lista: [
          'Mostrar horarios según la disponibilidad que configuró el local.',
          'Ordenar la lista de espera por orden de llegada.',
          'Detectar y bloquear envíos automatizados o abusivos para proteger el servicio. Si una reserva legítima fue bloqueada, puedes pedir revisión humana al local o al correo de privacidad.',
        ],
        cierre: [
          'Con el permiso de beneficios, el local puede agrupar a sus clientes según visitas y preferencias (por ejemplo, quienes no vienen hace tiempo o cumplen años este mes) para enviarles beneficios pertinentes. Es sólo para elegir qué ofrecerte, no produce efectos jurídicos y puedes oponerte retirando el permiso.',
          'Espartanos no usa tus datos para entrenar sistemas de inteligencia artificial ni para elaborar perfiles propios. Si aceptas la medición, Meta y Google pueden usar los datos para optimizar anuncios según sus propias políticas; retirar la autorización detiene ese envío.',
        ],
      },
      {
        titulo: '12. Cuánto tiempo se conservan',
        parrafos: [
          `Si aceptaste beneficios y novedades, tu historial de visitas y preferencias se conserva mientras mantengas ese permiso, con un máximo de ${p.clientesConBeneficiosMeses} meses desde tu última visita. Al retirarlo, se aplican los plazos normales.`,
          'Los plazos de la tabla del punto 5 se aplican de forma automática. Cumplido el plazo, los datos se anonimizan: se borran nombre, contacto, respuestas personales, datos sensibles e identificadores, y quedan sólo cifras que no permiten identificar a nadie, como cantidad de reservas por día o nota promedio de una encuesta.',
          'Si pides la supresión antes, se atiende sin esperar el plazo, salvo lo que una ley obligue a conservar o lo necesario para defender un reclamo en curso, lo que se te informará.',
        ],
      },
      {
        titulo: '12 bis. Estadísticas anónimas',
        parrafos: ['Espartanos puede elaborar estadísticas agregadas y anonimizadas a partir del uso de la plataforma, por ejemplo tasas de asistencia, horas de mayor demanda o promedios por tipo de local, para mejorar el servicio y publicar comparativas del rubro. Esas cifras no permiten identificar a ninguna persona ni a un local sin su autorización.'],
      },
      {
        titulo: '13. Tus derechos',
        parrafos: [`Tienes derecho a ${DERECHOS} de tus datos, a no ser objeto de decisiones basadas únicamente en tratamiento automatizado y a retirar cualquier autorización, sin costo y sin efecto retroactivo sobre lo hecho antes. Una autorización se puede retirar por el mismo medio en que se dio, con la misma facilidad.`],
        lista: [
          'Acceso: saber si hay datos tuyos, cuáles, de dónde vienen, para qué se usan, con quién se comparten y por cuánto tiempo se guardan.',
          'Rectificación: corregir datos inexactos o incompletos.',
          'Supresión: eliminar datos cuando ya no son necesarios, retiras tu consentimiento, te opusiste con éxito o se trataron ilícitamente.',
          'Oposición: que no se usen para una finalidad determinada, en especial marketing directo, sin necesidad de dar razones.',
          'Portabilidad: recibir tus datos en un formato estructurado y de uso común (CSV o JSON) o que se transmitan a otro responsable cuando sea técnicamente posible.',
          'Bloqueo: suspender temporalmente el uso de tus datos mientras se resuelve una solicitud de rectificación, supresión u oposición.',
        ],
        cierre: [
          `Cómo ejercerlos y en qué plazo se responde se explica en «Tus derechos». El plazo es de ${PLAZO_RESPUESTA_DERECHOS_DIAS} días corridos desde que se recibe la solicitud, prorrogable una vez por el mismo período con aviso fundado.`,
          RECLAMO,
        ],
      },
      {
        titulo: '14. Seguridad',
        parrafos: ['Las medidas se ajustan al riesgo de los datos. Hoy incluyen:'],
        lista: [
          'Conexión cifrada (HTTPS) en todas las páginas y en el panel.',
          'Contraseñas almacenadas con cifrado irreversible y límites de intentos de acceso.',
          'Acceso por roles: cada persona del local ve sólo lo que su función requiere.',
          'Registro de auditoría de las acciones sobre datos personales: quién, qué y cuándo.',
          'Copias de seguridad del proveedor de alojamiento.',
          'Anonimización automática al vencer los plazos.',
          'Casillas de consentimiento separadas, sin marcar de antemano, con el texto aceptado y su versión guardados como evidencia.',
        ],
        cierre: [
          `Si ocurre una vulneración de seguridad que afecte datos personales, se comunicará a la ${AGENCIA} por los medios más expeditos y sin dilaciones indebidas y, cuando afecte datos sensibles, de menores o datos que puedan causar un daño relevante, también a las personas afectadas, en lenguaje claro y con las medidas recomendadas. Espartanos avisa al local responsable dentro de ${PLAZO_AVISO_VULNERACION_HORAS} horas desde que la detecta.`,
        ],
      },
      {
        titulo: '15. Niñas, niños y adolescentes',
        parrafos: [
          'Las páginas de reserva y encuesta están dirigidas a mayores de 18 años. Si reservas para un grupo que incluye menores, entrega sólo los datos de un adulto responsable. No se piden datos de menores de 14 años; si se reciben por error, se suprimen apenas se detectan. Los datos sensibles de adolescentes nunca se tratan sin la autorización de quien tenga su cuidado personal.',
        ],
      },
      {
        titulo: '16. Cambios a esta política',
        parrafos: [
          'Cada versión tiene fecha y número, y las anteriores se conservan. Los cambios que amplíen el uso de tus datos no se aplican a datos ya entregados sin una nueva autorización. Esta política se actualizará cuando la Agencia de Protección de Datos Personales dicte instrucciones o normas que la afecten.',
        ],
      },
    ],
  };
}

/** Condiciones de uso de las páginas públicas de reservas y encuestas. */
export function condicionesDeUso(): DocumentoLegal {
  const { marca, correo } = OPERADOR_ESPARTANOS;
  return {
    id: 'terminos',
    titulo: 'Condiciones de uso de reservas y encuestas',
    version: VERSION_DOCUMENTOS_LEGALES,
    vigenteDesde: VIGENCIA_DOCUMENTOS_LEGALES,
    resumen: `Estas condiciones rigen el uso de las páginas de reserva, solicitud de eventos, lista de espera y encuestas de los locales que usan ${marca}. Al marcar la casilla de aceptación y enviar el formulario las aceptas, junto con las condiciones propias del local que se muestren en él.`,
    secciones: [
      { titulo: '1. Quién opera la plataforma', parrafos: identidadDelOperador() },
      {
        titulo: '2. Quién presta cada servicio',
        parrafos: [
          `El servicio que reservas o solicitas lo presta el local identificado con su razón social y RUT en el formulario. El local responde por el servicio, su disponibilidad, precios, políticas de cancelación, garantías, calidad y atención, conforme a la Ley 19.496.`,
          `${marca} provee la plataforma tecnológica por encargo del local. No vende, no cobra por la reserva y no es parte de la relación de consumo entre tú y el local, sin perjuicio de su responsabilidad por el correcto funcionamiento de la plataforma.`,
        ],
      },
      {
        titulo: '3. Cómo se forma y confirma una reserva',
        parrafos: ['La reserva se forma electrónicamente, con el mismo valor que un acuerdo por escrito:'],
        lista: [
          'Eliges personas, fecha y horario, completas tus datos y marcas la aceptación.',
          'Antes de enviar ves un resumen para revisar y corregir.',
          'Si el local confirma automáticamente, la reserva queda confirmada al terminar y recibes un código. Si el local revisa antes de confirmar, queda pendiente hasta que responda, y así se indica en pantalla.',
          'Si entregaste correo, recibes una confirmación con el detalle y un enlace para modificar o cancelar.',
        ],
        cierre: ['Mientras completas el formulario, el horario puede quedar retenido unos minutos para ti. Si no terminas, se libera.'],
      },
      {
        titulo: '4. Condiciones del local',
        parrafos: ['Tolerancia de llegada, plazo y forma de cancelación, consumo mínimo, garantías, uso de mesas o zonas y cualquier otra regla del local se muestran en el formulario antes de enviarlo y forman parte de tu reserva. Si el local no informó una condición antes de que reservaras, no puede exigírtela.'],
      },
      {
        titulo: '5. Modificar, cancelar y no asistir',
        parrafos: [
          'Puedes modificar o cancelar tu reserva con el enlace o código recibido, dentro de los plazos del local. Si no asistes, el local puede registrar la inasistencia. Cualquier consecuencia de una inasistencia o cancelación tardía sólo aplica si el local la informó en el formulario.',
          'El local puede cancelar o modificar una reserva por causas justificadas, avisándote por el medio de contacto que entregaste lo antes posible.',
        ],
      },
      { titulo: '6. Solicitudes de eventos y grupos', parrafos: ['Una solicitud de evento o de grupo grande no confirma cupo ni precio. El local responde con disponibilidad y, si corresponde, una cotización, que sólo te obliga si la aceptas expresamente.'] },
      { titulo: '7. Lista de espera', parrafos: ['Anotarte en la lista de espera no garantiza un cupo. Se atiende por orden de llegada. Si se libera un cupo, el local te avisa y la reserva existe sólo cuando lo confirma.'] },
      { titulo: '8. Encuestas', parrafos: ['Responder una encuesta es voluntario y no condiciona ningún servicio ni beneficio, salvo que el local haya informado otra cosa de forma clara antes de responder. Si dejas datos de contacto, el local puede comunicarse contigo sobre tu respuesta.'] },
      {
        titulo: '9. Uso correcto',
        parrafos: ['Al usar la plataforma te comprometes a:'],
        lista: [
          'Entregar datos verdaderos y propios, o de quien te autorizó a entregarlos.',
          'No hacer reservas falsas, masivas o automatizadas, ni reservar para revender cupos.',
          'No intentar acceder a datos de otras personas, vulnerar la seguridad ni afectar el funcionamiento de la plataforma.',
          'No ingresar contenido ofensivo, discriminatorio o ilícito en campos de texto.',
        ],
        cierre: ['El local puede anular reservas que infrinjan estas reglas, y Espartanos puede bloquear el acceso a quien ataque la plataforma, sin perjuicio de las acciones legales.'],
      },
      { titulo: '10. Comunicaciones', parrafos: ['Los mensajes sobre tu reserva (confirmación, recordatorio, cambios) son parte del servicio. Las comunicaciones promocionales sólo se envían si las autorizaste, identifican al local que las envía y permiten darte de baja en cada mensaje, conforme a la Ley 19.496.'] },
      { titulo: '11. Disponibilidad de la plataforma', parrafos: [`${marca} procura que la plataforma funcione de forma continua y segura, pero puede haber interrupciones por mantenimiento, fallas de terceros o causas de fuerza mayor. Si tienes un problema con una reserva, contacta directamente al local; también puedes escribir a ${correo}.`] },
      { titulo: '12. Propiedad intelectual', parrafos: [`La plataforma, su diseño y su software pertenecen a ${marca}. Las marcas, logos, fotos y textos de cada local pertenecen a ese local, que declara tener derecho a usarlos.`] },
      { titulo: '13. Datos personales', parrafos: ['El tratamiento de tus datos se rige por la política de privacidad del local y por la Política de privacidad de Espartanos, que forman parte de estas condiciones.'] },
      { titulo: '14. Tus derechos como consumidor', parrafos: ['Nada en estas condiciones limita los derechos irrenunciables que te otorga la Ley 19.496. Puedes reclamar ante el local, ante el Servicio Nacional del Consumidor o ante el juzgado de policía local competente.'] },
      { titulo: '15. Cambios', parrafos: ['Estas condiciones pueden actualizarse. Cada reserva se rige por la versión vigente al momento de hacerla, que queda registrada.'] },
      { titulo: '16. Ley aplicable', parrafos: ['Estas condiciones se rigen por las leyes de la República de Chile.'] },
    ],
  };
}

/** Condiciones del servicio para las empresas que contratan Espartanos. */
export function condicionesDelServicio(): DocumentoLegal {
  const { marca, correo } = OPERADOR_ESPARTANOS;
  return {
    id: 'servicio',
    titulo: 'Condiciones del servicio para empresas',
    version: VERSION_DOCUMENTOS_LEGALES,
    vigenteDesde: VIGENCIA_DOCUMENTOS_LEGALES,
    resumen: `Regulan el acceso y uso de ${marca} por las empresas que la contratan para recibir reservas, solicitudes de eventos y encuestas. Al activar el servicio o usar el panel, la empresa y las personas que actúan en su nombre las aceptan. Precios, plazos y alcance comercial se rigen por la propuesta o contrato comercial acordado con cada empresa, que prevalece en lo que regule expresamente.`,
    secciones: [
      { titulo: '1. Partes', parrafos: [...identidadDelOperador(), 'Empresa cliente: la persona jurídica o natural con giro que contrata el servicio, identificada con sus datos legales en la plataforma.'] },
      { titulo: '2. Descripción del servicio', parrafos: [`${marca} es un software como servicio que permite a la empresa publicar páginas de reserva, solicitudes de eventos, lista de espera y encuestas, gestionar sus sucursales, recibir notificaciones, ver métricas y, si la empresa lo activa, conectar medición publicitaria con Meta y Google. Las funciones disponibles dependen de lo contratado.`] },
      { titulo: '3. Cuentas y accesos', parrafos: [
        'La empresa entrega información veraz y actualizada, y designa a las personas que usarán el panel. Cada persona tiene una cuenta propia e intransferible con el rol que la empresa le asigne.',
        'La empresa es responsable de mantener la confidencialidad de las credenciales, de las acciones realizadas con sus cuentas y de retirar el acceso a quien deje de trabajar con ella. Debe avisar de inmediato a Espartanos si sospecha un acceso no autorizado.',
      ] },
      { titulo: '4. Datos legales y publicación', parrafos: ['Para publicar páginas que recogen datos personales, la empresa debe registrar su razón social, RUT y un correo de privacidad atendido, y aceptar el contrato de encargo de tratamiento. Sin esos datos la plataforma no permite publicar, para que cada persona sepa quién es responsable de sus datos.'] },
      { titulo: '5. Contenido de la empresa', parrafos: [
        'La empresa es responsable del contenido que publica: nombres, fotos, logos, textos, condiciones de reserva, preguntas, promociones y políticas propias. Declara tener los derechos necesarios sobre ese contenido y que es veraz, lícito y cumple la Ley 19.496.',
        'Espartanos puede retirar o pausar contenido manifiestamente ilícito, engañoso o que infrinja derechos de terceros, avisando a la empresa.',
      ] },
      { titulo: '6. Datos de la empresa y de sus clientes', parrafos: [
        'Los datos que la empresa y sus clientes cargan en la plataforma pertenecen a la empresa. Espartanos los trata como encargado, según el Contrato de encargo de tratamiento de datos personales, que forma parte de estas condiciones, y no los usa para fines propios.',
        'La empresa puede exportar sus datos durante la vigencia del servicio y hasta 30 días después de su término.',
      ] },
      { titulo: '7. Obligaciones de la empresa en el uso', parrafos: ['La empresa se obliga a:'], lista: [
        'Configurar con veracidad su disponibilidad, capacidad, condiciones de reserva y cancelación.',
        'Atender las reservas, solicitudes y reclamos de sus clientes; la relación de consumo es entre la empresa y su cliente.',
        'Marcar como sensible toda pregunta sobre salud, alimentación u otro dato sensible.',
        'Enviar comunicaciones promocionales sólo a quienes lo autorizaron.',
        'Activar la medición publicitaria sólo si la usará y mantener actualizados sus identificadores de Meta y Google.',
      ] },
      { titulo: '8. Usos prohibidos', parrafos: ['Está prohibido:'], lista: [
        'Copiar, modificar, descompilar o hacer ingeniería inversa de la plataforma.',
        'Revender, sublicenciar o dar acceso a terceros ajenos a la empresa.',
        'Usar la plataforma para contenido fraudulento, discriminatorio, difamatorio o ilícito, o para enviar comunicaciones no autorizadas.',
        'Intentar acceder a datos de otras empresas o vulnerar la seguridad del sistema.',
        'Cargar bases de datos de personas que no autorizaron su uso.',
      ] },
      { titulo: '9. Disponibilidad, soporte y mantenimiento', parrafos: [
        `Espartanos mantiene la plataforma disponible y corrige las fallas atribuibles a ella con la diligencia de un proveedor profesional. Puede realizar mantenimientos, avisando con anticipación razonable cuando sean programados. El soporte se atiende en ${correo} y por los canales acordados comercialmente.`,
        'No son atribuibles a Espartanos las fallas de internet, de los dispositivos de la empresa, de proveedores externos como Meta o Google, ni las causadas por mal uso o configuración incorrecta.',
      ] },
      { titulo: '10. Precios y pagos', parrafos: ['Los precios, la forma de pago, la facturación y la renovación se rigen por la propuesta o contrato comercial vigente con la empresa. Espartanos comunicará cualquier cambio de precio con al menos 30 días de anticipación; si la empresa no lo acepta, puede terminar el servicio antes de que rija. La falta de pago permite suspender el servicio previo aviso.'] },
      { titulo: '11. Propiedad intelectual', parrafos: [`La plataforma, su software, diseño, marcas y documentación pertenecen a ${marca}. La empresa recibe un derecho de uso limitado, no exclusivo e intransferible mientras dure el servicio. Las marcas y contenidos de la empresa siguen siendo suyos; la empresa autoriza a Espartanos a usarlos para prestar el servicio.`] },
      { titulo: '11 bis. Referencia comercial y estadísticas', parrafos: [
        `La empresa autoriza a ${marca} a mencionar su nombre comercial y logo como cliente en su sitio, presentaciones y redes, sin revelar datos de su operación. Puede revocarlo en cualquier momento escribiendo a ${correo}.`,
        `${marca} puede usar estadísticas agregadas y anonimizadas del uso de la plataforma para mejorar el servicio y publicar comparativas del rubro, sin identificar a personas ni a la empresa.`,
      ] },
      { titulo: '12. Limitación de responsabilidad', parrafos: [
        'La responsabilidad de Espartanos frente a la empresa por daños relacionados con el servicio se limita al monto pagado por la empresa en los 6 meses anteriores al hecho que la origina, y no comprende lucro cesante ni daños indirectos.',
        'Esta limitación no se aplica al dolo o culpa grave, ni a infracciones de Espartanos a la ley de protección de datos personales o al contrato de encargo, ni limita los derechos de las personas titulares de datos o de los consumidores frente a quien corresponda.',
      ] },
      { titulo: '13. Suspensión y término', parrafos: [
        'La empresa puede terminar el servicio cuando quiera, según lo acordado comercialmente. Espartanos puede terminarlo con 30 días de aviso, o suspenderlo de inmediato ante un incumplimiento grave, un riesgo de seguridad o un uso ilícito, informando el motivo.',
        'Al terminar, la empresa tiene 30 días para exportar sus datos; luego se eliminan o anonimizan conforme al contrato de encargo.',
      ] },
      { titulo: '14. Confidencialidad', parrafos: ['Cada parte mantiene reservada la información no pública de la otra que conozca por el servicio, durante su vigencia y después de terminado.'] },
      { titulo: '15. Modificaciones', parrafos: ['Espartanos puede actualizar estas condiciones para reflejar cambios legales, de seguridad o del servicio. Los cambios sustanciales se avisan con al menos 15 días de anticipación por correo o en el panel; si la empresa no los acepta, puede terminar el servicio sin costo antes de que rijan.'] },
      { titulo: '16. Ley aplicable y tribunales', parrafos: ['Se rigen por las leyes de Chile. Las controversias se someten a los tribunales ordinarios de justicia competentes de Chile.'] },
    ],
  };
}

/** Política de medición publicitaria y cookies. */
export function politicaDeMedicion(): DocumentoLegal {
  return {
    id: 'medicion',
    titulo: 'Medición publicitaria y cookies',
    version: VERSION_DOCUMENTOS_LEGALES,
    vigenteDesde: VIGENCIA_DOCUMENTOS_LEGALES,
    resumen: 'Qué almacena la página en tu navegador, qué herramientas de Meta y Google se usan sólo si lo aceptas, qué datos se les envían y cómo retirar la autorización en cualquier momento.',
    secciones: [
      {
        titulo: '1. Almacenamiento necesario',
        parrafos: ['Sin él la página no funciona. No requiere autorización y no se usa para publicidad ni se comparte:'],
        tabla: {
          columnas: ['Qué guarda', 'Para qué', 'Duración'],
          filas: [
            ['Tu elección sobre la medición', 'No volver a preguntarte y respetar lo que decidiste', 'Hasta que la cambies o borres los datos del navegador'],
            ['Reserva o respuesta en curso', 'No perder lo escrito si recargas la página', 'Hasta terminar o cerrar la sesión del navegador'],
            ['Identificador de sesión del panel (sólo personal de los locales)', 'Mantener la sesión iniciada de forma segura', 'Hasta cerrar sesión o su vencimiento'],
          ],
        },
      },
      {
        titulo: '2. Medición publicitaria (sólo si la aceptas)',
        parrafos: [
          'Al entrar se te pregunta, con la opción de no aceptar igual de visible. Si no respondes o no aceptas, no se instala nada de lo que sigue y Google queda con el consentimiento denegado por defecto. Tu reserva funciona igual en ambos casos.',
          'Si la aceptas, se usan para medir qué anuncios traen reservas y para mostrarte anuncios relevantes del local en Meta (Facebook, Instagram) y Google, incluidas audiencias formadas con clientes y personas con intereses parecidos. Estas son las herramientas:',
        ],
        tabla: {
          columnas: ['Cookie o herramienta', 'Proveedor', 'Para qué', 'Duración'],
          filas: [
            ['_fbp', 'Meta Platforms', 'Reconocer el navegador para medir resultados de anuncios', '90 días'],
            ['_fbc', 'Meta Platforms', 'Guardar el clic desde un anuncio de Meta', '90 días'],
            ['Meta Conversions API', 'Meta Platforms', 'Enviar desde el servidor los eventos de reserva, sin depender del navegador', 'No usa cookies propias'],
            ['_ga y _ga_ seguido de un código', 'Google', 'Distinguir visitas en Google Analytics', 'Hasta 2 años'],
            ['_gid', 'Google', 'Distinguir visitas del día', '24 horas'],
            ['_gcl_ seguido de un sufijo', 'Google', 'Guardar el clic desde un anuncio de Google Ads', '90 días'],
          ],
        },
        cierre: ['Las duraciones las define cada proveedor y pueden cambiar; al retirar la autorización se borran todas.'],
      },
      {
        titulo: '3. Qué datos se envían a Meta y Google',
        parrafos: ['Sólo con tu autorización:'],
        lista: [
          'El evento: inicio de reserva, reserva creada, reserva asistida, solicitud de evento o respuesta de encuesta.',
          'Fecha y hora, cantidad de personas y el local.',
          'Cookies de medición e identificador de clic del anuncio, si existen.',
          'Dirección IP y navegador.',
          'Tu correo y teléfono transformados con un cifrado irreversible (hash SHA-256), que permite asociarlos a una cuenta de esas plataformas sin enviarlos en texto legible.',
        ],
        cierre: ['Nunca se envían datos sensibles, respuestas de formularios, comentarios ni datos de pago.'],
      },
      { titulo: '4. Transferencia fuera de Chile', parrafos: ['Meta Platforms y Google tratan estos datos en servidores ubicados principalmente en Estados Unidos y la Unión Europea, amparados en sus cláusulas contractuales tipo y garantías. Cada uno es responsable del uso que haga de los datos conforme a su propia política de privacidad.'] },
      {
        titulo: '5. Cómo retirar la autorización',
        parrafos: [
          'En cualquier momento, desde el enlace «Preferencias de medición» que está en toda página de reserva y encuesta. Retirarla es tan simple como darla: se dejan de enviar datos desde ese momento, se borran del navegador las cookies de la tabla y se informa a Google que el consentimiento quedó denegado.',
          `Los identificadores de medición guardados junto a una reserva se anonimizan a los ${PLAZOS_DE_CONSERVACION.medicionMeses} meses. Los datos que Meta o Google ya recibieron se rigen por sus políticas; puedes gestionarlos desde la configuración de privacidad de tu cuenta en esas plataformas.`,
          'También puedes bloquear o borrar cookies desde la configuración de tu navegador.',
        ],
      },
      { titulo: '6. Contacto', parrafos: [`Para consultas sobre la medición escribe a ${OPERADOR_ESPARTANOS.correo}.`, RECLAMO] },
    ],
  };
}

/** Contrato de encargo de tratamiento que acepta cada empresa al usar Reservas o Encuestas. */
export function contratoDeEncargo(): DocumentoLegal {
  const p = PLAZOS_DE_CONSERVACION;
  const { marca, correo, alojamiento } = OPERADOR_ESPARTANOS;
  return {
    id: 'encargo',
    titulo: 'Contrato de encargo de tratamiento de datos personales',
    version: VERSION_DOCUMENTOS_LEGALES,
    vigenteDesde: VIGENCIA_DOCUMENTOS_LEGALES,
    resumen: `Condiciones con las que ${marca} trata, por cuenta de cada empresa cliente, los datos personales de sus clientes en Reservas y Encuestas. Lo acepta la empresa desde su portal; queda registrada la versión, la fecha y la persona que aceptó.`,
    secciones: [
      { titulo: '1. Partes', parrafos: [
        'Responsable: la empresa cliente que usa Reservas o Encuestas, identificada con la razón social y el RUT registrados en sus datos legales en la plataforma.',
        `Encargado: ${nombreLegalDelOperador()}, correo ${correo}.`,
      ] },
      { titulo: '2. Objeto', parrafos: ['El encargado trata los datos personales de los clientes del responsable sólo para prestar los servicios de reservas, solicitudes de eventos, lista de espera, encuestas, notificaciones asociadas y, cuando el responsable lo active y el titular lo autorice, medición publicitaria y comunicación entre locales de una misma red.'] },
      {
        titulo: '3. Datos y titulares',
        parrafos: ['Titulares: personas que reservan, solicitan eventos, se anotan en lista de espera o responden encuestas del responsable. Datos: identificación y contacto, detalle de reservas y solicitudes, respuestas de formularios y encuestas, autorizaciones otorgadas, identificadores técnicos y, cuando el responsable los pregunte, datos sensibles de salud o alimentación con consentimiento expreso del titular.'],
      },
      {
        titulo: '4. Instrucciones',
        parrafos: ['El encargado trata los datos sólo según las instrucciones documentadas del responsable, que se expresan en este contrato y en la configuración que el responsable hace en la plataforma. Si el encargado estima que una instrucción infringe la ley, lo informará al responsable y podrá abstenerse de ejecutarla.'],
      },
      {
        titulo: '5. Obligaciones del encargado',
        parrafos: ['El encargado se obliga a:'],
        lista: [
          'No usar los datos personales para fines propios, no elaborar perfiles con ellos, no venderlos ni comunicarlos a terceros salvo a los subencargados autorizados o por obligación legal. Se exceptúa la elaboración de estadísticas agregadas y anonimizadas, que no son datos personales, para mejorar la plataforma y publicar comparativas del rubro.',
          'Exigir confidencialidad a todas las personas que accedan a los datos, también después de terminada su relación.',
          'Mantener medidas de seguridad adecuadas al riesgo: conexión cifrada, control de acceso por roles, contraseñas con cifrado irreversible, registro de auditoría, copias de seguridad y anonimización automática.',
          `Notificar al responsable toda vulneración de seguridad que afecte sus datos dentro de ${PLAZO_AVISO_VULNERACION_HORAS} horas desde que la detecte, con la información disponible sobre su naturaleza, datos y titulares afectados y medidas adoptadas, y apoyarlo en las comunicaciones a la autoridad y a los titulares.`,
          'Ofrecer herramientas para exportar, corregir, bloquear y anonimizar datos, y derivar al responsable, sin demora, toda solicitud de titulares que reciba.',
          'Apoyar al responsable, en la medida de lo razonable, en evaluaciones de impacto y en requerimientos de la autoridad.',
          'Mantener un registro de las acciones realizadas sobre los datos.',
        ],
      },
      {
        titulo: '6. Subencargados',
        parrafos: ['El responsable autoriza a los siguientes subencargados:'],
        tabla: {
          columnas: ['Subencargado', 'Servicio', 'Datos', 'País'],
          filas: [
            [alojamiento, 'Alojamiento de la plataforma y envío de correos', 'Todos los datos de la plataforma', 'Chile'],
            ['Cloudinary', 'Fotos y logos del local', 'No recibe datos de clientes', 'Estados Unidos'],
            ['Meta Platforms', 'Medición publicitaria, sólo si el responsable la activa y el titular la acepta', 'Eventos, cookies, IP, navegador, correo y teléfono cifrados', 'Estados Unidos'],
            ['Google', 'Medición publicitaria, sólo si el responsable la activa y el titular la acepta', 'Eventos, cookies, IP y navegador', 'Estados Unidos'],
          ],
        },
        cierre: ['El encargado informará con al menos 30 días de anticipación la incorporación o reemplazo de subencargados. El responsable podrá oponerse por motivos fundados y, si no hay acuerdo, terminar el servicio sin costo. El encargado exige a sus subencargados obligaciones equivalentes a las de este contrato.'],
      },
      {
        titulo: '7. Obligaciones del responsable',
        parrafos: ['El responsable declara y se obliga a:'],
        lista: [
          'Que sus datos legales registrados son verdaderos y a mantenerlos actualizados.',
          'Contar con fundamento legal para cada tratamiento que configure e informar a sus clientes, usando su propia política o la generada por la plataforma con sus datos.',
          'Activar la medición publicitaria, las novedades o la red de locales sólo si efectivamente las usará como se informa.',
          'Marcar como sensible toda pregunta que pida información de salud, alimentación u otro dato sensible, para que la plataforma exija el consentimiento expreso.',
          'No pedir en formularios más datos que los necesarios para su finalidad.',
          'Responder a los titulares dentro del plazo legal y designar un correo de privacidad atendido.',
          'Que los textos, condiciones y políticas propias que publique cumplen la ley.',
        ],
      },
      { titulo: '8. Auditoría', parrafos: ['El responsable puede solicitar, una vez al año o ante un incidente, información razonable que demuestre el cumplimiento de este contrato: descripción de medidas de seguridad, registro de acciones sobre sus datos y listado de subencargados. Las revisiones presenciales se coordinan con anticipación, a costo del responsable y sin afectar la seguridad de otros clientes.'] },
      { titulo: '9. Transferencias internacionales', parrafos: ['El encargado no transfiere datos fuera de Chile salvo a Meta Platforms y Google para la medición que el responsable active y el titular acepte, amparadas en las cláusulas contractuales tipo de esos proveedores.'] },
      { titulo: '10. Conservación, devolución y eliminación', parrafos: [
        `Los datos se anonimizan automáticamente en los plazos de la Política de privacidad de Espartanos: reservas ${p.reservasMeses} meses desde la visita, solicitudes de grupo ${p.solicitudesDeGrupoMeses} meses, encuestas ${p.encuestasMeses} meses y medición ${p.medicionMeses} meses.`,
        'Al terminar el servicio, el responsable puede exportar sus datos durante 30 días. Luego el encargado los elimina o anonimiza, incluidas las copias, salvo lo que la ley obligue a conservar, y entrega constancia escrita si el responsable la solicita.',
      ] },
      { titulo: '11. Responsabilidad', parrafos: ['Cada parte responde por sus propios incumplimientos de la ley y de este contrato. El encargado no responde por instrucciones ilícitas del responsable, por textos o políticas que el responsable redacte, ni por tratamientos que el responsable realice fuera de la plataforma con datos exportados. Si el encargado usa los datos para fines distintos a los instruidos, será considerado responsable de ese tratamiento.'] },
      { titulo: '12. Duración y modificaciones', parrafos: ['Rige mientras el responsable use Reservas o Encuestas y sobrevive en lo relativo a confidencialidad y eliminación. Si cambia, se publica una nueva versión y se pide al responsable aceptarla desde su portal.'] },
      { titulo: '13. Ley y tribunales', parrafos: ['Se rige por las leyes de Chile. Las controversias se someten a los tribunales ordinarios de justicia competentes.'] },
      { titulo: '14. Aceptación', parrafos: ['Se acepta electrónicamente desde el portal de la empresa, conforme a la Ley 19.799. La plataforma registra la versión, la fecha y hora y la persona que aceptó en nombre de la empresa, quien declara tener facultades para hacerlo.'] },
    ],
  };
}

/** Cómo ejercer derechos sobre datos personales. */
export function ejercicioDeDerechos(): DocumentoLegal {
  const { correo, contactoPrivacidad } = OPERADOR_ESPARTANOS;
  return {
    id: 'derechos',
    titulo: 'Cómo ejercer tus derechos sobre tus datos',
    version: VERSION_DOCUMENTOS_LEGALES,
    vigenteDesde: VIGENCIA_DOCUMENTOS_LEGALES,
    resumen: `Puedes pedir ${DERECHOS} de tus datos, oponerte a decisiones automatizadas y retirar autorizaciones, sin costo. Aquí está el paso a paso.`,
    secciones: [
      {
        titulo: '1. Qué puedes pedir',
        parrafos: [],
        tabla: {
          columnas: ['Derecho', 'Qué obtienes'],
          filas: [
            ['Acceso', 'Saber qué datos tuyos hay, de dónde vienen, para qué se usan, con quién se comparten y cuánto tiempo se guardan'],
            ['Rectificación', 'Corregir datos inexactos o incompletos'],
            ['Supresión', 'Eliminar tus datos cuando ya no son necesarios, retiras tu autorización o se trataron indebidamente'],
            ['Oposición', 'Que tus datos no se usen para un fin determinado, como promociones o medición'],
            ['Portabilidad', 'Recibir tus datos en un archivo CSV o JSON, o que se envíen a otro responsable'],
            ['Bloqueo', 'Suspender el uso de tus datos mientras se revisa otra solicitud'],
            ['Decisiones automatizadas', 'Pedir revisión humana de una decisión tomada sólo por el sistema'],
            ['Retirar autorizaciones', 'Dejar de recibir novedades, detener la medición o dejar de compartir con otros locales'],
          ],
        },
      },
      {
        titulo: '2. A quién escribir',
        parrafos: [
          'Sobre una reserva, solicitud o encuesta: al correo de privacidad del local, que aparece en el formulario y en tu confirmación. El local es el responsable de esos datos.',
          `También puedes escribir a ${correo}, dirigido al ${contactoPrivacidad}. Espartanos deriva la solicitud al local dentro de 2 días hábiles, te informa que lo hizo y le entrega las herramientas para responder dentro de plazo.`,
          'Para retirar autorizaciones no necesitas escribir: las novedades se dan de baja desde cada mensaje y la medición desde «Preferencias de medición» en la página.',
        ],
      },
      {
        titulo: '3. Qué incluir',
        parrafos: [],
        lista: [
          'Tu nombre.',
          'El correo o teléfono con que reservaste o respondiste.',
          'El local y, si lo tienes, el código de reserva o la fecha aproximada.',
          'Qué derecho quieres ejercer y, si es rectificación, el dato correcto.',
        ],
        cierre: ['Para proteger tus datos se verifica que la solicitud la haces tú, normalmente pidiéndote responder desde el mismo correo o confirmar un dato de la reserva. Nunca se te pedirá tu contraseña ni una copia completa de tu cédula de identidad. Si actúas en representación de otra persona, debes acreditar tu poder.'],
      },
      {
        titulo: '4. Plazos',
        parrafos: [],
        lista: [
          `Respuesta: dentro de ${PLAZO_RESPUESTA_DERECHOS_DIAS} días corridos desde que se recibe la solicitud.`,
          `Prórroga: una sola vez, por ${PLAZO_RESPUESTA_DERECHOS_DIAS} días corridos más, informándote antes del vencimiento y explicando el motivo.`,
          'Bloqueo: se aplica apenas se recibe una solicitud de rectificación, supresión u oposición, mientras se resuelve.',
          'Costo: gratuito.',
        ],
      },
      {
        titulo: '5. Si se rechaza tu solicitud',
        parrafos: ['El rechazo debe ser fundado e indicar la razón, por ejemplo una obligación legal de conservar el dato o la imposibilidad de verificar tu identidad.', RECLAMO],
      },
    ],
  };
}

/**
 * Política de privacidad de un local que no publicó la suya, generada con sus datos reales.
 *
 * @param identidad Debe estar completa (`faltantesDeIdentidadLegal` vacío); si no, el formulario no se publica.
 */
export function politicaDePrivacidadDelLocal(identidad: IdentidadLegal): DocumentoLegal {
  const p = PLAZOS_DE_CONSERVACION;
  const local = nombreLegalDelLocal(identidad);
  const correo = identidad.correo?.trim() || OPERADOR_ESPARTANOS.correo;
  const { marca, alojamiento } = OPERADOR_ESPARTANOS;
  return {
    id: 'privacidad-local',
    titulo: `Política de privacidad de ${identidad.razonSocial?.trim() || identidad.nombreComercial?.trim() || 'el local'}`,
    version: VERSION_DOCUMENTOS_LEGALES,
    vigenteDesde: VIGENCIA_DOCUMENTOS_LEGALES,
    resumen: `Cómo ${local} trata los datos de quienes reservan, solicitan eventos, se anotan en lista de espera o responden sus encuestas.`,
    secciones: [
      { titulo: '1. Responsable', parrafos: [`${local}. Correo de privacidad para consultas y ejercicio de derechos: ${correo}.`] },
      {
        titulo: '2. Datos, finalidades y fundamento',
        parrafos: [],
        tabla: {
          columnas: ['Datos', 'Finalidad', 'Fundamento', 'Plazo'],
          filas: [
            ['Nombre, teléfono, correo, fecha, hora, personas y respuestas del formulario', 'Gestionar, confirmar, recordar, modificar o cancelar tu reserva o solicitud y contactarte por ese motivo', 'Ejecución de lo que solicitas', `${p.reservasMeses} meses desde la visita; solicitudes de grupo ${p.solicitudesDeGrupoMeses} meses`],
            ['Alergias, restricciones alimentarias u otra información de salud que decidas indicar', 'Atenderte de forma segura', 'Tu consentimiento expreso y separado', 'Igual que la reserva o respuesta'],
            ['Respuestas de encuestas y datos de contacto que entregues en ellas', 'Conocer tu opinión, mejorar y responderte si lo pides', 'Tu consentimiento; interés legítimo si la encuesta es anónima', `${p.encuestasMeses} meses`],
            ['Correo y teléfono de quien asistió', 'Invitarte a una encuesta sobre tu visita', 'Interés legítimo en evaluar nuestro servicio; puedes pedir no recibirlas', 'Igual que la reserva'],
            ['Correo, teléfono, cumpleaños si lo entregas, historial de visitas y preferencias (nunca salud)', 'Beneficios y novedades: promociones, cumpleaños, eventos y encuestas por correo, WhatsApp o SMS, según tus visitas y preferencias', 'Tu consentimiento', `Mientras mantengas el permiso, hasta ${p.clientesConBeneficiosMeses} meses desde tu última visita`],
            ['Cookies, IP, navegador, correo y teléfono cifrados', 'Medir qué anuncios traen reservas y mostrarte anuncios relevantes, incluidas audiencias', 'Tu consentimiento', `${p.medicionMeses} meses`],
            ['Nombre, contacto y preferencias compartidos con otros locales de la red', 'No repetir tus datos en otros locales', 'Tu consentimiento', 'Hasta que lo retires'],
            ['IP, navegador y registros de acceso', 'Seguridad y prevención de reservas falsas', 'Interés legítimo', 'El necesario para la seguridad del servicio'],
          ],
        },
        cierre: ['Los datos de contacto de la reserva son necesarios para gestionarla; todo lo demás es voluntario y ninguna autorización opcional condiciona tu reserva.'],
      },
      { titulo: '3. Datos sensibles', parrafos: ['Si indicas información de salud o alimentación, sólo se usa para atenderte, con tu consentimiento expreso. No se usa para publicidad ni se comparte con otros locales, Meta o Google.'] },
      { titulo: '4. Encargado de tratamiento', parrafos: [`Usamos la plataforma ${marca}, que trata los datos por nuestro encargo, según nuestras instrucciones y bajo un contrato de encargo, sin usarlos para fines propios. Su alojamiento y el envío de correos los presta ${alojamiento}.`] },
      { titulo: '5. Comunicaciones y transferencias', parrafos: ['No vendemos tus datos. Sólo se comunican a otros locales de la red o a Meta y Google si lo autorizaste, y a autoridades cuando la ley lo exija. Meta y Google tratan datos fuera de Chile, principalmente en Estados Unidos y la Unión Europea, con sus cláusulas contractuales tipo.'] },
      { titulo: '6. Decisiones automatizadas', parrafos: ['No tomamos decisiones basadas únicamente en tratamiento automatizado que te afecten de forma significativa. Si una reserva fue bloqueada por los controles automáticos contra abusos, puedes pedir revisión humana.'] },
      { titulo: '7. Conservación', parrafos: ['Vencidos los plazos de la tabla, los datos se anonimizan automáticamente. Si pides la supresión antes, se atiende sin esperar el plazo, salvo obligación legal.'] },
      { titulo: '8. Tus derechos', parrafos: [
        `Puedes ejercer los derechos de ${DERECHOS}, pedir revisión humana de decisiones automatizadas y retirar autorizaciones, sin costo, escribiendo a ${correo}. Respondemos dentro de ${PLAZO_RESPUESTA_DERECHOS_DIAS} días corridos, prorrogables una vez por igual plazo con aviso fundado. El detalle está en «Tus derechos» de ${marca}.`,
        RECLAMO,
      ] },
      { titulo: '9. Seguridad', parrafos: [`Junto a ${marca} aplicamos conexión cifrada, acceso por roles, registro de auditoría y anonimización automática. Si ocurre una vulneración que afecte tus datos, la comunicaremos a la ${AGENCIA} y, cuando corresponda, a ti.`] },
      { titulo: '10. Menores de edad', parrafos: ['Nuestros formularios están dirigidos a mayores de 18 años. Si reservas para un grupo con menores, entrega sólo los datos de un adulto responsable.'] },
      { titulo: '11. Cambios', parrafos: ['Cada versión tiene fecha y número. Los cambios que amplíen el uso de tus datos no se aplican sin una nueva autorización.'] },
    ],
  };
}

/** Todos los documentos de Espartanos, por identificador. */
export function documentoDeEspartanos(id: IdDocumentoLegal): DocumentoLegal {
  switch (id) {
    case 'privacidad': return politicaDePrivacidadDeEspartanos();
    case 'terminos': return condicionesDeUso();
    case 'servicio': return condicionesDelServicio();
    case 'medicion': return politicaDeMedicion();
    case 'encargo': return contratoDeEncargo();
    case 'derechos': return ejercicioDeDerechos();
  }
}

export const DOCUMENTOS_DE_ESPARTANOS: Array<{ id: IdDocumentoLegal; titulo: string }> = [
  { id: 'privacidad', titulo: 'Privacidad' },
  { id: 'terminos', titulo: 'Condiciones de uso' },
  { id: 'servicio', titulo: 'Condiciones para empresas' },
  { id: 'medicion', titulo: 'Medición y cookies' },
  { id: 'derechos', titulo: 'Tus derechos' },
  { id: 'encargo', titulo: 'Contrato de encargo' },
];

/** Ruta pública de un documento de Espartanos. */
export function rutaDocumentoLegal(id: IdDocumentoLegal): string {
  return `/legal/${id}`;
}

/** El documento en texto plano, para mostrarlo en una ventana o guardarlo como evidencia. */
export function documentoATexto(documento: DocumentoLegal): string {
  const seccion = (s: SeccionLegal): string[] => [
    '',
    s.titulo,
    ...s.parrafos,
    ...(s.lista ?? []).map((item) => `• ${item}`),
    ...(s.tabla ? s.tabla.filas.map((fila) => fila.map((celda, i) => `${s.tabla!.columnas[i]}: ${celda}`).join(' · ')) : []),
    ...(s.cierre ?? []),
  ];
  return [
    documento.titulo,
    `Versión ${documento.version} · vigente desde ${documento.vigenteDesde}`,
    '',
    documento.resumen,
    ...documento.secciones.flatMap(seccion),
  ].join('\n');
}

/** Textos de las casillas de una reserva o solicitud, iguales en la página y en la evidencia que guarda el servidor. */
export function textosDeAceptacionDeReserva(identidad: IdentidadLegal, opciones: { red?: string; grupo?: boolean } = {}) {
  const local = nombreLegalDelLocal(identidad);
  const correo = identidad.correo?.trim() || OPERADOR_ESPARTANOS.correo;
  const red = opciones.red?.trim() || OPERADOR_ESPARTANOS.marca;
  return {
    /** Casilla obligatoria: aceptación de condiciones e información, no un consentimiento. */
    reserva: `Acepto las condiciones de la reserva y declaro haber leído la política de privacidad. ${local} usará mi nombre, teléfono, correo y los datos de esta reserva para gestionarla, confirmarla, modificarla o cancelarla y contactarme por ese motivo, porque son necesarios para el servicio que pido. Se conservan hasta ${PLAZOS_DE_CONSERVACION.reservasMeses} meses después de la visita y luego se anonimizan. La plataforma ${OPERADOR_ESPARTANOS.marca} los trata por encargo de ${local}. Puedo ejercer mis derechos de ${DERECHOS} escribiendo a ${correo}, y reclamar ante la ${AGENCIA}.`,
    novedades: textoDeBeneficios(identidad, opciones),
    red: `Autorizo a ${local} a compartir mi nombre, datos de contacto y preferencias de visita con los demás locales de ${red}, para no repetirlos al reservar en ellos. Es opcional, no condiciona esta reserva, cada local responde por el uso que haga de esos datos y puedo retirarla cuando quiera escribiendo a ${correo}.`,
    sensibles: textoDeDatosSensibles(identidad),
  };
}

/**
 * Permiso de beneficios y novedades: un solo permiso, específico en canales, contenidos y uso de
 * historial, para no multiplicar casillas sin perder validez.
 *
 * @param opciones.grupo Si el local lo ofrece, incluye beneficios de los demás locales de su red.
 */
export function textoDeBeneficios(identidad: IdentidadLegal, opciones: { red?: string; grupo?: boolean } = {}): string {
  const local = nombreLegalDelLocal(identidad);
  const correo = identidad.correo?.trim() || OPERADOR_ESPARTANOS.correo;
  const grupo = opciones.grupo ? ` y de los locales de ${opciones.red?.trim() || OPERADOR_ESPARTANOS.marca}` : '';
  return `Quiero recibir beneficios y novedades de ${local}${grupo}: promociones, beneficio de cumpleaños, invitaciones a eventos y encuestas, por correo, WhatsApp o SMS. Autorizo usar mis visitas y preferencias, nunca datos de salud, para ofrecerme lo que me interese, y conservarlas mientras mantenga este permiso, hasta ${PLAZOS_DE_CONSERVACION.clientesConBeneficiosMeses} meses desde mi última visita. Es opcional, no condiciona mi reserva y puedo retirarlo cuando quiera, sin costo, desde cada mensaje o escribiendo a ${correo}.`;
}

/** Versión del texto de consentimiento para datos sensibles. */
export const VERSION_DATOS_SENSIBLES = 'sensibles-v1';

/**
 * Consentimiento expreso para información de salud o alimentación, separado de las demás casillas.
 * Se exige sólo cuando la persona completa un campo marcado como sensible.
 */
export function textoDeDatosSensibles(identidad: IdentidadLegal): string {
  const local = nombreLegalDelLocal(identidad);
  const correo = identidad.correo?.trim() || OPERADOR_ESPARTANOS.correo;
  return `Autorizo expresamente a ${local} a usar la información de salud o alimentación que indiqué (por ejemplo, alergias o movilidad) sólo para atenderme de forma segura. No se usa para publicidad ni se comparte con otros locales, Meta o Google, se anonimiza en el mismo plazo que mi registro y puedo pedir su supresión cuando quiera escribiendo a ${correo}.`;
}

/** Campos de visita que siempre son datos de salud: accesibilidad y restricciones alimentarias. */
export const CAMPOS_DE_VISITA_SENSIBLES = ['accessibilityNeed', 'dietaryNotes'] as const;

const tieneValor = (valor: unknown) => (Array.isArray(valor) ? valor.length > 0 : typeof valor === 'string' ? valor.trim() !== '' : valor !== undefined && valor !== null && valor !== false);

/**
 * Si lo enviado trae información sensible: un campo de visita de salud con texto o un campo del
 * formulario marcado como sensible con respuesta. Sólo entonces se exige el consentimiento expreso.
 */
export function traeDatosSensibles(campos: Array<{ id: string; sensible?: boolean }>, respuestas: Record<string, unknown> | null | undefined, visita: Record<string, unknown> = {}): boolean {
  if (CAMPOS_DE_VISITA_SENSIBLES.some((clave) => tieneValor(visita[clave]))) return true;
  return campos.some((campo) => campo.sensible && tieneValor(respuestas?.[campo.id]));
}

export const MENSAJE_FALTA_CONSENTIMIENTO_SENSIBLE = 'Para guardar la información de salud o alimentación que indicaste, marca la casilla que la autoriza. Si prefieres, bórrala y envía sin ella.';
