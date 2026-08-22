# Diez decisiones de permisos

Diez controladores cierran su puerta con `@Roles` **a nivel de clase**: nadie fuera de esa lista
entra, ni siquiera a leer. Y la matriz de permisos —la que se edita en Accesos y seguridad—
concede su módulo a más cargos.

El resultado se vive así: **concedes el módulo, la persona lo ve en el menú, entra y recibe 403.**
El menú promete lo que el servidor no cumple.

Esto no se arregla desde el código sin decidir antes: resolver cada una amplía o recorta el
acceso de gente concreta. Aquí está cada caso con lo que recomiendo y por qué. Basta un sí o un
no por fila.

> Las otras 16 divergencias que detecta `fuentes-de-autorizacion.spec.ts` tienen el `@Roles` en
> métodos sueltos —lectura abierta, escritura restringida—, que es lo correcto y no hay que tocar.

---

## Cómo se resuelve cada una

Hay dos formas, y casi siempre la correcta es la segunda:

1. **Quitar el `@Roles`** y dejar que mande la matriz. Amplía el acceso a quien tenga el módulo.
2. **Cambiar el módulo que declara el controlador** por uno que describa mejor lo que hace. No
   amplía nada: solo deja de prometer desde la pantalla lo que el código nunca iba a dar.

La segunda es preferible cuando el problema es que el controlador se colgó de un módulo
demasiado general —`settings` o `users`— que la matriz concede a casi todos para cosas básicas.

---

## Las diez

| # | Controlador | Módulo que declara | Deja fuera a | Recomiendo |
| --- | --- | --- | --- | --- |
| 1 | `core/audit` | `settings` | 7 cargos | **Cambiar a `governance`** |
| 2 | `core/data-protection` | `governance` | 7 cargos | **Dejar cerrado**, quitar de la matriz |
| 3 | `core/parameters/organization-settings` | `settings` | 8 cargos | **Dejar cerrado**, es la configuración |
| 4 | `modules/organizations` | `settings` | 7 cargos | **Dejar cerrado** |
| 5 | `modules/account-cycles` | `clients` | 7 + cliente | **Abrir a lectura** |
| 6 | `modules/clients` | `clients` | 3 cargos | **Abrir a lectura** |
| 7 | `modules/pods` | `users` | 8 cargos | **Abrir a lectura** |
| 8 | `modules/process-templates` | `operations` | 8 cargos | **Abrir a lectura** |
| 9 | `modules/service-requests` | `settings` | 9 cargos | **Abrir**, y cambiar a su propio módulo |
| 10 | `modules/automations` | `crm` | 8 + cliente | **Decisión tuya** (ver abajo) |

### Por qué cada recomendación

**1 · Auditoría → `governance`.** El registro de auditoría dice quién hizo qué. No es
configuración: es gobierno. Declarando `governance` la divergencia desaparece sin que nadie gane
acceso, porque ese módulo ya está restringido a quien corresponde.

**2, 3 y 4 · Protección de datos, ajustes de organización, organizaciones.** Son las tres palancas
que pueden dejar a todo el mundo fuera o exponer datos personales. Quien las toca es
administración. La divergencia se cierra **quitándolas de la matriz** para los cargos que hoy las
reciben: la pantalla deja de prometerlas.

**5 y 6 · Ciclos de cuenta y clientes.** Quien trabaja una cuenta necesita ver de qué cuenta se
trata y en qué punto del ciclo está. El alcance por cuenta ya limita a las suyas, así que abrir
la lectura no expone nada que no le corresponda. **La escritura sigue restringida.**

**7 · Pods.** Saber con quién trabajas no es información sensible. Lectura para todo el equipo.

**8 · Plantillas de proceso.** Definen las etapas por las que pasa el trabajo. Todo el mundo las
recorre; no poder ni leerlas obliga a preguntar por chat cómo se llama el paso siguiente.

**9 · Solicitudes de servicio.** Pedirle algo al equipo tiene que poder hacerlo cualquiera del
equipo. Además declara `settings`, que no describe lo que hace: merece su propio módulo.

**10 · Automatizaciones.** Es el único donde no tengo criterio suficiente. Una automatización mal
tocada manda correos a clientes reales o mueve leads en bloque. Si en tu equipo eso lo maneja
solo dirección, se deja cerrado y se quita de la matriz; si un community manager arma sus propias
automatizaciones, se abre. **Dímelo tú.**

---

## Después de decidir

Cada cambio se hace con su prueba de extremo a extremo: se crea una cuenta con ese cargo, se le
concede el módulo, y se comprueba que entra —o que no—. Sin eso, «abrir a lectura» es una
intención, no un hecho.

Y la cota de `fuentes-de-autorizacion.spec.ts` baja con cada una resuelta. Cuando llegue a cero,
la pantalla de permisos gobierna de verdad todo el producto.
