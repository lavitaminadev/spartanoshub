# Cómo se decide hoy quién entra a qué

Este documento decía otra cosa. Proponía diez cambios basados en una lectura equivocada del
código, se intentaron, y una prueba los tumbó antes de llegar a producción. Lo que sigue es lo
que el sistema hace de verdad.

---

## El hallazgo

`role-permissions.ts` tiene dos cosas que parecen la misma y no lo son:

```ts
// El reparto documentado, cargo por cargo, con las razones de cada decisión.
const PERFIL_SUGERIDO: Record<UserRole, RoleModuleMap> = { ... }

// La matriz que se aplica de verdad.
export const ROLE_PERMISSIONS = {
  ...Object.fromEntries(CARGOS_INTERNOS.map((rol) => [rol, ACCESO_COMPLETO])),
  [UserRole.CLIENT]: PERFIL_SUGERIDO[UserRole.CLIENT],
}
```

**Todos los cargos internos nacen con el catálogo completo en `manage`.** `PERFIL_SUGERIDO` no se
aplica: es el punto de partida documentado para cuando se recorte desde la pantalla.

La decisión está explicada en el propio archivo y tiene sentido: antes cada cargo nacía con una
lista corta y ampliarla exigía desplegar, así que faltaban pantallas sin que nada dijera por qué.

## La consecuencia, que es lo que importa

> **Las listas de `@Roles` no son una segunda reja redundante sobre la matriz. Son la reja.**

Sin ellas, cualquier cargo interno alcanza cualquier módulo, porque la matriz se lo concede todo.

Por eso las 26 «divergencias» que detecta `fuentes-de-autorizacion.spec.ts` no son un defecto a
corregir: son la medida de cuánto está protegiendo cada controlador por su cuenta. Bajar ese
número **abriendo accesos** sería exactamente lo contrario de lo que hay que hacer.

## Qué se intentó, y qué lo detuvo

Se quitaron las listas de siete controladores —auditoría, ajustes de organización, organizaciones,
clientes, pods, plantillas de proceso y ciclos de cuenta— con el razonamiento de «que gobierne la
matriz, y el nivel por método impedirá escribir».

Una prueba de extremo a extremo comprobó el efecto real con un community manager:

```
× el registro de auditoría no lo mira cualquiera   → recibió 200
× la configuración de la organización tampoco      → recibió 200
```

Un community manager entrando al registro de auditoría y a la configuración de la organización.
Revertido en el momento.

**La lección no es sobre permisos**: es que una prueba que comprueba el efecto —quién entra de
verdad— atrapa lo que ninguna lectura del código habría atrapado. La intuición decía «esto no
abre nada»; el sistema respondió 200.

## Entonces, ¿qué sí conviene hacer?

**Nada urgente.** El sistema no tiene un agujero: tiene las rejas en un sitio distinto del que
parecía. Lo que conviene, cuando haya tiempo y sin prisa:

1. **Renombrar `PERFIL_SUGERIDO`.** Su nombre invita a leerlo como la matriz vigente, y no lo es.
   Algo como `REPARTO_DOCUMENTADO_SIN_APLICAR` es feo y no engaña a nadie.
2. **Decidir si la apertura total sigue siendo lo que se quiere.** Se hizo para que la pantalla de
   permisos pudiera recortar sin desplegar. Funciona, pero significa que **una organización nueva
   nace con todo el equipo pudiendo tocar todo** hasta que alguien recorte. Si eso no es lo
   deseado, el arreglo es que `ROLE_PERMISSIONS` aplique `PERFIL_SUGERIDO` —que ya está escrito y
   razonado— y entonces sí sobrarían muchas listas de `@Roles`.
3. **Dejar las listas donde están** mientras tanto. Son lo único que hoy separa a un diseñador del
   registro de auditoría.

El punto 2 es una decisión de producto con consecuencias reales: aplicarlo recorta de golpe lo que
ve cada persona del equipo. No se hace sin avisar a quien va a notarlo.

## Lo que queda vigilado

`fuentes-de-autorizacion.spec.ts` mantiene dos cotas:

- **6 controladores** sin módulo declarado. Los seis son de infraestructura —acceso, salud,
  métricas, subidas, imágenes, avisos— y ninguno pertenece al producto. La cota vigila que no
  aparezca un séptimo que sí lo sea.
- **26 divergencias.** Mientras la matriz conceda todo, este número no debe bajar por las malas:
  bajarlo quitando listas es abrir accesos. Bajará solo, y con sentido, si algún día se aplica
  `PERFIL_SUGERIDO`.

Y `permisos-gobiernan.e2e.spec.ts` fija el comportamiento con un cargo real, para que cualquier
intento de simplificar esto —el mío incluido— falle ahí antes de llegar a producción.
