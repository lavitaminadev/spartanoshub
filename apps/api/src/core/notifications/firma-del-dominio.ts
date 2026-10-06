import { Resolver } from 'node:dns/promises';

/**
 * Si el dominio que envía está firmado, y qué le falta.
 *
 * Es la única parte del envío que no vive en el repositorio: SPF, DKIM y DMARC son registros DNS,
 * se editan en el panel del hosting y nadie se entera cuando se caen. Pero deciden si el correo
 * llega: desde febrero de 2024 Gmail y Yahoo rechazan o mandan a spam a quien envía en volumen sin
 * los tres. Un envío que «salió» según el servidor y no llegó a nadie se veía exactamente igual
 * que uno bien entregado.
 *
 * Lo que esto comprueba y lo que no:
 *
 * - **Comprueba que los registros existan y qué dicen.** Es una consulta DNS, no un envío de
 *   prueba: no verifica que la firma DKIM del mensaje valide, sólo que la clave esté publicada.
 * - **No consulta la reputación.** Un dominio con los tres registros perfectos igual puede estar
 *   en spam por quejas de los destinatarios; eso se mira en Google Postmaster Tools.
 *
 * `p=none` se informa como advertencia y no como error, y la diferencia importa: con `p=none` el
 * DMARC existe, se cumple el requisito de Gmail y no se rechaza nada, pero tampoco se protege el
 * dominio de quien lo suplante. Es un paso intermedio legítimo —se usa para mirar los informes
 * antes de endurecer— y por eso se nombra sin alarma, diciendo qué sigue.
 */

/** Selector DKIM que usa cPanel por omisión. Es el que hay que mirar primero. */
const SELECTOR_POR_OMISION = 'default';

export interface RevisionDeFirma {
  /** El dominio que se consultó, deducido del remitente. */
  dominio: string;
  spf: { publicado: boolean; registro: string | null; politica: string | null };
  dkim: { publicado: boolean; selector: string };
  dmarc: { publicado: boolean; registro: string | null; politica: string | null; informes: boolean };
  /** Lo que impide o degrada la entrega, de lo más grave a lo menos. */
  problemas: Array<{ nivel: 'error' | 'aviso'; texto: string }>;
  /** Nulo si la consulta DNS no se pudo hacer: no es lo mismo que «no está publicado». */
  consultado: boolean;
}

/** El dominio de un remitente, admitiendo tanto `a@b.cl` como `Nombre <a@b.cl>`. */
export function dominioDelRemitente(remitente: string | null | undefined): string | null {
  const texto = (remitente ?? '').trim();
  const dentro = texto.match(/<([^>]+)>/);
  const direccion = (dentro ? dentro[1] : texto).trim();
  const arroba = direccion.lastIndexOf('@');
  if (arroba < 1 || arroba === direccion.length - 1) return null;
  const dominio = direccion.slice(arroba + 1).toLowerCase();
  return dominio.includes('.') ? dominio : null;
}

/** El valor de una etiqueta `clave=valor` dentro de un registro SPF o DMARC. */
function etiqueta(registro: string, clave: string): string | null {
  for (const parte of registro.split(';')) {
    const [nombre, ...resto] = parte.trim().split('=');
    if (nombre.trim().toLowerCase() === clave) return resto.join('=').trim();
  }
  return null;
}

/** Une los trozos de un registro TXT: el DNS lo parte en cadenas de 255 caracteres. */
function unir(registros: string[][]): string[] {
  return registros.map((trozos) => trozos.join(''));
}

/**
 * Consulta los tres registros del dominio que envía.
 *
 * Nunca lanza. Un DNS que no responde deja `consultado: false` y la pantalla dice que no se pudo
 * comprobar, que es distinto de decir que los registros faltan: tratar un timeout como «no está
 * publicado» haría que alguien reemplazara un SPF correcto creyendo que no existía.
 */
export async function revisarFirmaDelDominio(remitente: string | null | undefined, selector = SELECTOR_POR_OMISION): Promise<RevisionDeFirma | null> {
  const dominio = dominioDelRemitente(remitente);
  if (!dominio) return null;

  const resolver = new Resolver({ timeout: 3_000, tries: 2 });
  const txt = async (nombre: string): Promise<string[] | null> => {
    try {
      return unir(await resolver.resolveTxt(nombre));
    } catch (error) {
      // Un dominio sin ese registro responde NXDOMAIN o vacío, que sí es información. Lo demás
      // —timeout, servidor caído— no lo es, y hay que poder distinguirlo.
      const codigo = (error as { code?: string }).code;
      return codigo === 'ENOTFOUND' || codigo === 'ENODATA' ? [] : null;
    }
  };

  const [spfTxt, dkimTxt, dmarcTxt] = await Promise.all([
    txt(dominio),
    txt(`${selector}._domainkey.${dominio}`),
    txt(`_dmarc.${dominio}`),
  ]);

  if (spfTxt === null && dkimTxt === null && dmarcTxt === null) {
    return {
      dominio,
      spf: { publicado: false, registro: null, politica: null },
      dkim: { publicado: false, selector },
      dmarc: { publicado: false, registro: null, politica: null, informes: false },
      problemas: [],
      consultado: false,
    };
  }

  const spf = (spfTxt ?? []).find((fila) => fila.toLowerCase().startsWith('v=spf1')) ?? null;
  const dkim = (dkimTxt ?? []).some((fila) => fila.toLowerCase().includes('p='));
  const dmarc = (dmarcTxt ?? []).find((fila) => fila.toLowerCase().startsWith('v=dmarc1')) ?? null;

  const problemas: RevisionDeFirma['problemas'] = [];
  // El orden es el de la gravedad, porque es el orden en que conviene arreglarlos.
  if (!spf) problemas.push({ nivel: 'error', texto: `Falta el SPF en ${dominio}. Sin él Gmail y Yahoo mandan a spam los envíos en volumen.` });
  if (!dkim) problemas.push({ nivel: 'error', texto: `Falta la clave DKIM en ${selector}._domainkey.${dominio}. Es la firma que prueba que el correo salió de este dominio.` });

  const politicaSpf = spf ? (spf.match(/[~\-+?]all\b/)?.[0] ?? null) : null;
  // `+all` autoriza a cualquiera a enviar en nombre del dominio: es peor que no tener SPF, porque
  // parece configurado. `?all` no afirma nada y deja la decisión al receptor.
  if (politicaSpf === '+all') problemas.push({ nivel: 'error', texto: `El SPF de ${dominio} termina en «+all», que autoriza a cualquier servidor a enviar en su nombre. Debe ser «-all» o «~all».` });
  else if (politicaSpf === '?all') problemas.push({ nivel: 'aviso', texto: `El SPF de ${dominio} termina en «?all», que no afirma nada. «-all» es lo que protege el dominio.` });

  const politicaDmarc = dmarc ? (etiqueta(dmarc, 'p')?.toLowerCase() ?? null) : null;
  const informes = Boolean(dmarc && etiqueta(dmarc, 'rua'));
  if (!dmarc) {
    problemas.push({ nivel: 'error', texto: `Falta el DMARC en _dmarc.${dominio}. Empieza por «v=DMARC1; p=none; rua=mailto:dmarc@${dominio}», que no rechaza nada y deja ver quién envía.` });
  } else {
    if (politicaDmarc === 'none') {
      problemas.push({
        nivel: 'aviso',
        texto: `El DMARC de ${dominio} está en «p=none»: cumple el requisito de Gmail y no rechaza nada, pero tampoco impide que alguien suplante el dominio. El paso siguiente es «p=quarantine» después de mirar unas semanas de informes.`,
      });
    }
    if (!informes) {
      problemas.push({
        nivel: 'aviso',
        texto: `El DMARC de ${dominio} no tiene «rua=», así que nadie recibe los informes y no hay cómo saber si algo se está rechazando. Agrega «rua=mailto:dmarc@${dominio}».`,
      });
    }
  }

  return {
    dominio,
    spf: { publicado: Boolean(spf), registro: spf, politica: politicaSpf },
    dkim: { publicado: dkim, selector },
    dmarc: { publicado: Boolean(dmarc), registro: dmarc, politica: politicaDmarc, informes },
    problemas,
    consultado: true,
  };
}
