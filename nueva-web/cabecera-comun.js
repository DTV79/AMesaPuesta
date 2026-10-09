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
    .amp-header{background:#f8f4ed;border-bottom:1px solid #e7dfd4;position:relative;z-index:30;font-family:Georgia,serif}
    .amp-header *{box-sizing:border-box}
    .amp-header-inner{max-width:1480px;margin:auto;padding:9px 18px;display:flex;align-items:center;gap:12px;min-height:72px}
    .amp-identity{display:flex;align-items:center;gap:11px;text-decoration:none;color:#27211f;min-width:210px;flex-shrink:0}
    .amp-emblem{height:48px;width:48px;border:1px solid #d7c9bd;border-radius:50%;object-fit:cover;background:white}
    .amp-name{font-weight:700;font-size:21px;line-height:1.1;white-space:nowrap}
    .amp-subtitle{font:700 10px/1.5 Arial,sans-serif;letter-spacing:2px;color:#91212b;margin-top:4px}
    .amp-nav{display:flex;gap:clamp(9px,1.2vw,19px);align-items:center;justify-content:flex-start;flex:1;flex-wrap:nowrap}
    .amp-nav a{font:700 12px Arial,sans-serif;color:#514b47;text-decoration:none;white-space:nowrap}
    .amp-nav a:hover,.amp-nav a[aria-current="page"]{color:#91212b}
    .amp-header .logout{white-space:nowrap;cursor:pointer;flex-shrink:0}
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
  // Conserva el botón original y su evento de cierre de sesión.
  const logout=document.querySelector(".shell > .top > #salir");
  if (logout) header.querySelector(".amp-header-inner").appendChild(logout);
  const button=header.querySelector(".amp-menu"),nav=header.querySelector(".amp-nav");
  button.addEventListener("click",()=>{const open=nav.classList.toggle("amp-open");button.setAttribute("aria-expanded",String(open));});
})();