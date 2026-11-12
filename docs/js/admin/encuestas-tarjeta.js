// Tarjetas de encuestas: comparte únicamente datos publicables, nunca votos individuales.
import {crearTarjetaAnuncio} from "./anuncios-tarjeta.js?v=20261112-acceso-encuestas";

const ACCESO = "https://dtv79.github.io/AMesaPuesta/acceso.html";
let tarjetaActual=null;

function fechaHoraMadrid(valor) {
  if (!valor) return "";
  const d=new Date(valor);
  return Number.isNaN(d.getTime())?"":d.toLocaleString("es-ES",{
    timeZone:"Europe/Madrid",day:"2-digit",month:"2-digit",year:"numeric",
    hour:"2-digit",minute:"2-digit",hour12:false
  });
}
function activo(e) {
  return e.estado_efectivo||e.estado;
}
function autorizada(e,modo) {
  if (modo==="resultados") {
    return ["cerrada","archivada"].includes(activo(e)) &&
      e.mostrar_resultados!==false && e.resultados_disponibles===true;
  }
  return ["abierta","programada"].includes(activo(e)) && e.mostrar_encuesta!==false;
}
export function puedeCompartirEncuesta(e,modo) {
  return autorizada(e,modo);
}
function etiquetaElectores(e) {
  return e.electores==="cofrades"?"Solo cofrades":"Todos los miembros autorizados";
}
function datosTarjeta(e,modo) {
  if (!autorizada(e,modo)) throw new Error("Esta encuesta no está disponible para compartir en este estado.");
  const opciones=Array.isArray(e.opciones)?e.opciones:[];
  const titulo=String(e.titulo||"Encuesta de la Cofradía").trim();
  const descripcion=String(e.descripcion||"").trim();
  const lineas=[];
  if (descripcion) lineas.push(descripcion,"");
  if (modo==="resultados") {
    const participaciones=Math.max(0,Number(e.participantes)||0);
    const suma=opciones.reduce((acc,o)=>acc+Math.max(0,Number(o.votos)||0),0);
    lineas.push("Participación: "+participaciones+" "+(participaciones===1?"persona":"personas"),"","RESULTADOS");
    if (!opciones.length)lineas.push("Sin opciones registradas.");
    else for (const o of opciones) {
      const votos=Math.max(0,Number(o.votos)||0);
      const porcentaje=suma?Math.round(100*votos/suma):0;
      lineas.push("• "+String(o.texto||"Opción"),"  "+votos+" "+(votos===1?"voto":"votos")+" · "+porcentaje+" %");
    }
    const max=opciones.length?Math.max(...opciones.map(o=>Math.max(0,Number(o.votos)||0))):0;
    const ganadoras=opciones.filter(o=>Number(o.votos||0)===max);
    if (e.tipo!=="participacion" && e.mostrar_ganador!==false &&
        Number(e.max_opciones||1)===1 && max>0 && ganadoras.length===1) {
      lineas.push("","Opción ganadora: "+String(ganadoras[0].texto||""));
    }
  } else {
    lineas.push("OPCIONES PARA VOTAR");
    if (!opciones.length)lineas.push("Consulta las opciones en la web.");
    else for (const o of opciones)lineas.push("• "+String(o.texto||"Opción"));
    lineas.push("","Electores: "+etiquetaElectores(e));
    if (Number(e.max_opciones)>1)lineas.push("Puedes seleccionar hasta "+e.max_opciones+" opciones.");
  }
  const cierre=fechaHoraMadrid(e.cierra_en);
  const apertura=fechaHoraMadrid(e.abre_en);
  const cuando=modo==="resultados"
    ?"Encuesta finalizada"+(cierre?" · "+cierre:"")
    :activo(e)==="programada"
      ?"Apertura: "+(apertura||"pendiente de fecha")
      :cierre?"Cierre: "+cierre:"Encuesta abierta";
  const etiqueta=modo==="resultados"?"📊 RESULTADOS FINALES":
    activo(e)==="programada"?"🗳️ ENCUESTA PROGRAMADA":"🗳️ ENCUESTA ABIERTA";
  const tipoMensaje=modo==="resultados"
    ?"Para consultar los resultados de esta encuesta y las últimas novedades, entra en la web de la Cofradía con tu usuario:"
    :activo(e)==="programada"
      ?"Para consultar esta encuesta cuando se abra, entra en la web de la Cofradía con tu usuario:"
      :"Para consultar esta encuesta y emitir tu voto, entra en la web de la Cofradía con tu usuario:";
  return {
    imagen:{
      titulo,texto:lineas.join("\n"),
      marca:"LA COFRADÍA · ENCUESTAS",etiqueta,
      fechaMeta:cuando,pie:"Encuestas"
    },
    mensaje:tipoMensaje+"\n"+ACCESO,
    nombre:"a-mesa-puesta-"+(modo==="resultados"?"resultados-":"encuesta-")+
      titulo.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()
        .replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,45)+".png"
  };
}
function guardar(archivo) {
  const url=URL.createObjectURL(archivo);
  const a=document.createElement("a");
  a.href=url;a.download=archivo.name;
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
}
export async function abrirTarjetaEncuesta(encuesta,modo) {
  const data=datosTarjeta(encuesta,modo);
  const blob=await crearTarjetaAnuncio(data.imagen);
  const file=new File([blob],data.nombre,{type:"image/png"});
  const url=URL.createObjectURL(blob);
  if (tarjetaActual?.url)URL.revokeObjectURL(tarjetaActual.url);
  tarjetaActual={file,url};
  const modal=document.getElementById("encuestaTarjetaDialogo");
  document.getElementById("encuestaTarjetaVista").src=url;
  document.getElementById("encuestaTarjetaMensaje").value=data.mensaje;
  document.getElementById("encuestaTarjetaEstado").textContent="";
  modal.showModal();
}

export function configurarTarjetasEncuestas() {
  const modal=document.getElementById("encuestaTarjetaDialogo");
  const imagen=document.getElementById("encuestaTarjetaVista");
  const mensaje=document.getElementById("encuestaTarjetaMensaje");
  const estado=document.getElementById("encuestaTarjetaEstado");
  const compartir=document.getElementById("encuestaTarjetaCompartir");
  document.getElementById("encuestaTarjetaCerrar").addEventListener("click",()=>modal.close());
  modal.addEventListener("click",e=>{if(e.target===modal)modal.close()});
  modal.addEventListener("close",()=>{
    imagen.removeAttribute("src");
    if(tarjetaActual?.url)URL.revokeObjectURL(tarjetaActual.url);
    tarjetaActual=null;
  });
  compartir.addEventListener("click",()=>{
    const file=tarjetaActual?.file;if(!file)return;
    const disponible=typeof navigator.share==="function"&&
      (typeof navigator.canShare!=="function"||navigator.canShare({files:[file]}));
    if(!disponible) {
      guardar(file);
      estado.textContent="Imagen guardada. Copia también el mensaje con enlace para pegarlo en WhatsApp.";
      return;
    }
    // Mantener el gesto directo del usuario, necesario para compartir archivos en iOS.
    navigator.share({files:[file],text:mensaje.value})
      .then(()=>{estado.textContent="Si WhatsApp omite el texto, pulsa «Copiar mensaje» para pegarlo.";})
      .catch(error=>{if(error?.name!=="AbortError")estado.textContent="No se pudo compartir. Guarda el PNG y copia el mensaje.";});
  });
  document.getElementById("encuestaTarjetaCopiar").addEventListener("click",async()=>{
    try {
      if(navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(mensaje.value);
        estado.textContent="Mensaje copiado. Puedes pegarlo al enviar la imagen por WhatsApp.";
      } else {
        mensaje.focus();mensaje.select();
        estado.textContent="Selecciona «Copiar» para utilizar el texto en WhatsApp.";
      }
    } catch {
      mensaje.focus();mensaje.select();
      estado.textContent="Selecciona «Copiar» para utilizar el texto en WhatsApp.";
    }
  });
  document.getElementById("encuestaTarjetaGuardar").addEventListener("click",()=>{
    if(!tarjetaActual?.file)return;
    guardar(tarjetaActual.file);
    estado.textContent="Imagen PNG guardada.";
  });
}
