# El motor de base de datos

**Spartanoshub se valida y despliega sobre MariaDB 11.4.** Las migraciones generan columnas
`uuid` nativas, y la integración continua debe usar ese mismo motor y versión de referencia.

| Entorno | Motor |
| --- | --- |
| Producción (cPanel) | MariaDB |
| Integración continua | `mariadb:11.4` |
| Desarrollo local | MariaDB 11.4 |
| Pruebas de extremo a extremo | MariaDB 11.4, base `espartanos_test` |

---

## Por qué no es intercambiable

Las migraciones declaran `type: 'uuid'` en 28 archivos, empezando por la primera
—`0001-create-organizations`—, así que no es un detalle de una tabla lateral: sin ese tipo no se
crea ni la primera tabla.

El SQL que TypeORM emite es literalmente:

```sql
CREATE TABLE `users` (
  `id` uuid NOT NULL,
  `organization_id` uuid NOT NULL,
  ...
)
```

**`uuid` es un tipo nativo de MariaDB desde la versión 10.7.** No es un alias de `varchar` ni un
adorno: la columna se almacena como `DATA_TYPE = 'uuid'`.

### Por qué se emite `uuid` y no `varchar`

Esto confunde al leer el código, así que conviene dejarlo escrito. TypeORM tiene dos caminos y
solo uno convierte el tipo:

- **Entidades.** `MysqlDriver.normalizeType()` degrada `uuid` a `varchar` salvo que las opciones
  declaren `type: "mariadb"`. Este repositorio declara `type: 'mysql'`, así que por esta vía
  saldría `varchar`.
- **Migraciones.** No pasan por ahí. Declaran el tipo directo en `TableColumn`, y como `uuid`
  figura en `supportedDataTypes` del driver, el `QueryRunner` lo emite tal cual.

**El esquema lo crean las migraciones.** Por eso manda el segundo camino.

> No cambies el driver a `mariadb` «para que quede coherente». `mysql` es el driver correcto para
> hablar con MariaDB, y cambiarlo alteraría cómo se generan las entidades sin arreglar nada.

---

## Qué está comprobado y qué no

**Comprobado**, ejecutado sobre MariaDB 11.4.3 el 23-08-2026:

- Migraciones desde una base vacía: **95 aplicadas, 87 tablas, 228 columnas `uuid` nativas.**
- `CREATE TABLE prueba_uuid (id uuid NOT NULL, PRIMARY KEY (id))` → aceptado, almacenado como
  `DATA_TYPE = uuid`.
- El volcado de producción trae `` `id` uuid NOT NULL ``: producción y una migración limpia
  coinciden.

**No comprobado.** No se ha ejecutado el esquema contra MySQL 8 ni contra MariaDB 12, así que
este documento no afirma cómo fallan. La razón para fijar el motor no es esa: es que **CI debe
reproducir producción**, y producción es MariaDB con `uuid` nativo. Cualquier motor que no lo
soporte no puede levantar el esquema, y averiguar de qué forma exacta se rompe no aporta nada.

---

## La anomalía de `espartanos_dev`

La base local de desarrollo `espartanos_dev` tiene esas mismas columnas en **`varchar(36)`**, no
en `uuid`. Se creó por otra vía —no ejecutando las migraciones— y quedó desalineada.

> **`espartanos_dev` no es referencia de esquema.** No coincide con producción ni con una
> migración limpia. Ante cualquier duda sobre cómo debe quedar una tabla, la respuesta se obtiene
> ejecutando las migraciones sobre una base vacía, nunca mirando esa base.

Es una anomalía sin consecuencias en producción, pero costó una conclusión equivocada: llevó a
afirmar que el esquema usaba `varchar`, cuando el esquema real —el que crean las migraciones y el
que corre en producción— usa `uuid`.

Para realinearla:

```bash
npm run migration:run
```

sobre una base recién creada, en vez de restaurar un volcado antiguo.

---

## Comprobarlo tú mismo

```bash
node -e "require('dotenv').config({quiet:true});const m=require('mysql2/promise');(async()=>{const c=await m.createConnection({host:process.env.DB_HOST,port:+process.env.DB_PORT,user:process.env.DB_USERNAME,password:process.env.DB_PASSWORD,database:process.env.DB_DATABASE});const [v]=await c.query('SELECT VERSION() v');const [u]=await c.query('SELECT COUNT(*) n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND DATA_TYPE=?',[process.env.DB_DATABASE,'uuid']);console.log(v[0].v,'| columnas uuid:',u[0].n);await c.end()})()"
```

En una base migrada de cero debe responder `11.4.x-MariaDB | columnas uuid: 228`.

CI lo verifica por su cuenta antes de migrar: si el contenedor no responde `11.4*MariaDB*`, el
job se detiene ahí en vez de fallar más adelante con un error de migración que no señala la causa.
