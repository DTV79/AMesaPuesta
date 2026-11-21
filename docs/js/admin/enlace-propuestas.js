document.addEventListener('DOMContentLoaded',()=>{
  const contenedor=document.querySelector('.acciones-comidas');
  if(!contenedor)return;
  const enlace=document.createElement('a');
  enlace.href='propuestas-restaurantes.html';
  enlace.className='btn soft propuestas-shortcut';
  enlace.textContent='💡 Por descubrir';
  contenedor.prepend(enlace);
});
