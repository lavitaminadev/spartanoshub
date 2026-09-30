import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createTransport: vi.fn(),
  sendMail: vi.fn(),
}));

vi.mock('nodemailer', () => ({
  default: { createTransport: mocks.createTransport },
}));

import { EmailService } from '../../../src/core/notifications/email.service';

const SMTP_KEYS = [
  'SMTP_ENABLED', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE',
  'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM', 'SMTP_REPLY_TO',
];

describe('EmailService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendMail.mockResolvedValue({ accepted: ['recipient@example.com'], messageId: 'message-1' });
    mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail });
  });

  afterEach(() => {
    for (const key of SMTP_KEYS) delete process.env[key];
  });

  it('does not report success when SMTP is disabled', async () => {
    process.env.SMTP_ENABLED = 'false';
    const service = new EmailService();

    await expect(service.send('recipient@example.com', 'Alert', '<p>Body</p>')).resolves.toBe(false);
    expect(mocks.createTransport).not.toHaveBeenCalled();
  });

  it('uses the configured secure transport and escapes dynamic HTML', async () => {
    Object.assign(process.env, {
      SMTP_ENABLED: 'true',
      SMTP_HOST: 'mail.example.com',
      SMTP_PORT: '465',
      SMTP_SECURE: 'true',
      SMTP_USER: 'notifications@example.com',
      SMTP_PASSWORD: 'secret',
      SMTP_FROM: 'notifications@example.com',
    });
    const service = new EmailService();

    await expect(service.sendPieceStuckAlert('recipient@example.com', '<script>alert(1)</script>', 12)).resolves.toBe(true);
    expect(mocks.createTransport).toHaveBeenCalledWith(expect.objectContaining({
      host: 'mail.example.com', port: 465, secure: true, requireTLS: false,
    }));
    expect(mocks.sendMail).toHaveBeenCalledWith(expect.objectContaining({
      html: expect.stringContaining('&lt;script&gt;alert(1)&lt;/script&gt;'),
    }));
    expect(mocks.sendMail.mock.calls[0][0].html).not.toContain('<script>');
  });

  /*
   * El botón de baja de Gmail y Yahoo.
   *
   * Con `List-Unsubscribe` sola no aparece: la cabecera dice dónde, pero sin `List-Unsubscribe-Post`
   * no hay permiso para hacerlo sin preguntar, así que el cliente de correo la ignora y la persona
   * acaba usando «marcar como spam», que es lo que hunde la reputación del servidor y arrastra a
   * los demás correos. Desde 2024 ambas lo exigen a quien manda en volumen.
   */
  it('el correo comercial lleva las dos cabeceras del un clic', async () => {
    Object.assign(process.env, { SMTP_ENABLED: 'true', SMTP_HOST: 'mail.example.com', SMTP_FROM: 'n@example.com' });
    const service = new EmailService();

    await service.send('a@b.cl', 'Promo', '<p>Hola</p>', { bajaUrl: 'https://cuartel.espartanos.cl/api/marketing/suscriptores/baja/tok' });

    expect(mocks.sendMail).toHaveBeenCalledWith(expect.objectContaining({
      list: { unsubscribe: { url: expect.stringContaining('/baja/tok'), comment: expect.any(String) } },
      headers: { 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    }));
  });

  /* Un aviso de servicio no lleva baja, y sin ella tampoco puede llevar la cabecera. */
  it('el correo que no es comercial no lleva ninguna de las dos', async () => {
    Object.assign(process.env, { SMTP_ENABLED: 'true', SMTP_HOST: 'mail.example.com', SMTP_FROM: 'n@example.com' });
    const service = new EmailService();

    await service.send('a@b.cl', 'Tu reserva', '<p>Confirmada</p>');

    expect(mocks.sendMail).toHaveBeenCalledWith(expect.objectContaining({ list: undefined, headers: undefined }));
  });

  it('el correo de clave temporal dice con qué usuario entrar', async () => {
    Object.assign(process.env, { SMTP_ENABLED: 'true', SMTP_HOST: 'mail.example.com', SMTP_PORT: '465', SMTP_SECURE: 'true', SMTP_FROM: 'notifications@example.com' });
    const service = new EmailService();

    await expect(service.sendTemporaryPassword('Ana', 'ana@casa.cl', 'Temp-1234', 'https://cuartel.espartanos.cl/login')).resolves.toBe(true);
    const html = mocks.sendMail.mock.calls[0][0].html as string;
    expect(html).toContain('Tu usuario: ana@casa.cl');
    expect(html).toContain('Temp-1234');
    expect(html).toContain('https://cuartel.espartanos.cl/login');
  });

  it('un texto propio sin {{usuario}} lo recibe igual al final', async () => {
    Object.assign(process.env, { SMTP_ENABLED: 'true', SMTP_HOST: 'mail.example.com', SMTP_PORT: '465', SMTP_SECURE: 'true', SMTP_FROM: 'notifications@example.com' });
    const parametros = { get: vi.fn(async (clave: string) => (
      clave.endsWith('_body') ? 'Texto propio: clave {{clave}} en {{enlace}}' : clave.endsWith('_subject') ? 'Acceso' : null
    )) };
    const service = new EmailService(parametros as never);

    await service.sendTemporaryPassword('Ana', 'ana@casa.cl', 'Temp-1234', 'https://cuartel.espartanos.cl/login', 'org-1');
    const html = mocks.sendMail.mock.calls[0][0].html as string;
    expect(html).toContain('Texto propio');
    expect(html).toContain('Tu usuario: ana@casa.cl');
  });
});
