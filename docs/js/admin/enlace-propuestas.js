document.addEventListener('DOMContentLoaded',()=>{
  const contenedor=document.querySelector('.acciones-comidas');
  if(!contenedor)return;
  const enlace=document.createElement('a');
  enlace.href='propuestas-restaurantes.html';
  enlace.className='btn soft';
  enlace.textContent='💡 Por descubrir';
  enlace.style.cssText='display:inline-flex;align-items:center;justify-content:center;text-decoration:none;color:#682736;min-height:40px';
  contenedor.prepend(enlace);
});
