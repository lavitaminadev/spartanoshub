import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { createHash } from 'node:crypto';

/**
 * Limitador que cuenta por recurso además de por dirección IP.
 *
 * El limitador de serie cuenta por IP. Para una aplicación interna eso está bien, pero acá el
 * público llega desde un anuncio en Instagram y entra **desde el celular**: los operadores
 * móviles usan CGNAT, así que cientos de personas distintas comparten una misma IP pública.
 *
 * Con el conteo por IP, todas esas personas comparten un único cupo — y además lo comparten
 * entre restaurantes que no tienen nada que ver entre sí. Una campaña exitosa de un local podía
 * dejar sin reservar a los comensales de otro, por el solo hecho de usar el mismo operador.
 *
 * Rechazar una reserva legítima no es solo perder una reserva: es perder también la conversión
 * que se le devuelve a Meta, que es la razón de ser de este canal.
 *
 * Cuando la ruta identifica un recurso —el `slug` de un formulario— el cupo se cuenta por
 * `IP + recurso`, así que el de cada local es suyo. La colisión solo puede ocurrir
 * entre comensales del mismo restaurante y del mismo operador, que es un escenario mucho más
 * raro y con un tope pensado para él.
 *
 * En el acceso se cuenta por `IP + correo`, por el mismo motivo con otro disfraz: una oficina
 * entera sale a internet por una sola dirección, así que cinco intentos por minuto se repartían
 * entre todo el equipo. Con el equipo llegando a la misma hora, al sexto le respondía «demasiadas
 * peticiones» y lo leía como que el sistema estaba caído.
 *
 * Contar por correo no debilita la protección contra quien prueba contraseñas: el freno real ante
 * eso es el bloqueo de la cuenta —cinco fallos y queda cerrada cinco minutos, en `auth.service`—,
 * que actúa sobre la cuenta atacada y no sobre quien esté sentado al lado. Y quien pruebe muchos
 * correos distintos se topa igual con el límite global de la aplicación.
 *
 * En las demás rutas sin `slug` se comporta igual que el de serie, contando solo por IP.
 *
 * Sigue frenando el abuso: un guion que golpea un formulario se topa igual con el límite, y la
 * clave de idempotencia impide que un reenvío cree reservas repetidas.
 */
@Injectable()
export class ResourceThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const ip = req.ips?.length ? req.ips[0] : req.ip;

    const slug = req.params?.slug;
    if (slug) return `${ip}:${slug}`;

    /*
     * Entrada de leads por integración: el cupo es de la llave, no de la dirección.
     *
     * Quien llama es Make o Zapier, y todos sus escenarios salen por un puñado de direcciones
     * compartidas. Contando por IP, las integraciones de varias empresas competían por el mismo
     * cupo —bastaba una ráfaga de una campaña para que otra empresa recibiera 429—, y el efecto
     * era peor justo para los leads sin correo, que son los que caían en el conteo por IP a
     * secas.
     *
     * La llave identifica el origen y ya viene firmada en la cabecera; su huella basta como
     * clave y evita dejar el valor en claro en la memoria del limitador.
     */
    const autorizacion = typeof req.headers?.authorization === 'string' ? req.headers.authorization.trim() : '';
    if (autorizacion && String(req.url ?? '').includes('/public/ingest/leads')) {
      const llave = autorizacion.toLowerCase().startsWith('bearer ') ? autorizacion.slice(7).trim() : autorizacion;
      if (llave) return `ingest:${createHash('sha256').update(llave).digest('hex')}`;
    }

    /*
     * El correo se normaliza igual que al entrar —recortado y en minúsculas— porque si no, probar
     * `Ana@` y `ana@` daría dos cupos distintos para la misma cuenta.
     *
     * Se lee del cuerpo, que lo controla quien llama, y eso está bien acá: alguien que quiera
     * más intentos puede inventar correos, pero cada correo inventado falla igual y el límite
     * global de la aplicación lo frena. Lo que se busca es que dos personas distintas no se
     * quiten el cupo entre ellas.
     */
    const correo = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (correo) return `${ip}:${correo}`;

    return String(ip);
  }
}
