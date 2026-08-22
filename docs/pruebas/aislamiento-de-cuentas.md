# Aislamiento entre cuentas

La agencia vende servicios sueltos: hay empresas que solo llevan el CRM y otras que solo llevan
reservas. Entre ellas no comparten nada —ni datos, ni personas, ni pantallas—. El equipo interno
sí atraviesa varias, pero solo las que tiene asignadas.

Este documento recoge lo que se comprueba de forma automática, lo que resistió, y lo que hubo
que corregir porque no resistía.

## Cómo se ejecuta

```bash
npm run test:e2e --workspace @espartanos/api
```

Necesita MariaDB con una base `espartanos_test` migrada. Cada fichero arranca **la API de verdad**
en un puerto libre, contra esa base, y habla con ella por HTTP: recorre prefijo, validación,
guardias, permisos y consultas. No hay dobles, y se entra por el mismo inicio de sesión que
cualquiera.

> Las dos pruebas que antes vivían bajo `e2e` —`api.e2e.spec.ts` y `crud.e2e.spec.ts`— montaban
> un servidor de mentira con `createServer` y comprobaban que ese servidor devolvía lo que ellas
> mismas habían programado. Pasaban aunque el CRM entero estuviera roto. Se eliminaron.

## Las tres rejas

Un dato es visible solo si las tres dejan pasar. Son independientes y hacen falta las tres:

| Reja | Pregunta que responde | Dónde vive |
| --- | --- | --- |
| **Rol** | ¿Este cargo alcanza este módulo? | `role-permissions.ts` + `PermissionGuard` |
| **Cuenta** | ¿Esta persona alcanza esta empresa? | `AccountAccessService` |
| **Capacidad** | ¿Esta empresa contrató este servicio? | `ClientCapabilityService` |

El nivel se deriva del método: `GET` exige `view`, `POST`/`PUT`/`PATCH` exigen `edit`, `DELETE`
exige `manage`.

## El escenario

Una organización —la agencia— con cuatro empresas cliente:

| Empresa | CRM | Reservas |
| --- | --- | --- |
| `crmUno` | sí | no |
| `crmDos` | sí | no |
| `reservasUno` | no | sí |
| `reservasDos` | no | sí |

Y seis cuentas: `dev`, `admin`, dos del equipo (`community_manager`) con asignaciones distintas,
y dos portales de cliente atados a su empresa.

## Lo que se comprueba (31 pruebas)

### Entre cuentas

- El equipo ve solo lo asignado: con una cuenta cada uno, ninguno ve los leads del otro.
- Pedir una cuenta ajena por `?clientId=` no devuelve sus leads.
- Un lead ajeno responde `404` —no `403`— al leerlo y al modificarlo. Decir que existe ya es
  contar algo.
- Escribir en una cuenta ajena no cambia nada: se comprueba en la base después del intento.
- Mover un lead propio no toca ninguno de otra cuenta: ni su estado ni su fecha de modificación.
- Los dos embudos no se mezclan en ninguna dirección.

### Por empresa

- Los contactos importados quedan en la empresa elegida y no aparecen en otra.
- No se puede importar a una empresa que no se alcanza, y no se escribe ni una fila.
- El inicio y el panel cuentan por empresa: con dos empresas distintas dan cifras distintas.
- Los avisos del inicio nombran solo contactos de la empresa elegida.
- Mover un contacto de una empresa no cambia las cifras de la otra.
- El recorrido de un contacto queda en su lead: ninguna empresa vecina acumula pasos.

### Reservas

- Cada empresa ve sus reservas y no las de la vecina.
- El portal de un local no ve las reservas de otro.
- Una reserva no aparece como lead en el CRM de ninguna empresa.
- Estar asignado al CRM de una empresa no da acceso a las reservas de un local.
- Crear una reserva no crea ningún lead.

### Portal del cliente

- Ve los contactos de su empresa, y solo los de su empresa.
- No ve el embudo comercial de la agencia.
- **Mira pero no mueve**: no puede cambiar la etapa de un contacto.
- Una empresa que no contrató CRM no lo ve desde su portal.

## Lo que hubo que corregir

### 1. La capacidad `crm` no se aplicaba en ninguna parte

`clients.capabilities` distingue `crm` y `reservations` por empresa, pero **solo reservas lo
comprobaba**. Una empresa que contrató únicamente reservas acumulaba leads en un CRM que no
tiene, mezclados con los de las que sí lo llevan.

Se añadió `ClientCapabilityService` y se aplica en el listado, la importación, el cambio de
empresa de un lead, el inicio y el panel. Pedir el CRM de una empresa que no lo contrató responde
`403` **nombrando el servicio**: quien lo lee tiene que poder distinguir «no lo contrataste» de
«no tienes permiso», que se arreglan de formas distintas.

Sin empresa elegida, la lista se acota a las que sí lo tienen en vez de negar todo. El embudo
comercial queda fuera de esta reja: sus prospectos no tienen empresa, y la agencia no se contrata
servicios a sí misma.

### 2. El portal del cliente no alcanzaba su propio CRM

El rol `client` no tenía el módulo `crm`: una empresa que contrató CRM recibía «no tienes acceso
a este módulo» sobre datos que son suyos.

Se abrió en **solo lectura** (`crm: 'view'`). En qué etapa está cada contacto y quién lo trabaja
son decisiones del equipo; dejar que el cliente las mueva convertiría su portal en un segundo
puesto de mando sobre el trabajo de la agencia. Las otras dos rejas siguen puestas: el alcance
por cuenta lo limita a su empresa y la capacidad a que esa empresa tenga CRM.

### 3. El límite de acceso es por dirección de origen, no por persona

`/auth/login` acepta cinco intentos por minuto **por IP**. Una oficina entera comparte una sola
salida a internet: con el equipo llegando a la misma hora, al sexto le responde `429` y lo lee
como que el sistema está caído.

Se conserva el valor de siempre como predeterminado —bajarlo protege contra el probador de
contraseñas— y se hizo ajustable con `AUTH_THROTTLE_LIMIT`.

### 4. El panel del CRM respondía con error del servidor a quien no dirige

La matriz de acceso lo destapó: `GET /crm/home/dashboard` devolvía **500** a un community
manager. El alcance por persona viajaba dentro del mismo objeto que la organización, el embudo y
la empresa, y cuatro de las cifras del panel se cuentan con un criterio por columnas: `assignedTo`
sí es columna, pero la clave que lo transportaba no, y la consulta reventaba.

No lo veía nadie porque las pruebas anteriores usaban cargos que dirigen, y para esos el panel no
lleva ese alcance. La corrección separa las dos cosas en un solo sitio del servicio.

### 5. Cada ejecución de las pruebas dejaba su API viva

En Windows, `npx` levanta un intérprete que a su vez levanta node: matar el padre deja al hijo
escuchando. Se acumularon **noventa procesos** en una tarde, consumiendo conexiones hasta que la
base dejaba de dar más y las pruebas fallaban por un motivo ajeno a lo que probaban. Ahora se
cierra el árbol completo.

## Pendiente

- Reservas creadas desde el **formulario público**, que exige un formulario publicado con su
  horario. Las pruebas actuales siembran la reserva directamente.
- El panel general de la lateral (`/reporting/dashboard`) por empresa.
- Aprobaciones, contenido y reuniones: las mismas tres rejas, sin cubrir todavía.
