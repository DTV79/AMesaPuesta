import {createClient} from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.0/+esm";
const sb=createClient("https://wmfcpnihymiiwgpvbngj.supabase.co","sb_publishable_ij3sYbyMrLI2B34OOYt6JA_Aez1R2cJ");
const $=id=>document.getElementById(id);
const euros=v=>new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"}).format(Number(v)||0);
const fecha=v=>v?String(v).slice(0,10).split("-").reverse().join("/"):"—";
let registros=[],cargados=false;
const pestañas=[["comidas","tabComidas"],["historico","tabHistorico"]];
function activar(tipo){
  const historico=tipo==="historico";
  for(const [valor,id] of pestañas){
    const b=$(id);
    b.classList.toggle("active",valor===tipo);
    b.setAttribute("aria-selected",String(valor===tipo));
    b.tabIndex=valor===tipo?0:-1;
  }
  $("lista").hidden=historico;
  $("nuevo").hidden=historico;
  $("historicoPanel").hidden=!historico;
  if(historico){
    $("editor").classList.remove("open");
    if(!cargados)cargar();
    else mostrar();
  }
}
function mostrar(){
  const seleccion=$("historicoAnio").value;
  const lista=registros.filter(x=>seleccion==="todos"||String(x.fecha).startsWith(seleccion));
  const total=lista.reduce((s,x)=>s+Number(x.total||0),0);
  const otros=lista.reduce((s,x)=>s+Number(x.otros||0),0);
  $("historicoTotal").textContent=euros(total);
  $("historicoComidas").textContent=String(lista.length);
  $("historicoOtros").textContent=lista.some(x=>x.otros!==null&&x.otros!==undefined)?euros(otros):"Sin registrar";
  $("historicoNota").textContent="El gasto de comida incluye el bote. «Sin registrar» indica que no consta información de otros gastos; los totales muestran los importes identificados, no necesariamente todos los gastos ni pagos realizados.";
  const caja=$("historicoFilas");
  caja.replaceChildren();
  if(!lista.length){
    const p=document.createElement("p");p.className="muted";
    p.textContent="No hay gastos históricos registrados para este ejercicio.";
    caja.append(p);
    return;
  }
  for(const comida of lista){
    const detalles=document.createElement("details");detalles.className="historico-comida";
    const suma=document.createElement("summary");suma.className="historico-fila";
    const nombre=document.createElement("span");nombre.className="hist-nombre";
    const strong=document.createElement("strong");strong.textContent=comida.restaurante;
    const small=document.createElement("small");small.textContent=fecha(comida.fecha);
    nombre.append(strong,small);
    const socios=document.createElement("span");socios.className="hist-num";socios.textContent=String(comida.cofrades);
    const gasto=document.createElement("span");gasto.className="hist-importe";gasto.textContent=euros(comida.gasto_comida);
    const otros=document.createElement("span");otros.className="hist-otros";otros.textContent=comida.otros===null||comida.otros===undefined?"Sin registrar":euros(comida.otros);
    const importe=document.createElement("strong");importe.className="hist-importe";importe.textContent=euros(comida.total);
    const ver=document.createElement("span");ver.className="hist-ver";ver.textContent="Ver detalle";
    suma.append(nombre,socios,gasto,otros,importe,ver);detalles.append(suma);
    const detalle=document.createElement("div");detalle.className="hist-detalle";
    const descripcion=document.createElement("p");descripcion.className="muted";descripcion.textContent="Gasto por cofrade, con su aportación al bote incluida.";
    detalle.append(descripcion);
    const tabla=document.createElement("table");tabla.className="hist-tabla";
    const cabecera=document.createElement("thead");
    const trh=document.createElement("tr");
    for(const texto of ["Cofrade","Asistió","Gasto comida","Otros gastos","Total"]){const th=document.createElement("th");th.textContent=texto;trh.append(th)}
    cabecera.append(trh);tabla.append(cabecera);
    const tbody=document.createElement("tbody");
    for(const item of comida.detalle||[]){
      const tr=document.createElement("tr");
      const valores=[item.nombre,item.asistio===null||item.asistio===undefined?"Sin registrar":item.asistio?"Sí":"No",euros(item.gasto_comida),item.otros===null||item.otros===undefined?"Sin registrar":euros(item.otros),euros(item.total)];
      for(const valor of valores){const td=document.createElement("td");td.textContent=valor;tr.append(td)}
      tbody.append(tr);
    }
    tabla.append(tbody);
    const tfoot=document.createElement("tfoot"),trTotal=document.createElement("tr");
    const label=document.createElement("th");label.colSpan=2;label.textContent="Total de la comida";trTotal.append(label);
    for(const valor of [euros(comida.gasto_comida),comida.otros===null||comida.otros===undefined?"Sin registrar":euros(comida.otros),euros(comida.total)]){const td=document.createElement("td");td.textContent=valor;trTotal.append(td)}
    tfoot.append(trTotal);tabla.append(tfoot);
    detalle.append(tabla);detalles.append(detalle);caja.append(detalles);
  }
}
async function cargar(){
  $("historicoEstado").textContent="Consultando los gastos históricos…";
  try {
    const {data:{session}}=await sb.auth.getSession();
    if(!session)throw Error("Debes identificarte como administrador.");
    const {data:admin,error:permiso}=await sb.rpc("soy_admin_cofradia");
    if(permiso||admin!==true)throw Error("Acceso no autorizado.");
    const {data,error}=await sb.rpc("resumen_gastos_historicos_comidas_admin");
    if(error)throw error;
    registros=Array.isArray(data)?data:[];
    const select=$("historicoAnio");
    select.replaceChildren();
    const todos=new Option("Todos los años","todos");select.add(todos);
    const ejercicios=[...new Set(registros.map(r=>String(r.fecha).slice(0,4)))].sort().reverse();
    for(const anio of ejercicios)select.add(new Option(anio,anio));
    select.value="todos";
    cargados=true;
    $("historicoEstado").textContent="";
    mostrar();
  }catch(e){
    $("historicoEstado").textContent="No se pudo cargar el histórico: "+e.message;
    $("historicoFilas").replaceChildren();
  }
}
$("tabComidas").addEventListener("click",()=>activar("comidas"));
$("tabHistorico").addEventListener("click",()=>activar("historico"));
$("historicoAnio").addEventListener("change",mostrar);
activar("comidas");
