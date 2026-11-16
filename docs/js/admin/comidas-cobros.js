// Panel rápido de transferencias entre cofrades. Reutiliza las RPC de liquidaciones existentes.
export function crearPanelCobrosComidas({sb,getComidas,onActualizado}){
 const boton=document.getElementById("abrirCobrosComidas");
 const contador=document.getElementById("contadorCobrosComidas");
 const dialogo=document.getElementById("dialogoCobrosComidas");
 const contenido=document.getElementById("cobrosComidasContenido");
 const resumen=document.getElementById("cobrosComidasResumen");
 const aviso=document.getElementById("cobrosComidasAviso");
 const cerrar=document.getElementById("cerrarCobrosComidas");
 const filtros=[...dialogo.querySelectorAll("[data-filtro-cobros]")];
 const recientes=new Set();
 let grupos=[],filtro="pendientes",consultaEnCurso=null,guardando=false;
 const euros=n=>new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"}).format(Number(n||0));
 const fecha=d=>d?new Date(d+"T12:00:00").toLocaleDateString("es-ES"):"—";
 const nodo=(tag,clase,texto)=>{const el=document.createElement(tag);if(clase)el.className=clase;if(texto!==undefined)el.textContent=texto;return el};
 const pendientes=g=>(g.movimientos||[]).filter(m=>!m.pagado);
 const cantidad=()=>grupos.reduce((n,g)=>n+pendientes(g).length,0);
 function actualizarContador(){
  const n=cantidad();
  contador.textContent=n?"("+n+")":"";
  boton.title=n?n+" transferencias pendientes":"Sin transferencias pendientes";
 }
 function mensaje(texto="",error=false){aviso.textContent=texto;aviso.classList.toggle("cobros-error",error)}
 async function consultar(){
  if(consultaEnCurso)return consultaEnCurso;
  consultaEnCurso=(async()=>{
   const comidas=(getComidas()||[]).slice().sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha)));
   const recibidos=[];
   // Se usan las mismas lecturas autorizadas que el editor. Limitar concurrencia.
   for(let i=0;i<comidas.length;i+=5){
    const bloque=comidas.slice(i,i+5);
    const respuestas=await Promise.all(bloque.map(c=>sb.rpc("estado_liquidacion_comida_admin",{p_comida:c.id})));
    respuestas.forEach((r,j)=>{
     if(r.error)throw r.error;
     const datos=r.data;
     if(datos?.cerrada && Array.isArray(datos.movimientos) && datos.movimientos.length)
      recibidos.push({comida:bloque[j],movimientos:datos.movimientos,pagados:datos.pagados,total:datos.total});
    });
   }
   grupos=recibidos;
   actualizarContador();
   pintar();
  })().finally(()=>{consultaEnCurso=null});
  return consultaEnCurso;
 }
 function filaPago(grupo,m){
  const fila=nodo("div","cobros-comida-fila");
  const datos=nodo("div","cobros-comida-datos");
  datos.append(nodo("div","cobros-comida-nombres",String(m.de||"")+" → "+String(m.a||"")),nodo("strong","cobros-comida-importe",euros(m.importe)));
  const accion=nodo("button","cobros-comida-estado "+(m.pagado?"esta-pagado":"esta-pendiente"),m.pagado?"✓ Pagado":"Pendiente");
  accion.type="button";accion.disabled=guardando;
  accion.title=m.pagado?"Volver a marcar como pendiente":"Marcar la transferencia como pagada";
  accion.addEventListener("click",()=>cambiarEstado(grupo,m));
  fila.append(datos,accion);
  return fila;
 }
 function pintar(){
  filtros.forEach(b=>{const activo=b.dataset.filtroCobros===filtro;b.classList.toggle("activo",activo);b.setAttribute("aria-pressed",String(activo))});
  const n=cantidad();
  resumen.textContent=n?n+" transferencia"+(n===1?" pendiente":"s pendientes")+" entre cofrades · "+euros(grupos.reduce((s,g)=>s+pendientes(g).reduce((t,m)=>t+Number(m.importe||0),0),0)):"Todas las transferencias entre cofrades están cobradas.";
  contenido.replaceChildren();
  const visibles=grupos.filter(g=>filtro==="todos"||pendientes(g).length||(g.movimientos||[]).some(m=>recientes.has(m.id)));
  if(!visibles.length){
   contenido.append(nodo("p","cobros-sin-pendientes",filtro==="todos"?"No hay transferencias registradas en comidas con liquidación cerrada.":"No hay cobros pendientes entre cofrades."));
   return;
  }
  for(const grupo of visibles){
   const card=nodo("section","cobros-comida-card");
   const cabecera=nodo("div","cobros-comida-cabecera");
   const titulos=nodo("div","cobros-comida-titulos");
   titulos.append(nodo("h3","",grupo.comida.restaurante?.nombre||"Comida sin restaurante"),nodo("span","cobros-comida-fecha",fecha(grupo.comida.fecha)));
   cabecera.append(titulos,nodo("span","cobros-comida-progreso",grupo.pagados+"/"+grupo.total+" pagados"));
   card.append(cabecera);
   const debidos=pendientes(grupo);
   const pagados=(grupo.movimientos||[]).filter(m=>m.pagado);
   const cambiados=pagados.filter(m=>recientes.has(m.id));
   if(debidos.length){
    const caja=nodo("div","cobros-comida-movimientos");
    debidos.forEach(m=>caja.append(filaPago(grupo,m)));
    card.append(caja);
   }else card.append(nodo("p","cobros-todos-pagados","✓ Sin transferencias pendientes."));
   if(cambiados.length){
    const caja=nodo("div","cobros-cambios-recientes");
    caja.append(nodo("div","cobros-cambios-titulo","Marcados como pagados ahora · puedes deshacerlo"));
    cambiados.forEach(m=>caja.append(filaPago(grupo,m)));
    card.append(caja);
   }
   const resto=pagados.filter(m=>!recientes.has(m.id));
   if(resto.length){
    const detalle=nodo("details","cobros-comida-historico");
    const sum=nodo("summary","", "Ver "+resto.length+" transferencia"+(resto.length===1?" pagada":"s pagadas"));
    detalle.append(sum);
    resto.forEach(m=>detalle.append(filaPago(grupo,m)));
    card.append(detalle);
   }
   contenido.append(card);
  }
 }
 async function cambiarEstado(grupo,m){
  if(guardando)return;
  guardando=true;
  contenido.querySelectorAll("button").forEach(b=>b.disabled=true);
  mensaje("Actualizando el cobro…");
  try{
   const nuevoEstado=!Boolean(m.pagado);
   const {error}=await sb.rpc("marcar_pago_liquidacion_admin",{p_id:m.id,p_pagado:nuevoEstado});
   if(error)throw error;
   recientes.add(m.id);
   // Leer de nuevo la liquidación para mostrar el estado guardado y sus totales reales.
   const {data,error:errLectura}=await sb.rpc("estado_liquidacion_comida_admin",{p_comida:grupo.comida.id});
   if(errLectura)throw new Error("Se guardó el cambio, pero no se pudo leer el nuevo estado. Usa Actualizar.");
   if(!data?.cerrada)throw new Error("La liquidación se ha reabierto. Actualiza el listado.");
   grupo.movimientos=Array.isArray(data.movimientos)?data.movimientos:[];
   grupo.pagados=data.pagados;grupo.total=data.total;
   mensaje("Cambio guardado correctamente.");
   if(typeof onActualizado==="function")Promise.resolve(onActualizado(grupo.comida.id)).catch(console.error);
  }catch(e){mensaje("No se ha podido completar la operación: "+(e.message||String(e)),true)}
  finally{guardando=false;actualizarContador();pintar()}
 }
 filtros.forEach(b=>b.addEventListener("click",()=>{filtro=b.dataset.filtroCobros;pintar()}));
 cerrar.addEventListener("click",()=>dialogo.close());
 dialogo.addEventListener("close",()=>{recientes.clear();mensaje("")});
 boton.addEventListener("click",async()=>{
  if(!dialogo.open)dialogo.showModal();
  filtro="pendientes";mensaje("Consultando cobros…");contenido.replaceChildren(nodo("p","cobros-sin-pendientes","Cargando transferencias…"));
  try{await consultar();mensaje("")}catch(e){mensaje("No se pudieron consultar los cobros: "+(e.message||String(e)),true);contenido.replaceChildren()}
 });
 document.getElementById("actualizarCobrosComidas").addEventListener("click",async()=>{
  if(guardando)return;
  mensaje("Actualizando…");
  try{await consultar();mensaje("")}catch(e){mensaje("No se pudieron actualizar los cobros: "+(e.message||String(e)),true)}
 });
 return {
  actualizar:()=>consultar().catch(e=>{console.warn("Error consultando cobros de comidas:",e);contador.textContent="";boton.title="No se pudieron consultar los cobros";}),
  estaAbierto:()=>dialogo.open
 };
}
