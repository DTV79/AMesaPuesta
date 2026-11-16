// Cobros rápidos: transferencias y reembolsos del bote, con las RPC existentes.
export function crearPanelCobrosComidas({sb,getComidas,onActualizado}){
 const boton=document.getElementById("abrirCobrosComidas");
 const contador=document.getElementById("contadorCobrosComidas");
 const dialogo=document.getElementById("dialogoCobrosComidas");
 const contenido=document.getElementById("cobrosComidasContenido");
 const resumen=document.getElementById("cobrosComidasResumen");
 const totalPendienteEl=document.getElementById("cobrosTotalPendiente");
 const totalCobradoEl=document.getElementById("cobrosTotalCobrado");
 const detallePendienteEl=document.getElementById("cobrosDetallePendiente");
 const detalleCobradoEl=document.getElementById("cobrosDetalleCobrado");
 const alcanceTotales=document.getElementById("cobrosAlcanceTotales");
 const aviso=document.getElementById("cobrosComidasAviso");
 const cerrar=document.getElementById("cerrarCobrosComidas");
 const filtros=[...dialogo.querySelectorAll("[data-filtro-cobros]")];
 const selectorAnio=document.getElementById("anioCobrosComidas");
 const campoAnio=document.getElementById("filtroAnioCobrosComidas");
 const recientes=new Set();
 let grupos=[],filtro="pendientes",consultaEnCurso=null,guardando=false,anioSeleccionado=null,comidaDesplegada=null;
 const euros=n=>new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"}).format(Number(n||0));
 const fecha=d=>d?new Date(d+"T12:00:00").toLocaleDateString("es-ES"):"—";
 const nodo=(tag,clase,texto)=>{const el=document.createElement(tag);if(clase)el.className=clase;if(texto!==undefined)el.textContent=texto;return el};
 const movimientos=g=>(g.movimientos||[]);
 const reembolsos=g=>(g.bote||[]);
 const pendientes=g=>[...movimientos(g),...reembolsos(g)].filter(m=>!m.pagado);
 const claveReciente=(tipo,id)=>tipo+":"+id;
 const centimos=lista=>lista.reduce((s,m)=>s+Math.round(Number(m.importe||0)*100),0);
 const pagosFiltrados=(grupos,prop,pagado)=>grupos.flatMap(g=>prop==="bote"?reembolsos(g):movimientos(g)).filter(m=>Boolean(m.pagado)===pagado);

 const anioDe=g=>/^\d{4}$/.test(String(g.comida?.fecha||"").slice(0,4))?String(g.comida.fecha).slice(0,4):"Sin año";
 function configurarFiltroAnio(){
  const anios=[...new Set(grupos.map(anioDe))].sort((a,b)=>b.localeCompare(a,"es"));
  if(anioSeleccionado!=="todos"&&!anios.includes(anioSeleccionado))anioSeleccionado=anios[0]||"todos";
  selectorAnio.replaceChildren();
  const todos=nodo("option","","Todos los años");todos.value="todos";selectorAnio.append(todos);
  for(const anio of anios){const opcion=nodo("option","",anio);opcion.value=anio;selectorAnio.append(opcion)}
  selectorAnio.value=anioSeleccionado;
 }
 const cantidad=()=>grupos.reduce((n,g)=>n+pendientes(g).length,0);
 function actualizarContador(){
  const n=cantidad();
  contador.textContent=n?"("+n+")":"";
  boton.title=n?n+" pagos o reembolsos pendientes":"Sin transferencias ni reembolsos pendientes";
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
     if(datos?.cerrada && ((Array.isArray(datos.movimientos)&&datos.movimientos.length)||(Array.isArray(datos.bote)&&datos.bote.length)))
      recibidos.push({comida:bloque[j],movimientos:datos.movimientos||[],bote:datos.bote||[],pagados:datos.pagados,total:datos.total});
    });
   }
   grupos=recibidos;
   actualizarContador();
   pintar();
  })().finally(()=>{consultaEnCurso=null});
  return consultaEnCurso;
 }
 function filaPago(grupo,m,tipo){
  const esBote=tipo==="bote";
  const fila=nodo("div","cobros-comida-fila");
  const datos=nodo("div","cobros-comida-datos");
  const descripcion=esBote?"Bote → "+String(m.a||""):String(m.de||"")+" → "+String(m.a||"");
  datos.append(nodo("div","cobros-comida-nombres",descripcion),nodo("strong","cobros-comida-importe",euros(m.importe)));
  const accion=nodo("button","cobros-comida-estado "+(m.pagado?"esta-pagado":"esta-pendiente"),m.pagado?(esBote?"✓ Reembolsado":"✓ Pagado"):"Pendiente");
  accion.type="button";accion.disabled=guardando;
  accion.title=m.pagado?(esBote?"Volver a marcar el reembolso como pendiente":"Volver a marcar como pendiente"):(esBote?"Marcar reembolso del bote como pagado":"Marcar transferencia como pagada");
  accion.addEventListener("click",()=>cambiarEstado(grupo,m,tipo));
  fila.append(datos,accion);
  return fila;
 }
 function pintarSeccion(grupo,card,tipo,esHistorico){
  const items=tipo==="bote"?reembolsos(grupo):movimientos(grupo);
  if(!items.length)return;
  const pendientesSeccion=items.filter(m=>!m.pagado);
  const cobradosSeccion=items.filter(m=>m.pagado);
  const recientesSeccion=cobradosSeccion.filter(m=>recientes.has(claveReciente(tipo,m.id)));
  if(!esHistorico&&!pendientesSeccion.length&&!recientesSeccion.length)return;
  const seccion=nodo("section","cobros-comida-seccion");
  seccion.append(nodo("h4","cobros-comida-seccion-titulo",tipo==="bote"?"💰 Reembolsos del bote":"Transferencias entre cofrades"));
  if(pendientesSeccion.length){
   const caja=nodo("div","cobros-comida-movimientos");
   pendientesSeccion.forEach(m=>caja.append(filaPago(grupo,m,tipo)));
   seccion.append(caja);
  }else if(esHistorico){
   seccion.append(nodo("p","cobros-todos-pagados",tipo==="bote"?"✓ Reembolsos al día.":"✓ Transferencias al día."));
  }
  if(recientesSeccion.length){
   const caja=nodo("div","cobros-cambios-recientes");
   caja.append(nodo("div","cobros-cambios-titulo","Marcados ahora como pagados · puedes deshacerlo"));
   recientesSeccion.forEach(m=>caja.append(filaPago(grupo,m,tipo)));
   seccion.append(caja);
  }
  const anteriores=cobradosSeccion.filter(m=>!recientes.has(claveReciente(tipo,m.id)));
  if(anteriores.length){
   const detalle=nodo("details","cobros-comida-historico");
   detalle.append(nodo("summary","","Ver "+anteriores.length+(tipo==="bote"?" reembolso"+(anteriores.length===1?"":"s")+" realizado"+(anteriores.length===1?"":"s"):" transferencia"+(anteriores.length===1?" pagada":"s pagadas"))));
   anteriores.forEach(m=>detalle.append(filaPago(grupo,m,tipo)));
   seccion.append(detalle);
  }
  card.append(seccion);
 }
 function pintar(){
  filtros.forEach(b=>{const activo=b.dataset.filtroCobros===filtro;b.classList.toggle("activo",activo);b.setAttribute("aria-pressed",String(activo))});
  campoAnio.hidden=filtro!=="todos";
  if(filtro==="todos")configurarFiltroAnio();
  const paraTotales=filtro==="todos"&&anioSeleccionado!=="todos"?grupos.filter(g=>anioDe(g)===anioSeleccionado):grupos;
  const pendienteTransferencias=centimos(pagosFiltrados(paraTotales,"movimientos",false));
  const pendienteBote=centimos(pagosFiltrados(paraTotales,"bote",false));
  const cobradoTransferencias=centimos(pagosFiltrados(paraTotales,"movimientos",true));
  const cobradoBote=centimos(pagosFiltrados(paraTotales,"bote",true));
  totalPendienteEl.textContent=euros((pendienteTransferencias+pendienteBote)/100);
  totalCobradoEl.textContent=euros((cobradoTransferencias+cobradoBote)/100);
  detallePendienteEl.textContent="Cofrades "+euros(pendienteTransferencias/100)+" · Bote "+euros(pendienteBote/100);
  detalleCobradoEl.textContent="Cofrades "+euros(cobradoTransferencias/100)+" · Bote "+euros(cobradoBote/100);
  alcanceTotales.textContent=filtro==="todos"&&anioSeleccionado!=="todos"?"Ejercicio "+anioSeleccionado:"Todas las comidas";
  const n=paraTotales.reduce((total,g)=>total+pendientes(g).length,0);
  resumen.textContent=n?n+" movimiento"+(n===1?" pendiente":"s pendientes")+" entre cofrades y bote":"Sin transferencias ni reembolsos pendientes.";
  const posAnterior=contenido.scrollTop;
  contenido.replaceChildren();
  const tieneRecientes=g=>[...movimientos(g).map(m=>claveReciente("transferencia",m.id)),...reembolsos(g).map(m=>claveReciente("bote",m.id))].some(k=>recientes.has(k));
  const visibles=grupos.filter(g=>filtro==="todos"?(anioSeleccionado==="todos"||anioDe(g)===anioSeleccionado):pendientes(g).length||tieneRecientes(g));
  if(!visibles.length){
   contenido.append(nodo("p","cobros-sin-pendientes",filtro==="todos"?"No hay transferencias o reembolsos registrados para el año seleccionado.":"No hay transferencias ni reembolsos del bote pendientes."));
   return;
  }
  let anioAnterior="";
  for(const grupo of visibles){
   if(filtro==="todos"&&anioSeleccionado==="todos"&&anioDe(grupo)!==anioAnterior){
    anioAnterior=anioDe(grupo);
    contenido.append(nodo("h3","cobros-cabecera-anio",anioAnterior));
   }
   const esHistorico=filtro==="todos";
   const desplegado=String(comidaDesplegada)===String(grupo.comida.id);
   const card=nodo("section","cobros-comida-card"+(esHistorico?" cobros-comida-compacta":""));
   const cabecera=nodo(esHistorico?"button":"div","cobros-comida-cabecera"+(esHistorico?" cobros-comida-toggle":""));
   const titulos=nodo("div","cobros-comida-titulos");
   titulos.append(nodo("h3","",grupo.comida.restaurante?.nombre||"Comida sin restaurante"),nodo("span","cobros-comida-fecha",fecha(grupo.comida.fecha)));
   const meta=nodo("span","cobros-comida-meta");
   const pagosTotales=movimientos(grupo).length+reembolsos(grupo).length;
   const pagosCompletados=pagosTotales-pendientes(grupo).length;
   meta.append(nodo("span","cobros-comida-progreso",pagosCompletados+"/"+pagosTotales+" liquidados"));
   if(esHistorico){
    const sinPagar=pendientes(grupo).length;
    if(sinPagar)meta.append(nodo("span","cobros-comida-badge",sinPagar+" pendiente"+(sinPagar===1?"":"s")));
    else meta.append(nodo("span","cobros-comida-check","✓"));
    meta.append(nodo("span","cobros-comida-chevron",desplegado?"⌃":"⌄"));
    cabecera.type="button";
    cabecera.setAttribute("aria-expanded",String(desplegado));
    cabecera.setAttribute("aria-label",(desplegado?"Cerrar ":"Ver ")+"cobros y reembolsos de "+(grupo.comida.restaurante?.nombre||"la comida")+" del "+fecha(grupo.comida.fecha));
    cabecera.addEventListener("click",()=>{comidaDesplegada=desplegado?null:grupo.comida.id;pintar()});
   }
   cabecera.append(titulos,meta);
   card.append(cabecera);
   if(esHistorico&&!desplegado){contenido.append(card);continue}
   pintarSeccion(grupo,card,"transferencia",esHistorico);
   pintarSeccion(grupo,card,"bote",esHistorico);
   contenido.append(card);
  }
  contenido.scrollTop=posAnterior;
 }
 async function cambiarEstado(grupo,m,tipo){
  if(guardando)return;
  guardando=true;
  contenido.querySelectorAll("button").forEach(b=>b.disabled=true);
  mensaje(tipo==="bote"?"Actualizando el reembolso del bote…":"Actualizando la transferencia…");
  try{
   const nuevoEstado=!Boolean(m.pagado);
   const rpc=tipo==="bote"?"marcar_pago_bote_liquidacion_admin":"marcar_pago_liquidacion_admin";
   const {error}=await sb.rpc(rpc,{p_id:m.id,p_pagado:nuevoEstado});
   if(error)throw error;
   recientes.add(claveReciente(tipo,m.id));
   const {data,error:errLectura}=await sb.rpc("estado_liquidacion_comida_admin",{p_comida:grupo.comida.id});
   if(errLectura)throw new Error("El cambio se guardó, pero no se pudo consultar el nuevo estado. Pulsa Actualizar.");
   if(!data?.cerrada)throw new Error("La liquidación ya no está cerrada. Pulsa Actualizar.");
   grupo.movimientos=Array.isArray(data.movimientos)?data.movimientos:[];
   grupo.bote=Array.isArray(data.bote)?data.bote:[];
   grupo.pagados=data.pagados;grupo.total=data.total;
   mensaje("Estado actualizado correctamente.");
   if(typeof onActualizado==="function")Promise.resolve(onActualizado(grupo.comida.id)).catch(console.error);
  }catch(e){mensaje("No se ha podido completar la operación: "+(e.message||String(e)),true)}
  finally{guardando=false;actualizarContador();pintar()}
 }
 filtros.forEach(b=>b.addEventListener("click",()=>{filtro=b.dataset.filtroCobros;comidaDesplegada=null;pintar();contenido.scrollTop=0}));
 selectorAnio.addEventListener("change",()=>{anioSeleccionado=selectorAnio.value;comidaDesplegada=null;pintar();contenido.scrollTop=0});
 cerrar.addEventListener("click",()=>dialogo.close());
 dialogo.addEventListener("close",()=>{recientes.clear();mensaje("")});
 boton.addEventListener("click",async()=>{
  if(!dialogo.open)dialogo.showModal();
  filtro="pendientes";anioSeleccionado=null;comidaDesplegada=null;mensaje("Consultando cobros…");contenido.replaceChildren(nodo("p","cobros-sin-pendientes","Cargando transferencias…"));
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
