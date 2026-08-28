import { beforeEach, describe, expect, it } from 'vitest';
import {
  esDeApple, esSafariDeApple, estaInstalada, fueDescartada, olvidarDescarteSiLaQuitaron,
  recordarDescarte, recordarInstalacion,
} from './instalacion-pwa';

const navegador = (ua: string, maxTouchPoints = 0) => ({ userAgent: ua, maxTouchPoints }) as Navigator;

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1';
const IPHONE_CHROME = `${IPHONE} CriOS/120.0`;
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0 Mobile';

describe('a qué dispositivo se le explica el gesto', () => {
  it('reconoce un iPhone', () => {
    expect(esDeApple(navegador(IPHONE))).toBe(true);
  });

  it('reconoce un iPad, que se presenta como un Mac', () => {
    // Desde iPadOS 13 miente en el agente de usuario; lo único que lo delata es el táctil.
    expect(esDeApple(navegador(IPAD, 5))).toBe(true);
  });

  it('no confunde un Mac de escritorio con un iPad', () => {
    expect(esDeApple(navegador(IPAD, 0))).toBe(false);
  });

  it('no confunde Android con Apple', () => {
    expect(esDeApple(navegador(ANDROID))).toBe(false);
  });

  it('en iPhone, solo Safari puede instalar', () => {
    // Chrome en iPhone usa el motor de Safari pero no ofrece añadir a la pantalla de inicio:
    // explicarle el gesto sería mandarlo a buscar un botón que no existe.
    expect(esSafariDeApple(navegador(IPHONE))).toBe(true);
    expect(esSafariDeApple(navegador(IPHONE_CHROME))).toBe(false);
  });
});

describe('si ya está instalada', () => {
  it('lo detecta cuando corre como aplicación', () => {
    const ventana = { matchMedia: () => ({ matches: true }), navigator: {} } as unknown as Window;
    expect(estaInstalada(ventana)).toBe(true);
  });

  it('lo detecta también por la vía de Safari', () => {
    const ventana = { matchMedia: () => ({ matches: false }), navigator: { standalone: true } } as unknown as Window;
    expect(estaInstalada(ventana)).toBe(true);
  });

  it('en una pestaña normal dice que no', () => {
    const ventana = { matchMedia: () => ({ matches: false }), navigator: {} } as unknown as Window;
    expect(estaInstalada(ventana)).toBe(false);
  });
});

describe('el «no, gracias» se respeta', () => {
  beforeEach(() => window.localStorage.clear());

  it('se recuerda entre visitas', () => {
    recordarDescarte();
    expect(fueDescartada()).toBe(true);
  });

  it('sobrevive a que el navegador vuelva a ofrecerla', () => {
    // Es el caso que hace que «nunca más» signifique algo: el navegador lanza ese aviso en cada
    // carga mientras no esté instalada, y tomarlo como señal la haría reaparecer al recargar.
    recordarDescarte();

    expect(olvidarDescarteSiLaQuitaron()).toBe(false);
    expect(fueDescartada()).toBe(true);
  });

  it('se olvida si la habían instalado y ya no está', () => {
    // Ahí sí es una situación nueva: el «no, gracias» describía un momento que ya no existe.
    recordarDescarte();
    recordarInstalacion();

    expect(olvidarDescarteSiLaQuitaron()).toBe(true);
    expect(fueDescartada()).toBe(false);
  });

  it('la desinstalación se cobra una sola vez', () => {
    // Sin borrar la marca, cada recarga posterior volveria a olvidar el descarte siguiente.
    recordarInstalacion();
    olvidarDescarteSiLaQuitaron();
    recordarDescarte();

    expect(olvidarDescarteSiLaQuitaron()).toBe(false);
    expect(fueDescartada()).toBe(true);
  });

  it('sin almacenamiento se prefiere ofrecer a fallar', () => {
    const roto = { getItem: () => { throw new Error('modo privado'); } } as unknown as Storage;
    expect(fueDescartada(roto)).toBe(false);
  });
});
