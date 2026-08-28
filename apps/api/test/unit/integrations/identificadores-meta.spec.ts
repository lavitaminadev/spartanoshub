import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  hashearTodos, normalizarCorreo, normalizarTelefono, parametroSinHashear,
  prepararIdentificadores, yaEstaHasheado,
} from '../../../src/modules/integrations/meta/identificadores-meta';

const SHA256 = /^[a-f0-9]{64}$/;
const sha = (valor: string) => createHash('sha256').update(valor).digest('hex');

describe('correo', () => {
  it('produce un digest de 64 hexadecimales', () => {
    const [digest] = hashearTodos(['Usuario@Example.COM'], normalizarCorreo) ?? [];

    expect(digest).toMatch(SHA256);
  });

  it('mayúsculas y espacios dan el mismo digest que la forma limpia', () => {
    // Meta compara digests: una mayúscula de más produce un hash distinto y el evento se acepta
    // sin emparejarse con nadie, que es un fallo sin ninguna señal.
    const [conRuido] = hashearTodos(['  Usuario@Example.COM  '], normalizarCorreo) ?? [];
    const [limpio] = hashearTodos(['usuario@example.com'], normalizarCorreo) ?? [];

    expect(conRuido).toBe(limpio);
    expect(limpio).toBe(sha('usuario@example.com'));
  });
});

describe('teléfono', () => {
  it('quita separadores y conserva el código de país', () => {
    const [conFormato] = hashearTodos(['+56 9 1234 5678'], normalizarTelefono) ?? [];

    expect(conFormato).toBe(sha('56912345678'));
  });

  it('el mismo número escrito de dos formas produce el mismo digest', () => {
    const [uno] = hashearTodos(['+56 9 1234 5678'], normalizarTelefono) ?? [];
    const [otro] = hashearTodos(['+56912345678'], normalizarTelefono) ?? [];

    expect(uno).toBe(otro);
  });
});

describe('protección contra doble hasheo', () => {
  it('reconoce un digest', () => {
    expect(yaEstaHasheado(sha('lo que sea'))).toBe(true);
    expect(yaEstaHasheado('usuario@example.com')).toBe(false);
  });

  it('lo ya hasheado pasa intacto', () => {
    // Hashear un hash produce un valor que no casa con nadie: el evento sale, Meta lo acepta y
    // no sirve para nada.
    const digest = sha('usuario@example.com');

    expect(hashearTodos([digest], normalizarCorreo)).toEqual([digest]);
  });

  it('hashear dos veces da lo mismo que hashear una', () => {
    const unaVez = hashearTodos(['usuario@example.com'], normalizarCorreo);
    const dosVeces = hashearTodos(unaVez, normalizarCorreo);

    expect(dosVeces).toEqual(unaVez);
  });

  it('un digest en mayúsculas se normaliza sin volver a hashearse', () => {
    const digest = sha('usuario@example.com');

    expect(hashearTodos([digest.toUpperCase()], normalizarCorreo)).toEqual([digest]);
  });
});

describe('sin dato no se inventa un identificador', () => {
  it('omite el parámetro cuando no hay valores', () => {
    expect(hashearTodos(undefined, normalizarCorreo)).toBeUndefined();
    expect(hashearTodos([], normalizarCorreo)).toBeUndefined();
  });

  it('descarta lo que queda vacío tras normalizar', () => {
    // Hashear la cadena vacía da siempre el mismo digest: Meta recibiría el mismo identificador
    // para toda persona sin ese dato y las trataría como una sola.
    expect(hashearTodos(['   '], normalizarCorreo)).toBeUndefined();
    expect(hashearTodos(['sin dígitos'], normalizarTelefono)).toBeUndefined();
  });
});

describe('lo que no lleva hash', () => {
  it('el identificador de Meta y las señales del navegador se conservan', () => {
    const preparado = prepararIdentificadores({
      lead_id: '1514141180734116',
      fbc: 'fb.1.123.abc',
      fbp: 'fb.1.456.def',
      client_ip_address: '200.0.0.1',
      client_user_agent: 'Mozilla/5.0',
      em: ['usuario@example.com'],
    });

    expect(preparado.lead_id).toBe('1514141180734116');
    expect(preparado.fbc).toBe('fb.1.123.abc');
    expect(preparado.fbp).toBe('fb.1.456.def');
    expect(preparado.client_ip_address).toBe('200.0.0.1');
    expect(preparado.client_user_agent).toBe('Mozilla/5.0');
    expect(preparado.em?.[0]).toMatch(SHA256);
  });
});

describe('la reja previa al envío', () => {
  it('deja pasar lo que va hasheado', () => {
    expect(parametroSinHashear(prepararIdentificadores({
      lead_id: '1514141180734116',
      em: ['usuario@example.com'],
      ph: ['+56912345678'],
    }) as unknown as Record<string, unknown>)).toBeNull();
  });

  it('detecta un correo en claro', () => {
    expect(parametroSinHashear({ em: ['usuario@example.com'] })).toBe('em');
  });

  it('detecta un teléfono en claro', () => {
    expect(parametroSinHashear({ ph: ['+56912345678'] })).toBe('ph');
  });

  it('no se queja del identificador de Meta, que va sin hash', () => {
    expect(parametroSinHashear({ lead_id: '1514141180734116' })).toBeNull();
  });
});
