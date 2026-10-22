async function cargarBalanceEjercicios(){
 const body=document.getElementById("balance-ejercicios-body"),errorEl=document.getElementById("balance-ejercicios-error");
 const {data,error}=await supabase.rpc("balance_ejercicios_tesoreria_admin");
 if(error){body.innerHTML='<tr><td colspan="5">No se pudo cargar el balance.</td></tr>';errorEl.textContent=error.message;return}
 errorEl.textContent="";const rows=Array.isArray(data)?data:[];
 const td=(text,clase="")=>{const el=document.createElement("td");el.textContent=text;if(clase)el.className=clase;return el};
 body.replaceChildren();
 for(const x of rows){const tr=document.createElement("tr");tr.append(td(String(x.ejercicio)),td(euro(x.ingresos)),td(euro(x.gastos)),td(euro(x.resultado),Number(x.resultado)<0?"bad":"ok"),td(euro(x.remanente),Number(x.remanente)<0?"bad":"ok"));body.append(tr)}
 if(!rows.length){const tr=document.createElement("tr");const cell=td("Sin movimientos registrados.");cell.colSpan=5;tr.append(cell);body.append(tr)}
 const ingresos=rows.reduce((s,x)=>s+Number(x.ingresos||0),0),gastos=rows.reduce((s,x)=>s+Number(x.gastos||0),0);
 document.getElementById("balance-total-ingresos").textContent=euro(ingresos);
 document.getElementById("balance-total-gastos").textContent=euro(gastos);
 document.getElementById("balance-total-resultado").textContent=euro(ingresos-gastos);
 document.getElementById("balance-total-remanente").textContent=euro(rows.length?rows[0].remanente:0);
}
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.0/+esm";
const supabase=createClient("https://wmfcpnihymiiwgpvbngj.supabase.co","sb_publishable_ij3sYbyMrLI2B34OOYt6JA_Aez1R2cJ");
let filas=[];
let filtroCuotas='todos';
function filtrarCuotas(){const alDia=filas.filter(r=>r.estado==='al_corriente').length;document.querySelectorAll('[data-filtro-cuotas]').forEach(b=>{const tipo=b.dataset.filtroCuotas;b.classList.toggle('activo',tipo===filtroCuotas);b.setAttribute('aria-pressed',String(tipo===filtroCuotas));b.querySelector('.cantidad').textContent=tipo==='todos'?filas.length:tipo==='al_corriente'?alDia:filas.length-alDia;});const visibles=filas.filter(r=>filtroCuotas==='todos'||(filtroCuotas==='al_corriente'?r.estado==='al_corriente':r.estado!=='al_corriente'));pintarFilas(visibles);}
function pintarFilas(visibles){
 $("#tbody").innerHTML=visibles.map(r=>'<tr><td class="name">'+r.nombre+'</td><td><span class="pill '+(r.estado==="al_corriente"?"ok":"bad")+'">● '+(r.estado==="al_corriente"?"Al corriente":r.estado==="parcial"?"Parcial":"Pendiente")+'</span></td><td class="desktop">'+euro(r.importe_asignado)+'</td><td class="desktop">'+euro(r.pagado)+'</td><td><strong>'+euro(r.pendiente)+'</strong></td><td class="action" data-c="'+r.cofrade_id+'" data-q="'+r.cuota_id+'">'+(Number(r.pendiente)>0?"Cobrar":"Ver")+'</td></tr>').join("");
 document.querySelectorAll(".action").forEach(x=>x.onclick=()=>abrirPago(x.dataset.c,x.dataset.q));

}
const $=s=>document.querySelector(s), euro=n=>{const p=(Number(n)||0).toFixed(2).split(".");return p[0].replace(/\B(?=(\d{3})+(?!\d))/g,".")+","+p[1]+" €"};
const hoy=()=>new Date().toISOString().slice(0,10);

async function guard(){
 const {data:{session}}=await supabase.auth.getSession();
 if(!session){document.body.innerHTML='<main class="shell"><section class="panel"><h1>Administración</h1><p>Inicia sesión desde el acceso de administrador.</p></section></main>';return false}
 const {data:admin}=await supabase.rpc("soy_admin_cofradia");
 if(!admin){document.body.innerHTML='<main class="shell"><section class="panel"><h1>Acceso restringido</h1></section></main>';return false}
 return true;
}
async function cargarTesoreria(){const errorEl=document.getElementById("tes-error");try{const {data,error}=await supabase.rpc("resumen_tesoreria_admin");if(error)throw error;document.getElementById("tes-recaudado").textContent=euro(data.recaudado);document.getElementById("tes-gastos").textContent=euro(data.gastos);document.getElementById("tes-remanente").textContent=euro(data.remanente);const esc=s=>String(s??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));document.getElementById("tes-cofrades").innerHTML=(data.cofrades||[]).map(x=>"<tr><td>"+esc(x.nombre)+"</td><td><strong>"+euro(x.pagado)+"</strong></td></tr>").join("");const fecha=s=>s?String(s).slice(0,10).split("-").reverse().join("/"):"—";document.getElementById("tes-comidas").innerHTML=(data.comidas||[]).map(x=>"<tr><td>"+fecha(x.fecha)+"</td><td>"+esc(x.restaurante)+"</td><td>"+euro(x.factura_restaurante)+"</td><td>"+euro(x.gastos_adicionales)+"</td><td>"+euro(x.bote_comprometido)+"</td><td>"+euro(x.gastos_remanente)+"</td></tr>").join("");const totalCampo=(items,k)=>items.reduce((s,x)=>s+Number(x[k]||0),0);const comidas=data.comidas||[],cofrades=data.cofrades||[];document.getElementById("tes-cofrades-total").textContent=euro(totalCampo(cofrades,"pagado"));document.getElementById("tes-restaurantes-total").textContent=euro(totalCampo(comidas,"factura_restaurante"));document.getElementById("tes-adicionales-total").textContent=euro(totalCampo(comidas,"gastos_adicionales"));document.getElementById("tes-comprometido-total").textContent=euro(totalCampo(comidas,"bote_comprometido"));document.getElementById("tes-remanente-total").textContent=euro(totalCampo(comidas,"gastos_remanente"));errorEl.textContent=""}catch(e){errorEl.textContent="No se pudo cargar el resumen económico: "+e.message}}
async function cargar(){
 const {data:rows,error}=await supabase.rpc("listar_cuotas_cofrades_admin",{p_ejercicio:new Date().getFullYear()});
 if(error)throw error; filas=rows||[];
 const total=filas.reduce((s,r)=>s+Number(r.importe_asignado),0),cobrado=filas.reduce((s,r)=>s+Number(r.pagado),0);
 $("#cuotas-asignadas").textContent=euro(total);$("#cuotas-cobradas").textContent=euro(cobrado);
 $("#cuotas-pendientes").textContent=euro(total-cobrado);$("#cuotas-al-dia").textContent=filas.filter(r=>r.estado==="al_corriente").length+" / "+filas.length;
 filtrarCuotas();
 await cargarHistorico();
 await cargarTesoreria();
 await cargarBalanceEjercicios();
}
let anulacionPendiente=null;
function cerrarAnularCobro(){document.getElementById("confirmAnularCobro").classList.remove("open");anulacionPendiente=null;}
function mostrarAnularCobro(p,cofradeId,cuotaId){
 anulacionPendiente={p,cofradeId,cuotaId};
 document.getElementById("anularCobroTexto").textContent="¿Anular el cobro de "+euro(p.importe)+"? El importe volverá a quedar pendiente y se conservará el registro de la anulación.";
 document.getElementById("anularCobroMotivo").value="";document.getElementById("anularCobroError").textContent="";
 document.getElementById("aceptarAnularCobro").disabled=false;
 document.getElementById("confirmAnularCobro").classList.add("open");
 document.getElementById("anularCobroMotivo").focus();
}
document.getElementById("cancelarAnularCobro").onclick=cerrarAnularCobro;
document.getElementById("aceptarAnularCobro").onclick=async()=>{
 if(!anulacionPendiente)return;
 const motivo=document.getElementById("anularCobroMotivo").value.trim();const errorEl=document.getElementById("anularCobroError");
 if(motivo.length<3){errorEl.textContent="Indica un motivo de al menos 3 caracteres.";return;}
 const btn=document.getElementById("aceptarAnularCobro");btn.disabled=true;
 const {p,cofradeId,cuotaId}=anulacionPendiente;
 const {error}=await supabase.rpc("anular_pago_cuota_admin",{p_pago:p.id,p_motivo:motivo});
 if(error){errorEl.textContent=error.message;btn.disabled=false;return;}
 cerrarAnularCobro();document.getElementById("drawer").classList.remove("open");await cargar();await abrirPago(cofradeId,cuotaId);
};
async function abrirPago(cofradeId,cuotaId){
 const r=filas.find(x=>x.cofrade_id===cofradeId&&x.cuota_id===cuotaId);if(!r)return;
 $("#cofradeId").value=cofradeId;$("#cuotaId").value=cuotaId;$("#fNombre").textContent=r.nombre;
 $("#fEstado").innerHTML='<div class="card"><div class="muted">Cuota '+r.ejercicio+'</div><div style="margin-top:6px">Asignado: <b>'+euro(r.importe_asignado)+'</b> · Pagado: <b>'+euro(r.pagado)+'</b> · Pendiente: <b>'+euro(r.pendiente)+'</b></div></div>';
 $("#importe").value=Number(r.pendiente)>0?Number(r.pendiente).toFixed(2):"";$("#importe").max=Number(r.pendiente);$("#fecha").value=hoy();$("#metodo").value="";$("#referencia").value="";$("#okPago").style.display="none";
 const {data,error}=await supabase.rpc("pagos_cuota_cofrade_admin",{p_cofrade:cofradeId,p_cuota:cuotaId});
 const historial=$("#historial");historial.replaceChildren();
 if(error){historial.textContent="Error al cargar pagos: "+error.message;}
 else if(!data?.length){historial.textContent="Sin pagos registrados.";}
 else for(const p of data){
  const item=document.createElement("div");item.className="history-item";
  const detalle=document.createElement("div");detalle.className="history-info";
  const cabecera=document.createElement("strong");cabecera.className="history-amount";cabecera.textContent=euro(p.importe);
  const concepto=document.createElement("div");concepto.className="history-concept";
  const referencia=String(p.referencia||"").trim();
  // Las referencias ALTA:/INCORPORACION: son identificadores internos: no se muestran.
  const esAlta=/^(ALTA|INCORPORACION):[a-f0-9-]{36}$/i.test(referencia);
  concepto.textContent=esAlta?"Cuota anual "+r.ejercicio+" · Incorporación":"Cuota anual "+r.ejercicio;
  const meta=document.createElement("div");meta.className="history-meta";
  meta.textContent=new Date(p.fecha+"T12:00:00").toLocaleDateString("es-ES")+(p.metodo_pago?" · "+p.metodo_pago:"Sin método indicado")+(referencia&&!esAlta?" · "+referencia:"");
  detalle.append(cabecera,concepto,meta);
  const btn=document.createElement("button");btn.type="button";btn.className="btn history-anular";btn.textContent="Anular cobro";btn.addEventListener("click",()=>mostrarAnularCobro(p,cofradeId,cuotaId));
  item.append(detalle,btn);historial.append(item);
 }
 $("#drawer").classList.add("open");
}
$("#cerrar").onclick=()=>$("#drawer").classList.remove("open");
$("#pagoForm").onsubmit=async e=>{
 e.preventDefault();const importe=Number($("#importe").value);
 const {error}=await supabase.rpc("registrar_pago_cuota_admin",{p_cofrade:$("#cofradeId").value,p_cuota:$("#cuotaId").value,p_importe:importe,p_fecha:$("#fecha").value,p_metodo:$("#metodo").value,p_referencia:$("#referencia").value.trim()});
 if(error)return AMPDialog.alert(error.message);$("#okPago").style.display="block";await cargar();setTimeout(()=>$("#drawer").classList.remove("open"),500);
};
let selectorPendientes=[],selectorElegido=null;
const selector=$("#selectorCofrade"),busqueda=$("#buscarCofrade"),lista=$("#listaCofradesPago"),aceptar=$("#aceptarSelector");
function cerrarSelector(){selector.classList.remove("open");busqueda.value="";selectorElegido=null;}
function pintarSelector(){
 const termino=busqueda.value.trim().toLocaleLowerCase("es");
 lista.replaceChildren();
 if(!termino){lista.style.display="none";aceptar.disabled=true;return;}
 lista.style.display="block";
 const visibles=selectorPendientes.filter(r=>r.nombre.toLocaleLowerCase("es").includes(termino));
 if(!visibles.length){const aviso=document.createElement("div");aviso.className="selector-empty";aviso.textContent="No hay cofrades que coincidan con la búsqueda.";lista.append(aviso);}
 for(const r of visibles){
  const label=document.createElement("label");label.className="selector-choice";
  const radio=document.createElement("input");radio.type="radio";radio.name="cofradePago";radio.value=r.cofrade_id+"|"+r.cuota_id;radio.checked=selectorElegido===radio.value;
  const nombre=document.createElement("span");nombre.textContent=r.nombre;
  const importe=document.createElement("small");importe.textContent=euro(r.pendiente)+" pendiente";
  label.append(radio,nombre,importe);lista.append(label);
  radio.addEventListener("change",()=>{selectorElegido=radio.value;aceptar.disabled=false;});
 }
 aceptar.disabled=!visibles.some(r=>r.cofrade_id+"|"+r.cuota_id===selectorElegido);
}
$("#registrarPago").onclick=()=>{
 selectorPendientes=filas.filter(r=>Number(r.pendiente)>0);
 if(!selectorPendientes.length){AMPDialog.alert("No hay cuotas pendientes.");return;}
 selectorElegido=null;busqueda.value="";pintarSelector();selector.classList.add("open");busqueda.focus();
};
busqueda.addEventListener("input",()=>{selectorElegido=null;pintarSelector();});
$("#cancelarSelector").addEventListener("click",cerrarSelector);
selector.addEventListener("click",e=>{if(e.target===selector)cerrarSelector();});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&selector.classList.contains("open"))cerrarSelector();});
aceptar.addEventListener("click",()=>{if(!selectorElegido)return;const r=selectorPendientes.find(x=>x.cofrade_id+"|"+x.cuota_id===selectorElegido);if(!r)return;cerrarSelector();abrirPago(r.cofrade_id,r.cuota_id);});
async function cargarHistorico(){
 const {data:h,error:e}=await supabase.rpc("listar_historico_cuotas_admin");
 if(e){console.error(e);document.querySelector("#histDetalle").textContent="Error al cargar el histórico: "+e.message;return;}
 const pagos=h?.pagos||[],cuotas=h?.cuotas||[];
 const years=[...new Set([...(pagos||[]).map(x=>x.ejercicio),...(cuotas||[]).map(x=>x.ejercicio)])].sort((a,b)=>b-a),sel=$("#histEjercicio"),prev=Number(sel.value);
 sel.innerHTML=years.map(y=>'<option value="'+y+'">'+y+'</option>').join("");if(years.length)sel.value=years.includes(prev)?prev:(years.includes(new Date().getFullYear())?new Date().getFullYear():years[0]);
 async function render(){const y=Number(sel.value),ps=(pagos||[]).filter(x=>x.ejercicio===y),qs=(cuotas||[]).filter(x=>x.ejercicio===y),total=ps.reduce((s,x)=>s+Number(x.importe),0);let asignados=[];if(qs.length){const {data:a}=await supabase.rpc("listar_cuotas_cofrades_admin",{p_cuotas:qs.map(q=>q.id)});asignados=a||[]}
 const previsto=asignados.reduce((s,x)=>s+Number(x.importe_asignado),0),pend=asignados.reduce((s,x)=>s+Number(x.pendiente),0);
 $("#histResumen").innerHTML='<div class="card"><div class="muted">Cobrado</div><div class="kpi ok">'+euro(total)+'</div></div><div class="card"><div class="muted">Pagos</div><div class="kpi">'+ps.length+'</div></div>'+(qs.length?'<div class="card"><div class="muted">Previsto</div><div class="kpi">'+euro(previsto)+'</div></div><div class="card"><div class="muted">Pendiente</div><div class="kpi bad">'+euro(pend)+'</div></div>':'');
 $("#histDetalle").innerHTML=(qs.length?'<h3>Cuotas</h3>'+qs.map(q=>'<div class="history-item cuota-hist-row"><span><strong>'+q.concepto+'</strong> · '+euro(q.importe)+' · '+q.tipo+'</span><span class="cuota-hist-actions"><button type="button" class="btn editarCuota" data-id="'+q.id+'">Editar</button><button type="button" class="btn borrarCuota" data-id="'+q.id+'">Eliminar</button></span></div>').join(""):"")+'<h3>Pagos registrados</h3>'+(ps.length?ps.map(p=>'<div class="history-item"><strong>'+(p.nombre||"Cofrade")+'</strong> · '+euro(p.importe)+' · '+new Date(p.fecha+"T12:00:00").toLocaleDateString("es-ES",{day:"2-digit",month:"2-digit",year:"numeric"})+'</div>').join(""):'<div class="muted">Sin pagos.</div>');
 document.querySelectorAll(".editarCuota").forEach(b=>b.onclick=()=>editarCuota(qs.find(q=>q.id===b.dataset.id)));document.querySelectorAll(".borrarCuota").forEach(b=>b.onclick=()=>borrarCuota(qs.find(q=>q.id===b.dataset.id)));} sel.onchange=render;if(years.length)await render();
}
let cuotaEnEdicion=null;function editarCuota(q){if(!q)return;cuotaEnEdicion=q.id;$("#qEjercicio").value=q.ejercicio;$("#qConcepto").value=q.concepto;$("#qTipo").value=q.tipo;$("#qImporte").value=q.importe;$("#qEmision").value=q.fecha_emision||hoy();$("#qVencimiento").value=q.fecha_vencimiento||"";$("#qObs").value=q.observaciones||"";$("#qAsignar").closest(".field").style.display="none";$("#qCofrades").style.display="none";$("#cuotaDrawer").querySelector("h2").textContent="Editar cuota";$("#cuotaForm button[type=submit]").textContent="Guardar cambios";$("#cuotaDrawer").classList.add("open")}
let cuotaPendienteEliminar=null;
function cerrarConfirmCuota(){cuotaPendienteEliminar=null;$("#confirmEliminarCuota").classList.remove("open")}
function borrarCuota(q){if(!q)return;cuotaPendienteEliminar=q;$("#confirmCuotaTexto").textContent="¿Quieres eliminar definitivamente «"+q.concepto+"»? Esta acción no se puede deshacer. Solo se permite si no tiene pagos registrados.";$("#confirmEliminarCuota").classList.add("open");$("#cancelarEliminarCuota").focus()}
$("#cancelarEliminarCuota").onclick=cerrarConfirmCuota;
$("#confirmEliminarCuota").addEventListener("click",e=>{if(e.target.id==="confirmEliminarCuota")cerrarConfirmCuota()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&$("#confirmEliminarCuota").classList.contains("open"))cerrarConfirmCuota()});
$("#aceptarEliminarCuota").onclick=async()=>{const q=cuotaPendienteEliminar;if(!q)return;const boton=$("#aceptarEliminarCuota");boton.disabled=true;try{const {error}=await supabase.rpc("eliminar_cuota_admin",{p_id:q.id});if(error){AMPDialog.alert(error.message);return}cerrarConfirmCuota();await cargar()}finally{boton.disabled=false}};
$("#gestionarCuota").onclick=()=>{cuotaEnEdicion=null;$("#cuotaDrawer").querySelector("h2").textContent="Nueva cuota";$("#cuotaForm button[type=submit]").textContent="Crear y asignar cuota";$("#qAsignar").closest(".field").style.display="block";const y=new Date().getFullYear()+1;$("#qEjercicio").value=y;$("#qConcepto").value="Cuota anual "+y;$("#qEmision").value=hoy();$("#qVencimiento").value="";$("#qObs").value="";$("#qAsignar").value="todos";$("#qCofrades").style.display="none";$("#qMsg").style.display="none";$("#cuotaDrawer").classList.add("open")};
$("#cerrarCuota").onclick=()=>$("#cuotaDrawer").classList.remove("open");
$("#qAsignar").onchange=()=>{$("#qCofrades").style.display=$("#qAsignar").value==="seleccion"?"block":"none";$("#qCofrades").innerHTML=filas.map((r,i)=>'<label style="display:block;padding:6px"><input type="checkbox" class="qSel" value="'+r.cofrade_id+'" '+(i===0?"checked":"")+'> '+r.nombre+'</label>').join("")};
$("#cuotaForm").onsubmit=async e=>{e.preventDefault();const seleccion=$("#qAsignar").value==="seleccion"?[...document.querySelectorAll(".qSel:checked")].map(x=>x.value):null;if(seleccion&&!seleccion.length)return AMPDialog.alert("Selecciona al menos un cofrade.");const {error}=await supabase.rpc(cuotaEnEdicion?"editar_cuota_admin":"crear_cuota_admin",{...(cuotaEnEdicion?{p_id:cuotaEnEdicion}:{}),p_ejercicio:Number($("#qEjercicio").value),p_concepto:$("#qConcepto").value.trim(),p_tipo:$("#qTipo").value,p_importe:Number($("#qImporte").value),p_emision:$("#qEmision").value,p_vencimiento:$("#qVencimiento").value||null,p_observaciones:$("#qObs").value.trim(),...(cuotaEnEdicion?{}:{p_cofrades:seleccion})});if(error)return AMPDialog.alert(error.message);$("#qMsg").textContent="✓ Cuota guardada correctamente.";$("#qMsg").style.display="block";await cargar();setTimeout(()=>$("#cuotaDrawer").classList.remove("open"),600)};
document.querySelectorAll("[data-filtro-cuotas]").forEach(b=>b.addEventListener("click",()=>{filtroCuotas=b.dataset.filtroCuotas;filtrarCuotas()}));
(async()=>{try{if(await guard())await cargar()}catch(err){console.error("Error cargando cuotas:",err);$("#tbody").textContent="No se pudieron cargar las cuotas: "+(err.message||"Error de consulta");}})();