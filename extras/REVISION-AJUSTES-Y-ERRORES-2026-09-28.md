# Revisión de ajustes y errores — 28 de septiembre de 2026

Para leer y decidir. Nada de lo pendiente de este documento está ejecutado.

---

## A. Errores ya corregidos (en commits locales, sin subir a main)

| Commit | Qué pasaba | Cómo quedó |
|---|---|---|
| `a9dc06ae3` | El resumen diario ignoraba la configuración de la empresa de cada persona. | Cada persona recibe el resumen según la configuración de su empresa. |
| `62ce6cff8` | Cualquier cuenta de una empresa podía cambiar la razón social, el RUT y el correo de privacidad, y aceptar el encargo de tratamiento en su nombre. | Solo el administrador de la empresa los guarda. Los demás ya no ven "Datos legales" en el menú. |
| (cabecera) | En el teléfono, los botones de buscar y de ayuda se veían vacíos y aplastados. | Se ve el ícono, el botón mide 40x40 y el título largo se corta con puntos. |
| `f5a507ad9` | En Usuarios, al escribir en el buscador la página volvía a "Cargando" con cada letra. Se perdía el cursor y lo escrito, y parecía que cambiaba de cuenta. | La lista anterior queda a la vista mientras llega la nueva, y el buscador conserva lo escrito. Revisé las demás páginas con buscador y no tienen este problema. |

---

## B. Ajustes de Configuración que no hacen nada

Se editan y se guardan, pero ningún código los lee.

### B1. Ley de datos personales (Ley 21.719, rige desde el 1 de diciembre de 2026)

**1. Retención de comentarios de trabajo (730 días)**
- **Qué existe:** la función que despersonaliza los comentarios vencidos está programada (borra el texto y el autor y conserva la fecha y el área), pero nada la ejecuta.
- **Riesgo:** los comentarios se guardan para siempre. La ley exige no guardar datos personales más tiempo del necesario.
- **Recomendación:** hacerlo funcionar con una tarea diaria que use el plazo del ajuste. Es poco trabajo porque la función ya existe. Antes, un abogado debe confirmar el plazo, que debe coincidir con el aviso de privacidad.

**2. Plazo para responder una solicitud de derechos (15 días hábiles)**
- **Qué existe:** las solicitudes se reciben y se resuelven a mano. Nada calcula el plazo ni avisa antes de que venza.
- **Riesgo:** una solicitud puede vencer sin que nadie lo note. Además, según lo que sé, la ley da 30 días corridos, prorrogables una vez por 30 más, y no 15 días hábiles. Un abogado debe confirmarlo.
- **Recomendación:** hacerlo funcionar mostrando la fecha de vencimiento en cada solicitud y avisando al equipo unos días antes. Nunca cerrar una solicitud sola. Ajustar el valor cuando lo confirme el abogado.

**3. Procedimiento del canal de derechos**
- **Qué existe:** es un texto que hoy dice "Pendiente de redacción por la agencia".
- **Recomendación:** no requiere código. Redactarlo (cómo se recibe, se verifica y se responde una solicitud, y quién responde) antes del 1 de diciembre, idealmente con asesoría legal.

### B2. Operación

**4. Modelo de asignación (individual, pod o híbrido)**
- **Qué existe:** el sistema ya trabaja por pods en todas partes, así que el selector no decide nada.
- **Recomendación:** ocultarlo. Hacerlo funcionar cambiaría cómo se reparte hoy el trabajo.

**5. Duración de la reunión semanal (30 minutos)**
- **Qué existe:** no hay un módulo de reuniones que lo use.
- **Recomendación:** ocultarlo hasta que exista ese módulo.

**6. Convención de nombres de archivos**
- **Qué existe:** un texto de referencia. El sistema no renombra archivos.
- **Recomendación:** dejarlo, pero cambiar la descripción para que diga que es una guía para el equipo y no algo que se aplique solo.

### B3. Presupuesto de diseño (UD)

**7. Visibilidad de UD para clientes**
- **Qué existe:** el portal del cliente no muestra el saldo UD en ninguna parte.
- **Recomendación:** ocultarlo. Mostrar el saldo al cliente sería una función nueva que conviene decidir aparte.

**8. Nombre visible del presupuesto ("UD" o "Créditos de Diseño")**
- **Qué existe:** las pantallas tienen "UD" escrito fijo.
- **Recomendación:** ocultarlo. Hacerlo funcionar significa cambiar el texto en muchas pantallas para poco beneficio.

**9. Costo interno por UD**
- **Qué existe:** no se usa en ningún cálculo.
- **Recomendación:** ocultarlo hasta que exista un reporte de rentabilidad que lo necesite.

> "Ocultar" no borra nada: lo que ya esté guardado se conserva y se puede volver a mostrar.

---

## C. Resumen de lo que hay que decidir

| # | Ajuste | Recomendación | Tu decisión |
|---|---|---|---|
| 1 | Retención de comentarios | Hacerlo funcionar (y confirmar el plazo con un abogado) | |
| 2 | Plazo de solicitudes de derechos | Hacerlo funcionar (vencimiento y aviso, valor a confirmar con un abogado) | |
| 3 | Procedimiento del canal de derechos | Redactarlo tú | |
| 4 | Modelo de asignación | Ocultar | |
| 5 | Duración de la reunión semanal | Ocultar | |
| 6 | Convención de nombres | Cambiar la descripción | |
| 7 | Visibilidad de UD para clientes | Ocultar | |
| 8 | Nombre visible del presupuesto | Ocultar | |
| 9 | Costo interno por UD | Ocultar | |
| — | Subir a main los commits de la sección A | Pendiente de tu aprobación | |

## D. Otros pendientes que siguen abiertos

- Límite del código de cupón repetible por empresa (falta tu decisión).
- Permisos y creación guiada de cuentas (lo dejaste para el final).
- Análisis de Meta a fondo y el píxel 911449224635876 (faltaban los pasos 5 y 6).
- Revisar el cron en cPanel o `ENABLE_INTERNAL_SCHEDULER`.
