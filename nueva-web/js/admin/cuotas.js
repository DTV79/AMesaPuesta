
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.0/+esm";
const supabase=createClient("https://wmfcpnihymiiwgpvbngj.supabase.co","sb_publishable_ij3sYbyMrLI2B34OOYt6JA_Aez1R2cJ");
let filas=[];
const euro=n=>new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"}).format(Number(n||0));
async function cargarHistorico(){
 const {data:pagos,error}=await supabase.from("pagos_cuotas").select("ejercicio,fecha,importe,cofrade_id,cofrades(nombre)").eq("anulado",false).order("fecha",{ascending:false}); if(error){console.error(error);return}
 const {data:cuotas}=await supabase.from("cuotas").select("id,ejercicio,concepto,importe,tipo,activa").order("ejercicio",{ascending:false});
 const years=[...new Set([...(pagos||[]).map(x=>x.ejercicio),...(cuotas||[]).map(x=>x.ejercicio)])].sort((a,b)=>b-a); const sel=document.querySelector("#histEjercicio"); sel.innerHTML=years.map(y=>'<option value="'+y+'">'+y+'</option>').join("");
 async function render(){const y=Number(sel.value),ps=(pagos||[]).filter(x=>x.ejercicio===y),qs=(cuotas||[]).filter(x=>x.ejercicio===y),total=ps.reduce((s,x)=>s+Number(x.importe),0); let asignados=[]; if(qs.length){const ids=qs.map(q=>q.id); const {data:a}=await supabase.from("admin_cuotas_cofrades").select("*").in("cuota_id",ids); asignados=a||[]}
 const previsto=asignados.reduce((s,x)=>s+Number(x.importe_asignado),0),pend=asignados.reduce((s,x)=>s+Number(x.pendiente),0); document.querySelector("#histResumen").innerHTML='<div class="card"><div class="muted">Cobrado</div><div class="kpi ok">'+euro(total)+'</div></div><div class="card"><div class="muted">Pagos</div><div class="kpi">'+ps.length+'</div></div>'+(qs.length?'<div class="card"><div class="muted">Previsto</div><div class="kpi">'+euro(previsto)+'</div></div><div class="card"><div class="muted">Pendiente</div><div class="kpi bad">'+euro(pend)+'</div></div>':'<div class="card"><div class="muted">Datos</div><div style="font-weight:750;margin-top:8px">Histórico importado</div></div>');
 let h=qs.length?'<h3>Cuotas</h3>'+qs.map(q=>'<div class="history-item"><strong>'+q.concepto+'</strong> · '+euro(q.importe)+' · '+q.tipo+'</div>').join(""):''; h+='<h3>Pagos registrados</h3>'+ (ps.length?ps.map(p=>'<div class="history-item"><strong>'+(p.cofrades?.nombre||"Cofrade")+'</strong> · '+euro(p.importe)+' · '+new Date(p.fecha+"T12:00:00").toLocaleDateString("es-ES")+'</div>').join(""):'<div class="muted">Sin pagos.</div>'); document.querySelector("#histDetalle").innerHTML=h; }
 sel.onchange=render; if(years.length){sel.value=years.includes(2026)?2026:years[0];await render()}
}
async function cargar(){
 const {data:{session}}=await supabase.auth.getSession();
 if(!session){document.body.innerHTML='<main class="shell"><section class="panel"><h1>Administración</h1><p>Inicia sesión desde el acceso de administrador para consultar cuotas y cobros.</p></section></main>';return}
 const {data:admin}=await supabase.rpc("soy_admin_cofradia");
 if(!admin){document.body.innerHTML='<main class="shell"><section class="panel"><h1>Acceso restringido</h1><p>Esta sección es exclusiva de administradores.</p></section></main>';return}
 const {data:rows,error}=await supabase.from("admin_cuotas_cofrades").select("*").eq("ejercicio",2026).order("nombre");
 if(error){console.error(error);return}
 const total=rows.reduce((s,r)=>s+Number(r.importe_asignado),0), cobrado=rows.reduce((s,r)=>s+Number(r.pagado),0);
 document.querySelectorAll(".kpi")[0].textContent=euro(total); document.querySelectorAll(".kpi")[1].textContent=euro(cobrado);
 document.querySelectorAll(".kpi")[2].textContent=euro(total-cobrado); document.querySelectorAll(".kpi")[3].textContent=rows.filter(r=>r.estado==="al_corriente").length+" / "+rows.length;
 document.querySelector("tbody").innerHTML=rows.map(r=>'<tr><td class="name">'+r.nombre+'</td><td><span class="pill '+(r.estado==="al_corriente"?"ok":"bad")+'">● '+(r.estado==="al_corriente"?"Al corriente":r.estado==="parcial"?"Parcial":"Pendiente")+'</span></td><td class="desktop">'+euro(r.importe_asignado)+'</td><td class="desktop">'+euro(r.pagado)+'</td><td><strong>'+euro(r.pendiente)+'</strong></td><td class="action" data-id="'+r.cofrade_id+'">'+(r.pendiente>0?"Cobrar →":"Ver →")+'</td></tr>').join("");
}
cargar();
