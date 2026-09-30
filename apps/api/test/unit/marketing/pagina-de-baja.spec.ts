import { describe, expect, it } from 'vitest';
import { paginaDeBaja, paginaDeConfirmarBaja } from '../../../src/modules/marketing/pagina-de-baja';

/*
 * El camino de salida.
 *
 * Es el único derecho que se ejerce desde fuera del sistema, sin sesión y con un solo clic, y el
 * único error que no se puede deshacer: una baja no se revierte sola —el artículo 28 B lo prohíbe—
 * así que darla por equivocación es definitivo. Lo que se comprueba es que nadie salga de la lista
 * sin haberlo pedido, y que quien lo pida no se encuentre un obstáculo.
 */
const TOKEN = 'tok-123';

describe('la página de la baja', () => {
  /*
   * El enlace ya no da de baja al abrirlo.
   *
   * Los antivirus de correo y la previsualización de Outlook visitan los enlaces de un mensaje para
   * revisarlos. Con la baja colgada del GET, eso daba de baja a personas que nunca hicieron clic.
   */
  it('pregunta antes, con un botón que manda un POST', () => {
    const html = paginaDeConfirmarBaja({ email: 'ana@correo.cl', empresa: 'c-casa', yaDeBaja: false }, TOKEN);

    expect(html).toContain('¿Dejamos de escribirte?');
    expect(html).toContain('method="post"');
    expect(html).toContain(`/api/marketing/suscriptores/baja/${TOKEN}`);
  });

  /* El correo entero a la vista delata a quien deja la pantalla abierta en el mesón. */
  it('no enseña el correo entero', () => {
    const html = paginaDeConfirmarBaja({ email: 'anamaria@correo.cl', empresa: null, yaDeBaja: false }, TOKEN);

    expect(html).not.toContain('anamaria@correo.cl');
    expect(html).toContain('@correo.cl');
  });

  /*
   * Los dos caminos a la vista desde el principio.
   *
   * Quien está molesto y no encuentra cómo salirse del todo usa «marcar como spam», que hunde la
   * reputación del servidor y arrastra a los demás locales.
   */
  it('ofrece la baja de todos los locales sin pasar antes por la de uno', () => {
    const html = paginaDeConfirmarBaja({ email: 'ana@correo.cl', empresa: 'c-casa', yaDeBaja: false }, TOKEN);

    expect(html).toContain('value="local"');
    expect(html).toContain('value="todas"');
  });

  it('a quien ya está de baja no le vuelve a preguntar lo mismo', () => {
    const html = paginaDeConfirmarBaja({ email: 'ana@correo.cl', empresa: 'c-casa', yaDeBaja: true }, TOKEN);

    expect(html).toContain('Ya no recibes estos correos');
    expect(html).toContain('Darme de baja de todos');
  });

  it('un enlace que no existe no insinúa que la dirección esté en el sistema', () => {
    const html = paginaDeConfirmarBaja(null, TOKEN);

    expect(html).toContain('Este enlace ya no sirve');
    expect(html).not.toContain('method="post"');
  });

  /* El origen viene de la dirección y llega tal cual a la página. */
  it('escapa el origen que viene en la consulta', () => {
    const html = paginaDeConfirmarBaja(
      { email: 'ana@correo.cl', empresa: null, yaDeBaja: false },
      TOKEN,
      '"><script>alert(1)</script>',
    );

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  describe('ya dada de baja', () => {
    it('de una empresa, explica que las otras van por separado y ofrece salir de todas', () => {
      const html = paginaDeBaja({ email: 'ana@correo.cl', alcance: 'local', empresa: 'c-casa' }, TOKEN);

      expect(html).toContain('de este local');
      expect(html).toContain('siguen llegando por');
      expect(html).toContain('Darme de baja de todos');
    });

    it('de todas, no vuelve a ofrecer lo mismo', () => {
      const html = paginaDeBaja({ email: 'ana@correo.cl', alcance: 'todas', empresa: null }, TOKEN);

      expect(html).toContain('de ninguno de los locales');
      expect(html).not.toContain('Darme de baja de todos');
    });

    /*
     * Darse de baja detiene la publicidad pero no borra nada: hace falta conservar la constancia
     * para poder cumplir la prohibición. Son dos puertas y conviene que se vean distintas.
     */
    it('siempre deja a mano el canal de derechos', () => {
      for (const html of [
        paginaDeConfirmarBaja({ email: 'a@b.cl', empresa: null, yaDeBaja: false }, TOKEN),
        paginaDeBaja({ email: 'a@b.cl', alcance: 'todas', empresa: null }, TOKEN),
        paginaDeBaja(null, TOKEN),
      ]) {
        expect(html).toContain('/solicitudes');
        expect(html).toContain('no borra tus datos');
      }
    });
  });
});
