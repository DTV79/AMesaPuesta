import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './config.js';

const enlace=document.getElementById('pizarra-mis-organizaciones');
const token=localStorage.getItem('amp_cofrade_token');
if(enlace&&token){
  // Consulta independiente: nunca retrasa ni bloquea la carga de Mi Pizarra.
  fetch(SUPABASE_URL.replace(/\/$/,'')+'/rest/v1/rpc/listar_mis_organizaciones_cofrade',{
    method:'POST',cache:'no-store',
    headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({p_token:token})
  }).then(r=>r.ok?r.json():[]).then(lista=>{
    enlace.hidden=!(Array.isArray(lista)&&lista.length);
  }).catch(()=>{});
}
