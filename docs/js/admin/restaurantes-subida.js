// Subida controlada de fotografías desde móviles y escritorio.
// Mantiene las comprobaciones de autorización de Supabase Storage (RLS).
const URL_STORAGE="https://wmfcpnihymiiwgpvbngj.supabase.co/storage/v1/object/comidas/";
const CLAVE_PUBLICA="sb_publishable_ij3sYbyMrLI2B34OOYt6JA_Aez1R2cJ";
const MAX_BYTES=10*1024*1024;
const TIPOS={jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp",heic:"image/heic",heif:"image/heif"};
const nombreArchivo=f=>String(f.name||"foto.jpg");
const extension=f=>nombreArchivo(f).split(".").pop().toLowerCase();

function conLimite(promise,ms,mensaje) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(mensaje)),ms)})
  ]).finally(()=>clearTimeout(timer));
}

function cargarFotoTemporal(archivo) {
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(archivo);
    const img=new Image();
    let cerrado=false;
    const terminar=(error)=>{
      if(cerrado)return;
      cerrado=true;
      img.onload=null;img.onerror=null;
      URL.revokeObjectURL(url);
      error?reject(error):resolve(img);
    };
    img.onload=()=>terminar(null);
    img.onerror=()=>terminar(new Error("No se pudo leer el formato de imagen."));
    img.src=url;
  });
}

// En 4G, optimizar archivos grandes antes de transferirlos evita esperas largas.
async function prepararFoto(file) {
  const ext=extension(file);
  const tipo=TIPOS[ext]||file.type;
  if(!Object.values(TIPOS).includes(tipo))throw new Error("Formato no admitido: "+nombreArchivo(file));
  const esHeic=tipo==="image/heic"||tipo==="image/heif";
  if(file.size<=1500000&&!esHeic)return {blob:file,extension:ext,tipo};
  try {
    const imagen=await conLimite(cargarFotoTemporal(file),20000,"No se pudo abrir la imagen para reducir su tamaño.");
    const ancho=imagen.naturalWidth||imagen.width,alto=imagen.naturalHeight||imagen.height;
    if(!(ancho>0&&alto>0))throw Error("Dimensiones inválidas");
    const escala=Math.min(1,2048/Math.max(ancho,alto));
    const canvas=document.createElement("canvas");
    canvas.width=Math.max(1,Math.round(ancho*escala));
    canvas.height=Math.max(1,Math.round(alto*escala));
    const ctx=canvas.getContext("2d");
    if(!ctx)throw Error("No se puede preparar la imagen");
    ctx.drawImage(imagen,0,0,canvas.width,canvas.height);
    const jpg=await conLimite(new Promise((resolve,reject)=>{
      canvas.toBlob(blob=>blob?resolve(blob):reject(Error("No se pudo convertir la imagen")),"image/jpeg",0.82);
    }),20000,"La conversión de la foto ha tardado demasiado.");
    canvas.width=0;canvas.height=0;
    if(jpg.size>0&&jpg.size<=MAX_BYTES)return {blob:jpg,extension:"jpg",tipo:"image/jpeg"};
  } catch(e) {
    console.warn("No se pudo optimizar la foto; se intentará subir el original",e);
    if(file.size>MAX_BYTES||esHeic)throw new Error("No se pudo preparar «"+nombreArchivo(file)+"». Prueba a enviarla desde Fotos como JPEG o reducir su tamaño.");
  }
  if(file.size>MAX_BYTES)throw new Error("«"+nombreArchivo(file)+"» supera el límite de 10 MB, incluso tras optimizarla.");
  return {blob:file,extension:ext,tipo};
}

async function subirArchivo(sb,path,foto) {
  const {data:{session},error:sessionError}=await conLimite(sb.auth.getSession(),15000,"No se pudo verificar la sesión. Comprueba la conexión o vuelve a iniciar sesión.");
  if(sessionError||!session?.access_token)throw Error("La sesión ha caducado. Vuelve a entrar en Administración.");
  const control=new AbortController();
  const timer=setTimeout(()=>control.abort(),90000);
  try {
    const respuesta=await fetch(URL_STORAGE+path.split("/").map(encodeURIComponent).join("/"),{
      method:"POST",
      headers:{
        apikey:CLAVE_PUBLICA,
        Authorization:"Bearer "+session.access_token,
        "Content-Type":foto.tipo,
        "cache-control":"max-age=3600",
        "x-upsert":"false"
      },
      body:foto.blob,
      signal:control.signal
    });
    if(!respuesta.ok){
      const texto=(await respuesta.text()).slice(0,1500);
      let mensaje;
      try {const json=JSON.parse(texto);mensaje=json.message||json.error||json.msg;} catch {}
      throw new Error("Error al subir ("+respuesta.status+"): "+(mensaje||"No se ha podido guardar el archivo."));
    }
  } catch(error) {
    if(error?.name==="AbortError")throw Error("La subida ha superado 90 segundos. Comprueba la cobertura y vuelve a intentarlo.");
    throw error;
  } finally {clearTimeout(timer);}
}

export async function subirFotosDeComida({sb,comida,files,onProgress}) {
  const lista=Array.from(files||[]);
  if(!lista.length)return {guardadas:0,errores:[],total:0};
  let guardadas=0;
  const errores=[];
  for(let i=0;i<lista.length;i++){
    const original=lista[i];
    const prefijo="Foto "+(i+1)+" de "+lista.length+" ("+nombreArchivo(original)+")";
    let ruta="";
    try {
      onProgress(prefijo+": preparando…");
      const preparada=await prepararFoto(original);
      if(preparada.blob.size>MAX_BYTES)throw Error("Esta foto supera el límite de 10 MB.");
      ruta=comida+"/"+crypto.randomUUID()+"."+preparada.extension;
      onProgress(prefijo+": subiendo "+(preparada.blob.size/1024/1024).toFixed(1).replace(".",",")+" MB…");
      await subirArchivo(sb,ruta,preparada);
      onProgress(prefijo+": guardando en la ficha…");
      const controlador=new AbortController();
      const timer=setTimeout(()=>controlador.abort(),20000);
      let error;
      try {
        const resp=await sb.rpc("guardar_foto_comida_admin",{
          p_comida:comida,p_ruta:ruta,p_titulo:nombreArchivo(original)
        }).abortSignal(controlador.signal);
        error=resp.error;
      } finally {clearTimeout(timer);}
      if(error)throw error;
      guardadas++;
      onProgress(prefijo+": guardada ✓");
    }catch(error){
      console.error("Error subiendo foto",nombreArchivo(original),error);
      const razon=error?.name==="AbortError"?"No se ha podido confirmar el registro de la foto a tiempo.":error?.message||"Error desconocido";
      errores.push(nombreArchivo(original)+": "+razon);
      onProgress(prefijo+": error. "+razon);
      // No borrar automáticamente un objeto subido si la respuesta es incierta.
      // Podría haberse registrado correctamente aunque la conexión se corte.
    }
  }
  return {guardadas,errores,total:lista.length};
}
