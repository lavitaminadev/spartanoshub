import { Link } from 'react-router-dom';
import { useAuth } from '../../core/auth';
import { PulsoEspartano } from '../pulse/PulsoEspartano';
import { PageHero } from '../../shared/PageHero';
import { activePortalCards } from './client-portal-scope';

export function ClientDashboard() {
  const { user } = useAuth();

  return (
    <div className="page">
      <PageHero
        tone="portal"
        eyebrow="TU ESPACIO DE MARCA"
        title={`Bienvenido, ${user?.name ?? ''}`}
        subtitle="Tu panel de avances y decisiones."
        footer={<div className="portal-pulse"><span><i className="online-dot" />Cuenta activa</span><span>Actualizado hoy</span></div>}
      />
      <PulsoEspartano compact />

      <div className="card-grid">
        {activePortalCards(user).map((card) => (
          <div key={card.link} className="card portal-home-card">
            <h3>{card.title}</h3>
            <p>{card.description}</p>
            <Link to={card.link} className="btn btn-primary btn-sm">
              {card.action}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
