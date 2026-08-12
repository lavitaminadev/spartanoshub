import { registerFeature } from '../../core/navigation.registry';

registerFeature({
  id: 'audiovisual',
  name: 'Audiovisual',
  enabled: true,
  navigation: [{
    label: 'Video y fotografía',
    path: '/audiovisual',
    icon: '🎬',
    roles: ['admin', 'creative_director', 'operations_director', 'av_director', 'audiovisual'],
  }],
  routes: [],
});
