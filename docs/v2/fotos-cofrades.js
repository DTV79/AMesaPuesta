import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './config.js';

const ENDPOINT=SUPABASE_URL.replace(/\/$/,'')+'/functions/v1/fotos-cofrades';
const MAX_BYTES=4*1024*1024;
const getToken=()=>localStorage.getItem('amp_cofrade_token')||'';

async function respuesta(res){
  let data;
  try{data=await res.json();}catch{throw Error('No se pudo leer la respuesta del servidor.');}
  if(!res.ok||data?.error)throw Error(data?.error||'Error al enviar fotografías.');
  return data;
}

export async function comidasConFotosHabilitadas(){
  if(!getToken())return new Set();
  const controlador=new AbortController(),timer=setTimeout(()=>controlador.abort(),16000);
  try{
    const res=await fetch(ENDPOINT,{
      method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({action:'elegibles',token:getToken()}),cache:'no-store',signal:controlador.signal
    });
    const data=await respuesta(res);
    return new Set(Array.isArray(data.codigos)?data.codigos:[]);
  }finally{clearTimeout(timer);}
}

function cargarImagen(archivo){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(archivo),imagen=new Image();
    imagen.onload=()=>{URL.revokeObjectURL(url);resolve(imagen);};
    imagen.onerror=()=>{URL.revokeObjectURL(url);reject(Error('No se pudo leer esta imagen.'));};
    imagen.src=url;
  });
}

async function prepararFoto(file){
  const tipo=String(file.type||'').toLowerCase();
  const admitidos=['image/jpeg','image/png','image/webp','image/heic','image/heif'];
  if(!admitidos.includes(tipo))throw Error('Formato no admitido. Selecciona una fotografía JPG, PNG, WebP o HEIC.');
  if(file.size<=1500000&&!['image/heic','image/heif'].includes(tipo))return file;
  try{
    const imagen=await cargarImagen(file);
    const escala=Math.min(1,2048/Math.max(imagen.naturalWidth,imagen.naturalHeight));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(imagen.naturalWidth*escala));
    canvas.height=Math.max(1,Math.round(imagen.naturalHeight*escala));
    const ctx=canvas.getContext('2d');
    if(!ctx)throw Error('No se pudo reducir la imagen.');
    ctx.drawImage(imagen,0,0,canvas.width,canvas.height);
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('No se pudo convertir la foto.')),'image/jpeg',0.8));
    canvas.width=0;canvas.height=0;
    if(blob.size>0&&blob.size<=MAX_BYTES)return new File([blob],file.name.replace(/\.[^.]+$/,'.jpg'),{type:'image/jpeg'});
  }catch(e){console.warn('No se pudo optimizar la fotografía',e);}
  if(file.size>MAX_BYTES||['image/heic','image/heif'].includes(tipo))
    throw Error('No se pudo preparar esta foto. Prueba a enviarla en JPG o con un tamaño menor.');
  return file;
}

export async function subirFotosCofrade(codigo,files,progreso){
  const lista=Array.from(files||[]);
  if(!lista.length)return {guardadas:0,errores:[],total:0};
  if(lista.length>10)throw Error('Selecciona como máximo 10 fotografías por subida.');
  const errores=[];let guardadas=0;
  for(let i=0;i<lista.length;i++){
    const original=lista[i];
    const etiqueta='Foto '+(i+1)+' de '+lista.length;
    try{
      progreso(etiqueta+': preparando…');
      const archivo=await prepararFoto(original);
      if(archivo.size>MAX_BYTES)throw Error('La foto supera los 4 MB.');
      const form=new FormData();
      form.append('action','subir');form.append('token',getToken());form.append('codigo',codigo);
      form.append('foto',archivo,archivo.name);
      progreso(etiqueta+': subiendo…');
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),90000);
      try{
        const res=await fetch(ENDPOINT,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY},body:form,signal:controller.signal});
        await respuesta(res);
      }finally{clearTimeout(timer);}
      guardadas++;progreso(etiqueta+': guardada ✓');
    }catch(e){
      const mensaje=e?.name==='AbortError'?'Se agotó el tiempo de espera.':e?.message||'Error desconocido';
      errores.push(original.name+': '+mensaje);
      progreso(etiqueta+': '+mensaje);
    }
  }
  return {guardadas,errores,total:lista.length};
}
