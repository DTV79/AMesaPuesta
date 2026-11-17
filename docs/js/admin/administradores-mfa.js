/* Protección TOTP opcional por cuenta: nunca se activa hasta verificar el código. */
(()=>{
  "use strict";
  const sb=window.ampAdminSupabaseClient;
  if(!sb){console.error("No se pudo inicializar la sesión de administradores");return}
  const $=id=>document.getElementById(id);
  let obligatorio=false;
  let factoresVerificados=[];
  let flujo=null;
  let inscripcionId=null;

  function mensaje(texto,error=false){
    $("mfaEstado").textContent=texto;
    $("mfaEstado").style.color=error?"#9b1c1c":"#746d66";
  }
  function limpiarFormulario(){
    $("mfaFormulario").hidden=true;
    $("mfaCodigoQR").hidden=true;
    $("mfaQr").removeAttribute("src");
    $("mfaSecreto").textContent="";
    $("mfaCodigo").value="";
    $("mfaConfirmar").disabled=false;
    $("mfaActivar").checked=obligatorio;
    inscripcionId=null;
    flujo=null;
  }
  async function estadoActual(){
    const {data,error}=await sb.rpc("estado_mfa_admin");
    if(error)throw error;
    if(!data?.administrador)return false;
    const {data:listado,error:errorFactores}=await sb.auth.mfa.listFactors();
    if(errorFactores)throw errorFactores;
    obligatorio=!!data.obligatorio;
    factoresVerificados=(listado?.totp||[]).filter(x=>x.status==="verified");
    $("mfaCard").hidden=false;
    $("mfaActivar").checked=obligatorio;
    $("mfaAnadirRespaldo").hidden=!obligatorio;
    $("mfaAnadirRespaldo").disabled=flujo!==null;
    mensaje(obligatorio
      ?"Activado. Para acceder a Administración necesitas tu contraseña y un código del móvil."
      : factoresVerificados.length
        ?"Desactivado. Al entrar solo se pedirán correo y contraseña. Puedes reactivarlo cuando quieras."
        :"Desactivado. Por ahora sigues entrando únicamente con correo y contraseña."
    );
    return true;
  }
  async function cancelar(){
    const pendiente=inscripcionId;
    limpiarFormulario();
    if(pendiente){
      // Elimina el factor no verificado para no acumular inscripciones fallidas.
      try{await sb.auth.mfa.unenroll({factorId:pendiente})}catch(_){}
    }
    try{await estadoActual()}catch(e){mensaje("No se pudo actualizar el estado: "+e.message,true)}
  }
  function mostrarFormulario(tipo,qr,secret){
    flujo=tipo;
    const activacion=tipo==="activar";
    $("mfaActivar").checked=obligatorio;
    $("mfaCodigoQR").hidden=!qr;
    if(qr){
      $("mfaQr").src=qr.startsWith("data:")?qr:qr.trimStart().startsWith("<svg")
        ?"data:image/svg+xml;charset=utf-8,"+encodeURIComponent(qr):qr;
      $("mfaSecreto").textContent=secret||"";
    }
    $("mfaAccionTitulo").textContent=tipo==="desactivar"?"Confirmar desactivación":
      tipo==="respaldo"?"Añadir dispositivo de respaldo":"Activar doble factor";
    $("mfaDescripcion").textContent=qr
      ?"Escanea el QR con tu aplicación (Google Authenticator o Microsoft Authenticator) y después introduce el código de seis cifras."
      :tipo==="desactivar"
        ?"Introduce un código actual de tu móvil para desactivar la exigencia de doble factor. En adelante bastarán correo y contraseña."
        :"Introduce un código actual de tu aplicación para confirmar que quieres activar la protección.";
    $("mfaConfirmar").textContent=tipo==="desactivar"?"Desactivar 2FA":
      tipo==="respaldo"?"Añadir dispositivo":"Activar 2FA";
    $("mfaFormulario").hidden=false;
    $("mfaCodigo").value="";
    $("mfaCodigo").focus();
  }
  async function inscribir(tipo){
    mensaje("Preparando el código QR…");
    $("mfaActivar").disabled=true;
    try{
      const {data,error}=await sb.auth.mfa.enroll({
        factorType:"totp",
        friendlyName:tipo==="respaldo"?"A Mesa Puesta - respaldo":"A Mesa Puesta - administración"
      });
      if(error)throw error;
      if(!data?.id||!data?.totp?.qr_code)throw Error("Supabase no ha proporcionado el código QR.");
      inscripcionId=data.id;
      mostrarFormulario(tipo,data.totp.qr_code,data.totp.secret);
      mensaje("Escanea el QR y confirma un código. Hasta entonces, la configuración seguirá igual.");
    }catch(e){
      limpiarFormulario();
      mensaje("No se pudo preparar el segundo factor: "+e.message,true);
    }finally{$("mfaActivar").disabled=false}
  }

  $("mfaActivar").addEventListener("change",async()=>{
    const quiereActivar=$("mfaActivar").checked;
    $("mfaActivar").checked=obligatorio;
    if(flujo!==null)return;
    if(quiereActivar===obligatorio)return;
    if(quiereActivar){
      if(factoresVerificados.length)mostrarFormulario("activar",null,null);
      else await inscribir("activar");
    }else{
      mostrarFormulario("desactivar",null,null);
    }
  });
  $("mfaAnadirRespaldo").onclick=async()=>{
    if(flujo===null&&obligatorio)await inscribir("respaldo");
  };
  $("mfaCancelar").onclick=()=>cancelar();

  $("mfaFormulario").onsubmit=async event=>{
    event.preventDefault();
    const codigo=$("mfaCodigo").value.trim();
    if(!/^[0-9]{6}$/.test(codigo)){mensaje("Introduce las seis cifras que muestra el móvil.",true);return}
    const btn=$("mfaConfirmar");
    btn.disabled=true;
    const modo=flujo;
    const factorId=inscripcionId||factoresVerificados[0]?.id;
    try{
      if(!factorId)throw Error("No hay un autenticador disponible.");
      const {error:errorCodigo}=await sb.auth.mfa.challengeAndVerify({factorId,code:codigo});
      if(errorCodigo)throw Error("El código no es correcto o ha caducado.");
      if(modo!=="respaldo"){
        const {data,error}=await sb.rpc("configurar_mfa_admin",{p_activar:modo==="activar"});
        if(error)throw error;
        if(data!==(modo==="activar"))throw Error("La configuración no se guardó.");
      }
      limpiarFormulario();
      await estadoActual();
      mensaje(modo==="desactivar"
        ?"2FA desactivado. La próxima vez bastarán tu correo y contraseña."
        :modo==="respaldo"
          ?"Dispositivo de respaldo añadido. Guárdalo para recuperar el acceso si pierdes el principal."
          :"2FA activado correctamente. El próximo acceso a Administración pedirá un código del móvil.");
    }catch(e){
      mensaje("No se pudo completar el cambio: "+e.message,true);
      btn.disabled=false;
      $("mfaCodigo").value="";
      $("mfaCodigo").focus();
    }
  };

  (async()=>{
    try{
      const {data:{session},error}=await sb.auth.getSession();
      if(error||!session)return;
      await estadoActual();
    }catch(e){
      $("mfaCard").hidden=false;
      $("mfaActivar").disabled=true;
      mensaje("No se pudo cargar la configuración de seguridad: "+e.message,true);
    }
  })();
})();
