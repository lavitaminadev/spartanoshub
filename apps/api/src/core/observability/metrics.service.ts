import { Injectable } from '@nestjs/common';

/**
 * @fileoverview Contadores de la aplicación. **Son locales al proceso.**
 *
 * Todo lo que hay acá vive en memoria del proceso que atendió la petición, y eso tiene dos
 * consecuencias que hay que tener presentes antes de tomar una decisión con estos números:
 *
 * 1. **No son globales.** Passenger levanta varios procesos y reparte las peticiones entre
 *    ellos. Cada uno lleva su propia cuenta, así que lo que devuelve `/metrics` es lo que vio
 *    **un** proceso —el que respondió esa consulta—, no el total del servicio. Con cuatro
 *    procesos, `requestCount` puede ser aproximadamente un cuarto del tráfico real, y dos
 *    consultas seguidas pueden devolver cifras distintas sin que nada esté mal.
 * 2. **Se reinician solos.** Passenger recicla procesos por inactividad o por memoria, y con el
 *    proceso se va su historia. Un `requestCount` que baja no significa que el tráfico bajó.
 *
 * Sirven para lo que se hicieron: mirar si un proceso está vivo y respondiendo. **No sirven**
 * para informar tráfico, medir tendencias ni decidir capacidad; para eso hace falta un
 * almacenamiento compartido, que hoy no existe y que no se agrega solo por tener métricas.
 *
 * Al mostrarlas en pantalla o en un informe, decir de dónde vienen. Un número presentado como
 * total del servicio, cuando es de un proceso entre varios, es peor que no tener el número.
 */
interface MetricsState {
  requestCount: number;
  errorCount: number;
  totalResponseTime: number;
  responseTimeCount: number;
  averageResponseTime: number;
  activeUsers: Set<string>;
  startTime: number;
}

@Injectable()
export class MetricsService {
  private state: MetricsState = {
    requestCount: 0,
    errorCount: 0,
    totalResponseTime: 0,
    responseTimeCount: 0,
    averageResponseTime: 0,
    activeUsers: new Set<string>(),
    startTime: Date.now(),
  };

  incrementRequestCount(): void {
    this.state.requestCount++;
  }

  incrementErrorCount(): void {
    this.state.errorCount++;
  }

  trackResponseTime(ms: number): void {
    this.state.totalResponseTime += ms;
    this.state.responseTimeCount++;
    this.state.averageResponseTime = Math.round(
      this.state.totalResponseTime / this.state.responseTimeCount,
    );
  }

  trackActiveUser(userId: string): void {
    this.state.activeUsers.add(userId);
  }

  getMetrics() {
    return {
      requestCount: this.state.requestCount,
      errorCount: this.state.errorCount,
      errorRate:
        this.state.requestCount > 0
          ? Number(
              (
                (this.state.errorCount / this.state.requestCount) *
                100
              ).toFixed(2),
            )
          : 0,
      averageResponseTimeMs: this.state.averageResponseTime,
      activeUsers: this.state.activeUsers.size,
      uptimeSeconds: Math.floor(
        (Date.now() - this.state.startTime) / 1000,
      ),
      timestamp: new Date().toISOString(),
    };
  }

  reset(): void {
    this.state = {
      requestCount: 0,
      errorCount: 0,
      totalResponseTime: 0,
      responseTimeCount: 0,
      averageResponseTime: 0,
      activeUsers: new Set<string>(),
      startTime: Date.now(),
    };
  }
}
