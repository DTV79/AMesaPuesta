import {createClient} from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.0/+esm";
const sb=createClient("https://wmfcpnihymiiwgpvbngj.supabase.co","sb_publishable_ij3sYbyMrLI2B34OOYt6JA_Aez1R2cJ");
const $=id=>document.getElementById(id);
let miembros=[],mensajes=[],seleccion=new Set(),editando=null;
const fechaES=iso=>iso?new Date(iso.slice(0,10)+"T12:00:00").toLocaleDateString("es-ES"):"";
const fechaHoy=()=>new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Madrid",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
function ahoraMadrid(){
 const partes=Object.fromEntries(new Intl.DateTimeFormat("es-ES",{
  timeZone:"Europe/Madrid",year:"numeric",month:"2-digit",day:"2-digit",
  hour:"2-digit",minute:"2-digit",hourCycle:"h23"
 }).formatToParts(new Date()).map(({type,value})=>[type,value]));
 return partes.year+"-"+partes.month+"-"+partes.day+"T"+partes.hour+":"+partes.minute;
}
function horaMensaje(m){return m.caduca_en?(m.caduca_hora||"23:59").slice(0,5):"";}
function aviso(texto,tipo="ok"){$("estadoGuardado").textContent=texto;$("estadoGuardado").className=tipo;}
function renderDestinatarios(){
 const q=$("buscarDestinatarios").value.trim().toLocaleLowerCase("es");
 const fragment=document.createDocumentFragment();
 for(const m of miembros.filter(x=>x.nombre.toLocaleLowerCase("es").includes(q))){
  const label=document.createElement("label");label.className="recipient";
  const input=document.createElement("input");input.type="checkbox";input.value=m.id;input.checked=seleccion.has(m.id);
  input.addEventListener("change",()=>{if(input.checked)seleccion.add(m.id);else seleccion.delete(m.id);actualizarSeleccion();});
  const name=document.createElement("span");name.textContent=m.nombre;label.append(input,name);fragment.append(label);
 }
 $("destinatarios").replaceChildren(fragment);
 actualizarSeleccion();
}
function actualizarSeleccion(){
 const total=seleccion.size;
 $("seleccionadosInfo").textContent=total===0?"Ningún cofrade seleccionado":total+" cofrade"+(total===1?" seleccionado":"s seleccionados");
 $("todos").checked=miembros.length>0&&total===miembros.length;
 $("todos").indeterminate=total>0&&total<miembros.length;
}
function elemento(tipo,clase,texto){const el=document.createElement(tipo);if(clase)el.className=clase;if(texto!==undefined)el.textContent=texto;return el;}
function renderHistorial(){
 $("totalMensajes").textContent=mensajes.length+" mensaje"+(mensajes.length===1?"":"s");
 const cont=$("historial");cont.replaceChildren();
 if(!mensajes.length){cont.append(elemento("p","muted","Aún no se ha enviado ningún mensaje personal."));return;}
 for(const m of mensajes){
  const card=elemento("article","history-card");
  const top=elemento("div","history-top");top.append(elemento("h3","",m.titulo));
  const caducado=!!m.caduca_en&&(m.caduca_en+"T"+horaMensaje(m)<=ahoraMadrid());
  const badge=elemento("span","pill"+(!m.activo?" inactive":caducado?" expired":""),!m.activo?"Retirado":caducado?"Caducado":"Publicado");
  top.append(badge);card.append(top);
  card.append(elemento("p","history-text",m.texto));
  const nombres=(m.destinatarios||[]).map(d=>d.nombre).join(", ");
  card.append(elemento("p","history-recipients","Destinatarios: "+(nombres||"Ninguno")));
  const meta="Creado: "+new Date(m.creado_en).toLocaleDateString("es-ES")+" · "+(m.caduca_en?"Hasta el "+fechaES(m.caduca_en)+" a las "+horaMensaje(m):"Sin caducidad");
  card.append(elemento("p","history-meta",meta));
  const acciones=elemento("div","history-actions");
  if(m.activo){
   const edit=elemento("button","btn btn-secondary","Editar");edit.type="button";edit.addEventListener("click",()=>editar(m));
   const retirar=elemento("button","btn btn-secondary","Retirar");retirar.type="button";retirar.addEventListener("click",()=>retirarMensaje(m));
   acciones.append(edit,retirar);
  }
  const eliminar=elemento("button","btn btn-danger","Eliminar");eliminar.type="button";eliminar.addEventListener("click",()=>eliminarMensaje(m));
  acciones.append(eliminar);card.append(acciones);
  cont.append(card);
 }
}
function resetFormulario(){
 editando=null;$("formulario").reset();seleccion.clear();$("tituloFormulario").textContent="Nuevo mensaje";$("guardar").textContent="Enviar mensaje";$("cancelarEdicion").hidden=true;$("buscarDestinatarios").value="";aviso("");renderDestinatarios();
}
function editar(m){
 editando=m.id;$("titulo").value=m.titulo;$("texto").value=m.texto;$("caduca").value=m.caduca_en||"";$("caducaHora").value=horaMensaje(m);
 seleccion=new Set((m.destinatarios||[]).map(x=>x.id).filter(id=>miembros.some(c=>c.id===id)));
 $("tituloFormulario").textContent="Editar mensaje personal";$("guardar").textContent="Guardar cambios";$("cancelarEdicion").hidden=false;
 $("buscarDestinatarios").value="";aviso("");renderDestinatarios();
 $("tituloFormulario").scrollIntoView({behavior:"smooth",block:"start"});$("titulo").focus({preventScroll:true});
}
async function retirarMensaje(m){
 const texto="¿Retirar el mensaje «"+m.titulo+"»? Dejará de aparecer en la pizarra de todos sus destinatarios.";
 if(typeof window.AMPDialog?.confirm!=="function"){aviso("No se pudo abrir la confirmación. Actualiza la página.","error");return;}
 const confirmado=await window.AMPDialog.confirm(texto,{titulo:"Retirar mensaje",aceptar:"Retirar"});
 if(!confirmado)return;
 const {data,error}=await sb.rpc("retirar_mensaje_personal_admin",{p_id:m.id});
 if(error||data!==true){aviso(error?.message||"No se pudo retirar el mensaje.","error");return;}
 if(editando===m.id)resetFormulario();
 await cargarMensajes();aviso("El mensaje se ha retirado de las pizarras.");
}
async function eliminarMensaje(m){
 if(typeof window.AMPDialog?.confirm!=="function"){aviso("No se pudo abrir la confirmación. Actualiza la página.","error");return;}
 const texto="¿Eliminar definitivamente el mensaje «"+m.titulo+"»?\n\nDejará de aparecer en las pizarras de sus destinatarios y también se borrará del historial de Administración. Esta acción no se puede deshacer.";
 const confirmado=await window.AMPDialog.confirm(texto,{titulo:"Eliminar mensaje",aceptar:"Eliminar",peligro:true});
 if(!confirmado)return;
 try{
  const {data,error}=await sb.rpc("eliminar_mensaje_personal_admin",{p_id:m.id});
  if(error)throw error;
  if(data!==true)throw new Error("El mensaje ya no existe. Actualiza la lista e inténtalo de nuevo.");
  if(editando===m.id)resetFormulario();
  await cargarMensajes();
  aviso("Mensaje eliminado definitivamente.");
 }catch(err){aviso("No se pudo eliminar el mensaje: "+(err.message||"Error desconocido"),"error");}
}
async function cargarMensajes(){
 const {data,error}=await sb.rpc("listar_mensajes_personales_admin");
 if(error)throw error;
 mensajes=Array.isArray(data)?data:[];renderHistorial();
}
$("caduca").addEventListener("change",()=>{
 if($("caduca").value){if(!$("caducaHora").value)$("caducaHora").value="23:59";}
 else $("caducaHora").value="";
});
$("buscarDestinatarios").addEventListener("input",renderDestinatarios);
$("todos").addEventListener("change",e=>{seleccion=e.target.checked?new Set(miembros.map(m=>m.id)):new Set();renderDestinatarios();});
$("cancelarEdicion").addEventListener("click",resetFormulario);
$("formulario").addEventListener("submit",async e=>{
 e.preventDefault();
 const titulo=$("titulo").value.trim(),texto=$("texto").value.trim(),fecha=$("caduca").value||null,hora=$("caducaHora").value||null;
 if(!seleccion.size){aviso("Selecciona al menos un cofrade.","error");return;}
 if(!titulo||!texto){aviso("Introduce un título y un mensaje.","error");return;}
 if(Boolean(fecha)!==Boolean(hora)){aviso("Indica una fecha y una hora, o deja ambos campos vacíos.","error");return;}
 if(fecha&&fecha+"T"+hora<=ahoraMadrid()){aviso("La fecha y la hora de caducidad deben ser posteriores a ahora.","error");return;}
 const btn=$("guardar");btn.disabled=true;aviso(editando?"Guardando cambios…":"Enviando mensaje…");
 try{
  const {error}=await sb.rpc("guardar_mensaje_personal_con_hora_admin",{p_id:editando,p_titulo:titulo,p_texto:texto,p_destinatarios:Array.from(seleccion),p_caduca_en:fecha,p_caduca_hora:hora});
  if(error)throw error;
  const actualizado=Boolean(editando);
  resetFormulario();await cargarMensajes();
  aviso(actualizado?"Mensaje actualizado correctamente.":"Mensaje enviado. Aparecerá en Mi Pizarra de los destinatarios.");
 }catch(err){aviso(err.message||"No se pudo guardar el mensaje.","error");}
 finally{btn.disabled=false;}
});
(async()=>{
 try{
  const {data:{session}}=await sb.auth.getSession();
  if(!session){location.replace("index.html");return;}
  const {data:esAdmin,error:permisoError}=await sb.rpc("soy_admin_cofradia");
  if(permisoError||esAdmin!==true)throw Error("No tienes permisos para gestionar mensajes personales.");
  const {data,error}=await sb.rpc("listar_cofrades_admin");
  if(error)throw error;
  miembros=(data||[]).filter(m=>!m.fecha_baja).sort((a,b)=>a.nombre.localeCompare(b.nombre,"es"));
  await cargarMensajes();renderDestinatarios();$("contenido").hidden=false;
 }catch(err){
  document.body.replaceChildren(elemento("main","",err.message||"No se pudo acceder a los mensajes personales."));
 }
})();