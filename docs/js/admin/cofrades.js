import{createClient}from"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.0/+esm";const sb=createClient("https://wmfcpnihymiiwgpvbngj.supabase.co","sb_publishable_ij3sYbyMrLI2B34OOYt6JA_Aez1R2cJ");let miembros=[],cuentas=[],estados=[];const ejercicioActual=new Date().getFullYear();const euro=n=>new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"}).format(Number(n||0));async function cargar(){const{data:{session}}=await sb.auth.getSession();if(!session)return document.body.innerHTML="<main class=shell><section class=panel><h1>Administración</h1><p>Debes iniciar sesión.</p></section></main>";const{data:admin}=await sb.rpc("soy_admin_cofradia");if(!admin)return document.body.innerHTML="<main class=shell><h1>Acceso restringido</h1></main>";await sb.rpc("refrescar_ascensos_admin");({data:miembros}=await sb.rpc("listar_cofrades_admin"));({data:cuentas}=await sb.rpc("listar_cuentas_cofrades_admin"));const e=await sb.rpc("resumen_cuotas_cofrades_admin",{p_ejercicio:ejercicioActual});estados=e.data||[];render()}function render(){const q=buscar.value.toLowerCase(),f=estado.value;lista.innerHTML=miembros.filter(m=>m.nombre.toLowerCase().includes(q)&&(f==="todos"||(f==="activos"&&!m.fecha_baja)||(f==="bajas"&&m.fecha_baja))).map(m=>{const e=estados.find(x=>x.cofrade_id===m.id);return '<div class="card member row" data-id="'+m.id+'"><div class=memberMain><div class=avatar>'+m.nombre[0]+'</div><div><div class=name>'+m.nombre+'</div><div class=muted>'+m.categoria+'</div></div></div><div><span class="pill '+(m.fecha_baja?"bad":"ok")+'">'+(m.fecha_baja?"Baja":"Activo")+'</span> '+(e?'<span class="pill '+(e.estado==="al_corriente"?"ok":"bad")+' hideMob">'+(e.estado==="al_corriente"?"Cuotas al día":"Pendiente "+euro(e.pendiente))+"</span>":"")+"</div></div>"}).join("");document.querySelectorAll(".member").forEach(x=>x.onclick=()=>abrir(x.dataset.id))}nCategoria.addEventListener("change",()=>{nFundador.checked=nCategoria.value==="Cofrade Fundador"});nFundador.addEventListener("change",()=>{if(nFundador.checked)nCategoria.value="Cofrade Fundador";else if(nCategoria.value==="Cofrade Fundador")nCategoria.value="Cofrade"});categoria.addEventListener("change",()=>{fundador.checked=categoria.value==="Cofrade Fundador"});fundador.addEventListener("change",()=>{if(fundador.checked)categoria.value="Cofrade Fundador";else if(categoria.value==="Cofrade Fundador")categoria.value="Cofrade"});nuevo.onclick=()=>{nIngreso.value=new Date().toISOString().slice(0,10);nNombre.value="";nCategoria.value="Cofrade";nFundador.checked=false;nuevoDrawer.classList.add("open")};cerrarNuevo.onclick=()=>nuevoDrawer.classList.remove("open");nuevoForm.onsubmit=async e=>{e.preventDefault();const fundadorNuevo=nFundador.checked||nCategoria.value==="Cofrade Fundador";const{data:newId,error}=await sb.rpc("crear_cofrade_admin",{p_nombre:nNombre.value,p_fecha_ingreso:nIngreso.value,p_categoria:nCategoria.value,p_fundador:fundadorNuevo});if(error)return AMPDialog.alert(error.message);nuevoDrawer.classList.remove("open");await cargar();abrir(newId)};
function abrir(id){const m=miembros.find(x=>x.id===id),e=estados.find(x=>x.cofrade_id===id),c=cuentas?.find(x=>x.cofrade_id===id);titulo.textContent=m.nombre;document.querySelector("#id").value=id;nombre.value=m.nombre;ingreso.value=m.fecha_ingreso||"";baja.value=m.fecha_baja||"";categoria.value=m.fundador?"Cofrade Fundador":(m.categoria||"Cofrade");fundador.checked=!!m.fundador||m.categoria==="Cofrade Fundador";fundador.disabled=!!m.fundador||m.categoria==="Cofrade Fundador";categoria.disabled=!!m.fundador||m.categoria==="Cofrade Fundador";resumen.innerHTML='<div class=stat><span class=muted>Estado</span><strong>'+(m.fecha_baja?"Baja":"Activo")+'</strong></div><div class=stat><span class=muted>Cuotas '+ejercicioActual+'</span><strong>'+(e?(e.estado==="al_corriente"?"Al día":euro(e.pendiente)+" pendiente"):"—")+"</strong></div>";estadoMiembro.textContent=m.fecha_baja?"Reactivar cofrade":"Dar de baja";estadoMiembro.dataset.baja=m.fecha_baja?"1":"0";drawer.classList.add("open");cargarIncorporacion(id);clavePersonal.value="";claveMensaje.textContent="";claveEstado.textContent="Comprobando clave…";sb.rpc("estado_clave_cofrade_admin",{p_cofrade_id:id}).then(({data,error})=>{if(document.querySelector("#id").value===id)claveEstado.textContent=error?"No se pudo comprobar la clave":data?"Clave personal configurada":"Sin clave personal configurada"})}buscar.oninput=render;estado.onchange=render;cerrar.onclick=()=>drawer.classList.remove("open");form.onsubmit=async e=>{e.preventDefault();const{error}=await sb.rpc("actualizar_cofrade_admin",{p_cofrade_id:id.value,p_nombre:nombre.value,p_fecha_ingreso:ingreso.value,p_fecha_baja:baja.value||null,p_categoria:categoria.value,p_fundador:fundador.checked});if(error)return AMPDialog.alert(error.message);drawer.classList.remove("open");await cargar()};estadoMiembro.onclick=async()=>{const estaBaja=estadoMiembro.dataset.baja==="1";let fecha=null;if(!estaBaja){fecha=await AMPDialog.prompt("Fecha de baja (AAAA-MM-DD)",new Date().toISOString().slice(0,10),{tipoCampo:"date"});if(!fecha)return;if(!(await AMPDialog.confirm("Se marcará como baja, pero se conservará todo su historial. ¿Continuar?")))return}else if(!(await AMPDialog.confirm("¿Reactivar a este cofrade?")))return;const{error}=await sb.rpc("cambiar_estado_cofrade_admin",{p_cofrade_id:id.value,p_fecha_baja:fecha});if(error)return AMPDialog.alert(error.message);drawer.classList.remove("open");await cargar()};
guardarClave.onclick=async()=>{const cofradeId=document.querySelector("#id").value,clave=clavePersonal.value;if(clave.length<8){claveMensaje.textContent="Introduce al menos 8 caracteres.";return}guardarClave.disabled=true;claveMensaje.textContent="Guardando…";const{error}=await sb.rpc("guardar_clave_cofrade_admin",{p_cofrade_id:cofradeId,p_clave:clave});guardarClave.disabled=false;if(error){claveMensaje.textContent="Error: "+error.message;return}clavePersonal.value="";claveEstado.textContent="Clave personal configurada";claveMensaje.textContent="Clave restablecida. Las sesiones anteriores han quedado cerradas. Facilita la clave provisional al cofrade para que la cambie desde su perfil."};cargar();
let incorporacionActual=null;
function destinoCobro(){return document.querySelector('input[name="incPagoDestino"]:checked')?.value||"ambos"}
function pendienteDestino(){if(!incorporacionActual)return 0;const cuota=Number(incorporacionActual.pendiente_cuota||0),entrada=Number(incorporacionActual.pendiente_incorporacion||0);return destinoCobro()==="cuota"?cuota:destinoCobro()==="incorporacion"?entrada:cuota+entrada}
function repartoCobro(importe){
 const cuota=Number(incorporacionActual?.pendiente_cuota||0);
 const entrada=Number(incorporacionActual?.pendiente_incorporacion||0);
 const modo=destinoCobro();
 const c=modo==="incorporacion"?0:Math.min(importe,cuota);
 const e=modo==="cuota"?0:Math.max(0,importe-c);
 return {cuota:c,entrada:e,esValido:Number.isFinite(importe)&&importe>0&&Math.abs(importe*100-Math.round(importe*100))<0.000001&&importe<=pendienteDestino()+0.001&&c<=cuota&&e<=entrada};
}
function actualizarVistaCobro(ponerImporte=false){
 const i=incorporacionActual,panel=document.getElementById("incCobroPanel");
 panel.hidden=!i;if(!i)return;
 const cuota=Number(i.pendiente_cuota||0),entrada=Number(i.pendiente_incorporacion||0);
 document.getElementById("incCobroPendientes").textContent="Cuota anual: "+euro(i.cuota_anual)+" (pagado "+euro(i.pagado_cuota)+" · pendiente "+euro(cuota)+"). Incorporación: "+euro(i.aportacion_incorporacion)+" (pagado "+euro(i.pagado_incorporacion)+" · pendiente "+euro(entrada)+"). Total pendiente: "+euro(cuota+entrada)+".";
 document.getElementById("incOpcionAmbos").textContent=euro(cuota+entrada);
 document.getElementById("incOpcionCuota").textContent=euro(cuota);
 document.getElementById("incOpcionIncorporacion").textContent=euro(entrada);
 if(ponerImporte)document.getElementById("incPagoImporte").value=pendienteDestino()>0?pendienteDestino().toFixed(2):"";
 const valorTexto=document.getElementById("incPagoImporte").value;
 const importe=valorTexto!==""?Number(valorTexto):NaN;
 const desglose=document.getElementById("incPagoReparto"),boton=document.getElementById("incRegistrarPago");
 if(cuota+entrada<=0){desglose.textContent="Incorporación pagada completamente.";boton.disabled=true;return}
 const reparto=repartoCobro(importe);
 desglose.textContent=reparto.esValido?
  "Este cobro se registrará como cuota anual "+euro(reparto.cuota)+" + incorporación "+euro(reparto.entrada)+" = "+euro(importe)+".":
  "Introduce un importe válido hasta "+euro(pendienteDestino())+".";
 boton.disabled=!reparto.esValido;
}
document.querySelectorAll('input[name="incPagoDestino"]').forEach(el=>el.addEventListener("change",()=>actualizarVistaCobro(true)));
document.getElementById("incPagoImporte").addEventListener("input",()=>actualizarVistaCobro());
async function cargarIncorporacion(cofradeId){
 const estado=document.getElementById("incorporacionEstado"),sel=document.getElementById("incComida");
 estado.textContent="Consultando incorporaciones…";sel.replaceChildren(new Option("Selecciona una comida cerrada",""));
 const {data,error}=await sb.rpc("opciones_incorporacion_admin",{p_cofrade:cofradeId});
 if(document.querySelector("#id").value!==cofradeId)return;
 if(error){estado.textContent="Error al consultar: "+error.message;return}
 for(const c of data.comidas||[])sel.add(new Option(c.fecha+" · "+c.nombre,c.id));
 const i=data.incorporacion;incorporacionActual=i||null;sel.value=i?.comida_admision_id||"";
 document.getElementById("incCuota").value=i?.cuota_anual??"";
 document.getElementById("incAportacion").value=i?.aportacion_incorporacion??"";
 estado.textContent=i?"Incorporación registrada. Pagos: cuota "+euro(i.pagado_cuota)+" · entrada "+euro(i.pagado_incorporacion):"Sin incorporación registrada.";
 document.getElementById("incGuardar").disabled=Boolean(i&&(Number(i.pagado_cuota)>0||Number(i.pagado_incorporacion)>0));
 actualizarTotalIncorporacion();
 actualizarVistaCobro(true);
}
function actualizarTotalIncorporacion(){const cuota=Number(document.getElementById("incCuota").value||0),aport=Number(document.getElementById("incAportacion").value||0);document.getElementById("incTotal").textContent="Total previsto: "+euro(cuota+aport)}
for(const id of ["incCuota","incAportacion"])document.getElementById(id).addEventListener("input",actualizarTotalIncorporacion);
document.getElementById("incCalcular").onclick=async()=>{
 const comida=document.getElementById("incComida").value,cofrade=document.querySelector("#id").value,estado=document.getElementById("incorporacionEstado");
 if(!comida)return AMPDialog.alert("Selecciona la comida de admisión.");
 const {data,error}=await sb.rpc("previsualizar_incorporacion_admin",{p_comida_id:comida,p_cofrade_id:cofrade});
 if(error)return AMPDialog.alert(error.message);
 if(!data.calculable)return AMPDialog.alert(data.motivo||"No se puede calcular.");
 document.getElementById("incCuota").value=data.cuota_anual;
 document.getElementById("incAportacion").value=data.aportacion_sugerida;
 actualizarTotalIncorporacion();
 estado.textContent="Participación por cofrade: "+euro(data.participacion_estimada)+". Cuota anual: "+euro(data.cuota_anual)+". Entrada al bote: "+euro(data.aportacion_sugerida)+". Total: "+euro(data.total_sugerido)+". Referencia: "+data.cofrades_referencia+" cofrades. Se tienen en cuenta "+euro(data.cuotas_pendientes_referencia)+" de cuotas pendientes SOLO para calcular la participación; no se han cobrado ni añadido al remanente real. Revisa los importes antes de confirmar.";
};
document.getElementById("incGuardar").onclick=async()=>{
 const cofrade=document.querySelector("#id").value,comida=document.getElementById("incComida").value,cuota=Number(document.getElementById("incCuota").value),aport=Number(document.getElementById("incAportacion").value),miembro=miembros.find(x=>x.id===cofrade);
 if(!comida||!Number.isFinite(cuota)||!Number.isFinite(aport)||cuota<0||aport<0)return AMPDialog.alert("Selecciona una comida e introduce importes válidos.");
 if(!(await AMPDialog.confirm("Registrar para "+miembro.nombre+": cuota "+euro(cuota)+" e incorporación "+euro(aport)+". Esta acción NO registra el cobro. ¿Confirmar?")))return;
 const {error}=await sb.rpc("configurar_incorporacion_cofrade_admin",{p_cofrade_id:cofrade,p_comida_id:comida,p_ejercicio:Number((miembro.fecha_ingreso||"").slice(0,4)),p_cuota_anual:cuota,p_aportacion:aport,p_observaciones:"Incorporación revisada por administración"});
 if(error)return AMPDialog.alert(error.message);
 await AMPDialog.alert("Importes registrados. Los pagos se confirmarán por separado.");
 await cargarIncorporacion(cofrade);
};

document.getElementById("incPagoFecha").value=new Date().toLocaleDateString("en-CA");
document.getElementById("incRegistrarPago").onclick=async()=>{
 const boton=document.getElementById("incRegistrarPago");
 const cofrade=document.querySelector("#id").value;
 const importe=Number(document.getElementById("incPagoImporte").value);
 const fecha=document.getElementById("incPagoFecha").value;
 const metodo=document.getElementById("incPagoMetodo").value;
 const destino=destinoCobro();
 const desglose=repartoCobro(importe);
 if(!incorporacionActual||!desglose.esValido||!fecha)return AMPDialog.alert("Introduce una fecha y un importe que no supere los importes pendientes.");
 const nombre=miembros.find(x=>x.id===cofrade)?.nombre||"este cofrade";
 const acepta=await AMPDialog.confirm("Confirmar cobro REAL a "+nombre+": "+euro(importe)+" ("+euro(desglose.cuota)+" de cuota anual y "+euro(desglose.entrada)+" de incorporación). Fecha: "+fecha+". Método: "+metodo+". ¿Registrar?");
 if(!acepta)return;
 boton.disabled=true;
 try{
  const {data,error}=await sb.rpc("registrar_cobro_incorporacion_admin",{p_cofrade_id:cofrade,p_importe:importe,p_fecha:fecha,p_metodo:metodo,p_destino:destino});
  if(error){await AMPDialog.alert("No se pudo registrar el cobro: "+error.message);return}
  document.getElementById("incPagoImporte").value="";
  await cargarIncorporacion(cofrade);
  await AMPDialog.alert("Cobro registrado: "+euro(data.cuota)+" de cuota y "+euro(data.incorporacion)+" de incorporación. Total: "+euro(data.total)+".");
 }finally{
  actualizarVistaCobro();
 }
};
