export function SoloEmpresaPropia({ nombre, seccion }: { nombre: string; seccion: string }) {
  return (
    <div className="page">
      <div className="alert alert-info" role="status">
        {seccion} todavía no está disponible para {nombre}. Cambia a la empresa principal de tu cuenta para verlo.
      </div>
    </div>
  );
}
