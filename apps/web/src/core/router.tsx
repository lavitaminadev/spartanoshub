import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { ClientRoute } from './ClientRoute';
import { NotFoundPage } from '../features/not-found/NotFoundPage';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { useAuth } from './auth';
import { ErrorBoundary } from './ErrorBoundary';

const LoginPage = lazy(() => import('../features/auth/LoginPage').then(m => ({ default: m.LoginPage })));
const ForgotPasswordPage = lazy(() => import('../features/auth/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('../features/auth/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })));
const ChangePasswordPage = lazy(() => import('../features/auth/ChangePasswordPage').then(m => ({ default: m.ChangePasswordPage })));
const FirstAccessPage = lazy(() => import('../features/auth/FirstAccessPage').then(m => ({ default: m.FirstAccessPage })));
const SessionsPage = lazy(() => import('../features/auth/SessionsPage').then(m => ({ default: m.SessionsPage })));
const DashboardPage = lazy(() => import('../features/dashboard/DashboardPage').then(m => ({ default: m.DashboardPage })));
const ClientsPage = lazy(() => import('../features/clients/ClientsPage').then(m => ({ default: m.ClientsPage })));
const ClientDetailPage = lazy(() => import('../features/clients/ClientDetailPage').then(m => ({ default: m.ClientDetailPage })));
const OpportunitiesPage = lazy(() => import('../features/crm/CrmRecordsPage').then(m => ({ default: m.OpportunitiesPage })));
const CrmLayout = lazy(() => import('../features/crm/CrmLayout').then(m => ({ default: m.CrmLayout })));
const CrmCalendarPage = lazy(() => import('../features/crm/CrmCalendarPage').then(m => ({ default: m.CrmCalendarPage })));
const CrmAdminPage = lazy(() => import('../features/crm/CrmAdminPage').then(m => ({ default: m.CrmAdminPage })));
const CrmDashboardPage = lazy(() => import('../features/crm/CrmDashboardPage').then(m => ({ default: m.CrmDashboardPage })));
const LeadsBoardPage = lazy(() => import('../features/crm/LeadsBoardPage').then(m => ({ default: m.LeadsBoardPage })));
const CrmHomePage = lazy(() => import('../features/crm/CrmHomePage').then(m => ({ default: m.CrmHomePage })));
const PipelineBoardPage = lazy(() => import('../features/crm/PipelineBoardPage').then(m => ({ default: m.PipelineBoardPage })));
const AutomationsPage = lazy(() => import('../features/automations/AutomationsPage').then(m => ({ default: m.AutomationsPage })));
const AutomationEditorPage = lazy(() => import('../features/automations/AutomationEditorPage').then(m => ({ default: m.AutomationEditorPage })));
const AutomationRunsPage = lazy(() => import('../features/automations/AutomationRunsPage').then(m => ({ default: m.AutomationRunsPage })));
const ContactsPage = lazy(() => import('../features/crm/CrmRecordsPage').then(m => ({ default: m.ContactsPage })));
const InteractionsPage = lazy(() => import('../features/crm/CrmRecordsPage').then(m => ({ default: m.InteractionsPage })));
const ProductionPage = lazy(() => import('../features/production/ProductionPage').then(m => ({ default: m.ProductionPage })));
const WorkDetailPage = lazy(() => import('../features/production/WorkDetailPage').then(m => ({ default: m.WorkDetailPage })));
const IntakePage = lazy(() => import('../features/intake/IntakePage').then(m => ({ default: m.IntakePage })));
const ContentGridPage = lazy(() => import('../features/content/ContentGridPage').then(m => ({ default: m.ContentGridPage })));
const ApprovalsPage = lazy(() => import('../features/approvals/ApprovalsPage').then(m => ({ default: m.ApprovalsPage })));
const MeetingsPage = lazy(() => import('../features/meetings/MeetingsPage').then(m => ({ default: m.MeetingsPage })));
const ReportsPage = lazy(() => import('../features/reports/ReportsPage').then(m => ({ default: m.ReportsPage })));
const SettingsPage = lazy(() => import('../features/settings/SettingsPage').then(m => ({ default: m.SettingsPage })));
const IntegrationsPage = lazy(() => import('../features/integrations/IntegrationsPage').then(m => ({ default: m.IntegrationsPage })));
const AgendaPage = lazy(() => import('../features/reservations/AgendaPage').then(m => ({ default: m.AgendaPage })));
const AvailabilityCalendarPage = lazy(() => import('../features/reservations/AvailabilityCalendarPage').then(m => ({ default: m.AvailabilityCalendarPage })));
const WaitlistPage = lazy(() => import('../features/reservations/WaitlistPage').then(m => ({ default: m.WaitlistPage })));
const ReservationsAnalyticsPage = lazy(() => import('../features/reservations/ReservationsAnalyticsPage').then(m => ({ default: m.ReservationsAnalyticsPage })));
const MetaOAuthCallbackPage = lazy(() => import('../features/integrations/OAuthCallbackPage').then(m => ({ default: () => <m.OAuthCallbackPage provider="meta" /> })));
const OperationsPage = lazy(() => import('../features/operations/OperationsPage').then(m => ({ default: m.OperationsPage })));
const DirectionPage = lazy(() => import('../features/direction/DirectionPage').then(m => ({ default: m.DirectionPage })));
const BillingPage = lazy(() => import('../features/billing/BillingPage').then(m => ({ default: m.BillingPage })));
const ContractsPage = lazy(() => import('../features/contracts/ContractsPage').then(m => ({ default: m.ContractsPage })));
const GamificationPage = lazy(() => import('../features/gamification/GamificationPage').then(m => ({ default: m.GamificationPage })));
const DocumentsPage = lazy(() => import('../features/documents/DocumentsPage').then(m => ({ default: m.DocumentsPage })));
const BriefsPage = lazy(() => import('../features/briefs/BriefsPage').then(m => ({ default: m.BriefsPage })));
const OnboardingPage = lazy(() => import('../features/onboarding/OnboardingPage').then(m => ({ default: m.OnboardingPage })));
const UsersPage = lazy(() => import('../features/users/UsersPage').then(m => ({ default: m.UsersPage })));
const CatalogPage = lazy(() => import('../features/catalog/CatalogPage').then(m => ({ default: m.CatalogPage })));
const KnowledgePage = lazy(() => import('../features/knowledge/KnowledgePage').then(m => ({ default: m.KnowledgePage })));
const ClientDashboard = lazy(() => import('../features/client-portal/ClientDashboard').then(m => ({ default: m.ClientDashboard })));
const ClientGrid = lazy(() => import('../features/client-portal/ClientGrid').then(m => ({ default: m.ClientGrid })));
const ClientApprovals = lazy(() => import('../features/client-portal/ClientApprovals').then(m => ({ default: m.ClientApprovals })));
const ClientMeetings = lazy(() => import('../features/client-portal/ClientMeetings').then(m => ({ default: m.ClientMeetings })));
const ClientReports = lazy(() => import('../features/client-portal/ClientReports').then(m => ({ default: m.ClientReports })));
const ClientLayout = lazy(() => import('../features/client-portal/ClientLayout').then(m => ({ default: m.ClientLayout })));
const ReservationsPage = lazy(() => import('../features/reservations/ReservationsPage').then(m => ({ default: m.ReservationsPage })));
const ReservationBuilderPage = lazy(() => import('../features/reservations/ReservationBuilderPage').then(m => ({ default: m.ReservationBuilderPage })));
const PublicReservationPage = lazy(() => import('../features/reservations/PublicReservationPage').then(m => ({ default: m.PublicReservationPage })));
const PublicSurveyPage = lazy(() => import('../features/surveys/PublicSurveyPage').then(m => ({ default: m.PublicSurveyPage })));
const AudiovisualPage = lazy(() => import('../features/audiovisual/AudiovisualPage').then(m => ({ default: m.AudiovisualPage })));
const GovernancePage = lazy(() => import('../features/governance/GovernancePage').then(m => ({ default: m.GovernancePage })));
const SecurityPage = lazy(() => import('../features/security/SecurityPage').then(m => ({ default: m.SecurityPage })));
const AdminPage = lazy(() => import('../features/admin/AdminPage').then(m => ({ default: m.AdminPage })));
const SurveysPage = lazy(() => import('../features/surveys/SurveysPage').then(m => ({ default: m.SurveysPage })));
const CreateSurveyWizard = lazy(() => import('../features/surveys/CreateSurveyWizard').then(m => ({ default: m.CreateSurveyWizard })));
const SurveyResultsPage = lazy(() => import('../features/surveys/SurveyResultsPage').then(m => ({ default: m.SurveyResultsPage })));
const SolicitudesPage = lazy(() => import('../features/service-requests/SolicitudesPage').then(m => ({ default: m.SolicitudesPage })));

function SafeSuspense({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary><Suspense fallback={<LoadingSpinner text="Preparando tu espacio..." />}>{children}</Suspense></ErrorBoundary>;
}

function HomeRedirect() {
  const user = useAuth((s) => s.user);
  const loading = useAuth((s) => s.loading);
  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword || user.mustCompleteProfile || user.mustAcceptTerms) return <Navigate to="/first-access" replace />;
  return <Navigate to={user.role === 'client' ? '/portal' : '/dashboard'} replace />;
}

function LoginRoute() {
  const user = useAuth((s) => s.user);
  const loading = useAuth((s) => s.loading);
  if (loading) return <LoadingSpinner text="Restaurando tu sesión..." />;
  if (user) return <Navigate to={user.mustChangePassword || user.mustCompleteProfile || user.mustAcceptTerms ? '/first-access' : user.role === 'client' ? '/portal' : '/dashboard'} replace />;
  return <SafeSuspense><LoginPage /></SafeSuspense>;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/forgot-password" element={<SafeSuspense><ForgotPasswordPage /></SafeSuspense>} />
        <Route path="/reset-password" element={<SafeSuspense><ResetPasswordPage /></SafeSuspense>} />
        <Route path="/solicitudes" element={<SafeSuspense><SolicitudesPage /></SafeSuspense>} />
        <Route path="/first-access" element={<ProtectedRoute path="/first-access"><SafeSuspense><FirstAccessPage /></SafeSuspense></ProtectedRoute>} />
        <Route path="/change-password" element={<ProtectedRoute path="/change-password"><SafeSuspense><ChangePasswordPage /></SafeSuspense></ProtectedRoute>} />
        <Route path="/book/:slug" element={<SafeSuspense><PublicReservationPage /></SafeSuspense>} />
        <Route path="/survey/:id" element={<SafeSuspense><PublicSurveyPage /></SafeSuspense>} />
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<ProtectedRoute path="/dashboard"><SafeSuspense><DashboardPage /></SafeSuspense></ProtectedRoute>} />
          <Route path="/clients" element={<ProtectedRoute path="/clients"><SafeSuspense><ClientsPage /></SafeSuspense></ProtectedRoute>} />
          <Route path="/clients/:id" element={<ProtectedRoute path="/clients"><SafeSuspense><ClientDetailPage /></SafeSuspense></ProtectedRoute>} />
          {/* El CRM se recorre entero sin salir de él, así que sus secciones cuelgan de una barra
              propia. Cada hija conserva su `ProtectedRoute`: la barra no decide quién entra. */}
          <Route element={<CrmLayout />}>
            <Route path="/crm" element={<ProtectedRoute path="/crm"><SafeSuspense><CrmHomePage /></SafeSuspense></ProtectedRoute>} />
            {/* Dos secciones con nombre propio sobre el mismo componente: «Tablero» es el
                embudo por etapas con arrastre y «Leads» es la lista. Comparten código —una sola
                consulta, una sola ficha— pero no comparten entrada de menú, porque un alternador
                dentro de una pantalla dejaba ambiguo cuál de las dos se estaba mirando. */}
            <Route path="/crm/tablero" element={<ProtectedRoute path="/crm/tablero"><SafeSuspense><LeadsBoardPage vista="tablero" /></SafeSuspense></ProtectedRoute>} />
            <Route path="/crm/dashboard" element={<ProtectedRoute path="/crm/dashboard"><SafeSuspense><CrmDashboardPage /></SafeSuspense></ProtectedRoute>} />
            <Route path="/crm/calendario" element={<ProtectedRoute path="/crm/calendario"><SafeSuspense><CrmCalendarPage /></SafeSuspense></ProtectedRoute>} />
            <Route path="/crm/administracion" element={<ProtectedRoute path="/crm/administracion"><SafeSuspense><CrmAdminPage /></SafeSuspense></ProtectedRoute>} />
            {/* Estas cinco colgaban del layout general y no de la barra del CRM. El efecto era
                que entrar a «Leads» desde la propia barra la hacía desaparecer: se navegaba
                dentro del CRM y se salía de él sin haber pedido salir. */}
            <Route path="/crm/leads" element={<ProtectedRoute path="/crm/leads"><SafeSuspense><LeadsBoardPage vista="tabla" /></SafeSuspense></ProtectedRoute>} />
            <Route path="/crm/opportunities" element={<ProtectedRoute path="/crm/opportunities"><SafeSuspense><OpportunitiesPage /></SafeSuspense></ProtectedRoute>} />
            <Route path="/crm/pipeline" element={<ProtectedRoute path="/crm/pipeline"><SafeSuspense><PipelineBoardPage /></SafeSuspense></ProtectedRoute>} />
            <Route path="/crm/contacts" element={<ProtectedRoute path="/crm/contacts"><SafeSuspense><ContactsPage /></SafeSuspense></ProtectedRoute>} />
            <Route path="/crm/interactions" element={<ProtectedRoute path="/crm/interactions"><SafeSuspense><InteractionsPage /></SafeSuspense></ProtectedRoute>} />
          </Route>
          <Route path="/automations" element={<ProtectedRoute path="/automations"><SafeSuspense><AutomationsPage /></SafeSuspense></ProtectedRoute>} />
          {/* El editor y el historial cuelgan de la misma ruta de permiso que el listado: se
              declaran con `path="/automations"` para no tener que repetir la regla por cada
              subruta y arriesgar que una quede sin proteger. */}
          <Route path="/automations/:id" element={<ProtectedRoute path="/automations"><SafeSuspense><AutomationEditorPage /></SafeSuspense></ProtectedRoute>} />
          <Route path="/automations/:id/runs" element={<ProtectedRoute path="/automations"><SafeSuspense><AutomationRunsPage /></SafeSuspense></ProtectedRoute>} />
          {/* Personal y sin modulo: todo el mundo debe poder ver donde esta abierta su cuenta. */}
          <Route path="/sesiones" element={<ProtectedRoute path="/sesiones"><SafeSuspense><SessionsPage /></SafeSuspense></ProtectedRoute>} />
          <Route path="/intake" element={<ProtectedRoute path="/intake"><SafeSuspense><IntakePage /></SafeSuspense></ProtectedRoute>} />
          <Route path="/production" element={<ProtectedRoute path="/production"><SafeSuspense><ProductionPage /></SafeSuspense></ProtectedRoute>} />
          <Route path="/production/:id" element={<ProtectedRoute path="/production"><SafeSuspense><WorkDetailPage /></SafeSuspense></ProtectedRoute>} />
          <Route path="/audiovisual" element={<ProtectedRoute path="/audiovisual"><SafeSuspense><AudiovisualPage /></SafeSuspense></ProtectedRoute>} />
          <Route path="/content" element={<ProtectedRoute path="/content"><SafeSuspense><ContentGridPage /></SafeSuspense></ProtectedRoute>} />
          <Route path="/approvals" element={<ProtectedRoute path="/approvals"><SafeSuspense><ApprovalsPage /></SafeSuspense></ProtectedRoute>} />
          <Route path="/meetings" element={<ProtectedRoute path="/meetings"><SafeSuspense><MeetingsPage /></SafeSuspense></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute path="/reports"><SafeSuspense><ReportsPage /></SafeSuspense></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute path="/settings"><SafeSuspense><SettingsPage /></SafeSuspense></ProtectedRoute>} />
          <Route path="/integrations" element={<ProtectedRoute path="/integrations"><SafeSuspense><IntegrationsPage /></SafeSuspense></ProtectedRoute>} />
          <Route path="/integrations/meta/callback" element={<ProtectedRoute path="/integrations"><SafeSuspense><MetaOAuthCallbackPage /></SafeSuspense></ProtectedRoute>} />
          <Route path="/operations" element={<ProtectedRoute path="/operations"><SafeSuspense><OperationsPage /></SafeSuspense></ProtectedRoute>} />
          <Route path="/direction" element={<ProtectedRoute path="/direction"><SafeSuspense><DirectionPage /></SafeSuspense></ProtectedRoute>} />
          <Route path="/billing" element={<ProtectedRoute path="/billing"><SafeSuspense><BillingPage /></SafeSuspense></ProtectedRoute>} />
          <Route path="/contracts" element={<ProtectedRoute path="/contracts"><SafeSuspense><ContractsPage /></SafeSuspense></ProtectedRoute>} />
          <Route path="/gamification" element={<ProtectedRoute path="/gamification"><SafeSuspense><GamificationPage /></SafeSuspense></ProtectedRoute>} />
          <Route path="/documents" element={<ProtectedRoute path="/documents"><SafeSuspense><DocumentsPage /></SafeSuspense></ProtectedRoute>} />
          <Route path="/briefs" element={<ProtectedRoute path="/briefs"><SafeSuspense><BriefsPage /></SafeSuspense></ProtectedRoute>} />
          <Route path="/onboarding" element={<ProtectedRoute path="/onboarding"><SafeSuspense><OnboardingPage /></SafeSuspense></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute path="/users"><SafeSuspense><UsersPage /></SafeSuspense></ProtectedRoute>} />
          <Route path="/governance" element={<ProtectedRoute path="/governance"><SafeSuspense><GovernancePage /></SafeSuspense></ProtectedRoute>} />
          <Route path="/security" element={<ProtectedRoute path="/security"><SafeSuspense><SecurityPage /></SafeSuspense></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute path="/admin"><SafeSuspense><AdminPage /></SafeSuspense></ProtectedRoute>} />
          <Route path="/catalog" element={<ProtectedRoute path="/catalog"><SafeSuspense><CatalogPage /></SafeSuspense></ProtectedRoute>} />
          <Route path="/knowledge" element={<ProtectedRoute path="/knowledge"><SafeSuspense><KnowledgePage /></SafeSuspense></ProtectedRoute>} />
          <Route path="/surveys" element={<ProtectedRoute path="/surveys"><SafeSuspense><SurveysPage /></SafeSuspense></ProtectedRoute>} />
          {/* `?id=` re-abre el mismo asistente para editar, en vez de una cuarta ruta: mismo rol que la lista. */}
          <Route path="/surveys/create" element={<ProtectedRoute path="/surveys"><SafeSuspense><CreateSurveyWizard /></SafeSuspense></ProtectedRoute>} />
          <Route path="/surveys/:id/results" element={<ProtectedRoute path="/surveys"><SafeSuspense><SurveyResultsPage /></SafeSuspense></ProtectedRoute>} />
          <Route path="/reservations" element={<ProtectedRoute path="/reservations"><SafeSuspense><ReservationsPage /></SafeSuspense></ProtectedRoute>} />
          <Route path="/reservations/forms/:id" element={<ProtectedRoute path="/reservations"><SafeSuspense><ReservationBuilderPage /></SafeSuspense></ProtectedRoute>} />
          <Route path="/reservations/agenda" element={<ProtectedRoute path="/reservations/agenda"><SafeSuspense><AgendaPage /></SafeSuspense></ProtectedRoute>} />
          <Route path="/reservations/calendar" element={<ProtectedRoute path="/reservations/calendar"><SafeSuspense><AvailabilityCalendarPage /></SafeSuspense></ProtectedRoute>} />
          <Route path="/reservations/waitlist" element={<ProtectedRoute path="/reservations/waitlist"><SafeSuspense><WaitlistPage /></SafeSuspense></ProtectedRoute>} />
          <Route path="/reservations/analytics" element={<ProtectedRoute path="/reservations/analytics"><SafeSuspense><ReservationsAnalyticsPage /></SafeSuspense></ProtectedRoute>} />
        </Route>
        <Route path="/portal" element={<ClientRoute><SafeSuspense><ClientLayout /></SafeSuspense></ClientRoute>}>
          <Route index element={<SafeSuspense><ClientDashboard /></SafeSuspense>} />
          <Route path="grid" element={<SafeSuspense><ClientGrid /></SafeSuspense>} />
          <Route path="approvals" element={<SafeSuspense><ClientApprovals /></SafeSuspense>} />
          <Route path="meetings" element={<SafeSuspense><ClientMeetings /></SafeSuspense>} />
          <Route path="reports" element={<SafeSuspense><ClientReports /></SafeSuspense>} />
          <Route path="reservations" element={<SafeSuspense><ReservationsPage clientView /></SafeSuspense>} />
          <Route path="reservations/forms/:id" element={<SafeSuspense><ReservationBuilderPage /></SafeSuspense>} />
        </Route>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

// Registra los manifiestos de features
import '../features/dashboard/feature.manifest';
import '../features/clients/feature.manifest';
import '../features/reservations/feature.manifest';
import '../features/contracts/feature.manifest';
import '../features/catalog/feature.manifest';
import '../features/crm/feature.manifest';
import '../features/automations/feature.manifest';
import '../features/briefs/feature.manifest';
import '../features/intake/feature.manifest';
import '../features/production/feature.manifest';
import '../features/gamification/feature.manifest';
import '../features/content/feature.manifest';
import '../features/documents/feature.manifest';
import '../features/knowledge/feature.manifest';
import '../features/approvals/feature.manifest';
import '../features/meetings/feature.manifest';
import '../features/reports/feature.manifest';
import '../features/billing/feature.manifest';
import '../features/operations/feature.manifest';
import '../features/direction/feature.manifest';
import '../features/integrations/feature.manifest';
import '../features/onboarding/feature.manifest';
import '../features/users/feature.manifest';
import '../features/settings/feature.manifest';
import '../features/audiovisual/feature.manifest';
import '../features/governance/feature.manifest';
import '../features/security/feature.manifest';
import '../features/admin/feature.manifest';
import '../features/surveys/feature.manifest';
