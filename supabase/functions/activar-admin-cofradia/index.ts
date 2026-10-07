import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
  "Content-Type":"application/json"
};
const reply=(status:number,body:Record<string,unknown>)=>
  new Response(JSON.stringify(body),{status,headers:cors});
const sha256=async(value:string)=>{
  const bytes=new TextEncoder().encode(value);
  const hash=await crypto.subtle.digest("SHA-256",bytes);
  return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,"0")).join("");
};

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return reply(405,{error:"Método no permitido"});
  try{
    const {email,token,password}=await req.json();
    const cleanEmail=String(email||"").trim().toLowerCase();
    const cleanToken=String(token||"").trim();
    const cleanPassword=String(password||"");
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)||cleanEmail.length>320)
      return reply(400,{error:"Correo no válido"});
    if(!/^[a-f0-9]{64}$/i.test(cleanToken))
      return reply(400,{error:"Enlace de alta no válido"});
    if(cleanPassword.length<10||cleanPassword.length>128)
      return reply(400,{error:"La contraseña debe tener entre 10 y 128 caracteres"});

    const url=Deno.env.get("SUPABASE_URL")!;
    const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}});
    const tokenHash=await sha256(cleanToken);
    const {data:valid,error:validError}=await admin.rpc("validar_token_alta_admin",{
      p_email:cleanEmail,p_token_hash:tokenHash
    });
    if(validError)throw validError;
    if(valid!==true)return reply(403,{error:"El enlace ha caducado, ya fue utilizado o no corresponde a este correo"});

    const {data,error}=await admin.auth.admin.createUser({
      email:cleanEmail,password:cleanPassword,email_confirm:true
    });
    if(error){
      if(/already|registered|exists/i.test(error.message))
        return reply(409,{error:"Ya existe una cuenta con este correo. Prueba a iniciar sesión o solicita al administrador un nuevo acceso."});
      throw error;
    }
    if(!data.user)return reply(500,{error:"No se pudo crear la cuenta"});
    return reply(200,{ok:true,email:cleanEmail});
  }catch(error){
    return reply(500,{error:error instanceof Error?error.message:"No se pudo activar la cuenta"});
  }
});