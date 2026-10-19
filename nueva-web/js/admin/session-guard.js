/* Sesión de administración: inactividad de 30 minutos y duración limitada a la pestaña/ventana. */
(() => {
  "use strict";
  // Todas las pantallas de administración comparten el favicon granate.
  const favicon = document.createElement("link");
  favicon.rel = "icon";
  favicon.type = "image/svg+xml";
  favicon.href = new URL("./favicon.svg", location.href).href;
  document.head.appendChild(favicon);
  const IDLE_MS = 30 * 60 * 1000;
  const SESSION_KEY = "amp_admin_session_started";
  const ACTIVITY_KEY = "amp_admin_last_activity";
  const AUTH_KEY = "sb-wmfcpnihymiiwgpvbngj-auth-token";
  const loginPage = "index.html";
  const isLoginPage = location.pathname.endsWith("/admin/index.html") || location.pathname.endsWith("/admin/");
  const now = Date.now();
  let started = false;
  let last = Number(sessionStorage.getItem(ACTIVITY_KEY)) || 0;
  const hadToken = !!localStorage.getItem(AUTH_KEY);

  function clearCredentials() {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(ACTIVITY_KEY);
    localStorage.removeItem(AUTH_KEY);
  }
  function redirect() {
    if (!isLoginPage) location.replace(loginPage);
    else if (document.readyState === "loading") location.replace(loginPage + "?sesion=caducada");
    else location.replace(loginPage + "?sesion=caducada");
  }
  function expire() {
    if (started) return;
    started = true;
    clearCredentials();
    redirect();
  }

  // Un navegador/pestaña nuevo no hereda una sesión administrativa persistente.
  // Las sesiones existentes deberán identificarse una vez tras activar esta protección.
  if (!sessionStorage.getItem(SESSION_KEY)) {
    if (hadToken) {
      clearCredentials();
      if (!isLoginPage) redirect();
    }
    return;
  }
  if (!last || now - last >= IDLE_MS || last > now + 60000) {
    expire();
    return;
  }

  function check() {
    if (started) return;
    if (Date.now() - last >= IDLE_MS) expire();
  }
  function activity() {
    check();
    if (started) return;
    last = Date.now();
    sessionStorage.setItem(ACTIVITY_KEY, String(last));
  }
  // La actividad real del administrador reinicia el contador.
  for (const event of ["pointerdown", "keydown", "touchstart", "scroll"]) {
    addEventListener(event, activity, { passive: true });
  }
  addEventListener("focus", check);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) check();
  });
  setInterval(check, 15000);
})();
