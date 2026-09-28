# Campañas con el mismo nombre en empresas distintas

Meta manda el **nombre** de la campaña, no un identificador de empresa. La correspondencia con la
empresa vive en las campañas registradas en el CRM, así que dos campañas llamadas igual en
empresas distintas dejan el lead sin dueño posible.

Antes se resolvia con `findOne`: ganaba la fila que devolviera el indice, y el mismo lead podia
caer en una empresa o en la otra. Los contactos de un negocio terminaban en la base de otro sin
que nada lo avisara.

Desde ahora, cuando hay duda **el lead no se guarda**: el evento queda con estado `error`, con su
motivo, y se reprocesa en cuanto se renombre una de las dos. Nada se pierde, pero mientras tanto
esos leads no entran.

## 1. Saber si esto afecta a alguna campaña

```sql
SELECT c.name,
       COUNT(*) AS cuantas,
       GROUP_CONCAT(COALESCE(cl.name, 'Espartanos (agencia)') ORDER BY cl.name SEPARATOR ' | ') AS empresas
FROM crm_campaigns c
LEFT JOIN clients cl ON cl.id = c.client_id
GROUP BY c.organization_id, c.name
HAVING COUNT(DISTINCT COALESCE(c.client_id, 'agencia')) > 1;
```

Sin filas, no hay nada que hacer: ninguna campaña comparte nombre entre empresas.

Con filas, cada una es un nombre que Meta no puede atribuir. Conviene renombrar antes de que
lleguen leads nuevos, porque los que lleguen mientras tanto se quedan esperando.

## 2. Renombrar

El nombre tiene que coincidir con el que traen los leads, así que se cambia en los dos lados:
primero en el Administrador de Anuncios de Meta, y después igual en **CRM → Administración →
Campañas**. Lo habitual es anteponer la marca: `Verano 2026` pasa a `Casa Costanera · Verano 2026`.

Los leads ya guardados con el nombre antiguo no se tocan: siguen contando para esa campaña por
`campaign_name`, así que el costo por lead histórico no cambia.

## 3. Ver los eventos que quedaron esperando

```sql
SELECT id, page_id, leadgen_id, error_message, created_at
FROM meta_lead_webhook_events
WHERE processing_status = 'error'
  AND error_message LIKE '%más de una campaña%'
ORDER BY created_at DESC;
```

Una vez renombrada la campaña, esos eventos se reprocesan desde **Integraciones → Meta** y los
leads entran en la empresa correcta.
