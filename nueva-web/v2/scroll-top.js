// Control compartido V2: volver al inicio en pantallas móviles.
(() => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "scroll-top";
  button.setAttribute("aria-label", "Volver arriba, al inicio de la página");
  button.setAttribute("title", "Volver arriba");
  button.textContent = "↑";
  button.hidden = true;
  document.body.appendChild(button);

  const updateVisibility = () => {
    button.hidden = window.scrollY < 500;
  };

  button.addEventListener("click", () => {
    // La flecha tiene prioridad sobre correcciones de navegación a «Más».
    window.dispatchEvent(new Event("amp:cancelar-salto-mas"));
    if (window.location.hash === "#secciones") {
      history.replaceState(history.state, "", location.pathname + location.search);
    }
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  });

  window.addEventListener("scroll", updateVisibility, { passive: true });
  window.addEventListener("pageshow", updateVisibility);
  updateVisibility();
})();
