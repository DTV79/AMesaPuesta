(() => {
  const admin = location.pathname.includes("/admin/") || /alta-admin\.html$/.test(location.pathname);
  const prefix = admin && location.pathname.includes("/admin/") ? "../" : "./";
  const base = admin && location.pathname.includes("/admin/") ? "./" : "admin/";
  const links = admin ? [
    ["Inicio","index.html"],["Cofrades","cofrades.html"],["Cuotas","cuotas.html"],
    ["Encuestas","encuestas.html"],["Anuncios","anuncios.html"],
    ["Comidas","restaurantes.html"],["Estatutos","estatutos.html"],
    ["Administradores","administradores.html"]
  ].map(([label,href])=>[label,base === "./" ? href : base+href]) : [
    ["Inicio",prefix+"index.html"],["Nuestras comidas",prefix+"restaurantes.html"],
    ["Cofrades",prefix+"cofrades.html"],["Tablón",prefix+"anuncios.html"],
    ["Encuestas",prefix+"encuestas.html"],["Estatutos",prefix+"estatutos.html"]
  ];
  const style = document.createElement("style");
  style.textContent = `
    .amp-header{background:#f8f4ed;border-bottom:1px solid #e7dfd4;position:fixed!important;top:0!important;left:0!important;right:0!important;width:100%!important;z-index:10000!important;transform:none!important;font-family:Georgia,serif}
    .amp-header *{box-sizing:border-box}
    /* Los paneles de edición permanecen bajo la navegación fija. */
    html.amp-modal-locked,body.amp-modal-locked{overflow:hidden!important;overscroll-behavior:none!important}\n    body.amp-modal-locked .amp-header{position:fixed!important;top:0!important}
    body:has(.amp-header) .drawer{top:var(--amp-header-height,72px)!important;bottom:0!important;inset-block-start:var(--amp-header-height,72px)!important;height:auto!important;max-height:calc(100dvh - var(--amp-header-height,72px));z-index:9000!important}
    body:has(.amp-header) .drawer .sheet{height:100%!important;max-height:100%!important;overflow-y:auto!important;overscroll-behavior:contain}
    body:has(.amp-header) .drawer .sheet>.close{position:absolute!important;top:16px!important;right:18px!important;float:none!important;margin:0!important;z-index:5!important;width:32px!important;height:32px!important;min-width:32px!important;min-height:32px!important;padding:0!important;display:grid!important;place-items:center!important;border:1px solid #e8e0d7!important;border-radius:9px!important;background:#f8f5f0!important;color:#625b54!important;font-size:17px!important;font-weight:500!important;line-height:1!important;box-shadow:none!important;cursor:pointer}
    body:has(.amp-header) .drawer .detalle-panel{max-height:100%;overflow-y:auto}
    body:has(.amp-header) .drawer.open{overflow:hidden}
    
    .amp-header-inner{max-width:970px;margin:auto;padding:9px 22px;display:flex;align-items:center;gap:10px;min-height:72px}
    .amp-identity{display:flex;align-items:center;gap:11px;margin-left:-68px;text-decoration:none;color:#27211f;min-width:0;flex-shrink:0}
    .amp-emblem{height:48px;width:48px;border:1px solid #d7c9bd;border-radius:50%;object-fit:cover;background:white}
    .amp-name{font-weight:700;font-size:21px;line-height:1.1;white-space:nowrap}
    .amp-subtitle{font:700 10px/1.5 Arial,sans-serif;letter-spacing:2px;color:#91212b;margin-top:4px}
    .amp-nav{display:flex;gap:clamp(8px,0.9vw,13px);align-items:center;justify-content:center;flex:1 1 auto;min-width:0;flex-wrap:nowrap}
    .amp-nav a{font:700 11px Arial,sans-serif;color:#514b47;text-decoration:none;white-space:nowrap}
    .amp-nav a:hover,.amp-nav a[aria-current="page"]{color:#91212b}
    .amp-header .logout{white-space:nowrap;cursor:pointer;flex-shrink:0;margin-left:auto}
    .amp-menu{display:none;border:1px solid #ddd1c5;border-radius:9px;background:#fff;padding:9px;cursor:pointer}
    .amp-header + .shell > .top > div:first-child:has(.brand){display:none}
    .amp-header + .shell > .top{justify-content:flex-end}
    .amp-header + .shell > .top:empty{display:none}
    @media(max-width:1100px){
      .amp-header-inner{flex-wrap:wrap;gap:8px;padding:9px 14px}
      .amp-identity{flex:1;min-width:0}
      .amp-name{font-size:19px}
      .amp-menu{display:block;white-space:nowrap}
      .amp-header .logout{padding:9px 11px}
      .amp-nav{display:none;flex-basis:100%;width:100%;flex-direction:column;align-items:stretch;gap:0;padding:5px 0}
      .amp-nav.amp-open{display:flex}
      .amp-nav a{padding:12px 8px;border-top:1px solid #e9e0d8}
    }`;
  document.head.appendChild(style);
  const header=document.createElement("header");
  header.className="amp-header";
  const current=location.pathname.split("/").pop()||"index.html";
  header.innerHTML='<div class="amp-header-inner"><a class="amp-identity" href="'+(admin?(base==="./"?"index.html":"admin/index.html"):"./index.html")+'"><img class="amp-emblem" src="https://dtv79.github.io/AMesaPuesta/Fotos/logo-cangrejo.png" alt="Escudo A Mesa Puesta"><span><span class="amp-name">A Mesa Puesta</span>'+(admin?'<span class="amp-subtitle" style="display:block">ZONA DE ADMINISTRACIÓN</span>':'')+'</span></a><button type="button" class="amp-menu" aria-label="Abrir menú" aria-expanded="false">☰ Menú</button><nav class="amp-nav" aria-label="Navegación principal">'+links.map(([name,url])=>'<a href="'+url+'"'+(url.split("/").pop()===current?' aria-current="page"':'')+'>'+name+'</a>').join("")+'</nav></div>';
  document.body.prepend(header);
  const syncHeaderHeight=()=>{const h=Math.ceil(header.getBoundingClientRect().height);document.documentElement.style.setProperty("--amp-header-height",h+"px");document.body.style.paddingTop=h+"px";};
  syncHeaderHeight();
  if(typeof ResizeObserver!=="undefined")new ResizeObserver(syncHeaderHeight).observe(header);
  window.addEventListener("resize",syncHeaderHeight);
  // El bloqueo no puede usar position:fixed en body: desplazaría también la cabecera.
  const updateModalLock=()=>{
    const active=!!document.querySelector('.drawer.open, .selector-overlay.open');
    document.documentElement.classList.toggle('amp-modal-locked',active);
    document.body.classList.toggle('amp-modal-locked',active);
  };
  new MutationObserver(updateModalLock).observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});
  // Conserva el botón original y su evento de cierre de sesión.
  const logout=document.querySelector(".shell > .top > #salir");
  if (logout) header.querySelector(".amp-header-inner").appendChild(logout);
  const button=header.querySelector(".amp-menu"),nav=header.querySelector(".amp-nav");
  button.addEventListener("click",()=>{const open=nav.classList.toggle("amp-open");button.setAttribute("aria-expanded",String(open));});
})();