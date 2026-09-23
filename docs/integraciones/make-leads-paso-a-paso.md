# Leads de Meta al CRM con Make, paso a paso

Esta guía deja un escenario de Make entregando los leads de un formulario instantáneo al CRM.
Está escrita para hacerse una vez por campaña y sin saber programar.

Al terminar, cada persona que complete el formulario aparece en el CRM en menos de un minuto,
con sus respuestas en los campos que se puedan filtrar y contar.

---

## Antes de empezar

Hay que tener a mano cuatro cosas. Si falta alguna, se consigue antes de abrir Make:

1. **Acceso a la página de Facebook** del cliente, con permiso para ver sus formularios.
2. **La campaña creada en el CRM**, en CRM → Campañas. La llave se genera ahí y es la que decide
   a qué empresa entra cada lead.
3. **Una cuenta de Make.** El plan gratuito alcanza: son dos operaciones por lead.
4. **El nombre exacto de las preguntas del formulario**, como las escribió quien armó el anuncio.

---

## Paso 1 · Crear la cuenta de Make

1. Entrar a [make.com](https://www.make.com) y crear la cuenta con el correo de la agencia, no
   con uno personal: un escenario atado a una cuenta personal se cae cuando esa persona se va.
2. Al elegir región, quedarse con la que Make proponga y **anotarla**: aparece en la dirección
   (`eu1.make.com`, `us1.make.com`) y los escenarios exportados de una región se importan en la
   misma.
3. Confirmar el correo y entrar.

## Paso 2 · Sacar la llave del CRM

1. En el CRM, ir a **Campañas** y abrir la campaña que va a recibir los leads.
2. Crear una llave de entrada. **Se muestra una sola vez**: copiarla y guardarla en el
   administrador de contraseñas antes de cerrar la ventana.
3. Si se perdió, no se recupera: se rota y se cambia en Make. La anterior deja de servir.

La llave ata los leads a **una empresa y una campaña**. Por eso hay una por campaña, y por eso
no hay que escribir el nombre de la campaña en Make: si se escribe distinto, manda la llave.

## Paso 3 · Importar el escenario

1. En Make, **Scenarios → Create a new scenario**.
2. Arriba a la derecha, los tres puntos → **Import Blueprint**.
3. Elegir el archivo `.json` del escenario y confirmar.

Quedan tres módulos: el disparador de Facebook, el detalle del lead y el envío al CRM.

## Paso 4 · Conectar Facebook

1. Abrir el primer módulo, **Nuevo lead de Facebook**.
2. En *Connection*, **Add** y entrar con la cuenta de Facebook que administra la página.
3. En *Webhook*, **Add**, elegir la **página** y el **formulario**, y guardar.
4. Abrir el segundo módulo, **Detalles del lead**, y elegir la misma página y el mismo
   formulario.

> La conexión guarda un permiso de esa persona. Si deja de administrar la página, el escenario
> se detiene: conviene usar una cuenta de la agencia con acceso estable.

## Paso 5 · Poner la llave en el envío

1. Abrir el último módulo, **Enviar al CRM**.
2. En *Credentials*, **Add**:
   - **Name**: el nombre de la campaña, para reconocerla después.
   - **Key**: `Authorization`
   - **Value**: `Bearer ` seguido de la llave del Paso 2. El espacio después de `Bearer` importa.
   - **Placement**: `Header`.
3. Guardar.

## Paso 6 · Probar con un lead de verdad

1. En Facebook, abrir la **Herramienta de pruebas de formularios instantáneos**, elegir el
   formulario y enviar un lead de prueba.
2. En Make, **Run once** y comprobar que los tres módulos quedan en verde.
3. En el CRM, el lead aparece en su campaña.

Si el envío responde `401`, la llave está mal copiada o le falta `Bearer `.
Si responde `400`, el cuerpo va incompleto: casi siempre falta el nombre.

## Paso 7 · Dejarlo andando

1. Abajo a la izquierda, activar **Scheduling**.
2. Dejarlo en **Immediately**: el disparador es instantáneo y esperar no aporta nada.
3. Guardar.

---

## Que las respuestas llenen campos y no un texto

Las respuestas del formulario llegan siempre, pero para **filtrarlas y contarlas** tienen que
caer en un campo propio.

1. En el CRM: **Administración → Campos propios → Leads → Agregar campo**.
2. Crear un campo por pregunta que se quiera medir. En *Preguntas de Meta que llenan este campo*,
   pegar el enunciado tal como está en el anuncio, uno por línea.
3. Si el formulario cambia de redacción, se agrega la nueva línea sin borrar la anterior: los
   leads viejos siguen encontrando su campo.

No importan tildes, mayúsculas ni guiones bajos: `he_invertido_en_negocios_pequeños` calza con
la opción escrita «He invertido en negocios pequeños». Un valor que no corresponda al tipo del
campo se queda en las notas del lead en vez de guardarse mal.

---

## Qué hacer cuando algo falla

| Lo que se ve | Qué pasó |
|---|---|
| `401` en el envío | La llave está mal, revocada, o falta `Bearer ` adelante |
| `400 Falta el nombre` | El formulario no trae nombre, o el módulo no lo mapeó |
| `429` | Demasiados envíos por minuto. Make reintenta solo |
| El lead entra sin campaña | La llave es antigua y no la lleva: rotarla en el CRM |
| Leads repetidos en la planilla | Make reintentó. **En el CRM no se duplican**: se reconocen por su id |
| El escenario se detuvo | Casi siempre la conexión de Facebook caducó: volver a conectarla |

## Qué revisar una vez al mes

- Que el escenario siga activo y sin errores acumulados en su historial.
- Que las preguntas del formulario no hayan cambiado de redacción.
- Que los leads del mes calcen con lo que muestra el administrador de anuncios.
