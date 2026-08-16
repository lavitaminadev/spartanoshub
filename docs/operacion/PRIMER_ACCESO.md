# Primer acceso: estado, cambios y riesgos

Rama `fix/first-access-hardening`. Estado al 15 de agosto de 2026.

---

## El flujo, tal como debe funcionar

```
LOGIN con clave temporal
  → /first-access
  → datos personales
  → leer y aceptar las cinco condiciones
  → crear contraseña
  → POST /auth/onboarding
  → se revocan las sesiones anteriores
  → /login?reason=first-access-complete
  → LOGIN con la contraseña nueva
  → /dashboard  (o /portal si es cuenta de cliente)
```

**Volver al login es intencional, no un defecto.** Al activar la cuenta se revocan las sesiones,
incluida la que se estaba usando: entrar directo al panel con el token anterior significaría
seguir usando una sesión abierta con la contraseña temporal.

---

## Cambios aplicados

### 1. Ventana propia para la activación

**Antes:** completar el primer acceso exigía autenticación reciente con la misma ventana que las
operaciones sensibles, quince minutos.

**El problema:** se le pide a la persona leer cinco condiciones. Quien las lee de verdad tarda
más de quince minutos, llega a crear su contraseña y recibe *«Tu sesión de activación expiró»*.
Queda fuera de una cuenta que acaba de recibir, y el sistema la castiga justamente por hacer lo
que se le pidió.

**Ahora:** `ONBOARDING_AUTH_WINDOW_MINUTES = 60`, independiente.

**Por qué no se amplió el valor global:** `REAUTH_WINDOW_MINUTES = 15` protege operaciones
sensibles sobre cuentas ya activas, donde una ventana corta es la protección y no un estorbo. Son
dos riesgos distintos y ahora son dos números distintos.

### 2. La versión aceptada es la que se mostró

**Antes:** el navegador mostraba su texto y el servidor registraba la versión vigente, sin
compararlas.

**El problema:** si la versión cambia con el formulario abierto, se registra que alguien aceptó un
texto que **nunca vio**. No es un desajuste cosmético: ante un reclamo no hay forma de demostrar
qué leyó.

**Ahora:** el navegador declara `termsVersion`; si no coincide con la vigente, el servidor
responde **409 y no escribe nada**. Cubre los dos caminos: `POST /auth/onboarding` y
`POST /auth/terms/accept`.

En la pantalla, un 409 limpia las aceptaciones —para que nadie confirme sin leer lo que quedó
vigente— y recarga, porque el texto viene compilado y sin recargar el rechazo se repetiría.

**El campo es opcional** en ambos extremos: un cliente que aún no lo envía sigue funcionando como
antes.

### 3. La transacción ya estaba bien

Contraseña, perfil y consentimientos se guardan dentro de una sola transacción. **No se tocó.**
Queda cubierta por la prueba de que un rechazo por versión no escribe ninguno de los dos.

---

## Lo que NO se tocó, a propósito

- Esquema de la base. **Ninguna migración**: nada de esto la necesitaba.
- Revocación de sesiones al activar.
- `MAX_FAILED_LOGIN_ATTEMPTS`, el bloqueo temporal, bcrypt.
- La separación entre 401 (autenticación) y `/first-access` (estado de la cuenta).
- El CSS de `auth.css` corregido en `main`.
- El flujo de despliegue por GitHub Actions.

---

## Verificación

```
test:api     553 pasando (78 archivos)
test:web      75 pasando (12 archivos)
lint:api      sin errores
build:web     correcto
```

Pruebas agregadas: la ventana de activación se mide con su propio plazo y es mayor que la de
reautenticación; una versión distinta es rechazada sin escribir; una versión coincidente se
acepta; un cliente sin versión declarada sigue funcionando. Lo mismo para la re-aceptación.

---

## Riesgos que quedan

### Alto — ninguno

### Medio

**El recorrido completo no se ejecutó contra un servidor.** Las pruebas son unitarias con dobles.
Los puntos 13 y 14 del encargo —login, activar, volver a entrar, contraseña vieja 401, nueva 200,
y las regresiones de bloqueo, refresh y reset— **no se corrieron**. Es lo primero a hacer en la
revisión de flujos.

**Al subir `TERMS_VERSION` hay que subir también `compliance.terms_version`.** Si solo se cambia
una, nadie puede aceptar hasta que coincidan. Es deliberado —preferible a registrar aceptaciones
de un texto equivocado— pero hay que saberlo antes de editar los textos. Queda anotado en el
propio archivo.

**La recarga del 409 asume que hay un despliegue nuevo.** Si la versión del parámetro se sube sin
desplegar el texto, la recarga trae el mismo paquete y el rechazo se repite. El aviso lo explica,
pero no se resuelve solo.

### Bajo

**El progreso del formulario sigue en memoria.** Un F5 borra nombre, teléfono y aceptaciones. El
punto 4 del encargo (`sessionStorage`) **no se implementó**: toca `FirstAccessPage`, el mismo
archivo cuyo CSS se acaba de corregir, y se prefirió no acumular cambios ahí sin revisión.

---

## Para la revisión de flujos

Vale la pena verificar a mano, en este orden:

1. Activar una cuenta **tardando más de veinte minutos** entre el ingreso y la contraseña. Antes
   fallaba; ahora debe completarse.
2. Contraseña vieja → 401. Contraseña nueva → 200 y panel.
3. Cinco intentos fallidos → bloqueo temporal.
4. Cuenta de cliente → `/portal`, no `/dashboard`.
5. Renovación de condiciones → pide aceptar, **sin** obligar a cambiar la contraseña otra vez.
