import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'settings',
  name: 'Mi configuración',
  /*
   * Administración también entra.
   *
   * La pantalla ya estaba escrita para los dos cargos —la identidad de la agencia se edita con
   * `admin` o `dev`, y el panel técnico cuelga de `dev`—, pero el manifiesto la dejaba sólo para
   * desarrollo: administración no podía abrir sus propios ajustes ni la biblioteca de imágenes.
   */
  navigation: [{ label: 'Configuración', path: '/settings', icon: '⚙️', roles: ['dev', 'admin'] }],
  routes: [],
});
