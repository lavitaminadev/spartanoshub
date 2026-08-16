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
