import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { APP_PIPE } from '@nestjs/core';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { SuscriptoresController } from '../../../src/modules/marketing/suscriptores.controller';
import { SuscriptoresService } from '../../../src/modules/marketing/suscriptores.service';
import { ClientCapabilityService } from '../../../src/core/client-scope/client-capability.service';
import { ValidationPipe } from '../../../src/core/errors/validation.pipe';

/*
 * La baja, por HTTP de verdad.
 *
 * Las demás pruebas llaman al método del controlador directamente, y eso deja fuera justo lo que
 * aquí puede fallar: el encaminamiento, el `ValidationPipe` global y, sobre todo, el parseo del
 * cuerpo. El botón de la página manda un formulario (`application/x-www-form-urlencoded`) y el
 * clic de Gmail manda el suyo; si cualquiera de los dos no llegara al controlador, la persona
 * vería una página de éxito y seguiría suscrita, que es la peor forma de fallar que tiene esto.
 *
 * Se levanta un servidor HTTP con el controlador real y el servicio sustituido: lo que se
 * comprueba es la carretera, no la lógica de la baja, que ya tiene sus pruebas.
 */
describe('la baja a través de HTTP', () => {
  let app: INestApplication;
  const suscriptores = {
    aQuienPertenece: vi.fn(async () => ({ email: 'ana@correo.cl', empresa: 'c-casa', yaDeBaja: false })),
    darDeBaja: vi.fn(async (_token: string, alcance: 'local' | 'todas') => ({
      email: 'ana@correo.cl', alcance, empresa: alcance === 'todas' ? null : 'c-casa',
    })),
  };

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      controllers: [SuscriptoresController],
      providers: [
        { provide: SuscriptoresService, useValue: suscriptores },
        { provide: ClientCapabilityService, useValue: { assert: vi.fn() } },
        // El mismo pipe global que corre en producción: es parte de lo que se quiere comprobar.
        { provide: APP_PIPE, useClass: ValidationPipe },
      ],
    }).compile();

    app = modulo.createNestApplication();
    await app.init();
    /*
     * Con margen: armar el módulo de Nest y levantar el servidor tarda más que el límite de cinco
     * segundos cuando la suite entera corre en paralelo, y la prueba fallaba sola una de cada
     * varias ejecuciones. Un fallo intermitente enseña a desconfiar de la suite, que es peor que
     * no tener la prueba.
     */
  }, 30_000);

  afterAll(async () => { await app?.close(); });

  /*
   * Abrir el enlace no da de baja a nadie.
   *
   * Es el cambio que más importa de todo esto: los antivirus de correo y la previsualización de
   * Outlook abren los enlaces de un mensaje para revisarlos, y la baja es definitiva.
   */
  it('el GET muestra la confirmación y no da de baja a nadie', async () => {
    suscriptores.darDeBaja.mockClear();

    const respuesta = await request(app.getHttpServer())
      .get('/marketing/suscriptores/baja/tok-123')
      .expect(200);

    expect(respuesta.headers['content-type']).toContain('text/html');
    expect(respuesta.text).toContain('¿Dejamos de escribirte?');
    expect(respuesta.text).toContain('method="post"');
    expect(suscriptores.darDeBaja).not.toHaveBeenCalled();
  });

  /** El botón de la página: un formulario corriente. */
  it('el POST del formulario da de baja de ese local', async () => {
    suscriptores.darDeBaja.mockClear();

    const respuesta = await request(app.getHttpServer())
      .post('/marketing/suscriptores/baja/tok-123')
      .type('form')
      .send({ alcance: 'local', origen: 'email.campaign' })
      .expect(201);

    expect(suscriptores.darDeBaja).toHaveBeenCalledWith('tok-123', 'local', 'email.campaign');
    expect(respuesta.text).toContain('Listo');
  });

  it('el POST con alcance «todas» saca de todos los locales', async () => {
    suscriptores.darDeBaja.mockClear();

    const respuesta = await request(app.getHttpServer())
      .post('/marketing/suscriptores/baja/tok-123')
      .type('form')
      .send({ alcance: 'todas' })
      .expect(201);

    expect(suscriptores.darDeBaja).toHaveBeenCalledWith('tok-123', 'todas', undefined);
    expect(respuesta.text).toContain('de ninguno de los locales');
  });

  /*
   * El clic de Gmail (RFC 8058).
   *
   * Manda `List-Unsubscribe=One-Click` y nada más. El `ValidationPipe` global rechaza lo que no
   * declara, así que un cuerpo tipado aquí devolvería 400 y la persona seguiría suscrita creyendo
   * que se dio de baja. Por eso el cuerpo no se declara, y esto es lo que lo sostiene.
   */
  it('el clic de un solo paso de Gmail da de baja, con su propio campo', async () => {
    suscriptores.darDeBaja.mockClear();

    await request(app.getHttpServer())
      .post('/marketing/suscriptores/baja/tok-123')
      .type('form')
      .send('List-Unsubscribe=One-Click')
      .expect(201);

    expect(suscriptores.darDeBaja).toHaveBeenCalledWith('tok-123', 'local', undefined);
  });

  /** Los enlaces de los correos ya enviados traen el alcance en la dirección. */
  it('un enlace antiguo con el alcance en la consulta sigue funcionando', async () => {
    suscriptores.darDeBaja.mockClear();

    await request(app.getHttpServer())
      .post('/marketing/suscriptores/baja/tok-123?alcance=todas&origen=email.birthday')
      .expect(201);

    expect(suscriptores.darDeBaja).toHaveBeenCalledWith('tok-123', 'todas', 'email.birthday');
  });

  /** Sin cuerpo tampoco se cae: un POST vacío es el caso más probable de un cliente de correo. */
  it('un POST sin cuerpo da de baja de ese local y responde una página', async () => {
    suscriptores.darDeBaja.mockClear();

    const respuesta = await request(app.getHttpServer())
      .post('/marketing/suscriptores/baja/tok-123')
      .expect(201);

    expect(suscriptores.darDeBaja).toHaveBeenCalledWith('tok-123', 'local', undefined);
    expect(respuesta.headers['content-type']).toContain('text/html');
  });

  /* Un token que ya no existe no puede delatar si esa dirección está en el sistema. */
  it('un token inservible responde una página y no un error técnico', async () => {
    suscriptores.aQuienPertenece.mockResolvedValueOnce(null as never);

    const respuesta = await request(app.getHttpServer())
      .get('/marketing/suscriptores/baja/no-existe')
      .expect(200);

    expect(respuesta.text).toContain('Este enlace ya no sirve');
  });
});
