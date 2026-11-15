// Aviso opcional al aprobar Estatutos. Usa los anuncios existentes para Mi Pizarra y Tablón.
const ENLACE_ESTAtUTOS="https://dtv79.github.io/AMesaPuesta/v2/estatutos.html";

export function prepararAvisoEstatutos({sb,$,guardar,versiones,abrir,obtenerActual}) {
  const modal=$("modalAvisoEstatutos");
  const activar=$("crearAvisoEstatutos");
  const ajustes=$("opcionesAvisoEstatutos");
  const dias=$("diasAvisoEstatutos");
  const texto=$("resumenAvisoEstatutos");
  const ejemplo=$("vistaAvisoEstatutos");
  const titulo=$("tituloAvisoEstatutos");
  const mensaje=$("mensajeAvisoEstatutos");
  const confirmar=$("confirmarPublicacionEstatutos");
  const cancelar=$("cancelarPublicacionEstatutos");
  let aprobadoEnEstaOperacion=false;
  let procesando=false;

  const horaMadrid=()=>{
    const partes=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{
      timeZone:"Europe/Madrid",year:"numeric",month:"2-digit",day:"2-digit",
      hour:"2-digit",minute:"2-digit",hourCycle:"h23"
    }).formatToParts(new Date()).map(x=>[x.type,x.value]));
    return {fecha:partes.year+"-"+partes.month+"-"+partes.day,hora:partes.hour+":"+partes.minute};
  };
  const sumarDias=(iso,n)=>{
    const [y,m,d]=iso.split("-").map(Number);
    return new Date(Date.UTC(y,m-1,d+n)).toISOString().slice(0,10);
  };
  const numeroVersion=v=>String(v||"").replace(/^versi[oó]n\s+/i,"").trim();
  const nombreAviso=v=>"Estatutos actualizados · Versión "+numeroVersion(v);

  const actualizarVista=()=>{
    ajustes.hidden=!activar.checked;
    const v=obtenerActual().detalle?.version?.version||"";
    titulo.textContent=nombreAviso(v);
    ejemplo.textContent=texto.value.trim()||"Resumen de los cambios aprobados.";
  };
  activar.addEventListener("change",actualizarVista);
  texto.addEventListener("input",actualizarVista);

  async function refrescar(id,info){
    let recargaError=null;
    try{
      await versiones.cargar();
      await abrir(id);
    }catch(err){
      recargaError=err;
      console.error("No se pudo actualizar el editor de Estatutos:",err);
    }
    modal.classList.remove("open");
    aprobadoEnEstaOperacion=false;
    $("msg").textContent=info+(recargaError?" No se pudo actualizar la vista; recarga la página.":"");
  }
  const cerrar=async()=>{
    if(procesando)return;
    const id=obtenerActual().id;
    if(aprobadoEnEstaOperacion && id){
      await refrescar(id,"✓ Estatutos aprobados. Comprueba en el Tablón si se llegó a publicar el aviso.");
    }else{
      modal.classList.remove("open");
    }
  };
  cancelar.addEventListener("click",()=>{cerrar().catch(e=>{mensaje.textContent=e.message})});
  modal.addEventListener("click",e=>{if(e.target===modal)cerrar().catch(err=>{mensaje.textContent=err.message})});

  async function crearAnuncio(version,duracion,resumen){
    const momento=horaMadrid();
    const tituloAnuncio=nombreAviso(version);
    // Reintentar no debe duplicar el aviso si la primera respuesta llegó con retraso.
    const {data:existentes,error:errorLista}=await sb.rpc("listar_anuncios_admin");
    if(errorLista)throw errorLista;
    if(Array.isArray(existentes)&&existentes.some(a=>a.titulo===tituloAnuncio&&a.enlace===ENLACE_ESTAtUTOS)){
      return false;
    }
    const anuncio={
      fecha:momento.fecha,
      fecha_publicacion:momento.fecha,
      hora_publicacion:momento.hora,
      fecha_fin:sumarDias(momento.fecha,duracion),
      hora_fin:momento.hora,
      fecha_evento:"",
      tipo:"General",
      titulo:tituloAnuncio,
      texto:resumen,
      destacado:true,
      dias_destacado:duracion,
      visible:true,
      autor:"Consejo de Cofrades",
      enlace:ENLACE_ESTAtUTOS,
      orden:0
    };
    const {error}=await sb.rpc("guardar_anuncio_admin",{p:anuncio});
    if(error)throw error;
    return true;
  }

  function abrirOpciones(){
    const {detalle}=obtenerActual();
    if(detalle?.version?.estado!=="borrador")return;
    aprobadoEnEstaOperacion=false;
    activar.checked=true;
    dias.value="7";
    texto.value=$("descripcionCambios").value.trim()||
      "Se han aprobado modificaciones en los Estatutos de la Cofradía. Consulta la versión vigente para conocerlas.";
    confirmar.textContent="Aprobar y publicar";
    cancelar.textContent="Cancelar";
    mensaje.textContent="";
    actualizarVista();
    modal.classList.add("open");
  }
  $("aprobar").onclick=abrirOpciones;

  confirmar.addEventListener("click",async()=>{
    if(procesando)return;
    const {id,detalle}=obtenerActual();
    if(!id)return;
    const publicar=activar.checked;
    const n=Number(dias.value);
    const resumen=texto.value.trim();
    if(publicar&&(!Number.isInteger(n)||n<1||n>365)){
      mensaje.textContent="Indica una duración de 1 a 365 días.";
      return;
    }
    if(publicar&&!resumen){
      mensaje.textContent="Escribe un breve resumen para el aviso.";
      return;
    }
    procesando=true;
    confirmar.disabled=true;
    cancelar.disabled=true;
    mensaje.textContent=aprobadoEnEstaOperacion?"Publicando aviso…":"Aprobando nueva versión…";
    try {
      if(!aprobadoEnEstaOperacion){
        await guardar();
        const {error}=await sb.rpc("aprobar_estatutos_admin",{p_id:id});
        if(error)throw error;
        aprobadoEnEstaOperacion=true;
      }
      if(publicar){
        try{
          const creado=await crearAnuncio(detalle.version.version,n,resumen);
          await refrescar(id,creado
            ?"✓ Estatutos aprobados y aviso publicado en Mi Pizarra y el Tablón."
            :"✓ Estatutos aprobados. Ya existía un aviso de esta versión en el Tablón.");
        }catch(err){
          // La aprobación no se revierte ni se repite si el aviso falla.
          mensaje.textContent="Los Estatutos ya están aprobados, pero no se pudo publicar el aviso: "+
            (err?.message||"error desconocido")+". Puedes reintentar aquí sin volver a aprobar.";
          confirmar.textContent="Reintentar aviso";
          cancelar.textContent="Cerrar sin aviso";
        }
      }else{
        await refrescar(id,"✓ Estatutos aprobados y publicados, sin anuncio en Mi Pizarra.");
      }
    }catch(err){
      mensaje.textContent="No se pudo completar la operación: "+(err?.message||"error desconocido");
    }finally{
      procesando=false;
      confirmar.disabled=false;
      cancelar.disabled=false;
    }
  });
}
