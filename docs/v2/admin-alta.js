import { SUPABASE_URL as URL, SUPABASE_PUBLISHABLE_KEY as KEY } from './config.js';
const API=URL.replace(/\/$/,'');
const form=document.getElementById('activation-form');
const feedback=document.getElementById('activation-feedback');
const button=document.getElementById('activation-submit');
const emailInput=document.getElementById('activation-email');
const params=new URLSearchParams(location.search);
const queryEmail=(params.get('email')||'').trim().toLowerCase();
const inviteToken=(params.get('token')||'').trim();
if(queryEmail){emailInput.value=queryEmail;emailInput.readOnly=true;}

function show(message,error=false){
  feedback.hidden=false;feedback.className='admin-activation-feedback'+(error?' is-error':' is-ok');
  feedback.textContent=message;
}
async function read(response){
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(String(data?.error||data?.message||'No se pudo activar la cuenta.'));
  return data;
}
if(!inviteToken){
  show('Este enlace de alta no contiene una autorización válida. Solicita al administrador un nuevo enlace.',true);
  button.disabled=true;
}
form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!inviteToken)return;
  const email=emailInput.value.trim().toLowerCase();
  const password=document.getElementById('activation-password').value;
  const confirmation=document.getElementById('activation-password-confirm').value;
  if(password!==confirmation){show('Las dos contraseñas no coinciden.',true);return;}
  if(password.length<10){show('La contraseña debe tener al menos 10 caracteres.',true);return;}
  button.disabled=true;button.textContent='Activando acceso…';feedback.hidden=true;
  try{
    await read(await fetch(API+'/functions/v1/activar-admin-cofradia',{
      method:'POST',
      headers:{apikey:KEY,'Content-Type':'application/json'},
      body:JSON.stringify({email,token:inviteToken,password})
    }));
    document.getElementById('activation-password').value='';
    document.getElementById('activation-password-confirm').value='';
    show('Acceso activado correctamente. Ya puedes entrar en Administración con tu correo y la contraseña que acabas de crear.');
    button.textContent='Acceso activado';
    setTimeout(()=>{location.href='admin-encuestas.html';},2200);
    return;
  }catch(error){
    show('No se pudo activar el acceso: '+error.message,true);
  }
  button.disabled=false;button.textContent='Crear mi acceso →';
});