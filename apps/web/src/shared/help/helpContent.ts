export interface HelpSection {
  id: string;
  title: string;
  description?: string;
  items?: HelpItem[];
}

export interface HelpItem {
  id: string;
  label: string;
  description: string;
  formula?: string;
  source?: string;
}

export const helpRegistry: Record<string, { title: string; description: string; sections: HelpSection[] }> = {
  dashboard: {
    title: 'Dashboard',
    description: 'Centro de control con métricas clave de tu operación.',
    sections: [
      { id: 'kpis', title: 'Indicadores principales', description: 'Reservas, asistencia, clientes activos y señales operativas visibles según los módulos habilitados.' },
      { id: 'performance', title: 'Rendimiento digital', description: 'Datos de Meta y Google consolidados de los últimos 30 días.', items: [
        { id: 'ctr', label: 'CTR (Click Through Rate)', description: 'Porcentaje de personas que hicieron clic en el anuncio respecto a las que lo vieron.', formula: 'Clics / Impresiones x 100', source: 'Meta Ads y Google Ads' },
        { id: 'cpl', label: 'CPL (Costo por Lead)', description: 'Costo promedio de conseguir un lead. Mide la eficiencia de la inversión.', formula: 'Inversión total / Leads generados', source: 'Meta Ads y Google Ads' },
      ]},
      { id: 'pieces', title: 'Estado de piezas', description: 'Distribución de piezas según su etapa en el flujo de producción. Detecta cuellos de botella.' },
      { id: 'flow', title: 'Ciclo Maestro', description: 'Flujo operativo completo: desde la captación del lead hasta la medición de resultados.' },
    ],
  },
  crm: {
    title: 'CRM',
    description: 'Gestión de contactos, leads y oportunidades comerciales.',
    sections: [
      { id: 'contacts', title: 'Contactos', description: 'Personas que llegaron desde las agendas de reserva. Filtrables por cliente y estado de asistencia.', items: [
        { id: 'status', label: 'Estados de contacto', description: 'Nuevo: sin interacción. Reservó: hizo una reserva. Asistió: confirmó presencia. No asistió: no se presentó.' },
      ]},
      { id: 'leads', title: 'Leads', description: 'Prospectos captados desde campañas de Meta. Cada lead se asocia a un cliente.', items: [
        { id: 'source', label: 'Origen del lead', description: 'Puede ser Meta Lead Ads, formulario web, referral o manual.', source: 'Meta Ads y formularios' },
      ]},
      { id: 'opportunities', title: 'Oportunidades', description: 'Pipeline comercial con etapas: nuevo, calificado, propuesta, negociación, ganado, perdido.', items: [
        { id: 'pipeline', label: 'Pipeline', description: 'Valor total de oportunidades en cada etapa. Permite proyectar ingresos futuros.', formula: 'Suma de amounts por etapa' },
      ]},
      /*
        Administración y Make.
        La ayuda cubría las tres pantallas de trabajo y ninguna de las de configuración, que son
        justo las que se usan una vez y sin nadie al lado.
      */
      { id: 'admin', title: 'Administración', description: 'Campañas, campos propios y etapas. Todo lo que se configura acá pertenece a la empresa que esté elegida arriba: otra empresa no lo ve ni lo hereda.', items: [
        { id: 'campanas', label: 'Campañas e inversión', description: 'El nombre tiene que escribirse igual que el que traen los leads. Si no coincide, la campaña aparece con cero leads y su inversión no se reparte.' },
        { id: 'llave', label: 'Llave de entrada', description: 'Una por campaña. Es la que decide a qué empresa y a qué campaña entra cada lead, así que no hay que mandarlas en el mensaje. Se muestra una sola vez: si se pierde, se rota y se cambia en Make.' },
        { id: 'campos', label: 'Campos propios', description: 'Datos que el equipo necesita y el CRM no trae. Se declaran por tipo de registro —leads, contactos, oportunidades— y se llenan en la ficha. Archivar esconde el campo sin borrar lo guardado.' },
        { id: 'preguntas', label: 'Preguntas de Meta que llenan un campo', description: 'Al crear un campo propio se pega el enunciado tal como está en el anuncio, uno por línea. No importan tildes, mayúsculas ni guiones bajos. Si el formulario cambia de redacción, se agrega la línea nueva sin borrar la anterior: los leads viejos siguen encontrando su campo.' },
        { id: 'etapas', label: 'Nombres de etapa', description: 'Cambian lo que ve todo el equipo a la vez. Cada etapa puede además reportarse o no a Meta.' },
      ]},
      { id: 'make', title: 'Conectar Make', description: 'Paso a paso para que los leads de un formulario instantáneo de Meta lleguen solos al CRM. Se hace una vez por campaña y no requiere programar.', items: [
        { id: 'p1', label: '1 · Crear la cuenta de Make', description: 'En make.com, con el correo de la agencia y no uno personal: un escenario atado a una cuenta personal se cae cuando esa persona se va. Anotar la región, porque un escenario exportado se importa en la misma.' },
        { id: 'p2', label: '2 · Sacar la llave del CRM', description: 'En CRM → Administración, elegir arriba la empresa y crear la llave de la campaña. Se muestra una sola vez: copiarla al administrador de contraseñas antes de cerrar el aviso.' },
        { id: 'p3', label: '3 · Importar el escenario', description: 'En Make: Scenarios → Create a new scenario → los tres puntos → Import Blueprint, y elegir el archivo del escenario. Quedan tres módulos: el disparador de Facebook, el detalle del lead y el envío al CRM.' },
        { id: 'p4', label: '4 · Conectar Facebook', description: 'En el primer módulo, agregar la conexión y elegir la página y el formulario. En el segundo, la misma página y el mismo formulario. Usar una cuenta con acceso estable: si deja de administrar la página, el escenario se detiene.' },
        { id: 'p5', label: '5 · Poner la llave en el envío', description: 'En el módulo de envío, Credentials → Add. Key: Authorization. Value: «Bearer » y la llave, con el espacio después de Bearer. Placement: Header.' },
        { id: 'p6', label: '6 · Probar con un lead de verdad', description: 'Con la herramienta de pruebas de formularios instantáneos de Facebook, enviar un lead y correr el escenario una vez. Los tres módulos quedan en verde y el lead aparece en su campaña.' },
        { id: 'p7', label: '7 · Dejarlo andando', description: 'Activar Scheduling en Immediately: el disparador es instantáneo y esperar no aporta nada.' },
        { id: 'errores', label: 'Cuando algo falla', description: '401: la llave está mal, revocada, o le falta «Bearer » adelante. 400 «Falta el nombre»: el módulo no mapeó el nombre. 429: demasiados envíos por minuto, Make reintenta solo. El escenario se detuvo: casi siempre la conexión de Facebook caducó. Un lead reenviado no se duplica: el CRM lo reconoce por su Lead ID.' },
        { id: 'revisar', label: 'Qué revisar una vez al mes', description: 'Que el escenario siga activo y sin errores acumulados, que las preguntas del formulario no hayan cambiado de redacción, y que los leads del mes calcen con el administrador de anuncios.' },
      ]},
    ],
  },
  integrations: {
    title: 'Integraciones',
    description: 'Conexión con plataformas externas: Meta, Google y Cloudinary.',
    sections: [
      { id: 'meta', title: 'Meta (Facebook/Instagram)', description: 'Pixel para seguimiento de conversiones y CAPI para enviar eventos al servidor.', items: [
        { id: 'pixel', label: 'Pixel de Meta', description: 'Código que se instala en la página de reserva para rastrear visitas y conversiones.' },
        { id: 'capi', label: 'Conversions API (CAPI)', description: 'Envía eventos de reserva y asistencia directamente al servidor de Meta, sin depender del navegador.' },
        { id: 'token', label: 'Token de acceso', description: 'Clave que autoriza a Espartanos a enviar eventos en nombre de tu cuenta. Se genera en Events Manager.' },
      ]},
      { id: 'google', title: 'Google', description: 'Conexión con Google Ads, Analytics, Calendar y Drive.', items: [
        { id: 'gads', label: 'Google Ads', description: 'Permite importar métricas de campañas para el dashboard.' },
        { id: 'gdrive', label: 'Google Drive', description: 'Carpeta compartida para almacenar documentos de clientes.' },
      ]},
      { id: 'cloudinary', title: 'Cloudinary', description: 'Servicio de imágenes para logos y fondos de formularios de reserva.' },
    ],
  },
  production: {
    title: 'Producción',
    description: 'Gestión visual del flujo de piezas: backlog, asignación, revisión y entrega.',
    sections: [
      { id: 'workflow', title: 'Flujo de trabajo', description: 'Backlog -> Asignado -> En progreso -> Revisión interna -> Validación cliente -> Correcciones -> Aprobado -> Entregado.' },
      { id: 'naming', title: 'Nomenclatura de archivos', description: 'Los archivos deben seguir la convención: Cliente_TipoPieza_Descripcion_Version.extension', items: [
        { id: 'format', label: 'Formato', description: 'CasaNativa_Carrusel_MenuTemporada_v1.pdf', formula: 'Cliente_Tipo_Descripcion_vN.extension' },
      ]},
    ],
  },
  reservations: {
    title: 'Reservas',
    description: 'Captación del local: formularios de reserva, disponibilidad y reservas recibidas.',
    sections: [
      { id: 'forms', title: 'Formularios de reserva', description: 'Crea formularios públicos para captar reservas. Cada uno tiene agenda, disponibilidad y enlace propio.' },
      { id: 'bookings', title: 'Reservas recibidas', description: 'Lista operativa de reservas confirmadas o pendientes. Marca asistencia con un clic para enviar la señal a Meta.', items: [
        { id: 'attendance', label: 'Asistencia', description: 'Al marcar Asistió se envía un evento de alto valor a Meta que mejora la optimización de campañas.' },
      ]},
      { id: 'availability', title: 'Disponibilidad', description: 'Configura horarios semanales, bloquea días o franjas, y define el tope diario de reservas.' },
    ],
  },
  surveys: {
    title: 'Encuestas',
    description: 'Medición independiente para equipo y clientes, con publicación por enlace, QR o correo.',
    sections: [
      { id: 'builder', title: 'Creación guiada', description: 'Define público, preguntas, diseño, distribución y revisión antes de publicar.' },
      { id: 'public', title: 'Enlace público', description: 'El enlace usa el ID estable de la encuesta, por lo que no cambia al editar nombre, diseño o preguntas.' },
      { id: 'analytics', title: 'Medición', description: 'Las encuestas normales usan GA4 si se configura. Meta CAPI queda reservado para conversiones de reservas.' },
    ],
  },
  settings: {
    title: 'Ajustes',
    description: 'Configuración de la organización: identidad, accesos, integraciones y preferencias.',
    sections: [
      { id: 'org', title: 'Organización', description: 'Nombre, código, moneda y configuración base de tu empresa en Espartanos.' },
      { id: 'access', title: 'Usuarios y accesos', description: 'Crea cuentas, asigna roles y controla quien accede a cada modulo.' },
    ],
  },
};

export function getHelpForModule(module: string) {
  return helpRegistry[module] ?? {
    title: module,
    description: 'Ayuda no disponible para este modulo todavia.',
    sections: [{ id: 'pending', title: 'En construccion', description: 'El contenido de ayuda para esta seccion esta en desarrollo.' }],
  };
}
