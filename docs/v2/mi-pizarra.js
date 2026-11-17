(()=>{const root=document.querySelector(".mi-pizarra");if(!root)return;const $=id=>document.getElementById(id),token=localStorage.getItem("amp_cofrade_token"),avisos=$("pizarra-avisos");if(!token)return;const euros=n=>{const v=(Number(n)||0).toFixed(2),partes=v.split("."),entero=partes[0].replace(/\B(?=(\d{3})+(?!\d))/g,".");return entero+","+partes[1]+" €"};avisos.replaceChildren();const loading=document.createElement("p");loading.className="pizarra-empty";loading.textContent="Cargando tus pendientes…";avisos.append(loading);const primeraLinea=valor=>{const lineas=String(valor??"").trim().split(/\r?\n/).map(x=>x.trim()).filter(Boolean);return (lineas[0]||"")+(lineas.length>1?"…":"")};const add=(icon,titulo,detalle,url,accion,opciones={})=>{const link=document.createElement("a");link.className="pizarra-aviso"+(opciones.urgente?" pizarra-aviso--urgente":opciones.pendiente?" pizarra-aviso--pendiente":"");link.dataset.prioridad=String(opciones.prioridad??5);if(opciones.pendiente)link.dataset.pendiente="1";link.href=url;const left=document.createElement("span");left.className="pizarra-aviso-icon";left.textContent=icon;const body=document.createElement("span");body.className="pizarra-aviso-body";const strong=document.createElement("strong");strong.textContent=titulo;const small=document.createElement("small");small.textContent=primeraLinea(detalle);const cabecera=document.createElement("span");cabecera.className="pizarra-aviso-encabezado";cabecera.append(strong);if(opciones.estado){const etiqueta=document.createElement("span");etiqueta.className="pizarra-estado"+(opciones.urgente?" pizarra-estado--urgente":"");etiqueta.textContent=opciones.estado;cabecera.append(etiqueta)}body.append(cabecera);if(detalle)body.append(small);const arrow=document.createElement("span");arrow.className="pizarra-aviso-accion";arrow.textContent=accion;link.append(left,body,arrow);avisos.append(link)};
 // Descarga el mismo evento de día completo que se ofrece en «Nuestras comidas».
 // La ficha no incluye una hora confirmada: nunca se inventa una.
 function guardarProximaEnCalendario(comida){
   const partes=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(comida.fecha||""));
   if(!partes)return;
   const dia=new Date(Date.UTC(+partes[1],+partes[2]-1,+partes[3]));
   if(dia.getUTCFullYear()!==+partes[1]||dia.getUTCMonth()!==+partes[2]-1||dia.getUTCDate()!==+partes[3])return;
   const formato=fecha=>fecha.toISOString().slice(0,10).replace(/-/g,"");
   const escapar=texto=>String(texto||"").trim().replace(/\\/g,"\\\\").replace(/\r\n|\r|\n/g,"\\n").replace(/;/g,"\\;").replace(/,/g,"\\,");
   const organizadores=Array.isArray(comida.organizadores)?comida.organizadores.filter(n=>typeof n==="string"&&n.trim()):[];
   const ficha="https://dtv79.github.io/AMesaPuesta/v2/restaurantes.html#"+encodeURIComponent(String(comida.codigo));
   const descripcion=[
     organizadores.length?"Organizan: "+organizadores.join(" y "):"",
     "Consulta la ficha para confirmar la hora y los detalles: "+ficha,
     "Evento de día completo: la Cofradía todavía no ha publicado una hora en la ficha."
   ].filter(Boolean).join("\n");
   const sello=new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z");
   const id=String(comida.codigo).replace(/[^a-z0-9-]/gi,"");
   const campos=[
     "BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Cofradia A Mesa Puesta//Calendario//ES",
     "CALSCALE:GREGORIAN","METHOD:PUBLISH","BEGIN:VEVENT",
     "UID:comida-"+id+"@amesapuesta","DTSTAMP:"+sello,
     "DTSTART;VALUE=DATE:"+formato(dia),
     "DTEND;VALUE=DATE:"+formato(new Date(dia.getTime()+86400000)),
     "SUMMARY:"+escapar("Comida de A Mesa Puesta · "+comida.restaurante),
     "LOCATION:"+escapar(comida.direccion||comida.restaurante),
     "DESCRIPTION:"+escapar(descripcion),"STATUS:CONFIRMED",
     "END:VEVENT","END:VCALENDAR"
   ];
   const archivo=new Blob([campos.join("\r\n")+"\r\n"],{type:"text/calendar;charset=utf-8"});
   const url=URL.createObjectURL(archivo);
   const enlace=document.createElement("a");
   enlace.href=url;
   enlace.download="Comida - "+String(comida.restaurante||"").trim().replace(/[\\/:*?"<>|]/g,"-").slice(0,55)+" - "+comida.fecha+".ics";
   document.body.append(enlace);
   enlace.click();
   enlace.remove();
   setTimeout(()=>URL.revokeObjectURL(url),1500);
 }
fetch("https://wmfcpnihymiiwgpvbngj.supabase.co/functions/v1/acceso-cofrade",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"pizarra",token})}).then(async r=>{const data=await r.json();if(!r.ok||data.error)throw Error(data.error||"No se pudo cargar la pizarra");avisos.replaceChildren();let count=0;if(data.incorporacion?.existe&&Number(data.incorporacion.total_pendiente)>0){const i=data.incorporacion;add("🦀","Incorporación · "+euros(i.total_pendiente)+" pendientes","Cuota "+i.ejercicio+": "+euros(i.pendiente_cuota)+" · Incorporación: "+euros(i.pendiente_incorporacion),"mis-cuotas.html","Ver desglose",{prioridad:1,pendiente:true,estado:"Pendiente"});count++}for(const m of data.mensajes_personales||[]){const titulo=String(m.titulo||"Mensaje personal"),contenido=String(m.texto||"");add("💬","Mensaje personal · "+titulo,contenido,"#mensaje-personal","Leer",{prioridad:3});const enlace=avisos.lastElementChild;enlace.addEventListener("click",ev=>{ev.preventDefault();const d=document.createElement("dialog");d.style.cssText="border:1px solid #e7d9cb;border-radius:20px;padding:clamp(22px,5vw,32px);width:min(92vw,520px);max-height:80vh;overflow:auto;background:#fffaf6;color:#302722;box-shadow:0 24px 70px #0005";const h=document.createElement("h2");h.textContent="💬 "+titulo;h.style.cssText="font:700 clamp(23px,5vw,30px) Georgia,serif;color:#571923;margin:0 0 18px";const p=document.createElement("p");p.textContent=contenido;p.style.cssText="font:15px/1.7 system-ui,sans-serif;white-space:pre-wrap;overflow-wrap:anywhere";const nota=document.createElement("p");nota.textContent="Mensaje privado de Administración";nota.style.cssText="font:12px system-ui,sans-serif;color:#766c66;margin-top:20px";const cerrar=document.createElement("button");cerrar.textContent="Cerrar";cerrar.type="button";cerrar.style.cssText="display:block;margin:22px auto 0;background:#571923;border:0;border-radius:11px;color:white;padding:12px 28px;font:700 14px system-ui,sans-serif;cursor:pointer";cerrar.onclick=()=>d.close();d.append(h,p,nota,cerrar);document.body.append(d);d.addEventListener("close",()=>d.remove());d.addEventListener("click",e=>{if(e.target===d)d.close()});d.showModal()});count++}for(const e of data.encuestas||[]){const destino="encuestas.html?encuesta="+encodeURIComponent(String(e.id||""));if(e.puede_votar===false){add("📊","Encuesta activa · Solo informativa",e.titulo+" · No tienes derecho a votar en esta encuesta.",destino,"Consultar",{prioridad:4})}else{const cierre=e.cierra_en?new Date(String(e.cierra_en).replace(" ","T")):null;const horas=cierre&&Number.isFinite(cierre.getTime())?(cierre.getTime()-Date.now())/3600000:null;const urgente=horas!==null&&horas>0&&horas<=48;const aviso=urgente?(horas<1?" · Termina en menos de 1 hora":horas<=24?" · Termina en menos de 24 horas":" · Termina en menos de 48 horas"):"";add("📊","Votación pendiente",e.titulo+aviso,destino,"Votar",{prioridad:urgente?0:1,pendiente:true,urgente,estado:urgente?"Termina pronto":"Pendiente"})}count++}for(const v of data.valoraciones_pendientes||[]){add("⭐","Pendiente de valorar la comida",v.restaurante,"restaurantes.html#"+encodeURIComponent(v.codigo),"Valorar",{prioridad:1,pendiente:true,estado:"Pendiente"});count++}
  // Una valoración ya enviada sigue disponible como aviso informativo mientras
  // la votación de esa comida permanezca abierta. No suma al contador de pendientes.
  try{
    const {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY}=await import("./config.js");
    const base=SUPABASE_URL.replace(/\/$/,"");
    const cabeceras={apikey:SUPABASE_PUBLISHABLE_KEY,"x-cofrade-token":token,"Content-Type":"application/json"};
    const consulta=async nombre=>{
      const respuesta=await fetch(base+"/functions/v1/listados-cofradia?consulta="+nombre,{
        method:"POST",headers:cabeceras,body:"{}",cache:"no-store"
      });
      if(!respuesta.ok)throw Error("HTTP "+respuesta.status);
      return respuesta.json();
    };
    const valoraciones=await consulta("listar_valoraciones_comidas_publicas");
    const abiertas=(Array.isArray(valoraciones)?valoraciones:[]).filter(v=>v?.abierta===true&&v.codigo);
    const pendientes=new Set((data.valoraciones_pendientes||[]).map(v=>String(v.codigo)));
    const sinPendiente=abiertas.filter(v=>!pendientes.has(String(v.codigo)));
    if(sinPendiente.length){
      const comidas=await consulta("listar_comidas_publicas_v2");
      const porCodigo=new Map((Array.isArray(comidas)?comidas:[]).filter(v=>v?.codigo).map(v=>[String(v.codigo),v]));
      const recientes=sinPendiente.map(v=>porCodigo.get(String(v.codigo))).filter(Boolean)
        .sort((a,b)=>String(b.fecha||"").localeCompare(String(a.fecha||""))).slice(0,3);
      await Promise.all(recientes.map(async comida=>{
        try{
          const respuesta=await fetch(base+"/rest/v1/rpc/mi_valoracion_comida_sesion",{
            method:"POST",headers:{apikey:SUPABASE_PUBLISHABLE_KEY,"Content-Type":"application/json"},
            body:JSON.stringify({p_token:token,p_codigo:comida.codigo}),cache:"no-store"
          });
          if(!respuesta.ok)return;
          const estado=await respuesta.json();
          if(estado?.asistio!==true||estado?.valorada!==true)return;
          add("⭐","Valoración realizada",comida.restaurante,
            "restaurantes.html?puntuaciones=1#"+encodeURIComponent(comida.codigo),
            "Ver puntuaciones",{prioridad:4,estado:"Ya valorada"});
          count++;
        }catch(error){console.warn("No se pudo consultar una valoración ya realizada",error)}
      }));
    }
  }catch(error){console.warn("No se pudieron cargar las valoraciones realizadas de Mi Pizarra",error)}
for(const d of data.deudas_comidas||[]){add("💸","Debes "+euros(d.importe)+" a "+d.persona,d.comida+" · Pago pendiente de confirmar por administración","restaurantes.html","Ver comida",{prioridad:1,pendiente:true,estado:"Pendiente"});count++}for(const d of data.cobros_comidas||[]){add("💰","Tienes pendiente de cobrar "+euros(d.importe)+" de "+d.persona,d.comida+" · Administración confirmará el cobro","restaurantes.html","Ver comida",{prioridad:3});count++}for(const b of data.reembolsos_bote||[]){add("💰","El bote te debe "+euros(b.importe),b.comida+" · Reembolso pendiente de confirmar","restaurantes.html","Ver comida",{prioridad:3});count++}for(const g of data.cobros_invitados||[]){add("💶","El invitado "+g.persona+" te debe "+euros(g.importe),g.comida+" · Cobro pendiente de confirmar","restaurantes.html","Ver comida",{prioridad:1,pendiente:true,estado:"Pendiente"});count++}const pendientesOtros=Math.max(0,Number(data.pendiente_personal||0)-Number(data.incorporacion?.existe?data.incorporacion.pendiente_cuota:0));if(pendientesOtros>0.005){add("💳","Cuotas pendientes","Tienes "+euros(pendientesOtros)+" pendientes de pago","mis-cuotas.html","Ver detalle",{prioridad:1,pendiente:true,estado:"Pendiente"});count++}// La Pizarra anuncia la próxima comida publicada; si aún no la hay,
 // conserva el aviso de organizadores sin duplicarlo.
 try {
   const {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY}=await import("./config.js");
   const base=SUPABASE_URL.replace(/\/$/,"");
   const consultar=async nombre=>{
     const respuesta=await fetch(base+"/functions/v1/listados-cofradia?consulta="+nombre,{
       method:"POST",headers:{apikey:SUPABASE_PUBLISHABLE_KEY,"x-cofrade-token":token,"Content-Type":"application/json"},
       body:"{}",cache:"no-store"
     });
     if(!respuesta.ok)throw Error(nombre+": HTTP "+respuesta.status);
     return respuesta.json();
   };
   const [respuestaComidas,respuestaOrganizadores]=await Promise.allSettled([
     consultar("listar_comidas_publicas_v2"),
     consultar("obtener_proximos_organizadores")
   ]);
   if(respuestaComidas.status==="rejected")console.warn("No se pudo consultar la próxima comida publicada",respuestaComidas.reason);
   if(respuestaOrganizadores.status==="rejected")console.warn("No se pudieron consultar los próximos organizadores",respuestaOrganizadores.reason);
   const registros=respuestaComidas.status==="fulfilled"&&Array.isArray(respuestaComidas.value)?respuestaComidas.value:[];
   const asignados=respuestaOrganizadores.status==="fulfilled"&&Array.isArray(respuestaOrganizadores.value)?respuestaOrganizadores.value:[];
   const parseFecha=valor=>{
     const partes=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(valor||""));
     if(!partes)return null;
     const fecha=new Date(+partes[1],+partes[2]-1,+partes[3]);
     return fecha.getFullYear()===+partes[1]&&fecha.getMonth()===+partes[2]-1&&fecha.getDate()===+partes[3]?fecha:null;
   };
   const ahora=new Date(),hoy=new Date(ahora.getFullYear(),ahora.getMonth(),ahora.getDate());
   const futuras=registros.filter(comida=>comida?.codigo&&comida?.restaurante&&parseFecha(comida.fecha)>=hoy)
     .sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha)));
   const proxima=futuras[0]||null;
   if(proxima||asignados.length){
     const nombresComida=proxima&&Array.isArray(proxima.organizadores)?proxima.organizadores.filter(n=>typeof n==="string"&&n.trim()):[];
     const nombresAsignados=asignados.map(persona=>String(persona.nombre||"").trim()).filter(Boolean);
     const nombres=nombresComida.length?nombresComida:nombresAsignados;
     let propio=false,companeros=[];
     try {
       if(asignados.length){
         const respuesta=await fetch(base+"/functions/v1/acceso-cofrade",{
           method:"POST",headers:{"Content-Type":"application/json"},
           body:JSON.stringify({action:"session",token}),cache:"no-store"
         });
         if(respuesta.ok){
           const sesion=await respuesta.json();
           const asignado=asignados.find(persona=>sesion?.cofrade_id&&String(persona.id)===String(sesion.cofrade_id));
           // El mensaje personal se muestra solo si pertenece a esta organización.
           propio=!!asignado&&(!proxima||!nombresComida.length||nombresComida.some(nombre=>nombre.trim().toLocaleLowerCase("es")===String(asignado.nombre||"").trim().toLocaleLowerCase("es")));
           if(propio)companeros=asignados.filter(persona=>String(persona.id)!==String(sesion.cofrade_id))
             .map(persona=>String(persona.nombre||"").trim()).filter(Boolean);
         }
       }
     }catch(error){console.warn("No se pudo verificar si toca organizar",error)}
     const tarjeta=document.createElement("section");
     tarjeta.className="pizarra-aviso pizarra-proxima";
     if(propio)tarjeta.classList.add("pizarra-aviso--pendiente");
     tarjeta.dataset.prioridad=propio?"1":"4";
     if(propio)tarjeta.dataset.pendiente="1";
     let cuerpo=tarjeta;
     if(!proxima){
       // Un solo icono, destacado como el de los otros avisos de Mi Pizarra.
       const fila=document.createElement("div");
       fila.className="pizarra-proxima-solo";
       const icono=document.createElement("span");
       icono.className="pizarra-proxima-icono";
       icono.textContent="👥";
       icono.setAttribute("aria-hidden","true");
       cuerpo=document.createElement("div");
       cuerpo.className="pizarra-proxima-solo-contenido";
       fila.append(icono,cuerpo);
       tarjeta.append(fila);
     }
     const encabezado=document.createElement("div");
     encabezado.className="pizarra-proxima-encabezado";
     const titulo=document.createElement("strong");
     titulo.textContent=proxima?"🍽️ Próxima comida":propio
       ?"Organizas la próxima comida"+(companeros.length?" junto a "+companeros.join(" y "):"")
       :"Organizadores próxima comida";
     encabezado.append(titulo);
     if(proxima){
       const estado=document.createElement("span");
       estado.className="pizarra-proxima-estado";
       estado.textContent="Programada";
       encabezado.append(estado);
     }
     cuerpo.append(encabezado);
     if(proxima){
       const restaurante=document.createElement("strong");
       restaurante.className="pizarra-proxima-restaurante";
       restaurante.textContent=proxima.restaurante;
       const fecha=document.createElement("span");
       fecha.className="pizarra-proxima-fecha";
       const fechaReal=parseFecha(proxima.fecha);
       const fechaTexto=new Intl.DateTimeFormat("es-ES",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(fechaReal);
       fecha.textContent="📅 "+fechaTexto.charAt(0).toUpperCase()+fechaTexto.slice(1);
       cuerpo.append(restaurante,fecha);
     }
     if(nombres.length){
       if(proxima){
         const organizadores=document.createElement("span");
         organizadores.className="pizarra-proxima-organizadores";
         organizadores.textContent="👥 "+nombres.join(" & ");
         cuerpo.append(organizadores);
       }else{
         const fila=document.createElement("div");
         fila.className="pizarra-proxima-nombres";
         for(const [indice,nombre] of nombres.entries()){
           if(indice){
             const separador=document.createElement("span");
             separador.className="pizarra-proxima-separador";
             separador.textContent="&";
             fila.append(separador);
           }
           const persona=document.createElement("span");
           persona.className="pizarra-proxima-persona";
           const nombreVisible=document.createElement("span");
           nombreVisible.textContent=nombre;
           const asignado=asignados.find(x=>String(x.nombre||"").trim().toLocaleLowerCase("es")===nombre.trim().toLocaleLowerCase("es"));
           const metodo=document.createElement("small");
           metodo.textContent=asignado?.metodo==="sorteo"?"Por sorteo":asignado?.metodo==="voluntario"?"Voluntario":"Pendiente de indicar";
           persona.append(nombreVisible,metodo);
           fila.append(persona);
         }
         cuerpo.append(fila);
       }
     }
     if(propio){
       const aviso=document.createElement("span");
       aviso.className="pizarra-proxima-personal";
       aviso.textContent="Te toca organizar esta comida";
       tarjeta.append(aviso);
     }
     if(proxima){
       const acciones=document.createElement("div");
       acciones.className="pizarra-proxima-acciones";
       const calendario=document.createElement("button");
       calendario.type="button";
       calendario.textContent="📅 Añadir al calendario";
       calendario.addEventListener("click",()=>guardarProximaEnCalendario(proxima));
       const ficha=document.createElement("a");
       ficha.href="restaurantes.html#"+encodeURIComponent(String(proxima.codigo));
       ficha.textContent="↗ Ver comida";
       acciones.append(calendario,ficha);
       tarjeta.append(acciones);
     }
     avisos.append(tarjeta);
     count++;
   }
 }catch(error){console.warn("No se pudo preparar el aviso de próxima comida",error)}
// Resultados de encuestas cerradas: publicación automática o controlada manualmente.
try {
  const {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY}=await import("./config.js");
  const respuesta=await fetch(SUPABASE_URL.replace(/[/]$/,"")+"/functions/v1/listados-cofradia?consulta=listar_encuestas_cofradia",{
    method:"POST",headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'x-cofrade-token':localStorage.getItem('amp_cofrade_token')||'',"Content-Type":"application/json"},
    body:"{}",cache:"no-store"
  });
  if(!respuesta.ok)throw Error("HTTP "+respuesta.status);
  const datos=await respuesta.json();
  const ahora=Date.now();
  // La consulta de la encuesta permanece mientras esté abierta, aunque ya se haya votado.
  // La comprobación usa el voto de la sesión, nunca el listado público de participantes.
  const abiertas=(Array.isArray(datos?.polls)?datos.polls:[]).filter(e=>e.status==="abierta"&&e.id);
  const yaPendientes=new Set((data.encuestas||[]).map(e=>String(e.id||"")));
  await Promise.all(abiertas.filter(e=>!yaPendientes.has(String(e.id))).map(async encuesta=>{
    try{
      const votoRespuesta=await fetch(SUPABASE_URL.replace(/[/]$/,"")+"/rest/v1/rpc/mi_voto_encuesta_sesion",{
        method:"POST",headers:{apikey:SUPABASE_PUBLISHABLE_KEY,"Content-Type":"application/json"},
        body:JSON.stringify({p_token:token,p_id:encuesta.id}),cache:"no-store"
      });
      if(!votoRespuesta.ok)return;
      const miVoto=await votoRespuesta.json();
      if(miVoto?.votado!==true)return;
      add("📊","Votación realizada",String(encuesta.title||"Encuesta"),"encuestas.html?encuesta="+encodeURIComponent(String(encuesta.id)),"Consultar",{prioridad:4,estado:"Votada"});
    }catch(error){console.warn("No se pudo comprobar un voto de Mi Pizarra",error)}
  }));
  for(const encuesta of (Array.isArray(datos?.polls)?datos.polls:[])){
    if(encuesta.status!=="cerrada")continue;
    // No anunciar resultados ocultos por administración.
    if(encuesta.showResults===false)continue;
    // El modo manual permite publicar inmediatamente tras el cierre o retirar el aviso.
    // Las encuestas cerradas siguen siendo la única fuente de resultados visibles.
    const modo=String(encuesta.pizarraMode||"automatica");
    if(modo==="oculta")continue;
    if(modo!=="publicada"){
      const dias=Number(encuesta.pizarraDays??7);
      if(!Number.isInteger(dias)||dias<=0)continue;
      const cierre=encuesta.closedAt||encuesta.closes;
      if(!cierre)continue;
      const fechaCierre=new Date(String(cierre).replace(' ','T'));
      if(!Number.isFinite(fechaCierre.getTime()))continue;
      const antiguedad=ahora-fechaCierre.getTime();
      if(antiguedad<0||antiguedad>=dias*24*60*60*1000)continue;
    }
    const titulo=String(encuesta.title||"Encuesta sin título");
    const total=Number(encuesta.totalVotes)||0;
    const ganadores=Array.isArray(encuesta.winners)?encuesta.winners:[];
    const ganador=encuesta.winner?.name?String(encuesta.winner.name):"";
    const mostrarGanador=encuesta.showWinner!==false;
    const resultado=mostrarGanador
      ? (encuesta.isTie&&ganadores.length?"Empate: "+ganadores.map(x=>x.name).join(", "):ganador?"Ganador: "+ganador:"Resultados disponibles")
      : "Resultados disponibles";
    const detalle=titulo+" · "+resultado+" · "+total+" voto"+(total===1?"":"s");
    add("📊","Resultado de la votación",detalle,"encuestas.html?encuesta="+encodeURIComponent(String(encuesta.id||"")),"Ver resultados",{prioridad:4});
    count++;
  }
}catch(error){console.warn("No se pudieron cargar los resultados recientes en Mi Pizarra:",error)}
// Los anuncios públicos vigentes también son avisos de Mi Pizarra.
try {
  const {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY}=await import("./config.js");
  const response=await fetch(SUPABASE_URL.replace(/\/$/,"")+"/functions/v1/listados-cofradia?consulta=listar_anuncios_publicos_v2",{
    method:"POST",
    headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'x-cofrade-token':localStorage.getItem('amp_cofrade_token')||'',"Content-Type":"application/json"},
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
    const esEstatutos=normal(titulo).startsWith("estatutos actualizados")&&String(anuncio.enlace||"").includes("/AMesaPuesta/v2/estatutos.html");
    const destino=esEstatutos?"estatutos.html":(anuncio.id?"anuncios.html?anuncio="+encodeURIComponent(String(anuncio.id)):"anuncios.html");
    add(esEstatutos?"📜":"📣",titulo,txt(anuncio.texto),destino,esEstatutos?"Consultar Estatutos":"Leer anuncio",{prioridad:5});
    count++;
  }
}catch(error){console.warn("No se pudieron cargar los anuncios en Mi Pizarra:",error)}
// Orden estable: primero urgencias y tareas pendientes; después avisos informativos.
const tarjetas=Array.from(avisos.children);
tarjetas.sort((a,b)=>Number(a.dataset.prioridad??5)-Number(b.dataset.prioridad??5));
avisos.replaceChildren(...tarjetas);
const total=tarjetas.length;
const pendientes=tarjetas.filter(x=>x.dataset.pendiente==="1").length;
if(!total){const ok=document.createElement("p");ok.className="pizarra-empty";ok.textContent="¡Todo al día! Ya puedes dedicarte a lo importante: la próxima comida.";avisos.append(ok)}$("pizarra-count").hidden=!pendientes;$("pizarra-count").textContent=pendientes+" pendiente"+(pendientes===1?"":"s");$("pizarra-recaudado").textContent=euros(data.cuotas_recaudadas);$("pizarra-gastos").textContent=euros(data.gastos_remanente);$("pizarra-remanente").textContent=euros(data.remanente);const nota=$("pizarra-economia-nota");if(nota)nota.remove();$("pizarra-saludo").textContent=pendientes?"Tienes "+pendientes+" asunto"+(pendientes===1?" pendiente":"s pendientes")+". ¡No lo dejes para después de la sobremesa!":"¡Todo al día! Ya puedes dedicarte a lo importante: la próxima comida.";}).catch(()=>{avisos.replaceChildren();const err=document.createElement("p");err.className="pizarra-empty";err.textContent="No se ha podido cargar tu pizarra. Vuelve a intentarlo más tarde.";avisos.append(err)})})();