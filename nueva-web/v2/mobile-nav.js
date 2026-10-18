/* Menú inferior compartido: se compacta al bajar y se expande al subir. */
(() => {
  const nav = document.querySelector('.mobile-nav');
  if (!nav) return;

  const mobile = window.matchMedia('(max-width: 680px)');
  let lastY = Math.max(0, window.scrollY);
  let direction = 0;
  let distance = 0;
  let scheduled = false;

  const expanded = () => {
    nav.classList.remove('mobile-nav-compact');
    direction = 0;
    distance = 0;
  };

  function checkScroll() {
    scheduled = false;
    if (!mobile.matches) {
      expanded();
      lastY = Math.max(0, window.scrollY);
      return;
    }

    const y = Math.max(0, window.scrollY);
    const delta = y - lastY;
    lastY = y;

    if (y < 100) {
      expanded();
      return;
    }
    if (Math.abs(delta) < 1) return;

    const newDirection = Math.sign(delta);
    if (newDirection !== direction) {
      direction = newDirection;
      distance = 0;
    }
    distance += Math.abs(delta);
    if (distance < 14) return;

    nav.classList.toggle('mobile-nav-compact', direction > 0);
    distance = 0;
  }

  window.addEventListener('scroll', () => {
    if (!scheduled) {
      scheduled = true;
      window.requestAnimationFrame(checkScroll);
    }
  }, {passive: true});
  window.addEventListener('pageshow', () => {
    lastY = Math.max(0, window.scrollY);
    if (lastY < 100) expanded();
  });
  mobile.addEventListener('change', () => {
    expanded();
    lastY = Math.max(0, window.scrollY);
  });
})();
