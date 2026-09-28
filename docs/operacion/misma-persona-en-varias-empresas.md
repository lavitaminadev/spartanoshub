# La misma persona en el CRM de varias empresas

Es normal y está previsto: quien reserva en dos restaurantes es cliente de dos negocios que no se
conocen entre sí. Cada empresa tiene su propia ficha, con su nombre, sus notas y su historial, y
ninguna ve la de la otra. No hay límite: una persona puede estar en tantas empresas como haga
falta.

Lo que decide que dos capturas son la misma persona —el teléfono en reservas, el correo en el
embudo comercial— **se busca sólo dentro de la empresa**. Por eso el mismo teléfono en dos locales
de dueños distintos no fusiona nada.

## El caso que sí estaba mal

Un lead **sin empresa** —los de Espartanos: el formulario de la agencia, una campaña propia— se
buscaba en toda la organización. Con eso, un lead de la agencia podía fusionarse con la ficha de un
cliente de una empresa por compartir el correo, y los datos de un negocio terminaban escritos en
la ficha de otro.

Ahora un lead sin empresa sólo se compara con los que tampoco la tienen. Es el mismo criterio que
ya usaban los paneles del CRM para separar «Espartanos» del resto.

## Ver cómo está tu base

**Personas que están en varias empresas** (esto es sano, es sólo para verlo):

```sql
SELECT l.email,
       COUNT(DISTINCT l.client_id) AS empresas,
       GROUP_CONCAT(DISTINCT c.name ORDER BY c.name SEPARATOR ' | ') AS cuales
FROM leads l
JOIN clients c ON c.id = l.client_id
WHERE l.email IS NOT NULL AND l.email <> '' AND l.client_id IS NOT NULL
GROUP BY l.organization_id, l.email
HAVING COUNT(DISTINCT l.client_id) > 1
ORDER BY empresas DESC
LIMIT 50;
```

**Fichas que pudieron mezclarse antes del arreglo** — leads de una empresa que comparten correo con
un lead de la agencia:

```sql
SELECT l.id, l.name, l.email, c.name AS empresa, l.source, l.created_at
FROM leads l
JOIN clients c ON c.id = l.client_id
WHERE l.client_id IS NOT NULL
  AND l.email IN (
    SELECT a.email FROM leads a
    WHERE a.client_id IS NULL AND a.email IS NOT NULL AND a.email <> ''
  )
ORDER BY l.created_at DESC;
```

Cada fila es una ficha a mirar: si su nombre, su origen o sus notas hablan de Espartanos y no del
negocio de esa empresa, se fusionó lo que no debía. Se corrige a mano desde la ficha —los datos
están, sólo están en el sitio equivocado—, y de ahí en adelante no vuelve a pasar.

Sin filas, no hubo mezcla.
