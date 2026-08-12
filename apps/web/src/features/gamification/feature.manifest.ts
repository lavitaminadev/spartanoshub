import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'gamification',
  name: 'Gamificación',
  enabled: true,
  navigation: [{ label: 'Logros del equipo', path: '/gamification', icon: '🏆', roles: ['admin', 'art_director', 'av_director', 'designer', 'audiovisual'] }],
  routes: [],
});
