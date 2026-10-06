import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * La revisión de SPF, DKIM y DMARC del dominio que envía.
 *
 * Es la única parte del envío que no vive en el repositorio: son registros DNS que se editan en el
 * panel del hosting, no se despliegan y nadie se entera cuando se caen. Desde febrero de 2024
 * Gmail y Yahoo mandan a spam los envíos en volumen de un dominio sin los tres.
 *
 * Lo que de verdad se prueba acá es la diferencia entre «no está publicado» y «no se pudo
 * consultar». Tratar un timeout como una falta llevaría a reemplazar un SPF correcto.
 */
const resolveTxt = vi.fn();
vi.mock('node:dns/promises', () => ({
  Resolver: class { resolveTxt = (nombre: string) => resolveTxt(nombre); },
}));

const { dominioDelRemitente, revisarFirmaDelDominio } = await import('../../../src/core/notifications/firma-del-dominio');

/** Un DNS que responde lo que se le diga por nombre, y NODATA para lo que no esté. */
function dns(registros: Record<string, string[]>) {
  resolveTxt.mockImplementation(async (nombre: string) => {
    if (!(nombre in registros)) {
      const error = Object.assign(new Error('NODATA'), { code: 'ENODATA' });
      throw error;
    }
    return registros[nombre].map((fila) => [fila]);
  });
}

const BIEN = {
  'espartanos.cl': ['v=spf1 include:_spf.ihosting.cl mx -all'],
  'default._domainkey.espartanos.cl': ['v=DKIM1; k=rsa; p=MIIBIjAN'],
  '_dmarc.espartanos.cl': ['v=DMARC1; p=quarantine; rua=mailto:dmarc@espartanos.cl'],
};

describe('dominio del remitente', () => {
  it('lo saca de una dirección suelta y de un remitente con nombre', () => {
    expect(dominioDelRemitente('reservas@espartanos.cl')).toBe('espartanos.cl');
    expect(dominioDelRemitente('Espartanos <Reservas@Espartanos.CL>')).toBe('espartanos.cl');
  });

  it('devuelve nulo cuando no hay dominio que revisar', () => {
    for (const malo of [undefined, null, '', 'sin-arroba', 'a@', '@b.cl', 'a@localhost']) {
      expect(dominioDelRemitente(malo)).toBeNull();
    }
  });
});

describe('revisión de la firma del dominio', () => {
  beforeEach(() => vi.clearAllMocks());

  it('con los tres registros bien puestos no reporta nada', async () => {
    dns(BIEN);

    const revision = await revisarFirmaDelDominio('reservas@espartanos.cl');

    expect(revision?.consultado).toBe(true);
    expect(revision?.spf.publicado).toBe(true);
    expect(revision?.dkim.publicado).toBe(true);
    expect(revision?.dmarc.politica).toBe('quarantine');
    expect(revision?.dmarc.informes).toBe(true);
    expect(revision?.problemas).toEqual([]);
  });

  /* Lo que impide la entrega se reporta como error: sin SPF o sin DKIM el correo no llega. */
  it('reporta como error la falta de SPF y de DKIM', async () => {
    dns({ '_dmarc.espartanos.cl': BIEN['_dmarc.espartanos.cl'] });

    const revision = await revisarFirmaDelDominio('reservas@espartanos.cl');

    const errores = revision?.problemas.filter((problema) => problema.nivel === 'error') ?? [];
    expect(errores).toHaveLength(2);
    expect(errores.map((e) => e.texto).join(' ')).toContain('SPF');
    expect(errores.map((e) => e.texto).join(' ')).toContain('DKIM');
  });

  /*
   * El caso real de espartanos.cl: los tres publicados, pero el DMARC en `p=none` y sin `rua=`.
   * Cumple el requisito de Gmail y no rechaza nada, así que es un aviso y no un error: tratarlo
   * como una falta diría que el correo no llega, y llega.
   */
  it('avisa sin alarmar cuando el DMARC está en p=none y sin informes', async () => {
    dns({ ...BIEN, '_dmarc.espartanos.cl': ['v=DMARC1; p=none;'] });

    const revision = await revisarFirmaDelDominio('reservas@espartanos.cl');

    expect(revision?.problemas.every((problema) => problema.nivel === 'aviso')).toBe(true);
    expect(revision?.problemas).toHaveLength(2);
    expect(revision?.dmarc.informes).toBe(false);
  });

  /* `+all` autoriza a cualquiera a enviar en nombre del dominio: peor que no tener SPF. */
  it('trata «+all» como error y «?all» como aviso', async () => {
    dns({ ...BIEN, 'espartanos.cl': ['v=spf1 +all'] });
    const abierto = await revisarFirmaDelDominio('reservas@espartanos.cl');
    expect(abierto?.problemas.some((p) => p.nivel === 'error' && p.texto.includes('+all'))).toBe(true);

    dns({ ...BIEN, 'espartanos.cl': ['v=spf1 mx ?all'] });
    const tibio = await revisarFirmaDelDominio('reservas@espartanos.cl');
    expect(tibio?.problemas.some((p) => p.nivel === 'aviso' && p.texto.includes('?all'))).toBe(true);
  });

  /*
   * La distinción que justifica todo el módulo: un DNS caído no es un dominio sin firmar.
   * Con `consultado: false` la pantalla dice que no se pudo comprobar, y no manda a nadie a
   * reemplazar registros que están correctos.
   */
  it('un DNS que no responde deja consultado en falso y sin problemas', async () => {
    resolveTxt.mockRejectedValue(Object.assign(new Error('timeout'), { code: 'ETIMEOUT' }));

    const revision = await revisarFirmaDelDominio('reservas@espartanos.cl');

    expect(revision?.consultado).toBe(false);
    expect(revision?.problemas).toEqual([]);
  });

  it('une los trozos de un TXT partido por el DNS', async () => {
    resolveTxt.mockImplementation(async (nombre: string) => (
      nombre === 'default._domainkey.espartanos.cl' ? [['v=DKIM1; k=rsa; ', 'p=MIIBIjAN']] : []
    ));

    const revision = await revisarFirmaDelDominio('reservas@espartanos.cl');

    expect(revision?.dkim.publicado).toBe(true);
  });

  it('sin casilla configurada no hay nada que revisar', async () => {
    expect(await revisarFirmaDelDominio(null)).toBeNull();
    expect(resolveTxt).not.toHaveBeenCalled();
  });
});
