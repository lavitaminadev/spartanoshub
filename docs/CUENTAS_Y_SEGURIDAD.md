# Cuentas, roles y seguridad de los formularios

Estado al 15 de agosto de 2026. Qué existe, qué falta, y qué hay que decidir.

---

## 0. Una sola organización — corrección importante

**EspartanosHub tiene una organización: La Vitamina / Espartanos.** Los clientes que la agencia
administra son **datos**, no organizaciones.

`organizationId` existe como columna en casi todas las tablas y siempre tiene el mismo valor. Es
una separación técnica que aísla los datos por si algún día hubiera otra agencia, no una función
del producto. **Hablar de «cada organización» al describir el sistema induce a error**: hace
pensar que hay un panel donde se administran varias, y no lo hay.

La forma correcta de decirlo:

| En vez de | Decir |
|---|---|
| «el catálogo de cada organización» | «el catálogo de la agencia» |
| «configuración por organización» | «configuración de la agencia» |
| «los clientes de la organización» | «los clientes que la agencia administra» |

Lo que sí es por cliente: presupuesto de unidades, formularios de reserva, piezas, cuentas de
portal. Eso está bien modelado y no cambia.

---

## 1. Cuentas de cliente: cuántos usuarios por empresa

### Qué existe

Un usuario con cargo `client` se vincula a una empresa por `clientId`. Al crearlo:

- Es obligatorio indicar la empresa (`Las cuentas cliente requieren una empresa asignada`).
- Se verifica que esa empresa exista.

### No hay límite de usuarios por empresa

Revisado: **nada impide crear dos, tres o diez cuentas para la misma empresa.** No hay validación
de cantidad en ninguna parte.

**Esto es correcto y debe quedarse así.** Una empresa cliente puede tener a su gerente de
marketing y a su encargado de redes, y ambos necesitan entrar. Poner un límite obligaría a
compartir una contraseña, que es exactamente lo que no se quiere: si dos personas usan la misma
cuenta, la bitácora no puede decir quién aprobó una pieza.

### Lo que sí falta decidir

| Pregunta | Por qué importa |
|---|---|
| ¿Todos los usuarios de una empresa ven lo mismo? | Hoy sí. Un gerente y un asistente ven idéntico |
| ¿Cualquiera puede aprobar piezas? | Hoy sí, si tiene cargo `client` |
| ¿Alguien de la empresa administra a los demás? | Hoy no: solo Espartanos crea cuentas de cliente |

**Recomendación**: dejarlo sin límite y sin jerarquía por ahora. Agregar «quién de la empresa
puede aprobar» solo cuando un cliente lo pida — inventar una jerarquía que nadie pidió agrega una
pantalla que nadie usa.

---

## 2. Creación de cuentas: qué se pide y quién lo llena

### El principio, que ya está bien implementado

**Espartanos aporta solo lo que le consta. La persona completa el resto al entrar.**

Al crear una cuenta, Administración indica:

| Campo | Obligatorio | Por qué |
|---|---|---|
| Nombre | Sí | Para saber a quién se invita |
| Correo | Sí | Es por donde llega la invitación, y es la identidad |
| Contraseña inicial | Sí | Se reemplaza al primer ingreso |
| Cargo | No (por defecto diseñador) | |
| Teléfono | No | Dato personal: lo pone su dueño |
| Empresa | Solo para cuentas de cliente | |

La cuenta nace **a medias a propósito**, con tres marcas:

```
mustChangePassword  → pone su propia contraseña
mustCompleteProfile → completa sus datos
mustAcceptTerms     → acepta las condiciones vigentes
```

El enrutador las respeta: mientras alguna esté encendida, cualquier ruta redirige a
`/first-access`. Verificado en `router.tsx`, `ProtectedRoute.tsx` y `ClientRoute.tsx`.

**Esto está bien y no hay que cambiarlo.** Que Administración no cargue el teléfono de nadie no
es una omisión: es que ese dato le pertenece a su dueño y debe entrarlo él.

### Lo que falta verificar

`FirstAccessPage` existe y el enrutador la fuerza, pero **no se revisó qué campos pide ni cuáles
marca como obligatorios**. Es la pantalla donde se decide qué datos personales se piden, así que
merece una revisión propia antes de dar por cerrado el flujo.

Pendiente concreto: listar los campos de `FirstAccessPage` y decidir cuáles son obligatorios,
distinguiendo cuenta de equipo de cuenta de cliente.

---

## 3. Seguridad de los formularios

### Inyección SQL

**No hay superficie de inyección en las consultas de la aplicación.** Todo pasa por TypeORM con
parámetros vinculados. Las pocas consultas con SQL escrito a mano usan marcadores:

```ts
await queryRunner.query('INSERT IGNORE INTO piece_type_definitions (...) VALUES (UUID(), ?, ?, ...)',
  [organization.id, type, PIECE_TYPE_LABELS[type], ...]);
```

El valor nunca se concatena en el texto de la consulta. Una comilla en un nombre de tipo de pieza
viaja como dato y no como instrucción.

### Validación de entrada

Un `ValidationPipe` global con tres opciones que importan:

- `whitelist` — descarta cualquier campo no declarado en el DTO.
- `forbidNonWhitelisted` — además **rechaza la petición** si trae campos de más.
- `transform` — convierte los tipos antes de que el código los toque.

Consecuencia práctica: mandar `{ "role": "admin" }` a un endpoint que no lo declara no escala
privilegios, devuelve error.

### Contraseñas

- Mínimo 8 caracteres, con mayúscula, minúscula y número.
- `bcrypt` con las rondas de `BCRYPT_ROUNDS`.
- Nunca se devuelve el campo en las respuestas.

### Cargos y atribuciones

- Un Director de Operaciones **no puede crear administradores** ni otros directores de operaciones.
- **Un solo cargo `dev`** por instalación, y solo Administración lo asigna.
- Los guards son globales (`APP_GUARD`): un endpoint sin módulo declarado **se rechaza**, no se
  abre. Verificado en la práctica esta misma sesión: los comentarios de proceso devolvieron
  «Este endpoint no tiene módulo declarado» hasta que se declaró.

Ese último comportamiento —cerrado por defecto— es lo que hace que olvidar una anotación falle
de forma visible en vez de dejar un endpoint abierto.

### Lo que no se revisó

- Límite de intentos de inicio de sesión.
- Caducidad y renovación de sesiones (existe `SessionsPage`, no se auditó).
- Subida de archivos: qué tipos se aceptan y qué se valida.

---

## 4. ¿Están listas las vistas de todo el flujo?

**No.** Con precisión:

| Vista | Estado |
|---|---|
| Tablero de producción | Componente construido y probado, **no conectado a la pantalla** |
| Tablero de audiovisual | Columnas declaradas, sin datos que las llenen |
| Comentarios de proceso | Backend completo y probado, **sin interfaz** |
| Catálogo de tipos de pieza | Backend completo, **sin pantalla de administración** |
| Cancelar pieza | Backend completo, **sin botón** |
| Selector de área (lente) | Lógica construida, **sin control en la barra** |
| Configuración básica/avanzada | Backend clasifica, **la pantalla aún no agrupa** |

El patrón es el mismo en todo: **el backend está terminado, probado y verificado; la interfaz que
lo expone no está construida.** Lo que hay son las piezas correctas sin ensamblar.

Es una situación sana —lo difícil y lo que cuesta corregir después ya está bien— pero hay que
nombrarla como es: **el sistema hace estas cosas, y todavía no hay dónde apretar para pedirlas.**
