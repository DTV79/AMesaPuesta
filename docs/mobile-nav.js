(function(){
  const page=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  if(page==='index.html'||page==='') document.body.classList.add('home-mobile');

  const primary=[
    ['index.html','⌂','Inicio'],
    ['restaurantes.html','🍽','Restaurantes'],
    ['anuncios.html','📌','Tablón']
  ];
  const more=[
    ['cofrades.html','👥','Cofrades'],
    ['encuestas.html','📊','Encuestas'],
    ['himno.html','♫','Himno'],
    ['estatutos.html','📜','Estatutos']
  ];

  const backdrop=document.createElement('div');
  backdrop.className='mobile-more-backdrop';
  const menu=document.createElement('div');
  menu.className='mobile-more-menu';
  menu.setAttribute('aria-label','Más secciones');
  more.forEach(([href,icon,label])=>{
    const a=document.createElement('a');
    a.href=href;
    a.innerHTML=`<span class="nav-icon">${icon}</span><span>${label}</span>`;
    if(page===href) a.classList.add('active');
    menu.appendChild(a);
  });

  const nav=document.createElement('nav');
  nav.className='mobile-bottom-nav';
  nav.setAttribute('aria-label','Navegación principal');
  primary.forEach(([href,icon,label])=>{
    const a=document.createElement('a');
    a.href=href;
    a.innerHTML=`<span class="nav-icon">${icon}</span><span>${label}</span>`;
    if(page===href || (page==='mapa.html' && href==='restaurantes.html')) a.classList.add('active');
    nav.appendChild(a);
  });

  const btn=document.createElement('button');
  btn.type='button';
  btn.setAttribute('aria-expanded','false');
  btn.setAttribute('aria-label','Abrir más secciones');
  btn.innerHTML='<span class="nav-icon">☰</span><span>Más</span>';
  if(more.some(x=>x[0]===page)) btn.style.color='var(--app-wine)';
  nav.appendChild(btn);

  function close(){menu.classList.remove('open');backdrop.classList.remove('open');btn.setAttribute('aria-expanded','false')}
  btn.addEventListener('click',()=>{
    const open=!menu.classList.contains('open');
    menu.classList.toggle('open',open);backdrop.classList.toggle('open',open);btn.setAttribute('aria-expanded',String(open));
  });
  backdrop.addEventListener('click',close);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});

  document.body.append(backdrop,menu,nav);
})();
