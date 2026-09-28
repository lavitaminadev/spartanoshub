# Revisar si un Pixel está compartido entre empresas

Un Pixel compartido mezcla las conversiones de dos negocios en el mismo Events Manager, y ahí ya
no se separan. Desde ahora la plataforma no deja crear ese estado, pero lo que se configuró antes
sigue tal cual: esto es para encontrarlo.

Hay que mirar en **dos sitios**, porque la asignación vive en dos formas que conviven:

- la tabla `meta_pixels`, que pobló una migración con lo que había;
- el campo `config` de `integrations`, donde queda lo que se configura desde las pantallas
  (`clientPixels` es el mapa empresa → Pixel, y `metaPixels` el registro de credenciales por Pixel).

## 1. En la tabla: Pixels con más de un dueño

```sql
SELECT p.pixel_id,
       COUNT(DISTINCT p.client_id) AS empresas,
       GROUP_CONCAT(DISTINCT c.name ORDER BY c.name SEPARATOR ' | ') AS cuales
FROM meta_pixels p
JOIN clients c ON c.id = p.client_id
WHERE p.client_id IS NOT NULL
GROUP BY p.organization_id, p.pixel_id
HAVING COUNT(DISTINCT p.client_id) > 1;
```

Sin filas, la tabla está limpia.

## 2. En el registro de las pantallas: el mapa empresa → Pixel

Es una fila por organización y un JSON corto, así que se lee a ojo:

```sql
SELECT JSON_PRETTY(JSON_EXTRACT(config, '$.clientPixels')) AS mapa
FROM integrations
WHERE provider = 'meta';
```

Sale algo así:

```json
{
  "68d2f89a-…": { "pixelId": "911449224635876", "pixelName": "TOKENS GRDS" },
  "505723ab-…": { "pixelId": "911449224635876", "pixelName": "Pixel pruebas" }
}
```

**Dos empresas con el mismo `pixelId` es el caso a corregir.** Para ponerle nombre a cada id:

```sql
SELECT id, name FROM clients WHERE id IN ('68d2f89a-…', '505723ab-…');
```

## 3. Cruzar las dos formas

Un Pixel puede estar asignado a una empresa en la tabla y a otra en el mapa. Con el resultado del
paso 2 a la vista:

```sql
SELECT p.pixel_id, c.name AS empresa_en_la_tabla
FROM meta_pixels p
JOIN clients c ON c.id = p.client_id
WHERE p.pixel_id IN ('911449224635876');  -- los pixelId que aparecieron en el paso 2
```

Si el nombre que sale aquí no es el mismo que el del mapa, ese Pixel figura en dos empresas por
caminos distintos.

## 4. Qué hacer con cada caso

Primero hay que decidir **de quién es** el Pixel. Es una decisión de operación, no técnica: quién
paga esa cuenta publicitaria y quién debe ver esas conversiones.

**Si la empresa que sobra no lo está usando** —el caso normal, una prueba o un arrastre—, se le
quita la asignación desde la pantalla de la empresa (Conexiones → Meta → esa empresa → dejar sin
Pixel), o con SQL si la fila no se ve en pantalla. Respaldar antes:

```sql
CREATE TABLE meta_pixels_respaldo_AAAAMMDD AS
SELECT * FROM meta_pixels WHERE pixel_id = '911449224635876';

DELETE FROM meta_pixels
WHERE pixel_id = '911449224635876' AND client_id = 'EL-ID-DE-LA-QUE-SOBRA';
```

Debe afectar a **una** fila. Si dice otra cosa, parar y restaurar:

```sql
INSERT INTO meta_pixels SELECT * FROM meta_pixels_respaldo_AAAAMMDD;
```

**Si las dos empresas lo están usando de verdad**, hay que darle un Pixel propio a una: se crea en
Events Manager, se registra en Conexiones → Meta con su token, y se le asigna. Las conversiones
anteriores se quedan donde están —no se pueden mover— pero desde ese día cada negocio mide en el
suyo.

**Mientras no se arregle**, la plataforma no falla: la comprobación de exclusividad mira todas las
filas, así que la empresa que lo tiene asignado sigue pudiendo guardarlo. Lo que no se puede es
asignárselo a una tercera.

## 5. Comprobar que quedó resuelto

Repetir los pasos 1 y 2. Y en la pantalla de la empresa, asignar el Pixel tiene que funcionar sin
el aviso de «ya está asignado a otra empresa».
