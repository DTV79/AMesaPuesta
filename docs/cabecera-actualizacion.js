/* Cabecera estable y actualización por gesto para la web instalada en iOS y Android. */
(() => {
  const header = document.querySelector('.amp-header') || document.querySelector('.site-header');
  if (!header) return;
  const mobile = matchMedia('(max-width: 760px)');
  const spacer = document.createElement('div');
  spacer.setAttribute('aria-hidden','true');
  spacer.style.display = 'none';
  header.after(spacer);
  const sync = () => {
    const enabled = mobile.matches;
    if (!enabled) {
      header.style.removeProperty('position');
      header.style.removeProperty('top');
      header.style.removeProperty('left');
      header.style.removeProperty('right');
      header.style.removeProperty('width');
      header.style.removeProperty('z-index');
      spacer.style.display = 'none';
      return;
    }
    spacer.style.display = 'block';
    spacer.style.height = header.getBoundingClientRect().height + 'px';
    Object.assign(header.style, {position:'fixed',top:'0',left:'0',right:'0',width:'100%',zIndex:'1100'});
  };
  sync();
  window.addEventListener('resize', sync, {passive:true});
  if (window.ResizeObserver) new ResizeObserver(sync).observe(header);
  const hint = document.createElement('div');
  hint.setAttribute('role','status');
  hint.setAttribute('aria-live','polite');
  hint.textContent = '↓ Desliza para actualizar';
  Object.assign(hint.style, {position:'fixed',top:'max(8px, env(safe-area-inset-top))',left:'50%',transform:'translate(-50%,-150%)',padding:'9px 16px',borderRadius:'24px',background:'#54202b',color:'#fff',font:'600 13px system-ui,sans-serif',zIndex:'1200',pointerEvents:'none',transition:'transform .15s ease',boxShadow:'0 3px 12px #0002'});
  document.body.append(hint);
  let startY = null, tracking = false, distance = 0;
  const isTop = () => window.scrollY <= 2 && document.scrollingElement.scrollTop <= 2;
  document.addEventListener('touchstart', e => {
    const target=e.target;
    tracking = mobile.matches && isTop() && !document.querySelector('dialog[open]') && !target.closest('input,textarea,select,[contenteditable="true"]');
    startY = tracking ? e.touches[0].clientY : null;
    distance = 0;
  }, {passive:true});
  document.addEventListener('touchmove', e => {
    if (!tracking || startY === null || !isTop()) return;
    distance = Math.max(0,e.touches[0].clientY-startY);
    hint.textContent = distance >= 90 ? '↻ Suelta para actualizar' : '↓ Desliza para actualizar';
    hint.style.transform = distance > 25 ? 'translate(-50%,0)' : 'translate(-50%,-150%)';
  }, {passive:true});
  document.addEventListener('touchend', () => {
    const reload = tracking && distance >= 90 && isTop();
    tracking=false;startY=null;distance=0;
    hint.style.transform='translate(-50%,-150%)';
    if (reload) {hint.textContent='Actualizando…';location.reload();}
  }, {passive:true});
  document.addEventListener('touchcancel', () => {tracking=false;startY=null;distance=0;hint.style.transform='translate(-50%,-150%)';}, {passive:true});
})();
