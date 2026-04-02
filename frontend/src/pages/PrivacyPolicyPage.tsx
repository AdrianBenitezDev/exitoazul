function PrivacyPolicyPage() {
  return (
    <div className="page-stack" id="privacy-policy">
      <section className="panel">
        <p className="eyebrow">Politica de privacidad</p>
        <h2>Uso y proteccion de datos</h2>
        <p>
          Exito Azul procesa imagenes y metadatos para almacenamiento privado, organizacion por
          secciones y comparticion temporal.
        </p>
        <ul>
          <li>Solo el propietario autenticado puede administrar su contenido.</li>
          <li>No se ofrece descarga desde la interfaz web.</li>
          <li>Los links compartidos deben tener expiracion y opcion de revocacion.</li>
        </ul>
      </section>

      <section className="panel">
        <p className="eyebrow">Politica de seguridad</p>
        <h2>Reglas de comparticion y proteccion</h2>
        <ul>
          <li>La web no ofrece descarga de imagenes.</li>
          <li>Si no hay envio directo, el fallback siempre es link temporal.</li>
          <li>Cada imagen recibe nombre automatico: seccion_numero.</li>
        </ul>
      </section>

      <section className="panel">
        <p className="inline-note">
          Completa este contenido con texto legal final antes de pasar a produccion.
        </p>
      </section>
    </div>
  );
}

export default PrivacyPolicyPage;
