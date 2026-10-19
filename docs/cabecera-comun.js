(() => {
  const admin = location.pathname.includes("/admin/") || /alta-admin\.html$/.test(location.pathname);
  const prefix = admin && location.pathname.includes("/admin/") ? "../" : "./";
  const base = admin && location.pathname.includes("/admin/") ? "./" : "admin/";
  const links = admin ? [
    ["Inicio","index.html"],["Cofrades","cofrades.html"],["Cuotas","cuotas.html"],
    ["Encuestas","encuestas.html"],["Anuncios","anuncios.html"],
    ["Comidas","restaurantes.html"],["Estatutos","estatutos.html"]
  ].map(([label,href])=>[label,base === "./" ? href : base+href]) : [
    ["Inicio",prefix+"index.html"],["Nuestras comidas",prefix+"restaurantes.html"],
    ["Cofrades",prefix+"cofrades.html"],["Tablón",prefix+"anuncios.html"],
    ["Encuestas",prefix+"encuestas.html"],["Estatutos",prefix+"estatutos.html"],["Mi acceso",prefix+"acceso.html"]
  ];
  const style = document.createElement("style");
  style.textContent = `
    .amp-header{background:#f8f4ed;border-bottom:1px solid #e7dfd4;position:fixed!important;top:0!important;left:0!important;right:0!important;width:100%!important;z-index:10000!important;transform:none!important;font-family:Georgia,serif}
    .amp-header *{box-sizing:border-box}
    /* Los paneles de edición permanecen bajo la navegación fija. */
    html.amp-modal-locked,body.amp-modal-locked{overflow:hidden!important;overscroll-behavior:none!important}\n    body.amp-modal-locked .amp-header{position:fixed!important;top:0!important}
    body:has(.amp-header) .drawer{top:var(--amp-header-height,72px)!important;bottom:0!important;inset-block-start:var(--amp-header-height,72px)!important;height:auto!important;max-height:calc(100dvh - var(--amp-header-height,72px));z-index:9000!important}
    body:has(.amp-header) .drawer .sheet{position:relative!important;height:100%!important;max-height:100%!important;overflow-y:auto!important;overscroll-behavior:contain}
    body:has(.amp-header) .drawer .sheet{padding-top:22px!important}
    body:has(.amp-header) .drawer .sheet>.close{position:static!important;top:auto!important;right:auto!important;float:right!important;margin:0 0 10px 12px!important;z-index:auto!important;width:28px!important;height:28px!important;min-width:28px!important;min-height:28px!important;padding:0!important;display:grid!important;place-items:center!important;border:1px solid #e8e0d7!important;border-radius:8px!important;background:#f8f5f0!important;color:#625b54!important;font-size:15px!important;font-weight:400!important;line-height:1!important;box-shadow:none!important;cursor:pointer}
    body:has(.amp-header) .drawer .detalle-panel{max-height:100%;overflow-y:auto}
    body:has(.amp-header) .drawer.open{overflow:hidden}
    
    .amp-header-inner{max-width:970px;margin:auto;padding:9px 22px;display:flex;align-items:center;gap:10px;min-height:72px}
    .amp-identity{display:flex;align-items:center;gap:11px;margin-left:-68px;text-decoration:none;color:#27211f;min-width:0;flex-shrink:0}
    .amp-emblem{height:48px;width:48px;border:1px solid #d7c9bd;border-radius:50%;object-fit:cover;background:white}
    .amp-name{font-weight:700;font-size:21px;line-height:1.1;white-space:nowrap}
    .amp-subtitle{font:700 10px/1.5 Arial,sans-serif;letter-spacing:2px;color:#91212b;margin-top:4px}
    .amp-nav{display:flex;gap:clamp(12px,1.35vw,19px);align-items:center;justify-content:center;flex:1 1 auto;min-width:0;flex-wrap:nowrap}
    .amp-nav a{font:700 11px Arial,sans-serif;color:#514b47;text-decoration:none;white-space:nowrap}
    .amp-nav a:hover{color:#91212b}.amp-nav a[aria-current="page"]{color:#91212b!important;background:#f0e2dd;border-radius:7px;padding:7px 9px;box-shadow:inset 0 -2px #91212b}
    .amp-header .logout{white-space:nowrap;cursor:pointer;flex-shrink:0;margin-left:auto;background:#eee9e1!important;color:#332b27!important;border:1px solid #e2d8cd!important;border-radius:9px!important;padding:9px 12px!important;font:700 11px Arial,sans-serif!important;box-shadow:none;transition:background .15s}
    .amp-header .logout:hover{background:#e5dcd1!important}
    .amp-header .logout:focus-visible{outline:3px solid #e7bca6;outline-offset:2px}
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
  if(admin) style.textContent += `
    /* Cabecera de administración: mantener el escudo y el tamaño de texto,
       distribuir botones sin desbordamiento en móviles estrechos. */
    @media(max-width:700px){
      .amp-header-inner{display:flex;flex-wrap:wrap;justify-content:flex-end;column-gap:8px;row-gap:6px;padding:9px 10px}
      .amp-header .amp-identity{margin-left:0;flex:1 1 auto;min-width:175px;gap:8px}
      .amp-header .amp-emblem{width:40px;height:40px;flex-shrink:0}
      .amp-header .amp-name{font-size:19px}
      .amp-header .amp-subtitle{font-size:10px;letter-spacing:1.5px}
      .amp-header .amp-admin-home{flex:0 0 auto}
      .amp-header .logout{margin-left:0!important;font-size:11px!important}
    }
  `;
  if(admin) style.textContent += `
    @media(max-width:700px){
      .amp-header .amp-menu{display:flex;align-items:center;justify-content:center;text-decoration:none;color:#7e242d;font:700 13px Arial,sans-serif;white-space:nowrap;min-height:39px}
      .amp-header .amp-nav{display:none!important}
    }
  `;
  if(admin) style.textContent += `
    /* En teléfonos el teclado nativo ya permite insertar emojis.
       Se conserva el selector en tablet y ordenador. */
    @media (max-width:600px) and (pointer:coarse) {
      button.emoji-btn, button.emoji[data-target], button[data-target][aria-label*="emoticono" i] {display:none!important}
      .emoji-picker, .emojiBox, .selector-emoji-completo {display:none!important}
    }
  `;
  style.textContent += `
    .amp-back-top{position:fixed;right:22px;bottom:24px;z-index:10020;border:0;border-radius:999px;background:#222;color:#fff;width:45px;height:45px;display:none;place-items:center;cursor:pointer;box-shadow:0 4px 16px #0003;font:700 24px Arial,sans-serif}
    .amp-back-top.visible{display:grid}
    .amp-back-top:focus-visible{outline:3px solid #a77817;outline-offset:3px}
    @media(max-width:720px){.amp-back-top{right:14px;bottom:calc(16px + env(safe-area-inset-bottom,0px))}}
  `;
  document.head.appendChild(style);
  const header=document.createElement("header");
  header.className="amp-header";
  const current=location.pathname.split("/").pop()||"index.html";
  header.innerHTML='<div class="amp-header-inner"><a class="amp-identity" href="'+(admin?(base==="./"?"index.html":"admin/index.html"):"./index.html")+'"><img class="amp-emblem" src="https://dtv79.github.io/AMesaPuesta/Fotos/logo-cangrejo.png" alt="Escudo A Mesa Puesta"><span><span class="amp-name">A Mesa Puesta</span>'+(admin?'<span class="amp-subtitle" style="display:block">ZONA DE ADMINISTRACIÓN</span>':'')+'</span></a><button type="button" class="amp-menu" aria-label="Abrir menú" aria-expanded="false">☰ Menú</button><nav class="amp-nav" aria-label="Navegación principal">'+links.map(([name,url])=>'<a href="'+url+'"'+(url.split("/").pop()===current?' aria-current="page"':'')+'>'+name+'</a>').join("")+'</nav></div>';
  if(admin){
    const mobileHome=document.createElement("a");
    mobileHome.className="amp-menu amp-admin-home";
    mobileHome.href=base==="./"?"index.html":"admin/index.html";
    mobileHome.textContent="☰ Menú";
    mobileHome.setAttribute("aria-label","Ir al panel de administración");
    const toggle=header.querySelector(".amp-menu");
    toggle.replaceWith(mobileHome);
  }
  document.body.prepend(header);
  const backTop=document.createElement("button");
  backTop.type="button";
  backTop.className="amp-back-top";
  backTop.textContent="↑";
  backTop.setAttribute("aria-label","Volver al inicio");
  backTop.title="Volver al inicio";
  document.body.appendChild(backTop);
  const scrollTarget=()=>{
    const opened=[...document.querySelectorAll(".drawer.open,.sheet,.detalle-panel")].filter(el=>el.getClientRects().length&&el.scrollHeight>el.clientHeight+5);
    return opened.find(el=>el.scrollTop>0)||opened[0]||document.scrollingElement;
  };
  const syncBackTop=()=>{
    const target=scrollTarget();
    backTop.classList.toggle("visible",!!target&&target.scrollTop>180);
  };
  backTop.addEventListener("click",()=>{
    const target=scrollTarget();
    if(target)target.scrollTo({top:0,behavior:"smooth"});
    if(target===document.scrollingElement)window.scrollTo({top:0,behavior:"smooth"});
  });
  document.addEventListener("scroll",syncBackTop,true);
  window.addEventListener("resize",syncBackTop);
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
  if (admin) {
    const cerrar = logout || document.createElement("button");
    cerrar.type="button";
    cerrar.classList.add("logout");
    cerrar.textContent="🚪 Cerrar sesión";
    cerrar.setAttribute("aria-label","Cerrar sesión de administración");
    if (!logout) {
      cerrar.addEventListener("click",async()=>{
        cerrar.disabled=true;
        try {
          const {createClient}=await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.0/+esm");
          const sb=createClient("https://wmfcpnihymiiwgpvbngj.supabase.co","sb_publishable_ij3sYbyMrLI2B34OOYt6JA_Aez1R2cJ");
          const {error}=await sb.auth.signOut();
          if(error)throw error;
          location.href=base==="./"?"index.html":"admin/index.html";
        } catch(e) {
          cerrar.disabled=false;
          if (admin && window.AMPDialog) await window.AMPDialog.alert("No se pudo cerrar la sesión. Inténtalo de nuevo.");
          else alert("No se pudo cerrar la sesión. Inténtalo de nuevo.");
        }
      });
    }
    header.querySelector(".amp-header-inner").appendChild(cerrar);
  }
  if(!admin){
    const token=localStorage.getItem("amp_cofrade_token");
    if(token){
      fetch("https://wmfcpnihymiiwgpvbngj.supabase.co/functions/v1/acceso-cofrade",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"session",token})})
      .then(async r=>{const d=await r.json();if(!r.ok||!d.nombre)throw Error("Sesión no válida");
        const enlace=[...header.querySelectorAll(".amp-nav a")].find(a=>a.getAttribute("href")===prefix+"acceso.html");
        if(enlace){enlace.textContent="👤 "+d.nombre;enlace.title="Sesión de cofrade activa";}
        const cerrar=document.createElement("button");cerrar.type="button";cerrar.textContent="Salir";
        cerrar.style.cssText="border:0;background:#eee8df;padding:8px;border-radius:8px;cursor:pointer";
        cerrar.onclick=()=>{localStorage.removeItem("amp_cofrade_token");location.href=prefix+"index.html"};
        header.querySelector(".amp-header-inner").appendChild(cerrar);
      }).catch(()=>localStorage.removeItem("amp_cofrade_token"));
    }
  }
  const button=header.querySelector(".amp-menu"),nav=header.querySelector(".amp-nav");
  button.addEventListener("click",()=>{const open=nav.classList.toggle("amp-open");button.setAttribute("aria-expanded",String(open));});
})();