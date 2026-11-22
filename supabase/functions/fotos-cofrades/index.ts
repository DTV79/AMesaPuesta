import { createClient } from 'npm:@supabase/supabase-js@2.95.0';

// Las fotos van al bucket privado «comidas». Nunca se entrega al navegador
// la clave de servicio ni un permiso general de escritura sobre Storage.
const url = Deno.env.get('SUPABASE_URL');
const clave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!url || !clave) throw Error('Configuración de fotografías incompleta');
const db = createClient(url, clave, {auth: {persistSession:false,autoRefreshToken:false}});
const maxBytes = 4 * 1024 * 1024;
const headers = {
  'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store',
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'content-type, apikey, authorization, x-client-info',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
};
const json = (data:unknown,status=200) => new Response(JSON.stringify(data),{status,headers});

function tipoSeguro(file:File, primeros:Uint8Array):string | null {
  const jpeg=primeros[0]===0xff&&primeros[1]===0xd8&&primeros[2]===0xff;
  const png=primeros.slice(0,8).every((v,i)=>v===[137,80,78,71,13,10,26,10][i]);
  const webp=String.fromCharCode(...primeros.slice(0,4))==='RIFF'
    &&String.fromCharCode(...primeros.slice(8,12))==='WEBP';
  if(file.type==='image/jpeg'&&jpeg)return 'jpg';
  if(file.type==='image/png'&&png)return 'png';
  if(file.type==='image/webp'&&webp)return 'webp';
  return null;
}

Deno.serve(async (req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return json({error:'Método no permitido'},405);
  try {
    const multipart=(req.headers.get('content-type')||'').includes('multipart/form-data');
    const form=multipart?await req.formData():null;
    const body=multipart?null:await req.json();
    const action=String(form?.get('action')||body?.action||'');
    const token=String(form?.get('token')||body?.token||'');
    if(!/^[a-f0-9]{64}$/.test(token))return json({error:'Inicia sesión de nuevo como cofrade'},401);

    if(action==='elegibles'){
      const {data,error}=await db.rpc('comidas_fotos_habilitadas_cofrade',{p_token:token});
      if(error)return json({error:'No se pudieron comprobar tus comidas'},401);
      return json({codigos:Array.isArray(data)?data:[]});
    }
    if(action!=='subir'||!form)return json({error:'Operación no válida'},400);
    const codigo=String(form.get('codigo')||'');
    const archivo=form.get('foto');
    if(!codigo||codigo.length>100||!(archivo instanceof File))return json({error:'Selecciona una comida y una foto'},400);
    if(archivo.size<100||archivo.size>maxBytes)return json({error:'La fotografía debe ocupar menos de 4 MB'},413);
    const bytes=new Uint8Array(await archivo.slice(0,16).arrayBuffer());
    const extension=tipoSeguro(archivo,bytes);
    if(!extension)return json({error:'Utiliza fotografías JPG, PNG o WebP'},415);

    const {data:comidaId,error:permiso}=await db.rpc('autorizar_foto_comida_cofrade',{
      p_token:token,p_codigo:codigo
    });
    if(permiso||typeof comidaId!=='string')return json({error:permiso?.message||'No puedes añadir fotos a esta comida'},403);

    const ruta=comidaId+'/'+crypto.randomUUID()+'.'+extension;
    const {error:subida}=await db.storage.from('comidas').upload(ruta,archivo,{
      contentType:archivo.type,cacheControl:'3600',upsert:false
    });
    if(subida){console.error('Storage: fallo al guardar una fotografía',subida.message);return json({error:'No se pudo subir la fotografía'},500);}

    const {error:registro}=await db.rpc('registrar_foto_comida_cofrade',{
      p_token:token,p_codigo:codigo,p_ruta:ruta,p_titulo:archivo.name
    });
    if(registro){
      console.error('Error al registrar fotografía',registro.code);
      // Se retira únicamente el fichero que acaba de crear esta petición.
      await db.storage.from('comidas').remove([ruta]);
      return json({error:registro.message||'No se pudo asociar la fotografía a la comida'},400);
    }
    return json({ok:true});
  }catch(error){
    console.error('Error de subida de fotografía',error instanceof Error?error.name:'desconocido');
    return json({error:'No se pudo completar la subida. Vuelve a intentarlo.'},500);
  }
});
