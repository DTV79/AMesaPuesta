import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.0/+esm";
const supabase=createClient("https://wmfcpnihymiiwgpvbngj.supabase.co","sb_publishable_ij3sYbyMrLI2B34OOYt6JA_Aez1R2cJ");
let filas=[];
const $=s=>document.querySelector(s), euro=n=>new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"}).format(Number(n||0));
const hoy=()=>new Date().toISOString().slice(0,10);

async function guard(){
 const {data:{session}}=await supabase.auth.getSession();
 if(!session){document.body.innerHTML='<main class="shell"><section class="panel"><h1>Administración</h1><p>Inicia sesión desde el acceso de administrador.</p></section></main>';return false}
 const {data:admin}=await supabase.rpc("soy_admin_cofradia");
 if(!admin){document.body.innerHTML='<main class="shell"><section class="panel"><h1>Acceso restringido</h1></section></main>';return false}
 return true;
}
async function cargar(){
 const {data:rows,error}=await supabase.rpc("listar_cuotas_cofrades_admin",{p_ejercicio:new Date().getFullYear()});
 if(error)throw error; filas=rows||[];
 const total=filas.reduce((s,r)=>s+Number(r.importe_asignado),0),cobrado=filas.reduce((s,r)=>s+Number(r.pagado),0);
 document.querySelectorAll(".kpi")[0].textContent=euro(total);document.querySelectorAll(".kpi")[1].textContent=euro(cobrado);
 document.querySelectorAll(".kpi")[2].textContent=euro(total-cobrado);document.querySelectorAll(".kpi")[3].textContent=filas.filter(r=>r.estado==="al_corriente").length+" / "+filas.length;
 $("#tbody").innerHTML=filas.map(r=>'<tr><td class="name">'+r.nombre+'</td><td><span class="pill '+(r.estado==="al_corriente"?"ok":"bad")+'">● '+(r.estado==="al_corriente"?"Al corriente":r.estado==="parcial"?"Parcial":"Pendiente")+'</span></td><td class="desktop">'+euro(r.importe_asignado)+'</td><td class="desktop">'+euro(r.pagado)+'</td><td><strong>'+euro(r.pendiente)+'</strong></td><td class="action" data-c="'+r.cofrade_id+'" data-q="'+r.cuota_id+'">'+(Number(r.pendiente)>0?"Cobrar →":"Ver →")+'</td></tr>').join("");
 document.querySelectorAll(".action").forEach(x=>x.onclick=()=>abrirPago(x.dataset.c,x.dataset.q));
 await cargarHistorico();
}
async function abrirPago(cofradeId,cuotaId){
 const r=filas.find(x=>x.cofrade_id===cofradeId&&x.cuota_id===cuotaId);if(!r)return;
 $("#cofradeId").value=cofradeId;$("#cuotaId").value=cuotaId;$("#fNombre").textContent=r.nombre;
 $("#fEstado").innerHTML='<div class="card"><div class="muted">Cuota '+r.ejercicio+'</div><div style="margin-top:6px">Asignado: <b>'+euro(r.importe_asignado)+'</b> · Pagado: <b>'+euro(r.pagado)+'</b> · Pendiente: <b>'+euro(r.pendiente)+'</b></div></div>';
 $("#importe").value=Number(r.pendiente)>0?Number(r.pendiente).toFixed(2):"";$("#importe").max=Number(r.pendiente);$("#fecha").value=hoy();$("#metodo").value="";$("#referencia").value="";$("#okPago").style.display="none";
 const {data,error}=await supabase.rpc("pagos_cuota_cofrade_admin",{p_cofrade:cofradeId,p_cuota:cuotaId});
 $("#historial").innerHTML=error||!data?.length?'<div class="muted">Sin pagos registrados.</div>':data.map(p=>'<div class="history-item"><b>'+euro(p.importe)+'</b> · '+new Date(p.fecha+"T12:00:00").toLocaleDateString("es-ES",{day:"2-digit",month:"2-digit",year:"numeric"})+(p.metodo_pago?" · "+p.metodo_pago:"")+(p.referencia?'<div class="muted">'+p.referencia+'</div>':"")+'</div>').join("");
 $("#drawer").classList.add("open");
}
$("#cerrar").onclick=()=>$("#drawer").classList.remove("open");
$("#pagoForm").onsubmit=async e=>{
 e.preventDefault();const importe=Number($("#importe").value);
 const {error}=await supabase.rpc("registrar_pago_cuota_admin",{p_cofrade:$("#cofradeId").value,p_cuota:$("#cuotaId").value,p_importe:importe,p_fecha:$("#fecha").value,p_metodo:$("#metodo").value,p_referencia:$("#referencia").value.trim()});
 if(error)return alert(error.message);$("#okPago").style.display="block";await cargar();setTimeout(()=>$("#drawer").classList.remove("open"),500);
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
 if(!selectorPendientes.length){alert("No hay cuotas pendientes.");return;}
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
$("#aceptarEliminarCuota").onclick=async()=>{const q=cuotaPendienteEliminar;if(!q)return;const boton=$("#aceptarEliminarCuota");boton.disabled=true;try{const {error}=await supabase.rpc("eliminar_cuota_admin",{p_id:q.id});if(error){alert(error.message);return}cerrarConfirmCuota();await cargar()}finally{boton.disabled=false}};
$("#gestionarCuota").onclick=()=>{cuotaEnEdicion=null;$("#cuotaDrawer").querySelector("h2").textContent="Nueva cuota";$("#cuotaForm button[type=submit]").textContent="Crear y asignar cuota";$("#qAsignar").closest(".field").style.display="block";const y=new Date().getFullYear()+1;$("#qEjercicio").value=y;$("#qConcepto").value="Cuota anual "+y;$("#qEmision").value=hoy();$("#qVencimiento").value="";$("#qObs").value="";$("#qAsignar").value="todos";$("#qCofrades").style.display="none";$("#qMsg").style.display="none";$("#cuotaDrawer").classList.add("open")};
$("#cerrarCuota").onclick=()=>$("#cuotaDrawer").classList.remove("open");
$("#qAsignar").onchange=()=>{$("#qCofrades").style.display=$("#qAsignar").value==="seleccion"?"block":"none";$("#qCofrades").innerHTML=filas.map((r,i)=>'<label style="display:block;padding:6px"><input type="checkbox" class="qSel" value="'+r.cofrade_id+'" '+(i===0?"checked":"")+'> '+r.nombre+'</label>').join("")};
$("#cuotaForm").onsubmit=async e=>{e.preventDefault();const seleccion=$("#qAsignar").value==="seleccion"?[...document.querySelectorAll(".qSel:checked")].map(x=>x.value):null;if(seleccion&&!seleccion.length)return alert("Selecciona al menos un cofrade.");const {error}=await supabase.rpc(cuotaEnEdicion?"editar_cuota_admin":"crear_cuota_admin",{...(cuotaEnEdicion?{p_id:cuotaEnEdicion}:{}),p_ejercicio:Number($("#qEjercicio").value),p_concepto:$("#qConcepto").value.trim(),p_tipo:$("#qTipo").value,p_importe:Number($("#qImporte").value),p_emision:$("#qEmision").value,p_vencimiento:$("#qVencimiento").value||null,p_observaciones:$("#qObs").value.trim(),...(cuotaEnEdicion?{}:{p_cofrades:seleccion})});if(error)return alert(error.message);$("#qMsg").textContent="✓ Cuota guardada correctamente.";$("#qMsg").style.display="block";await cargar();setTimeout(()=>$("#cuotaDrawer").classList.remove("open"),600)};
(async()=>{try{if(await guard())await cargar()}catch(err){console.error("Error cargando cuotas:",err);$("#tbody").textContent="No se pudieron cargar las cuotas: "+(err.message||"Error de consulta");}})();