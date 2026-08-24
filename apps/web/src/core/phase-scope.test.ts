import { describe, expect, it } from 'vitest';
import {
  OUT_OF_SCOPE_MODULES,
  PHASE_1_MODULES,
  PHASE_SCOPE_ENABLED,
  isModuleInPhaseScope,
} from './phase-scope';
import { getFeatureForPath, isPathEnabled, isRoleAllowedForPath } from './navigation.registry';

describe('alcance de fase', () => {
  it('deja pasar el circuito mínimo a quien corresponde', () => {
    for (const module of ['reservations', 'crm']) {
      expect(isModuleInPhaseScope(module, undefined, 'designer'), module).toBe(true);
    }
    for (const module of ['integrations', 'clients', 'users']) {
      expect(isModuleInPhaseScope(module, undefined, 'admin'), module).toBe(true);
    }
  });

  /**
   * Decisión del 2026-08-18: el catálogo ya no esconde ningún módulo.
   *
   * Abrir uno exigía editar el catálogo y desplegar. Ahora el ciclo de vida se guarda en
   * configuración y se cambia desde el panel de Desarrollo, así que el código los ofrece
   * todos y se elige cuáles se usan sin volver a desplegar.
   *
   * Que un módulo esté activo no lo hace aparecer: sigue necesitando su interruptor encendido
   * y permiso en la matriz de cargos. Lo que cambió es que abrirlo dejó de ser un despliegue.
   *
   * El mecanismo de ocultar no desapareció —lo ejerce el bloque «el cargo de desarrollo frente
   * al alcance de fase», con un ciclo de vida guardado en configuración—; lo que desapareció es que
   * venga impuesto desde el código.
   */
  it('la operación inicial reserva los módulos futuros para desarrollo', () => {
    expect(OUT_OF_SCOPE_MODULES).toEqual({});
    for (const module of ['content', 'billing', 'gamification', 'adsInsights']) {
      expect(isModuleInPhaseScope(module, undefined, 'admin'), module).toBe(false);
      expect(isModuleInPhaseScope(module, undefined, 'dev'), module).toBe(true);
    }
  });

  it('reserva el pipeline comercial para desarrollo', () => {
    expect(isModuleInPhaseScope('commercialPipeline', undefined, 'admin')).toBe(false);
    expect(isModuleInPhaseScope('commercialPipeline', undefined, 'dev')).toBe(true);
  });

  it('no clasifica un módulo en las dos listas a la vez', () => {
    const duplicated = PHASE_1_MODULES.filter((module) => module in OUT_OF_SCOPE_MODULES);
    expect(duplicated).toEqual([]);
  });

  it('falla cerrado ante un módulo desconocido y no oculta la ruta sin módulo', () => {
    expect(isModuleInPhaseScope('modulo-que-todavia-no-existe', undefined, 'admin')).toBe(false);
    expect(isModuleInPhaseScope('modulo-que-todavia-no-existe', undefined, 'dev')).toBe(true);
    expect(isModuleInPhaseScope(undefined)).toBe(true);
  });

  it('el interruptor está encendido mientras dure el alcance de Fase 0 y 1', () => {
    // Si esta prueba falla es porque alguien reactivó la plataforma completa. Es una decisión
    // válida: actualizar la expectativa junto con el cambio, para que quede registrada.
    expect(PHASE_SCOPE_ENABLED).toBe(true);
  });
});

describe('navegación bajo el alcance de fase', () => {
  const visible = (path: string, role = 'admin') => isPathEnabled(path, undefined, undefined, undefined, role);

  it('mantiene las rutas del alcance aunque el usuario tenga todos los permisos', () => {
    for (const path of ['/dashboard', '/reservations', '/crm/contacts', '/clients', '/integrations']) {
      expect(visible(path), path).toBe(true);
    }
  });

  /**
   * Con todos los módulos activos, ninguna ruta se cierra desde el código.
   *
   * `visible()` consulta solo el catálogo —sin interruptores ni permisos—, así que responde
   * qué ofrece el producto, no qué ve una persona concreta. Esas dos preguntas se responden
   * más abajo: `surveys` con su interruptor, y el bloque de Desarrollo con el ciclo de vida
   * guardado en configuración.
   */
  it('las rutas futuras quedan fuera de alcance para administración', () => {
    const antesOcultas = ['/content', '/approvals', '/briefs', '/audiovisual',
      '/meetings', '/billing', '/contracts', '/catalog', '/gamification', '/knowledge',
      '/onboarding', '/direction', '/operations', '/documents'];

    for (const path of antesOcultas) {
      expect(visible(path), path).toBe(false);
    }
  });

  it('mantiene las rutas propias del CRM dentro de su módulo', () => {
    for (const path of ['/crm/leads', '/crm/opportunities', '/crm/interactions']) {
      expect(visible(path), path).toBe(true);
    }
  });

  /**
   * El orden de las preguntas no cambió, solo dejó de haber módulos que lo activen desde el
   * catálogo. Se comprueba con un ciclo de vida guardado en configuración, que es la única
   * vía que queda para cerrar uno: ni el interruptor encendido ni el permiso de administrar
   * reabren lo que está cerrado ahí.
   */
  it('el permiso explícito no alcanza para reabrir una ruta cerrada en configuración', () => {
    expect(isPathEnabled('/content', { content: true }, { content: 'manage' }, { content: 'development' }, 'admin')).toBe(false);
    // Y con el módulo abierto, el permiso vuelve a mandar.
    expect(isPathEnabled('/content', { content: true }, { content: 'manage' }, { content: 'active' }, 'admin')).toBe(false);
  });

  it('reserva la puerta de entrada a producción y su tablero', () => {
    // Decisión del 2026-08-09: el plan de plataforma pone las solicitudes como primer
    // entregable. Si se vuelve a ocultar, mover la clave y actualizar esta expectativa.
    for (const path of ['/intake', '/production']) {
      expect(visible(path), path).toBe(false);
    }
    // `/intake` pasó a su propio módulo: recibir y coordinar solicitudes se libera antes que el
    // tablero de piezas, y mientras compartían clave no se podía liberar lo uno sin lo otro.
    expect(getFeatureForPath('/intake')).toBe('intake');
    expect(getFeatureForPath('/production')).toBe('production');
  });

  it('Encuestas queda reservada aunque el interruptor esté encendido', () => {
    // El módulo dejó de estar en `development` cuando se publicó `SurveysController`. Ahora la
    // ruta la gobierna el interruptor: sin él, la pantalla llamaría a una API que sí existe
    // pero que la organización no contrató.
    expect(getFeatureForPath('/surveys')).toBe('surveys');
    expect(isPathEnabled('/surveys', { surveys: false }, undefined)).toBe(false);
    expect(isPathEnabled('/surveys', { surveys: true }, undefined)).toBe(false);
    expect(isPathEnabled('/surveys', undefined, { surveys: 'none' })).toBe(false);
    expect(isPathEnabled('/surveys', undefined, { surveys: 'edit' })).toBe(false);
  });

  it('toda ruta fuera de alcance declara su módulo, sin lo cual no se podría ocultar', () => {
    for (const path of ['/content', '/billing', '/contracts']) {
      expect(getFeatureForPath(path), path).toBeDefined();
    }
  });
});

describe('el cargo de desarrollo frente al alcance de fase', () => {
  it('puede pasar restricciones de rol del manifiesto sin convertirlas en permisos de admin', () => {
    expect(isRoleAllowedForPath(['admin'], 'dev')).toBe(true);
    expect(isRoleAllowedForPath(['admin'], 'operations_director')).toBe(false);
    expect(isRoleAllowedForPath(['admin', 'operations_director'], 'admin')).toBe(true);
  });

  it('ve un módulo en desarrollo, que es como valida antes de liberar', () => {
    expect(isModuleInPhaseScope('production', { production: 'development' }, 'dev')).toBe(true);
  });

  it('no muestra a desarrollo módulos deshabilitados que el servidor rechaza', () => {
    expect(isModuleInPhaseScope('production', { production: 'disabled' }, 'dev')).toBe(false);
    // Maintenance sigue visible para todos: es un estado operativo, no una retirada del
    // producto. La regla compartida lo incluye entre los lifecycles visibles.
    expect(isModuleInPhaseScope('production', { production: 'maintenance' }, 'dev')).toBe(true);
  });

  it('ningún otro cargo ve lo que está en desarrollo', () => {
    expect(isModuleInPhaseScope('production', { production: 'development' }, 'admin')).toBe(false);
    expect(isModuleInPhaseScope('production', { production: 'development' }, 'designer')).toBe(false);
  });

  it('lo liberado se ve igual para todos', () => {
    expect(isModuleInPhaseScope('reservations', { reservations: 'active' }, 'designer')).toBe(true);
    expect(isModuleInPhaseScope('reservations', { reservations: 'active' }, 'dev')).toBe(true);
  });
});
