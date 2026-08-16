# Diagnóstico del bucle de primer acceso y plan de limpieza

Estado al 15 de agosto de 2026, con evidencia del log de producción.

---

## 1. El bucle de `/first-access`: causa encontrada

### El síntoma

Se restablece la contraseña, se entra, y la aplicación devuelve siempre a `/first-access` sin
completar nunca la activación.

### La causa, en el log

```
POST /api/auth/onboarding 400 372ms - La nueva contraseña debe ser diferente
```

No es un error de validación de campos. Es esta regla de `completeOnboarding`:

```ts
if (await bcrypt.compare(dto.newPassword, user.password)) {
  throw new BadRequestException('La nueva contraseña debe ser diferente');
}
```

**La secuencia que lo produce:**

1. Administración restablece la contraseña a `X`.
2. La persona entra con `X`.
3. El primer acceso le pide crear su contraseña y escribe `X`, que es la que acaba de recibir y
   la única que recuerda.
4. El servidor la rechaza porque es idéntica a la actual.
5. La activación no se completa, las marcas siguen encendidas, y el enrutador la devuelve a
   `/first-access`.

Cada intento repite el paso 3, y de ahí que se sienta como estar pegado.

### Que la regla exista está bien

Reutilizar la contraseña temporal anula el propósito del primer acceso: esa clave la conoce quien
la generó y viajó por correo. Lo que falla no es la regla, es que **la persona no entiende por qué
la rechazan** y vuelve a intentar lo mismo.

### Registrado: no lo introdujeron los cambios del 15 de agosto

El mismo error aparece en el log del **14 de agosto a las 23:57**, antes de cualquier cambio de
esa jornada. Es un comportamiento previo.

### Qué falta corregir

| | |
|---|---|
| El mensaje debe verse en la pantalla | Hay que confirmar que `FirstAccessPage` muestra el texto del 400 y no un error genérico |
| Decirlo antes, no después | El formulario puede avisar «no puede ser la misma que recibiste» antes de enviar |
| Nombrar la causa | «La nueva contraseña debe ser diferente **a la temporal que recibiste**» |

---

## 2. Otros hallazgos del mismo log

**Bloqueos por intentos fallidos, repetidos.** Varios `401 - Cuenta bloqueada... 15 minuto(s)`
sobre el mismo usuario. Es consistente con alguien reintentando tras el rechazo anterior. El
bloqueo bajó a **5 minutos** el 15 de agosto; los registros de 15 minutos son previos a ese
cambio.

**Caídas de arranque del 13 de agosto**, con dos causas distintas visibles:

```
apps/api/dist/config/load-environment.js:3     ← no encontró el entorno
typeorm/EntityMetadataValidator                ← metadatos de entidades inválidos
```

Ambas anteriores al 15 y ya no aparecen en los registros posteriores.

**`AH01276` sobre `public_html`** — cientos de entradas. Son rastreadores y bots pidiendo la raíz
del dominio, que no sirve índice. **Ruido, no un fallo**: la aplicación vive en `refugio` y
`cuartel`, no en `public_html`.

---

## 3. Plan de limpieza del repositorio

### Se puede borrar

**Dieciséis ramas locales `codex/*`.** Verificado por contenido, no por fecha:

- `codex/inode-policy` — el tope de 4000 archivos **está en el workflow de `main`**.
- `codex/corregir-migracion-contactos` — `0077-contacts-require-lead.ts` **existe en `main`**
  con su prueba.

Aparecen como pendientes porque al integrarlas se rebasaron o aplastaron: el contenido entró con
otro identificador, y git compara identificadores.

**Mezclarlas sería destructivo.** Son del 10–11 de agosto y `main` avanzó entre 70 y 88 commits
desde su base. Sus diffs muestran cientos de supresiones que son `main` retrocediendo.

```bash
git branch -D $(git branch --format='%(refname:short)' | grep '^codex/')
```

Quince de las dieciséis **también existen en GitHub**; el comando solo borra las locales. Eliminar
las remotas es otra decisión, irreversible, y no hace falta para limpiar la vista.

**Cinco copias del despliegue fuera del repositorio**, en la carpeta `final/`:

```
spartanoshub-deploy-1647814f       13 MB
spartanoshub-deploy-1647814f-v2    13 MB
spartanoshub-deploy-bridge
spartanoshub-deploy-build-2
spartanoshub-deploy-update
```

Las dos medidas son del 12 de agosto y su último commit es «Despliegue de 1647814»: **copias de
la rama `deploy`**, que Actions regenera en cada push. Antes de borrarlas conviene comprobar que
ninguna tenga commits propios sin subir.

### No se debe tocar

| | Por qué |
|---|---|
| Rama `deploy` | La sigue cPanel. Borrarla rompe el despliegue |
| `apps/*/dist` versionado | Es lo que ejecuta Passenger, por diseño: no se compila en el servidor |
| `spartanoshub-main-hotfix-2` | Es el repositorio de trabajo |

---

## 4. Recordatorio operativo

**Al cambiar backend y frontend a la vez, verificar el `dist`, no el `.ts`.** El 15 de agosto el
primer acceso devolvió 400 porque el navegador ya enviaba `termsVersion` y el `dist` de la API no
lo conocía: el código fuente estaba bien y lo que faltaba era compilarlo. Passenger ejecuta el
`dist`.

```bash
grep -c "termsVersion" apps/api/dist/core/auth/dto/onboarding.dto.js
```
