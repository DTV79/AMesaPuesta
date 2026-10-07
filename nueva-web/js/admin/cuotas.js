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
 const {data:rows,error}=await supabase.from("admin_cuotas_cofrades").select("*").eq("ejercicio",new Date().getFullYear()).order("nombre");
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
 $("#historial").innerHTML=error||!data?.length?'<div class="muted">Sin pagos registrados.</div>':data.map(p=>'<div class="history-item"><b>'+euro(p.importe)+'</b> · '+new Date(p.fecha+"T12:00:00").toLocaleDateString("es-ES")+(p.metodo_pago?" · "+p.metodo_pago:"")+(p.referencia?'<div class="muted">'+p.referencia+'</div>':"")+'</div>').join("");
 $("#drawer").classList.add("open");
}
$("#cerrar").onclick=()=>$("#drawer").classList.remove("open");
$("#pagoForm").onsubmit=async e=>{
 e.preventDefault();const importe=Number($("#importe").value);
 const {error}=await supabase.rpc("registrar_pago_cuota_admin",{p_cofrade:$("#cofradeId").value,p_cuota:$("#cuotaId").value,p_importe:importe,p_fecha:$("#fecha").value,p_metodo:$("#metodo").value,p_referencia:$("#referencia").value.trim()});
 if(error)return alert(error.message);$("#okPago").style.display="block";await cargar();setTimeout(()=>$("#drawer").classList.remove("open"),500);
};
document.querySelector(".top .btn").onclick=()=>{
 const pendientes=filas.filter(x=>Number(x.pendiente)>0);if(!pendientes.length)return alert("No hay cuotas pendientes.");
 const nombre=prompt("Escribe parte del nombre del cofrade:");if(!nombre)return;const hits=pendientes.filter(x=>x.nombre.toLowerCase().includes(nombre.trim().toLowerCase()));
 if(hits.length!==1)return alert(hits.length?"Hay varios resultados. Escribe un nombre más concreto.":"No se encontró un cofrade con cuota pendiente.");abrirPago(hits[0].cofrade_id,hits[0].cuota_id);
};
async function cargarHistorico(){
 const {data:pagos}=await supabase.from("pagos_cuotas").select("ejercicio,fecha,importe,cofrade_id,cofrades(nombre)").eq("anulado",false).order("fecha",{ascending:false});
 const {data:cuotas}=await supabase.from("cuotas").select("id,ejercicio,concepto,importe,tipo,activa").order("ejercicio",{ascending:false});
 const years=[...new Set([...(pagos||[]).map(x=>x.ejercicio),...(cuotas||[]).map(x=>x.ejercicio)])].sort((a,b)=>b-a),sel=$("#histEjercicio"),prev=Number(sel.value);
 sel.innerHTML=years.map(y=>'<option value="'+y+'">'+y+'</option>').join("");if(years.length)sel.value=years.includes(prev)?prev:(years.includes(new Date().getFullYear())?new Date().getFullYear():years[0]);
 async function render(){const y=Number(sel.value),ps=(pagos||[]).filter(x=>x.ejercicio===y),qs=(cuotas||[]).filter(x=>x.ejercicio===y),total=ps.reduce((s,x)=>s+Number(x.importe),0);let asignados=[];if(qs.length){const {data:a}=await supabase.from("admin_cuotas_cofrades").select("*").in("cuota_id",qs.map(q=>q.id));asignados=a||[]}
 const previsto=asignados.reduce((s,x)=>s+Number(x.importe_asignado),0),pend=asignados.reduce((s,x)=>s+Number(x.pendiente),0);
 $("#histResumen").innerHTML='<div class="card"><div class="muted">Cobrado</div><div class="kpi ok">'+euro(total)+'</div></div><div class="card"><div class="muted">Pagos</div><div class="kpi">'+ps.length+'</div></div>'+(qs.length?'<div class="card"><div class="muted">Previsto</div><div class="kpi">'+euro(previsto)+'</div></div><div class="card"><div class="muted">Pendiente</div><div class="kpi bad">'+euro(pend)+'</div></div>':'');
 $("#histDetalle").innerHTML=(qs.length?'<h3>Cuotas</h3>'+qs.map(q=>'<div class="history-item"><strong>'+q.concepto+'</strong> · '+euro(q.importe)+' · '+q.tipo+'</div>').join(""):"")+'<h3>Pagos registrados</h3>'+(ps.length?ps.map(p=>'<div class="history-item"><strong>'+(p.cofrades?.nombre||"Cofrade")+'</strong> · '+euro(p.importe)+' · '+new Date(p.fecha+"T12:00:00").toLocaleDateString("es-ES")+'</div>').join(""):'<div class="muted">Sin pagos.</div>');
 } sel.onchange=render;if(years.length)await render();
}
$("#gestionarCuota").onclick=()=>{const y=new Date().getFullYear()+1;$("#qEjercicio").value=y;$("#qConcepto").value="Cuota anual "+y;$("#qEmision").value=hoy();$("#qVencimiento").value="";$("#qObs").value="";$("#qAsignar").value="todos";$("#qCofrades").style.display="none";$("#qMsg").style.display="none";$("#cuotaDrawer").classList.add("open")};
$("#cerrarCuota").onclick=()=>$("#cuotaDrawer").classList.remove("open");
$("#qAsignar").onchange=()=>{$("#qCofrades").style.display=$("#qAsignar").value==="seleccion"?"block":"none";$("#qCofrades").innerHTML=filas.map((r,i)=>'<label style="display:block;padding:6px"><input type="checkbox" class="qSel" value="'+r.cofrade_id+'" '+(i===0?"checked":"")+'> '+r.nombre+'</label>').join("")};
$("#cuotaForm").onsubmit=async e=>{e.preventDefault();const seleccion=$("#qAsignar").value==="seleccion"?[...document.querySelectorAll(".qSel:checked")].map(x=>x.value):null;if(seleccion&&!seleccion.length)return alert("Selecciona al menos un cofrade.");const {error}=await supabase.rpc("crear_cuota_admin",{p_ejercicio:Number($("#qEjercicio").value),p_concepto:$("#qConcepto").value.trim(),p_tipo:$("#qTipo").value,p_importe:Number($("#qImporte").value),p_emision:$("#qEmision").value,p_vencimiento:$("#qVencimiento").value||null,p_observaciones:$("#qObs").value.trim(),p_cofrades:seleccion});if(error)return alert(error.message);$("#qMsg").textContent="✓ Cuota creada y asignada correctamente.";$("#qMsg").style.display="block";await cargar();setTimeout(()=>$("#cuotaDrawer").classList.remove("open"),600)};
(async()=>{if(await guard())await cargar()})();