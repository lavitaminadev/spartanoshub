import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

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
 * En las rutas sin `slug` se comporta igual que el de serie, contando solo por IP.
 *
 * Sigue frenando el abuso: un guion que golpea un formulario se topa igual con el límite, y la
 * clave de idempotencia impide que un reenvío cree reservas repetidas.
 */
@Injectable()
export class ResourceThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const ip = req.ips?.length ? req.ips[0] : req.ip;
    const slug = req.params?.slug;
    return slug ? `${ip}:${slug}` : String(ip);
  }
}
