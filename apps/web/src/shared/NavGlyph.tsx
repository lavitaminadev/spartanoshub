const GLYPHS: Record<string, string> = {
  Dashboard: 'IN', Clientes: 'CL', Contratos: 'CT', Catalogo: 'CA', 'Catálogo': 'CA',
  'Leads CRM': 'CR', Briefs: 'BR', Produccion: 'PR', 'Producción': 'PR', Gamificacion: 'XP',
  'Gamificación': 'XP', Contenido: 'CO', Documentos: 'DO', Knowledge: 'KN', Aprobaciones: 'AP',
  Reuniones: 'RE', Reportes: 'RP', Facturacion: 'FA', 'Facturación': 'FA', Operaciones: 'OP',
  Direccion: 'DI', 'Dirección': 'DI', Integraciones: 'IN', Onboarding: 'ON', Usuarios: 'US',
  Configuracion: 'CF', 'Configuración': 'CF', 'Mi Dashboard': 'IN', 'Mi Parrilla': 'PA',
  Reservas: 'RS', 'Contactos de campañas': 'CC', Solicitudes: 'SO',
  'Ventas y CRM': 'VE', Audiovisual: 'AV', 'Resultados': 'RE',
  'Control de acceso': 'AD', Gobernanza: 'GB', 'Seguridad y privacidad': 'SE',
  Encuestas: 'EN', Conocimiento: 'KN', Sesiones: 'SE',
  Prospectos: 'PR', 'Pipeline de oportunidades': 'OP', 'Actividad comercial': 'AC',
  'Reservas y captacion': 'RS', 'Agenda del servicio': 'AG',
  'Calendario de disponibilidad': 'CD', 'Lista de espera': 'LE',
  Analiticas: 'AN', 'Analíticas': 'AN',
};

export function NavGlyph({ label }: { label: string }) {
  return <span className="nav-glyph" aria-hidden="true">{GLYPHS[label] ?? label.slice(0, 2).toUpperCase()}</span>;
}
