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
      expect(isModuleInPhaseScope(module, undefined, 'commercial_director'), module).toBe(true);
    }
  });

  /*
   * Dirección de Operaciones administra las reservas de todas las empresas, así que necesita
   * abrir su ficha. Lo demás de esta lista no se mueve: es la reja de verdad —la matriz concede
   * el catálogo a todo cargo interno— y ampliarla de más abre la cartera al equipo entero.
   */
  it('deja a Dirección de Operaciones abrir la ficha de una empresa, y a nadie más de más', () => {
    expect(isModuleInPhaseScope('clients', undefined, 'operations_director')).toBe(true);
    expect(isModuleInPhaseScope('clients', undefined, 'community_manager')).toBe(false);
    expect(isModuleInPhaseScope('clients', undefined, 'creative_director')).toBe(false);
    // Conexiones guarda las credenciales de medición: sigue en administración y dirección comercial.
    expect(isModuleInPhaseScope('integrations', undefined, 'operations_director')).toBe(false);
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
  /*
   * Los ejemplos cambian, la afirmación no.
   *
   * `content` y `billing` salieron de `INITIAL_OPERATION_MODULES` con los otros diez módulos de
   * empresa, por decisión del dueño: abrirlos y dejarlos apagados hasta que se enciendan. Desde
   * ahí los cierra el interruptor de la organización, no esta lista. Detrás de la puerta de
   * despliegue quedan los que de verdad no están terminados, y son los que se fijan acá.
   */
  it('la operación inicial reserva para desarrollo los módulos sin terminar', () => {
    expect(OUT_OF_SCOPE_MODULES).toEqual({});
    for (const module of ['gamification', 'knowledge', 'direction', 'adsInsights']) {
      expect(isModuleInPhaseScope(module, undefined, 'admin'), module).toBe(false);
      expect(isModuleInPhaseScope(module, undefined, 'dev'), module).toBe(true);
    }
  });

  /*
   * El embudo comercial se queda detrás de la puerta, y la razón es `/automations`.
   *
   * Es uno de los doce módulos de empresa y aun así no se liberó: `/automations` cuelga de su
   * misma clave —no tiene módulo propio en el catálogo—, así que abrirlo abriría también
   * Automatizaciones, que no está terminada. Esta prueba es la que lo encontró al cambiar la
   * lista. Para liberarlo hay que darle antes a `/automations` su propia clave.
   */
  it('reserva el pipeline comercial para desarrollo, porque Automatizaciones comparte su clave', () => {
    expect(isModuleInPhaseScope('commercialPipeline', undefined, 'commercial_director')).toBe(false);
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
  /*
   * La lista se partió en dos cuando se liberaron los once módulos de empresa.
   *
   * Las que siguen cerradas son las que no están terminadas, y las que se abrieron pasan esta
   * puerta sin que eso sea acceso: su interruptor en la organización nace apagado. Mantenerlas
   * aquí como «fuera de alcance» habría sido fijar una puerta que ya no está ahí.
   */
  it('las rutas sin terminar quedan fuera de alcance para administración', () => {
    for (const path of ['/catalog', '/gamification', '/knowledge', '/onboarding', '/direction', '/operations']) {
      expect(visible(path), path).toBe(false);
    }
  });

  it('las once liberadas pasan la puerta de despliegue, y las cierra su interruptor', () => {
    for (const path of ['/content', '/approvals', '/briefs', '/audiovisual', '/meetings',
      '/billing', '/contracts', '/documents', '/intake', '/production']) {
      expect(visible(path), path).toBe(true);
    }
  });

  it('mantiene contactos y leads dentro del CRM inicial', () => {
    for (const path of ['/crm/leads', '/crm/calendario']) {
      expect(visible(path), path).toBe(true);
    }
  });

  it('el calendario pertenece al CRM del cliente, no al módulo interno de reuniones', () => {
    expect(getFeatureForPath('/crm/calendario')).toBe('crm');
    expect(isPathEnabled(
      '/crm/calendario',
      { crm: true },
      { crm: 'view', meetings: 'none' },
      { crm: 'active' },
      'client',
    )).toBe(true);
  });

  it('no hereda Automatizaciones desde el permiso CRM', () => {
    expect(getFeatureForPath('/automations')).toBe('commercialPipeline');
    expect(visible('/automations', 'commercial_director')).toBe(false);
    expect(visible('/automations', 'admin')).toBe(false);
    expect(visible('/automations', 'dev')).toBe(true);
  });

  it('reserva oportunidades y mantiene la actividad dentro del CRM operativo', () => {
    expect(visible('/crm/opportunities')).toBe(false);
    expect(visible('/crm/interactions')).toBe(true);
  });

  /**
   * El orden de las preguntas no cambió, solo dejó de haber módulos que lo activen desde el
   * catálogo. Se comprueba con un ciclo de vida guardado en configuración, que es la única
   * vía que queda para cerrar uno: ni el interruptor encendido ni el permiso de administrar
   * reabren lo que está cerrado ahí.
   */
  it('el permiso explícito no alcanza para reabrir una ruta cerrada en configuración', () => {
    expect(isPathEnabled('/content', { content: true }, { content: 'manage' }, { content: 'development' }, 'admin')).toBe(false);
    /*
     * Y con el módulo abierto, el permiso vuelve a mandar.
     *
     * Esta segunda línea esperaba `false` y lo decía el comentario de al lado: lo cerraba la
     * puerta de despliegue, no el ciclo de vida. Liberados los once, la prueba dice por fin lo
     * que su comentario siempre afirmó, y la primera línea —la que importa— no cambió.
     */
    expect(isPathEnabled('/content', { content: true }, { content: 'manage' }, { content: 'active' }, 'admin')).toBe(true);
  });

  it('la puerta de entrada a producción y su tablero ya pasan, cada uno con su clave', () => {
    // Decisión del 2026-08-09: el plan de plataforma pone las solicitudes como primer
    // entregable. Lo que las cierra ahora es el interruptor de cada módulo, no esta lista.
    for (const path of ['/intake', '/production']) {
      expect(visible(path), path).toBe(true);
    }
    // `/intake` pasó a su propio módulo: recibir y coordinar solicitudes se libera antes que el
    // tablero de piezas, y mientras compartían clave no se podía liberar lo uno sin lo otro.
    expect(getFeatureForPath('/intake')).toBe('intake');
    expect(getFeatureForPath('/production')).toBe('production');
  });

  it('Encuestas la deciden el permiso de la persona y la capacidad de su empresa, como CRM y Reservas', () => {
    expect(getFeatureForPath('/surveys')).toBe('surveys');
    expect(isPathEnabled('/surveys', { surveys: false }, undefined)).toBe(false);
    for (const cargo of ['commercial_director', 'admin', 'operations_director', 'community_manager']) {
      expect(isPathEnabled('/surveys', { surveys: true }, { surveys: 'edit' }, undefined, cargo)).toBe(true);
    }
    expect(isPathEnabled('/surveys', undefined, { surveys: 'none' }, undefined, 'commercial_director')).toBe(false);
    // Cargos que no operan cuentas siguen fuera aunque alguien les dé el permiso.
    expect(isPathEnabled('/surveys', { surveys: true }, { surveys: 'edit' }, undefined, 'designer')).toBe(false);
    // Una empresa del portal sin el servicio no lo ve.
    expect(isPathEnabled('/surveys', { surveys: true }, { surveys: 'edit' }, undefined, 'community_manager', { surveys: false })).toBe(false);
  });

  it('Dirección Comercial no recibe Reservas junto con Encuestas', () => {
    expect(isRoleAllowedForPath(['admin', 'operations_director', 'community_manager'], 'commercial_director')).toBe(false);
    expect(isModuleInPhaseScope('reservations', undefined, 'commercial_director')).toBe(true);
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
