# VITAHUB / Espartanos

Monorepo de La Vitamina: NestJS (`apps/api`) + React/Vite (`apps/web`) + `packages/shared`.

**Una sola organización.** Las empresas clientes —restaurantes— son **datos**, no inquilinos. No es
un SaaS multiempresa: hay una organización, La Vitamina, y dentro de ella empresas atendidas. El
equipo se reparte por áreas, con alcance por pod.

---

## Verificar

```bash
npx tsc -p apps/api/tsconfig.json --noEmit    # API
npx tsc -b apps/web                           # web
npm run lint:api && npm run lint:web && npm run lint:shared
npm run test:api                              # vitest
npm run test:web
```

**En `apps/web` hay que usar `tsc -b`.** `tsc -p tsconfig.json` no compila nada ahí: el
`tsconfig.json` tiene `files: []` y sólo referencia a los proyectos hijos. Devuelve 0 sin mirar una
sola línea.

**Es vitest, no jest.** No hay `npm run lint` a secas: son tres, uno por paquete.

**`apps/api/test/unit/app-module-boot.spec.ts` es la única prueba que detecta un fallo de registro
de módulo o de DI.** Esos fallos compilan y pasan todas las demás pruebas, y luego la aplicación no
arranca. Si tocas un módulo, un proveedor o una entidad, córrela.

**Los constructores en las pruebas son posicionales.** Un colaborador nuevo va **al final** del
constructor, o rompes todas las pruebas que construyen esa clase a mano.

Con varias ventanas corriendo a la vez, la suite completa puede fallar por tiempo. Antes de
reportar un fallo, vuelve a correr ese archivo solo.

---

## Las tres rejas de acceso

Se comprueban en este orden, y entenderlas evita romperlas:

1. **Permiso de módulo por cargo** — `PermissionResolverService`, con excepciones por persona y por
   empresa en `user_permission_override`.
2. **Capacidad contratada por empresa** — `modules/clients/client-capabilities.ts`. Los doce módulos
   cuyo sujeto es una empresa atendida nacen **apagados**; encender uno es una decisión comercial.
3. **Área del perfil** — 37 claves en `packages/shared/src/areas.ts`, cada una en `ninguno` / `ver` /
   `hacer`. Se exigen con `@RequiereArea('clave', 'nivel')` y las comprueba `PermissionGuard`.

Más, cruzando las tres: **nivel de datos protegidos por módulo y por persona** —`oculto`,
`bajo_registro`, `directo`—, en `packages/shared/src/datos-protegidos.ts`. `bajo_registro` recorta
igual que `oculto`; la diferencia es que se puede pedir y queda constancia.

`INITIAL_OPERATION_MODULES` en `packages/shared/src/constants/modules.ts` es una lista fija que
cierra los módulos no liberados. **Es una reja real, no redundante**: retirarla es una decisión
comercial, no técnica.

---

## La empresa de una petición

Se resuelve en **un solo sitio**: `core/client-scope/empresa-resuelta.ts`, con el interceptor global
`empresa.interceptor.ts` y el decorador `@Empresa()`.

| Situación | Respuesta |
|---|---|
| La declara y la alcanza | La empresa |
| La declara y no la alcanza | **404**, el mismo que si no existiera |
| No la declara y alcanza una sola | Esa |
| No la declara y alcanza varias | **400** |
| No la declara y no tiene límite | `AGENCIA` |

**No hay repliegue.** Devolver «la mía» cuando se pidió otra es el defecto que esto existe para
quitar: con una empresa por cuenta acertaba siempre, con dos escribe en la equivocada y responde
200.

`apps/api/test/unit/authorization/donde-se-decide-la-empresa.spec.ts` vigila que no vuelva a
aparecer un sitio que la adivine. Si migras uno, sácalo de su lista.

**404 y no 403** cuando algo está fuera de alcance: decir «existe pero no es tuyo» ya revela a quién
atiende la agencia.

**`undefined` es «sin límite» y `[]` es «ninguna empresa».** Confundirlos convierte un alcance vacío
en acceso total.

---

## Los dos embudos del CRM

`lead.domain` distingue:

- **`commercial`** — un prospecto que quiere contratar a La Vitamina. Ahí `lead.company` es su
  nombre, hoy en texto libre.
- **`audience`** — un comensal que reservó en un restaurante cliente. Ahí `company` no significa
  nada, y `clientId` es el restaurante cuya audiencia es.

Un cambio que toque campos de empresa, cotizaciones o redes sociales es del embudo **comercial**.

---

## Desplegar

**Subir no despliega.** cPanel tiene Git Version Control apuntando a la rama `deploy` y corre
`.cpanel.yml`. Un workflow publica en `deploy` al llegar código a `main`.

**Los `dist` se versionan a propósito** (`apps/api/dist`, `apps/web/dist`, `packages/shared/dist`).
La cuenta tiene **768 MB para todos sus procesos** y `tsc` pide unos 600: compilar allá puede matar
a los procesos que están atendiendo reservas. Se compila acá con `npm run build:cpanel`.

Hay además **límite de inodes**. Antes de añadir miles de archivos, cuéntalos.

La migración **`0179-soltar-las-tablas-retiradas.ts` no se sigue en git a propósito**: suelta tablas
y espera confirmación de que hay respaldo fuera del hosting. Su `.js` se quita de `dist` antes de
montarlo. Las migraciones se cargan por glob, así que su ausencia no rompe ningún import.

**WordPress vive en la raíz del hosting.** Un 500 sin actividad en `passenger-error.log` es Apache,
no la aplicación: mirar el `.htaccess` del directorio padre.

**Nunca conectar a la base de datos de producción.**

---

## Cómo se escribe acá

**Los comentarios documentan qué hace algo y qué garantiza. No narran el bug que se corrigió.**

```ts
// Mal:  Antes esto devolvía la empresa de la sesión y escribía en la equivocada.
// Bien: Una empresa que no se alcanza da 404, no la propia: devolver «la mía» cuando
//       se pidió otra deja la escritura en la empresa equivocada con un 200 encima.
```

Todo en español: código, comentarios, mensajes de error, commits. Los `LEGACY_*` con el nombre
antiguo sostienen sesiones y datos vivos: **no se borran**.

Antes de implementar algo con alternativas, explicar pros y contras **con cifras medidas del
repositorio**, no con etiquetas. La decisión es del dueño.

---

## Qué skill se carga, y cuándo

No se piden: se cargan antes del primer paso del tipo de trabajo que cubren. Una skill instalada
que nadie invoca no sirve de nada, y esperar a que el modelo la vea es dejarlo al azar.

| Antes de… | Cargar | Por qué |
|---|---|---|
| Diagnosticar un fallo cuyo origen no esté claro, o una regresión que no se localiza | `systematic-debugging` | El `errno 150`, el YAML del workflow y el lock de npm costaron seis días, y los tres fueron fallos de método: cambiar algo plausible antes de medir. La skill obliga a probar la causa, no a adivinarla |
| Abrir o actualizar un PR, o dejar un diff listo para revisar | `github-pr-workflow` | Rama, borrador, CI, riesgo anotado, fusión. Es el ciclo que se hace a mano varias veces por semana |
| Copiar, instalar o clonar código de un repositorio de fuera | `oss-forensics` | Un `install.sh` ajeno escribe en `~/.claude`. Se lee antes de correrlo, siempre |
| Notar que la conversación se alargó y el contexto empieza a apretar | `hermes-compress` | Resume y guarda las decisiones antes de perderlas, en vez de volver a averiguarlas |
| Revisar los cambios de una rama buscando defectos | `/code-review` | Ya instalada |
| Desplegar, publicar, o recompilar `dist` tras tocar código | `desplegar` | De este repositorio (`.claude/skills/desplegar`): los diez pasos, del `tsc` al sha en `/api/health`. Hecho a mano cinco veces en una semana, y cada vez se olvidó algo distinto |
| Una pantalla nueva o una que cambie de forma | `design:accessibility-review` | Ya instalada |

Las de este repositorio se cargan con `Skill`. Si una no existe, se dice y se sigue a mano: no se
inventa el nombre.

**Y una que no depende de que nadie se acuerde:** el gancho `PreToolUse` de `.claude/settings.json`
rechaza un `git commit` cuando el índice contiene la `0179` o un `.env`, y dice con qué línea
sacarlos. Está porque `git add -A apps/api/src` agrega la `0179` aunque esté sin seguir, y a partir
de ahí sólo lo nota quien mire la lista de archivos de un commit de `dist`.

---

## Dónde está lo ya averiguado

`auditoria-main/` (ignorado por git, presente en disco) tiene 17 documentos: el consolidado, uno por
módulo, el forense de la empresa activa, el de perfiles y áreas, las decisiones que sólo puede tomar
el dueño, el vocabulario pendiente y el análisis de repositorios externos.

**Mirar ahí antes de investigar de cero.** Casi todo lo que parece una pregunta nueva ya está medido.
