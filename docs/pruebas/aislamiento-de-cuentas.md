# Aislamiento entre cuentas

La agencia vende servicios sueltos: hay empresas que solo llevan el CRM y otras que solo llevan
reservas. Entre ellas no comparten nada —ni datos, ni personas, ni pantallas—. El equipo interno
sí atraviesa varias, pero solo las que tiene asignadas.

Este documento recoge lo que se comprueba de forma automática, lo que resistió y los huecos que
la prueba destapó.

## Cómo se ejecuta

```bash
npm run test:e2e --workspace @espartanos/api
```

Necesita MariaDB con una base `espartanos_test` migrada. Las pruebas arrancan **la API de
verdad** en el puerto 3111, contra esa base, y hablan con ella por HTTP: recorren prefijo,
validación, guardias, permisos y consultas. No hay dobles.

> Las dos pruebas que antes vivían bajo `e2e` —`api.e2e.spec.ts` y `crud.e2e.spec.ts`— montaban
> un servidor de mentira con `createServer` y comprobaban que ese servidor devolvía lo que ellas
> mismas habían programado. Pasaban aunque el CRM entero estuviera roto.

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

Cada cuenta entra por el mismo inicio de sesión que cualquiera. No se firma ningún token a mano:
hacerlo saltaría el propio acceso, que también es parte de lo que se comprueba.

## Lo que resistió

- **El equipo ve solo lo asignado.** Con una cuenta cada uno, ninguno ve los leads del otro.
- **Pedir una cuenta ajena por parámetro no la abre.** `?clientId=` de otra empresa no devuelve
  sus leads.
- **El identificador no es una puerta.** Un lead ajeno responde `404` —no `403`— al leerlo y al
  modificarlo. Decir que existe ya es contar algo.
- **Escribir en una cuenta ajena no cambia nada.** Tras el intento, el estado del lead sigue
  siendo el que era.
- **Mover un lead propio no toca ninguno de otra cuenta**: ni su estado ni su fecha de
  modificación.
- **Los dos embudos no se mezclan.** Un prospecto de la agencia no aparece en el CRM de una
  empresa, y un contacto de campaña no aparece en el embudo comercial.
- **El portal de una empresa no ve reservas de otra.**

## Huecos encontrados

### 1. La capacidad `crm` de una empresa no se comprueba en ninguna parte

`clients.capabilities` distingue `crm` y `reservations` por empresa. **Solo reservas la
comprueba** (`reservations.service.ts`). El CRM no la mira: una empresa que contrató únicamente
reservas acumula leads en el CRM igual que cualquier otra, y aparecen para quien tenga la cuenta
asignada.

No es una fuga entre clientes —cada lead sigue en su empresa— pero sí una capacidad que se cobra
y no se aplica.

### 2. El portal del cliente no alcanza su propio CRM

El rol `client` no tiene el módulo `crm` en la matriz de permisos. Una empresa que contrató CRM
**no puede ver el suyo** desde su portal: responde `403`.

Abrirlo es una decisión de producto, no un arreglo: el CRM muestra montos estimados, responsables
internos y notas del equipo. Si se abre, hay que decidir antes qué parte de la ficha ve el
cliente. La prueba deja escrito el comportamiento de hoy para que el día que se cambie, sea con
el filtro por cuenta puesto.

### 3. El límite de acceso es por dirección de origen, no por persona

`/auth/login` acepta cinco intentos por minuto **por IP**. Una oficina entera comparte una sola
salida a internet: con el equipo llegando a la misma hora, al sexto le responde `429` y lo lee
como que el sistema está caído.

Se conserva el valor de siempre como predeterminado —bajarlo protege contra el probador de
contraseñas— y se hizo ajustable con `AUTH_THROTTLE_LIMIT` para las instalaciones donde ese
reparto no dé.

## Pendiente de cubrir

- Importación de un archivo real de leads a la cuenta correcta.
- Reservas creadas desde el formulario público y su llegada al CRM de la empresa correspondiente.
- Que las acciones del CRM de una empresa no aparezcan en la bitácora ni en los avisos de la
  cuenta principal.
- El panel y el inicio del CRM por empresa, con las cifras acotadas.
