import { SUPABASE_URL as URL, SUPABASE_PUBLISHABLE_KEY as KEY } from './config.js';
const API=URL.replace(/\/$/,'');
const form=document.getElementById('activation-form');
const feedback=document.getElementById('activation-feedback');
const button=document.getElementById('activation-submit');
const emailInput=document.getElementById('activation-email');
const queryEmail=new URLSearchParams(location.search).get('email');
if(queryEmail)emailInput.value=queryEmail;

function show(message,error=false){
  feedback.hidden=false;feedback.className='admin-activation-feedback'+(error?' is-error':' is-ok');
  feedback.textContent=message;
}
async function read(response){
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(String(data?.msg||data?.message||data?.error_description||data?.error||'No se pudo crear la cuenta.'));
  return data;
}
form.addEventListener('submit',async event=>{
  event.preventDefault();
  const email=emailInput.value.trim().toLowerCase();
  const password=document.getElementById('activation-password').value;
  const confirmation=document.getElementById('activation-password-confirm').value;
  if(password!==confirmation){show('Las dos contraseñas no coinciden.',true);return;}
  if(password.length<10){show('La contraseña debe tener al menos 10 caracteres.',true);return;}
  button.disabled=true;button.textContent='Creando acceso…';feedback.hidden=true;
  try{
    const response=await fetch(API+'/auth/v1/signup',{
      method:'POST',
      headers:{apikey:KEY,'Content-Type':'application/json'},
      body:JSON.stringify({email,password})
    });
    const data=await read(response);
    form.reset();
    if(data?.session||data?.access_token){
      show('Cuenta creada. Si tu correo estaba preautorizado, ya puedes volver a Administración e iniciar sesión.');
    }else{
      show('Cuenta creada. Revisa '+email+' y confirma el correo. Después vuelve a Administración para iniciar sesión.');
    }
  }catch(error){
    show('No se pudo crear el acceso: '+error.message,true);
  }finally{
    button.disabled=false;button.textContent='Crear mi acceso →';
  }
});