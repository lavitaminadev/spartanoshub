# Antes de mostrar

Diez minutos, en orden. Si un paso falla, **no sigas al siguiente**: cada uno depende del anterior.

---

## 0. Si no puedes entrar

Solo si la aplicación te responde «sin autorización» en el inicio o `PUT /settings` da 403.
Significa que un módulo quedó escondido y se llevó consigo la pantalla que lo arregla.

En phpMyAdmin:

```sql
DELETE pv FROM parameter_values pv
JOIN parameter_definitions pd ON pd.id = pv.definition_id
WHERE pd.`key` LIKE 'modules.lifecycle.%';
```

Todos los módulos vuelven al catálogo, que es **activo**. Cierra sesión y entra de nuevo.

---

## 1. Desplegar

En cPanel → Git Version Control:

1. **Update from Remote**
2. Comprueba que *HEAD Commit* diga «Despliegue de …» con el commit que esperas
3. **Deploy HEAD Commit**

Ese último clic corre las migraciones pendientes. Son aditivas: crean tablas y columnas, ninguna
borra ni reescribe.

**Verificación:** *Last Deployed SHA* debe coincidir con *HEAD Commit*. Si no coinciden, bajaste
el código pero no lo desplegaste.

---

## 2. Dejar solo lo que se va a mostrar

Entra como **desarrollo**. En **Accesos y seguridad → 02 Módulos**, elige según lo que vayas a
mostrar:

| Botón | Deja encendido | Cuándo |
| --- | --- | --- |
| **Dejar solo el CRM** | inicio, configuración, informes, CRM, clientes, usuarios | Solo vas a mostrar el CRM |
| **CRM + portal + operaciones** | lo anterior más aprobaciones, contenido, reuniones, operaciones y reservas | Vas a mostrar también la vista del cliente |

Después, **recarga la página** — el menú se arma con el perfil que tiene tu navegador, no con lo
que el servidor acaba de guardar.

**Verificación con «Dejar solo el CRM»:** la lateral debe quedar en cinco entradas.

> Inicio · CRM · Clientes · Usuarios · Accesos y seguridad

Si ves algo más, no recargaste.

Los módulos del segundo preajuste están medidos sobre lo que esas pantallas piden de verdad: el
portal consulta aprobaciones, contenido, reuniones e informes mensuales, y su inicio monta el
pulso; operaciones consulta su resumen, objetivos, clientes y usuarios. Uno de menos no se nota
al preparar la demostración: se nota al abrir la pantalla delante de alguien.

> Si necesitas apagar algo puntual, usa el interruptor **«Acceso organización»** de cada tarjeta,
> nunca el estado del producto. «En desarrollo» esconde el módulo del equipo pero **no de ti**, así
> que desde tu sesión parece que no hizo nada.

---

## 3. Comprobar el CRM con datos reales

Esto es lo único que no se pudo verificar antes de desplegar, y es lo primero que hay que mirar.

1. Entra al CRM. Con **Espartanos** en el selector debes ver los prospectos de la agencia.
2. Cambia el selector a una empresa cliente.
3. **Las cifras del Inicio deben cambiar**, y el encabezado debe decir el nombre de esa empresa.

**Si no cambian**, el selector no está llegando al servidor: muestra el CRM con una sola empresa
elegida y no lo cambies durante la demostración.

Recorre las seis pestañas: Inicio · Tablero · Leads · Dashboard · Calendario · Administración.
Ninguna debe dar error.

---

## 4. La llave de entrada

En **CRM → Administración → Campañas e inversión**:

1. **+ Nueva campaña**
2. Nombre: el mismo que trae la campaña en Meta
3. **Fuente: `meta_lead_ads`** — este valor importa: es lo que evita que el mismo lead entre dos
   veces cuando se encienda el camino directo de Meta
4. Guardar

La pantalla muestra **una sola vez** la dirección, la cabecera y el cuerpo. Cópialos ahí mismo: la
llave no se guarda en claro y no hay dónde volver a verla. Si se pierde, se rota y se reconfigura.

---

## 5. La importación

**Con diez filas primero**, nunca con el archivo completo.

En **CRM → Leads → Importar CSV**:

- Elige el embudo: *Contactos de campaña* para leads de un cliente, *Prospectos* para los de la agencia
- Elige la cuenta
- Revisa la vista previa antes de confirmar

**Verificación:** los diez aparecen en la lista, con la empresa correcta. Recién entonces sube el
archivo completo.

---

## Lo que NO hay que tocar

- **El camino directo de Meta** (`/webhooks/meta`). Todavía no asigna cuenta ni embudo: los leads
  entrarían sin empresa y al embudo equivocado. Ver `docs/integraciones/meta-lead-ads.md`.
- **El dashboard general** (el de la lateral). No responde por empresa: muestra la organización
  completa. Para mostrar cifras, usa el Dashboard **dentro** del CRM.
- **El ciclo de vida de los módulos.** Para apagar algo, el interruptor de organización.

---

## Si algo falla en vivo

Casi todo lo que se ve como avería es configuración:

| Síntoma | Causa habitual |
| --- | --- |
| «No tienes acceso a este módulo» | Ese módulo está apagado. Enciéndelo y **recarga** |
| El menú ofrece algo que luego niega | El perfil del navegador quedó viejo. **Recarga** |
| Una sección del CRM abre error | Falta uno de los seis módulos que el CRM necesita |
| Cambiar de empresa no cambia nada | Estás en el dashboard general, no en el del CRM |

**Recargar la página arregla más de lo que parece**, porque el menú vive en el navegador y la
autorización vive en el servidor.
