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
  let modoSoloAviso=false;
  let procesando=false;
  let anuncioDeVersion=null;
  let estadoSeq=0;

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

  const esAnuncioDeVersion=(a,v)=>a?.titulo===nombreAviso(v)&&a?.enlace===ENLACE_ESTAtUTOS;
  async function listarAnuncios(){
    const {data,error}=await sb.rpc("listar_anuncios_admin");
    if(error)throw error;
    if(!Array.isArray(data))throw new Error("No se pudo obtener la lista de anuncios.");
    return data;
  }
  // Mantener los demás campos del anuncio al cambiar su visibilidad.
  function datosParaGuardar(a,visible){
    return {
      id:a.id,
      fecha:a.fecha||"",
      fecha_publicacion:a.fecha_publicacion||"",
      hora_publicacion:a.hora_publicacion||"00:00",
      fecha_fin:a.fecha_fin||"",
      hora_fin:a.hora_fin||"23:59",
      fecha_evento:a.fecha_evento||"",
      tipo:a.tipo||"General",
      titulo:a.titulo,
      texto:a.texto||"",
      destacado:!!a.destacado,
      dias_destacado:a.dias_destacado??"",
      visible,
      autor:a.autor||"",
      enlace:a.enlace||"",
      orden:Number(a.orden||0)
    };
  }
  function estadoAnuncio(a){
    if(!a)return "No se ha creado un aviso para esta versión.";
    if(!a.visible)return "Aviso oculto: no aparece en Mi Pizarra ni en el Tablón.";
    const fin=a.fecha_fin?String(a.fecha_fin).slice(0,10):"";
    const hora=String(a.hora_fin||"23:59").slice(0,5);
    return fin?"Aviso publicado o programado hasta el "+fin.split("-").reverse().join("/")+" a las "+hora+".":"Aviso publicado sin fecha de retirada.";
  }
  async function refrescarEstado(){
    const token=++estadoSeq;
    const {id,detalle}=obtenerActual();
    const estado=$("estadoAvisoEstatutos"),retirar=$("retirarAvisoEstatutos"),anunciar=$("avisarVersionVigente");
    anuncioDeVersion=null;
    retirar.hidden=true;
    if(detalle?.version?.estado!=="vigente"){
      estado.hidden=true;
      return;
    }
    estado.hidden=false;
    estado.textContent="Comprobando si hay un aviso publicado…";
    anunciar.textContent="📣 Anunciar cambios";
    try{
      const anuncios=await listarAnuncios();
      if(token!==estadoSeq||id!==obtenerActual().id)return;
      const anuncio=anuncios.find(a=>esAnuncioDeVersion(a,detalle.version.version));
      anuncioDeVersion=anuncio||null;
      estado.textContent=estadoAnuncio(anuncio);
      retirar.hidden=!(anuncio&&anuncio.visible);
      anunciar.textContent=!anuncio?"📣 Anunciar cambios":anuncio.visible?"📣 Actualizar anuncio":"📣 Volver a publicar aviso";
    }catch(error){
      if(token!==estadoSeq||id!==obtenerActual().id)return;
      estado.textContent="No se pudo comprobar el estado del aviso. Actualiza la página.";
      console.error("Aviso de Estatutos:",error);
    }
  }
  $("retirarAvisoEstatutos").onclick=async()=>{
    const {detalle}=obtenerActual();
    const anuncio=anuncioDeVersion;
    if(procesando||detalle?.version?.estado!=="vigente"||!anuncio?.visible||!esAnuncioDeVersion(anuncio,detalle.version.version))return;
    if(!(await AMPDialog.confirm("¿Dejar de publicar el aviso de la versión "+numeroVersion(detalle.version.version)+"? Desaparecerá de Mi Pizarra y del Tablón, pero los Estatutos seguirán publicados.")))return;
    if(!esAnuncioDeVersion(anuncio,obtenerActual().detalle?.version?.version))return;
    procesando=true;
    const boton=$("retirarAvisoEstatutos");
    boton.disabled=true;
    try{
      const {error}=await sb.rpc("guardar_anuncio_admin",{p:datosParaGuardar(anuncio,false)});
      if(error)throw error;
      $("msg").textContent="✓ Aviso retirado de Mi Pizarra y del Tablón. La versión de los Estatutos sigue vigente.";
      await refrescarEstado();
    }catch(err){
      await AMPDialog.alert("No se pudo retirar el aviso: "+(err?.message||"error desconocido"));
    }finally{
      procesando=false;
      boton.disabled=false;
    }
  };

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
    if(aprobadoEnEstaOperacion && !modoSoloAviso && id){
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
    const existentes=await listarAnuncios();
    const anterior=existentes.find(a=>esAnuncioDeVersion(a,version));
    const anuncio={
      ...(anterior?{id:anterior.id}:{}),
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
    return !anterior;
  }

  function abrirOpciones(soloAviso=false){
    const {detalle}=obtenerActual();
    if(soloAviso ? detalle?.version?.estado!=="vigente" : detalle?.version?.estado!=="borrador")return;
    modoSoloAviso=soloAviso;
    aprobadoEnEstaOperacion=soloAviso;
    $("tituloModalAvisoEstatutos").textContent=soloAviso?"Anunciar versión vigente":"Aprobar nueva versión";
    $("textoModalAvisoEstatutos").textContent=soloAviso
      ?"Esta versión ya está aprobada y publicada. Puedes comunicar los cambios sin volver a aprobarla."
      :"Los Estatutos se publicarán al confirmar. Opcionalmente, puedes informar del cambio a los cofrades.";
    $("filaCheckboxAvisoEstatutos").hidden=soloAviso;
    activar.checked=true;
    dias.value="7";
    texto.value=$("descripcionCambios").value.trim()||
      "Se han aprobado modificaciones en los Estatutos de la Cofradía. Consulta la versión vigente para conocerlas.";
    confirmar.textContent=soloAviso?"Publicar aviso":"Aprobar y publicar";
    cancelar.textContent="Cancelar";
    mensaje.textContent="";
    actualizarVista();
    modal.classList.add("open");
  }
  $("aprobar").onclick=()=>abrirOpciones(false);
  $("avisarVersionVigente").onclick=()=>abrirOpciones(true);

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
            ?(modoSoloAviso?"✓ Aviso publicado en Mi Pizarra y el Tablón.":"✓ Estatutos aprobados y aviso publicado en Mi Pizarra y el Tablón.")
            :"✓ Aviso actualizado y publicado en Mi Pizarra y el Tablón.");
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
  return {refrescarEstado};
}
