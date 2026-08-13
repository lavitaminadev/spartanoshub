import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'knowledge',
  name: 'Conocimiento',
  enabled: true,
  navigation: [{ label: 'Base de conocimiento', path: '/knowledge', icon: '🧠', roles: ['admin', 'ai_lead'] }],
  routes: [],
});
