function TermsConditionsPage() {
  return (
    <div className="page-stack" id="terms-conditions">
      <section className="panel">
        <p className="eyebrow">Terminos y Condiciones</p>
        <h2>Uso de Exito Azul</h2>
        <p>
          Al usar Exito Azul aceptas estas condiciones para proteger la privacidad, seguridad y
          buen uso de la plataforma.
        </p>
      </section>

      <section className="panel">
        <h3>Reglas de uso</h3>
        <ul>
          <li>El usuario es responsable del contenido que sube y comparte.</li>
          <li>No esta permitido publicar contenido ilegal, violento o sin autorizacion.</li>
          <li>Los links temporales pueden vencer o ser revocados por su propietario.</li>
          <li>La plataforma puede limitar funciones para preservar seguridad y rendimiento.</li>
        </ul>
      </section>

      <section className="panel">
        <h3>Privacidad y seguridad</h3>
        <ul>
          <li>La gestion de imagenes privadas requiere cuenta autenticada.</li>
          <li>La vista compartida solo muestra recursos autorizados por token activo.</li>
          <li>Se aplican controles de acceso para proteger colecciones y archivos.</li>
        </ul>
      </section>
    </div>
  );
}

export default TermsConditionsPage;
