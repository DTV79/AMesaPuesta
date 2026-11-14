(()=>{const root=document.querySelector(".mi-pizarra");if(!root)return;const $=id=>document.getElementById(id),token=localStorage.getItem("amp_cofrade_token"),avisos=$("pizarra-avisos");if(!token)return;const euros=n=>{const v=(Number(n)||0).toFixed(2),partes=v.split("."),entero=partes[0].replace(/\B(?=(\d{3})+(?!\d))/g,".");return entero+","+partes[1]+" €"};avisos.replaceChildren();const loading=document.createElement("p");loading.className="pizarra-empty";loading.textContent="Cargando tus pendientes…";avisos.append(loading);const primeraLinea=valor=>{const lineas=String(valor??"").trim().split(/\r?\n/).map(x=>x.trim()).filter(Boolean);return (lineas[0]||"")+(lineas.length>1?"…":"")};const add=(icon,titulo,detalle,url,accion)=>{const link=document.createElement("a");link.className="pizarra-aviso";link.href=url;const left=document.createElement("span");left.className="pizarra-aviso-icon";left.textContent=icon;const body=document.createElement("span");body.className="pizarra-aviso-body";const strong=document.createElement("strong");strong.textContent=titulo;const small=document.createElement("small");small.textContent=primeraLinea(detalle);body.append(strong);if(detalle)body.append(small);const arrow=document.createElement("span");arrow.className="pizarra-aviso-accion";arrow.textContent=accion;link.append(left,body,arrow);avisos.append(link)};fetch("https://wmfcpnihymiiwgpvbngj.supabase.co/functions/v1/acceso-cofrade",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"pizarra",token})}).then(async r=>{const data=await r.json();if(!r.ok||data.error)throw Error(data.error||"No se pudo cargar la pizarra");avisos.replaceChildren();let count=0;if(data.incorporacion?.existe&&Number(data.incorporacion.total_pendiente)>0){const i=data.incorporacion;add("🦀","Incorporación · "+euros(i.total_pendiente)+" pendientes","Cuota "+i.ejercicio+": "+euros(i.pendiente_cuota)+" · Incorporación: "+euros(i.pendiente_incorporacion),"mis-cuotas.html","Ver desglose");count++}for(const m of data.mensajes_personales||[]){const titulo=String(m.titulo||"Mensaje personal"),contenido=String(m.texto||"");add("💬","Mensaje personal · "+titulo,contenido,"#mensaje-personal","Leer");const enlace=avisos.lastElementChild;enlace.addEventListener("click",ev=>{ev.preventDefault();const d=document.createElement("dialog");d.style.cssText="border:1px solid #e7d9cb;border-radius:20px;padding:clamp(22px,5vw,32px);width:min(92vw,520px);max-height:80vh;overflow:auto;background:#fffaf6;color:#302722;box-shadow:0 24px 70px #0005";const h=document.createElement("h2");h.textContent="💬 "+titulo;h.style.cssText="font:700 clamp(23px,5vw,30px) Georgia,serif;color:#571923;margin:0 0 18px";const p=document.createElement("p");p.textContent=contenido;p.style.cssText="font:15px/1.7 system-ui,sans-serif;white-space:pre-wrap;overflow-wrap:anywhere";const nota=document.createElement("p");nota.textContent="Mensaje privado de Administración";nota.style.cssText="font:12px system-ui,sans-serif;color:#766c66;margin-top:20px";const cerrar=document.createElement("button");cerrar.textContent="Cerrar";cerrar.type="button";cerrar.style.cssText="display:block;margin:22px auto 0;background:#571923;border:0;border-radius:11px;color:white;padding:12px 28px;font:700 14px system-ui,sans-serif;cursor:pointer";cerrar.onclick=()=>d.close();d.append(h,p,nota,cerrar);document.body.append(d);d.addEventListener("close",()=>d.remove());d.addEventListener("click",e=>{if(e.target===d)d.close()});d.showModal()});count++}for(const e of data.encuestas||[]){if(e.puede_votar===false){add("📊","Encuesta activa · Solo informativa",e.titulo+" · No tienes derecho a votar en esta encuesta.","encuestas.html","Ver encuesta")}else{add("📊","Votación pendiente",e.titulo,"encuestas.html","Votar")}count++}for(const v of data.valoraciones_pendientes||[]){add("⭐","Pendiente de valorar la comida",v.restaurante,"restaurantes.html#"+encodeURIComponent(v.codigo),"Valorar");count++}for(const d of data.deudas_comidas||[]){add("💸","Debes "+euros(d.importe)+" a "+d.persona,d.comida+" · Pago pendiente de confirmar por administración","restaurantes.html","Ver comida");count++}for(const d of data.cobros_comidas||[]){add("💰","Tienes pendiente de cobrar "+euros(d.importe)+" de "+d.persona,d.comida+" · Administración confirmará el cobro","restaurantes.html","Ver comida");count++}for(const b of data.reembolsos_bote||[]){add("💰","El bote te debe "+euros(b.importe),b.comida+" · Reembolso pendiente de confirmar","restaurantes.html","Ver comida");count++}for(const g of data.cobros_invitados||[]){add("💶","El invitado "+g.persona+" te debe "+euros(g.importe),g.comida+" · Cobro pendiente de confirmar","restaurantes.html","Ver comida");count++}const pendientesOtros=Math.max(0,Number(data.pendiente_personal||0)-Number(data.incorporacion?.existe?data.incorporacion.pendiente_cuota:0));if(pendientesOtros>0.005){add("💳","Cuotas pendientes","Tienes "+euros(pendientesOtros)+" pendientes de pago","mis-cuotas.html","Ver detalle");count++}if(data.proxima_comida){const fecha=data.proxima_comida.fecha?new Date(data.proxima_comida.fecha+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"long"}):"";add("🍽️","Próxima comida",data.proxima_comida.descripcion+(fecha?" · "+fecha:""),"#detalle-proxima-comida","Ver detalles");const enlace=avisos.lastElementChild;enlace.addEventListener("click",async event=>{event.preventDefault();const previo=document.getElementById("amp-proxima-dialog");if(previo){previo.showModal();return}const dialog=document.createElement("dialog");dialog.id="amp-proxima-dialog";dialog.style.cssText="border:1px solid #e7d9cb;border-radius:24px;padding:clamp(22px,5vw,34px);max-width:min(92vw,560px);width:100%;max-height:85vh;overflow:auto;color:#302722;background:#fffaf6;box-shadow:0 24px 75px #0004";const titulo=document.createElement("h2");titulo.textContent="🍽️ Próxima comida";titulo.style.cssText="font-family:Georgia,serif;font-size:clamp(25px,5vw,32px);color:#54202b;margin:0 0 20px;padding-bottom:14px;border-bottom:1px solid #e7d9cb";const detalle=document.createElement("div");detalle.textContent="Cargando información…";detalle.style.cssText="font-size:16px;line-height:1.7";const cerrar=document.createElement("button");cerrar.type="button";cerrar.textContent="Cerrar";cerrar.style.cssText="display:block;margin:24px auto 0;padding:12px 28px;border-radius:13px;border:1px solid #54202b;background:#54202b;color:#fff;font:700 15px system-ui,sans-serif;cursor:pointer;min-width:120px";cerrar.addEventListener("click",()=>dialog.close());dialog.append(titulo,detalle,cerrar);document.body.append(dialog);dialog.showModal();dialog.addEventListener("click",e=>{if(e.target===dialog)dialog.close()});try{const comida=data.proxima_comida;detalle.replaceChildren();if(!comida){detalle.textContent="No hay detalles disponibles de esta comida.";return}const campos=[["Fecha",new Date(comida.fecha+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"long",year:"numeric"})],["Restaurante",comida.restaurante],["Dirección",comida.direccion],["Teléfono",comida.telefono],["Descripción",comida.comentario],["Entrantes",comida.menu_entrantes],["Principales",comida.menu_principales],["Postres",comida.menu_postres],["Bebidas",comida.menu_bebidas],["Organizadores",(comida.organizadores||[]).join(", ")]];for(const [etiqueta,valor] of campos){if(!valor)continue;const p=document.createElement("p");const b=document.createElement("strong");b.textContent=etiqueta+": ";p.append(b,document.createTextNode(String(valor)));detalle.append(p)}if(!detalle.childNodes.length)detalle.textContent="Los detalles se publicarán próximamente."}catch(error){detalle.textContent="No se pudieron cargar los detalles. Inténtalo de nuevo más tarde."}});count++}// Resultados de encuestas cerradas durante los siete días posteriores al cierre.
try {
  const {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY}=await import("./config.js");
  const respuesta=await fetch(SUPABASE_URL.replace(/[/]$/,"")+"/rest/v1/rpc/listar_encuestas_cofradia",{
    method:"POST",headers:{apikey:SUPABASE_PUBLISHABLE_KEY,"Content-Type":"application/json"},
    body:"{}",cache:"no-store"
  });
  if(!respuesta.ok)throw Error("HTTP "+respuesta.status);
  const datos=await respuesta.json();
  const ahora=Date.now(),sieteDias=7*24*60*60*1000;
  for(const encuesta of (Array.isArray(datos?.polls)?datos.polls:[])){
    if(encuesta.status!=="cerrada")continue;
    // No anunciar resultados ocultos por administración.
    if(encuesta.showResults===false)continue;
    const cierre=encuesta.closedAt||encuesta.closes;
    if(!cierre)continue;
    const fechaCierre=new Date(cierre);
    if(!Number.isFinite(fechaCierre.getTime()))continue;
    const antiguedad=ahora-fechaCierre.getTime();
    if(antiguedad<0||antiguedad>=sieteDias)continue;
    const titulo=String(encuesta.title||"Encuesta sin título");
    const total=Number(encuesta.totalVotes)||0;
    const ganadores=Array.isArray(encuesta.winners)?encuesta.winners:[];
    const ganador=encuesta.winner?.name?String(encuesta.winner.name):"";
    const mostrarGanador=encuesta.showWinner!==false;
    const resultado=mostrarGanador
      ? (encuesta.isTie&&ganadores.length?"Empate: "+ganadores.map(x=>x.name).join(", "):ganador?"Ganador: "+ganador:"Resultados disponibles")
      : "Resultados disponibles";
    const detalle=titulo+" · "+resultado+" · "+total+" voto"+(total===1?"":"s");
    add("📊","Resultado de la votación",detalle,"encuestas.html?encuesta="+encodeURIComponent(String(encuesta.id||"")),"Ver resultados");
    count++;
  }
}catch(error){console.warn("No se pudieron cargar los resultados recientes en Mi Pizarra:",error)}
// Los anuncios públicos vigentes también son avisos de Mi Pizarra.
try {
  const {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY}=await import("./config.js");
  const response=await fetch(SUPABASE_URL.replace(/\/$/,"")+"/rest/v1/rpc/listar_anuncios_publicos_v2",{
    method:"POST",
    headers:{apikey:SUPABASE_PUBLISHABLE_KEY,"Content-Type":"application/json"},
    body:"{}",cache:"no-store"
  });
  if(!response.ok)throw Error("HTTP "+response.status);
  const lista=await response.json();
  if(!Array.isArray(lista))throw Error("Formato de anuncios no válido");
  const txt=v=>String(v??"").trim();
  const normal=v=>txt(v).toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  const si=v=>typeof v==="boolean"?v:["si","true","1","x","yes"].includes(normal(v));
  const fecha=v=>{
    const raw=txt(v),iso=/^(\d{4})-(\d{2})-(\d{2})$/.exec(raw),es=/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(raw);
    if(!iso&&!es)return null;
    const y=iso?+iso[1]:(+es[3]<100?+es[3]+2000:+es[3]),m=iso?+iso[2]:+es[2],d=iso?+iso[3]:+es[1];
    const f=new Date(y,m-1,d,12);
    return f.getFullYear()===y&&f.getMonth()===m-1&&f.getDate()===d?f:null;
  };
  const now=new Date(),hoy=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12);
  const dias=(a,b)=>Math.round((Date.UTC(a.getFullYear(),a.getMonth(),a.getDate())-Date.UTC(b.getFullYear(),b.getMonth(),b.getDate()))/86400000);
  const destacados=a=>{
    if(!si(a.destacado))return false;
    const inicio=fecha(a.fecha);
    if(!inicio)return false;
    const n=Number.parseInt(a.dias_destacado??a["dias destacado"]??a["Días Destacado"]??"",10);
    const duracion=Number.isFinite(n)&&n>0?n:15;
    const elapsed=dias(hoy,inicio);
    return elapsed>=0&&elapsed<=duracion;
  };
  const vigentes=lista.filter(a=>{
    if(!a||!si(a.visible))return false;
    const inicio=fecha(a.fechaPublicacion),fin=fecha(a.fechaFin);
    if(inicio&&inicio>hoy||fin&&fin<hoy)return false;
    const publicada=fecha(a.fechaPublicacion||a.fecha);
    const reciente=publicada&&dias(hoy,publicada)>=0&&dias(hoy,publicada)<=90;
    return reciente||destacados(a);
  }).sort((a,b)=>Number(destacados(b))-Number(destacados(a))||(fecha(b.fechaPublicacion||b.fecha)?.getTime()||0)-(fecha(a.fechaPublicacion||a.fecha)?.getTime()||0));
  for(const anuncio of vigentes){
    const titulo=txt(anuncio.titulo)||"Anuncio de la cofradía";
    const destino=anuncio.id?"anuncios.html?anuncio="+encodeURIComponent(String(anuncio.id)):"anuncios.html";
    add("📣",titulo,txt(anuncio.texto),destino,"Leer anuncio");
    count++;
  }
}catch(error){console.warn("No se pudieron cargar los anuncios en Mi Pizarra:",error)}
if(!count){const ok=document.createElement("p");ok.className="pizarra-empty";ok.textContent="¡Todo al día! Ya puedes ir pensando en la próxima sobremesa.";avisos.append(ok)}$("pizarra-count").hidden=!count;$("pizarra-count").textContent=count+" aviso"+(count===1?"":"s");$("pizarra-recaudado").textContent=euros(data.cuotas_recaudadas);$("pizarra-gastos").textContent=euros(data.gastos_remanente);$("pizarra-remanente").textContent=euros(data.remanente);const nota=$("pizarra-economia-nota");if(nota)nota.remove();$("pizarra-saludo").textContent="Tus asuntos pendientes y las cuentas de la cofradía.";}).catch(()=>{avisos.replaceChildren();const err=document.createElement("p");err.className="pizarra-empty";err.textContent="No se ha podido cargar tu pizarra. Vuelve a intentarlo más tarde.";avisos.append(err)})})();