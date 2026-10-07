// Panel privado de encuestas. Solo clave publicable, Supabase Auth y RPC autorizadas.
// La página pública sigue usando Google Apps Script hasta completar la migración.
import { SUPABASE_URL as URL, SUPABASE_PUBLISHABLE_KEY as KEY } from './config.js';

const $ = id => document.getElementById(id);
const API = URL.replace(/\/$/, '');
const SESSION = 'amp_admin_encuestas_session';
const STATES = {borrador:'Borrador',programada:'Programada',abierta:'Abierta',pausada:'Pausada',cerrada:'Cerrada',archivada:'Archivada'};
const TYPES = {publica:'Pública',secreta:'Secreta',participacion:'Participación visible'};
let session = null, polls = [], selectedId = null, dirty = false, busy = false;

function el(tag,cls='',text){
  const n=document.createElement(tag);
  if(cls)n.className=cls;
  if(text!==undefined)n.textContent=String(text);
  return n;
}
const str = value => String(value??'').trim();
const selected = () => polls.find(p=>p.id===selectedId)||null;
const options = value => String(value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
const currentType = () => document.querySelector('input[name="admin-type"]:checked')?.value||'secreta';
function typeSelect(value){
  const radio=document.querySelector('input[name="admin-type"][value="'+value+'"]');
  if(radio)radio.checked=true;
}
function localTime(iso){
  if(!iso)return '';
  const d=new Date(iso);if(Number.isNaN(d.getTime()))return '';
  const p=n=>String(n).padStart(2,'0');
  return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes());
}
function isoTime(value){
  if(!value)return null;
  const d=new Date(value);
  if(Number.isNaN(d.getTime()))throw new Error('Fecha no válida.');
  return d.toISOString();
}
function feedback(message,error=false){
  const n=$('admin-notice');n.hidden=false;n.textContent=message;
  n.className='admin-toast'+(error?' is-error':'');
}
function headers(token){
  return {apikey:KEY,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})};
}
async function parseResponse(response){
  const data=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(str(data?.message||data?.error_description||data?.msg||data?.error)||'Error HTTP '+response.status);
  return data;
}
function setSession(data){
  if(!data?.access_token||!data?.refresh_token)throw new Error('No se recibió una sesión válida.');
  session={access_token:data.access_token,refresh_token:data.refresh_token,
    expires_at:Date.now()+(Number(data.expires_in)||3600)*1000,email:str(data.user?.email||session?.email)};
  sessionStorage.setItem(SESSION,JSON.stringify(session));
}
function clearSession(){session=null;sessionStorage.removeItem(SESSION);}
async function refresh(){
  if(!session?.refresh_token)throw new Error('Sesión caducada.');
  const response=await fetch(API+'/auth/v1/token?grant_type=refresh_token',{
    method:'POST',headers:headers(),body:JSON.stringify({refresh_token:session.refresh_token})});
  setSession(await parseResponse(response));
}
async function rpc(name,body={}){
  if(!session?.access_token)throw new Error('Inicia sesión.');
  if(Date.now()>session.expires_at-60000)await refresh();
  const request=()=>fetch(API+'/rest/v1/rpc/'+name,{
    method:'POST',headers:headers(session.access_token),body:JSON.stringify(body),cache:'no-store'});
  let response=await request();
  if(response.status===401){await refresh();response=await request();}
  return parseResponse(response);
}
function view(login){$('admin-login').hidden=!login;$('admin-dashboard').hidden=login;}
function lock(value){
  busy=value;
  for(const id of ['admin-save','admin-delete','admin-new','admin-login-submit'])$(id).disabled=value;
}
function stats(){
  $('admin-stat-drafts').textContent=polls.filter(p=>(p.estado_efectivo||p.estado)==='borrador').length;
  $('admin-stat-scheduled').textContent=polls.filter(p=>(p.estado_efectivo||p.estado)==='programada').length;
  $('admin-stat-open').textContent=polls.filter(p=>(p.estado_efectivo||p.estado)==='abierta').length;
  $('admin-stat-closed').textContent=polls.filter(p=>['cerrada','archivada'].includes(p.estado_efectivo||p.estado)).length;
}
function renderList(){
  const root=$('admin-list');root.replaceChildren();
  const query=str($('admin-search').value).toLocaleLowerCase('es'),status=$('admin-filter').value;
  $('admin-list-count').textContent=polls.length+(polls.length===1?' encuesta':' encuestas');
  const matches=polls.filter(p=>(!status||(p.estado_efectivo||p.estado)===status)&&(!query||p.titulo.toLocaleLowerCase('es').includes(query)));
  if(!matches.length){
    root.append(el('p','admin-list-empty',polls.length?'No hay resultados para este filtro.':'Aún no hay encuestas. Crea la primera con «+ Nueva».'));
    return;
  }
  for(const p of matches){
    const button=el('button','admin-list-item'+(p.id===selectedId?' is-selected':''));
    button.type='button';button.setAttribute('aria-pressed',String(p.id===selectedId));
    const meta=el('div','admin-list-item-top');
    meta.append(el('span','admin-mini-status state-'+(p.estado_efectivo||p.estado),STATES[p.estado_efectivo||p.estado]||p.estado),el('small','',TYPES[p.tipo]));
    button.append(meta,el('strong','',p.titulo),el('span','admin-list-item-meta',(p.participantes||0)+' participantes · '+(p.opciones?.length||0)+' opciones'));
    button.addEventListener('click',()=>selectPoll(p.id));
    root.append(button);
  }
}

const EMOJI_RECENTS_KEY='amp_admin_emoji_recents_v1';
const EMOJI_GROUPS=[
  {id:'recientes',icon:'🕘',label:'Recientes',items:[]},
  {id:'comida',icon:'🍽️',label:'Comida y bebida',items:['🍽️','🍴','🥄','🍷','🍾','🥂','🍺','☕','🥤','🧀','🥖','🥐','🍞','🥩','🍗','🍖','🐟','🦐','🦀','🦞','🐙','🦑','🍚','🥘','🍲','🍝','🍕','🥗','🥔','🍅','🫒','🍎','🍓','🍰','🎂']},
  {id:'caras',icon:'😀',label:'Caras',items:['😀','😃','😄','😁','😂','😊','😍','🥰','😋','😎','🤩','🤔','🤨','😅','😬','🙄','😮','😢','😭','😡','🥳','🤗','🫡','🤭','🤫','😴']},
  {id:'gestos',icon:'👍',label:'Gestos y símbolos',items:['👍','👎','👌','👏','🙌','🤝','🙏','💪','✋','👋','🤞','☝️','👉','👈','❤️','💚','💛','💙','🤍','💯','✅','❌','⚠️','❓','❗','⭐','🏆','🎯','💡','🔥']},
  {id:'eventos',icon:'📅',label:'Fechas y celebración',items:['📅','🗓️','⏰','⌛','📍','🗺️','🚗','🚌','🏠','🏨','🎉','🎊','🎁','🎵','🎶','🎤','📸','🎲','⚽','🏓','🎾','☀️','🌧️','🌙','🌊']},
  {id:'votacion',icon:'🗳️',label:'Encuestas y comunicación',items:['🗳️','📊','📋','📝','📣','🔔','📌','📍','💬','📢','👀','🔒','🔓','👤','👥','➕','➖','➡️','⬅️','🔝','💶','💰','🧾','ℹ️']}
];
let emojiTarget=null,emojiActiveGroup='comida',emojiPicker=null,emojiLastButton=null;
function emojiRecents(){
  try{
    const value=JSON.parse(localStorage.getItem(EMOJI_RECENTS_KEY)||'[]');
    return Array.isArray(value)?value.filter(x=>typeof x==='string').slice(0,18):[];
  }catch{return [];}
}
function rememberEmoji(value){
  const next=[value,...emojiRecents().filter(x=>x!==value)].slice(0,18);
  try{localStorage.setItem(EMOJI_RECENTS_KEY,JSON.stringify(next));}catch{}
}
function insertEmoji(value){
  if(!emojiTarget)return;
  const target=emojiTarget;
  const start=Number.isInteger(target.selectionStart)?target.selectionStart:target.value.length;
  const end=Number.isInteger(target.selectionEnd)?target.selectionEnd:start;
  const max=Number(target.maxLength);
  const nextLength=target.value.length-(end-start)+value.length;
  if(max>0&&nextLength>max){feedback('No cabe otro emoji: este campo ha alcanzado su longitud máxima.',true);return;}
  target.setRangeText(value,start,end,'end');
  rememberEmoji(value);
  target.dispatchEvent(new Event('input',{bubbles:true}));
  target.focus();
  renderEmojiPicker(emojiActiveGroup);
}
function renderEmojiPicker(groupId){
  if(!emojiPicker)return;
  const recent=emojiRecents();
  if(groupId==='recientes'&&!recent.length)groupId='comida';
  emojiActiveGroup=groupId;
  const tabs=emojiPicker.querySelector('.admin-emoji-tabs');
  const grid=emojiPicker.querySelector('.admin-emoji-grid');
  const title=emojiPicker.querySelector('.admin-emoji-group-title');
  tabs.replaceChildren();grid.replaceChildren();
  for(const group of EMOJI_GROUPS){
    const items=group.id==='recientes'?recent:group.items;
    const button=el('button','admin-emoji-tab',group.icon);
    button.type='button';button.title=group.label;button.setAttribute('aria-label',group.label);
    button.setAttribute('aria-pressed',String(group.id===groupId));
    button.disabled=group.id==='recientes'&&!items.length;
    button.addEventListener('click',()=>renderEmojiPicker(group.id));
    tabs.append(button);
  }
  const current=EMOJI_GROUPS.find(g=>g.id===groupId)||EMOJI_GROUPS[1];
  const items=current.id==='recientes'?recent:current.items;
  title.textContent=current.label;
  for(const value of items){
    const button=el('button','admin-emoji-item',value);
    button.type='button';button.title='Insertar '+value;button.setAttribute('aria-label','Insertar '+value);
    button.addEventListener('click',()=>insertEmoji(value));grid.append(button);
  }
}
function closeEmojiPicker(){
  if(!emojiPicker)return;
  emojiPicker.hidden=true;
  emojiLastButton?.setAttribute('aria-expanded','false');
  emojiLastButton=null;
}
function positionEmojiPicker(button){
  if(!emojiPicker||matchMedia('(max-width: 700px)').matches)return;
  const rect=button.getBoundingClientRect(),width=Math.min(360,window.innerWidth-24);
  const left=Math.max(12,Math.min(window.innerWidth-width-12,rect.right-width));
  const estimatedHeight=335;
  const top=rect.bottom+8+estimatedHeight>window.innerHeight
    ?Math.max(12,rect.top-estimatedHeight-8):rect.bottom+8;
  emojiPicker.style.left=left+'px';emojiPicker.style.top=top+'px';emojiPicker.style.width=width+'px';
}
function openEmojiPicker(target,button){
  if(emojiPicker&&!emojiPicker.hidden&&emojiTarget===target){closeEmojiPicker();return;}
  emojiTarget=target;emojiLastButton?.setAttribute('aria-expanded','false');emojiLastButton=button;
  button.setAttribute('aria-expanded','true');
  renderEmojiPicker(emojiRecents().length?'recientes':'comida');
  emojiPicker.hidden=false;positionEmojiPicker(button);
}
function installEmojiPicker(){
  emojiPicker=el('div','admin-emoji-picker');
  emojiPicker.id='admin-emoji-picker';emojiPicker.hidden=true;emojiPicker.setAttribute('role','dialog');
  emojiPicker.setAttribute('aria-label','Selector de emojis');
  const head=el('div','admin-emoji-picker-head');
  head.append(el('strong','admin-emoji-group-title','Emojis'));
  const close=el('button','admin-emoji-close','×');close.type='button';close.setAttribute('aria-label','Cerrar selector de emojis');
  close.addEventListener('click',closeEmojiPicker);head.append(close);
  emojiPicker.append(head,el('div','admin-emoji-tabs'),el('div','admin-emoji-grid'));
  document.body.append(emojiPicker);

  for(const id of ['admin-title','admin-description','admin-options']){
    const target=$(id),wrap=el('span','admin-emoji-field');
    target.parentNode.insertBefore(wrap,target);wrap.append(target);
    const button=el('button','admin-emoji-trigger','😀');
    button.type='button';button.title='Añadir emoji';button.setAttribute('aria-label','Añadir emoji');
    button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','admin-emoji-picker');
    button.setAttribute('aria-expanded','false');
    button.addEventListener('click',()=>openEmojiPicker(target,button));
    wrap.append(button);
  }
  document.addEventListener('pointerdown',event=>{
    if(emojiPicker.hidden)return;
    if(emojiPicker.contains(event.target)||event.target.closest?.('.admin-emoji-trigger'))return;
    closeEmojiPicker();
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeEmojiPicker();});
  window.addEventListener('resize',()=>{if(!emojiPicker.hidden&&emojiLastButton)positionEmojiPicker(emojiLastButton);});
  window.addEventListener('scroll',()=>{if(!emojiPicker.hidden&&emojiLastButton&&!matchMedia('(max-width: 700px)').matches)positionEmojiPicker(emojiLastButton);},{passive:true});
}

function confirmDiscard(){return !dirty||window.confirm('Hay cambios sin guardar. ¿Quieres descartarlos?');}
function resetForm(force=false){
  if(!force&&!confirmDiscard())return;
  selectedId=null;
  $('admin-poll-form').reset();
  $('admin-title').value='';$('admin-description').value='';$('admin-options').value='';
  $('admin-max').value='1';$('admin-start').value='';$('admin-end').value='';
  $('admin-electors').value='todos';$('admin-state').value='borrador';
  $('admin-show-results').checked=true;$('admin-show-winner').checked=true;
  typeSelect('secreta');$('admin-editor-heading').textContent='Nueva encuesta';
  $('admin-delete').hidden=true;$('admin-archive').hidden=true;dirty=false;refreshEditor();renderList();
}
function selectPoll(id,force=false){
  if(!force&&!confirmDiscard())return;
  const p=polls.find(x=>x.id===id);if(!p)return;
  selectedId=id;
  $('admin-title').value=p.titulo;$('admin-description').value=p.descripcion||'';
  $('admin-options').value=(p.opciones||[]).map(x=>x.texto).join('\n');
  $('admin-max').value=p.max_opciones;$('admin-electors').value=p.electores;
  $('admin-start').value=localTime(p.abre_en);$('admin-end').value=localTime(p.cierra_en);
  $('admin-state').value=p.estado;$('admin-show-results').checked=p.mostrar_resultados;
  $('admin-show-winner').checked=p.mostrar_ganador;typeSelect(p.tipo);
  $('admin-editor-heading').textContent='Editar encuesta';
  const hasVotes=Number(p.participantes)>0;
  $('admin-delete').hidden=hasVotes;
  $('admin-delete').title=hasVotes?'No se puede eliminar porque ya tiene votos':'Eliminar definitivamente esta encuesta';
  $('admin-archive').hidden=!hasVotes||p.estado==='archivada';
  dirty=false;refreshEditor();renderList();
}
function renderPreview(){
  const root=$('admin-preview-card');root.replaceChildren();
  const state=$('admin-state').value,type=currentType();
  const tags=el('div','admin-preview-tags');
  tags.append(el('span','admin-mini-status state-'+state,STATES[state]),el('span','admin-preview-type',TYPES[type]));
  root.append(tags,el('h4','',str($('admin-title').value)||'Título de la encuesta'));
  const description=str($('admin-description').value);
  if(description)root.append(el('p','admin-preview-description',description));
  const choices=options($('admin-options').value);
  if(choices.length){
    const list=el('div','admin-preview-options');
    for(const choice of choices.slice(0,20)){
      const line=el('div','admin-preview-option');
      line.append(el('span','admin-preview-option-circle','○'),el('span','',choice));list.append(line);
    }
    root.append(list);
  }else root.append(el('p','admin-preview-empty','Añade las opciones para ver cómo quedará.'));
  const foot=el('div','admin-preview-footer');
  foot.append(el('span','',type==='secreta'?'🔒 Voto secreto':type==='publica'?'👁 Voto público':'✓ Participación visible'));
  const max=Number($('admin-max').value)||1;
  foot.append(el('span','',max===1?'Una opción':'Hasta '+max+' opciones'));
  root.append(foot,el('p','admin-preview-caution','Simulación: no se publica ni registra votos en la web actual.'));
}
function renderResults(){
  const p=selected(),section=$('admin-results');
  if(!p){section.hidden=true;return;}
  section.hidden=false;
  const root=$('admin-results-content');root.replaceChildren();
  const count=Number(p.participantes)||0;
  root.append(el('p','admin-results-summary',count+(count===1?' cofrade ha votado.':' cofrades han votado.')));
  if(p.resultados_disponibles===false){
    root.append(el('p','admin-preview-empty','🔒 Los resultados de esta votación permanecerán ocultos hasta su cierre, también para los administradores.'));
    return;
  }
  if(!count){root.append(el('p','admin-preview-empty','Sin votos registrados todavía en Supabase.'));return;}
  for(const o of p.opciones||[]){
    const votes=Number(o.votos)||0,pct=Math.round(100*votes/count);
    const row=el('div','admin-results-row'),head=el('div','admin-results-label');
    head.append(el('span','',o.texto),el('strong','',votes+' votos · '+pct+'%'));
    const track=el('div','admin-results-track'),fill=el('span');
    fill.style.width=Math.max(0,Math.min(100,pct))+'%';track.append(fill);
    row.append(head,track);root.append(row);
  }
  root.append(el('p','admin-results-privacy',p.tipo==='publica'
    ? 'Encuesta pública: los votos pueden asociarse a la identidad de quien eligió cada opción.'
    : 'La identidad de quien elige cada opción no se conserva: solo se muestran resultados agregados.'));
}
function refreshEditor(){
  const state=$('admin-state').value,chip=$('admin-editor-status');
  const effective=!dirty&&selected()?.estado_efectivo?selected().estado_efectivo:state;
  chip.textContent=STATES[effective];chip.className='admin-status-chip state-'+effective;
  renderPreview();renderResults();
}
function values(){
  const choices=options($('admin-options').value),max=Number($('admin-max').value);
  if(choices.length<2||choices.length>20)throw new Error('Introduce de 2 a 20 opciones, una por línea.');
  if(new Set(choices.map(s=>s.toLocaleLowerCase('es'))).size!==choices.length)throw new Error('Hay opciones repetidas.');
  if(choices.some(s=>s.length>180))throw new Error('Una opción supera los 180 caracteres.');
  if(!Number.isInteger(max)||max<1||max>choices.length)throw new Error('El máximo de elecciones debe estar entre 1 y el número de opciones.');
  const start=isoTime($('admin-start').value),end=isoTime($('admin-end').value),state=$('admin-state').value;
  if(start&&end&&new Date(end)<=new Date(start))throw new Error('El cierre debe ser posterior a la apertura.');
  if(state==='programada'&&!start)throw new Error('Indica una fecha de apertura para programar.');
  return {...(selectedId?{id:selectedId}:{}),titulo:str($('admin-title').value),
    descripcion:str($('admin-description').value),opciones:choices,max_opciones:max,
    tipo:currentType(),electores:$('admin-electors').value,
    mostrar_resultados:$('admin-show-results').checked,mostrar_ganador:$('admin-show-winner').checked,
    abre_en:start,cierra_en:end,estado:state};
}
async function reload(keep=true){
  const data=await rpc('listar_encuestas_admin');
  if(!Array.isArray(data))throw new Error('Formato de datos incorrecto.');
  polls=data;stats();renderList();
  if(keep&&selectedId&&polls.some(p=>p.id===selectedId))selectPoll(selectedId,true);
  else resetForm(true);
}
async function save(event){
  event.preventDefault();if(busy)return;
  let value;try{value=values();}catch(error){feedback(error.message,true);return;}
  if(!$('admin-poll-form').reportValidity())return;
  if(value.estado!=='borrador'&&(!selectedId||selected()?.estado!==value.estado)){
    if(!window.confirm('¿Guardar como '+(STATES[value.estado]||value.estado)+'?\n\nLa web pública todavía utiliza el sistema de Google.'))return;
  }
  lock(true);
  try{
    selectedId=await rpc('guardar_encuesta_admin',{p_encuesta:value});
    dirty=false;await reload();feedback('Encuesta guardada correctamente en Supabase.');
  }catch(error){feedback('No se pudo guardar: '+error.message,true);}
  finally{lock(false);}
}
async function remove(){
  const p=selected();
  if(!p||Number(p.participantes)>0||busy)return;
  if(!window.confirm('¿Eliminar definitivamente la encuesta «'+p.titulo+'»?\n\nTiene 0 votos. Esta acción no se puede deshacer.'))return;
  lock(true);
  try{
    await rpc('eliminar_encuesta_admin',{p_id:p.id});
    selectedId=null;dirty=false;await reload(false);feedback('Encuesta eliminada correctamente.');
  }catch(error){feedback('No se pudo eliminar: '+error.message,true);}
  finally{lock(false);}
}
function archivePoll(){
  const p=selected();
  if(!p||Number(p.participantes)<=0||p.estado==='archivada'||busy)return;
  if(!window.confirm('¿Archivar «'+p.titulo+'»?\n\nSus votos y resultados se conservarán en el histórico.'))return;
  $('admin-state').value='archivada';
  dirty=true;refreshEditor();
  $('admin-poll-form').requestSubmit();
}
async function loadAccounts(){
  const rows=await rpc('listar_cuentas_cofrades_admin');
  if(!Array.isArray(rows))throw new Error('No se pudo cargar la lista de cofrades.');
  const root=$('admin-accounts-list');root.replaceChildren();
  const active=rows.filter(c=>c.activo);
  const linked=active.filter(c=>c.vinculado).length;
  $('admin-accounts-summary').textContent=linked+' de '+active.length+' cofrades activos con cuenta vinculada';
  for(const c of rows){
    const card=el('article','admin-account-card'+(!c.activo?' is-inactive':''));
    const identity=el('div','admin-account-identity');
    identity.append(el('strong','',c.nombre),el('small','',c.categoria||'Cofrade'));
    const controls=el('div','admin-account-controls');
    if(!c.activo){
      controls.append(el('span','admin-mini-status','Baja · Sin acceso'));
    }else if(c.vinculado){
      controls.append(el('span','admin-mini-status state-abierta','✓ Vinculado'));
      if(c.correo)controls.append(el('span','admin-account-email',c.correo));
      const unlink=el('button','admin-outline','Desvincular');
      unlink.type='button';
      unlink.addEventListener('click',async()=>{
        if(busy||!window.confirm('¿Revocar el acceso de '+c.nombre+' a su identidad de votación?'))return;
        unlink.disabled=true;
        try{
          await rpc('desvincular_cuenta_cofrade_admin',{p_cofrade_id:c.id});
          await loadAccounts();feedback('Cuenta desvinculada correctamente.');
        }catch(error){feedback('No se pudo desvincular: '+error.message,true);unlink.disabled=false;}
      });
      controls.append(unlink);
    }else{
      controls.append(el('span','admin-mini-status state-borrador','Pendiente'));
      const input=el('input','admin-account-input');
      input.type='email';input.placeholder='Correo confirmado de Supabase';
      input.autocomplete='off';input.setAttribute('aria-label','Correo para vincular a '+c.nombre);
      const link=el('button','admin-new-button','Vincular');
      link.type='button';
      link.addEventListener('click',async()=>{
        const email=str(input.value);
        if(!email||!input.checkValidity()){feedback('Introduce un correo electrónico válido.',true);input.focus();return;}
        if(busy||!window.confirm('¿Vincular a '+c.nombre+' con la cuenta '+email+'? Comprueba la identidad antes de confirmar.'))return;
        link.disabled=true;
        try{
          await rpc('vincular_cuenta_cofrade_admin',{p_cofrade_id:c.id,p_correo:email});
          await loadAccounts();feedback('Cuenta de '+c.nombre+' vinculada correctamente.');
        }catch(error){feedback('No se pudo vincular: '+error.message,true);link.disabled=false;}
      });
      controls.append(input,link);
    }
    card.append(identity,controls);root.append(card);
  }
}
function activationUrl(email,token){
  const url=new URL('./admin-alta.html',window.location.href);
  url.searchParams.set('email',email);
  if(token)url.searchParams.set('token',token);
  return url.href;
}
async function copyText(value){
  if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(value);return;}
  const area=document.createElement('textarea');area.value=value;document.body.append(area);area.select();
  document.execCommand('copy');area.remove();
}
async function loadManagers(){
  const data=await rpc('listar_administradores_cofradia');
  const admins=Array.isArray(data?.administradores)?data.administradores:[];
  const invites=Array.isArray(data?.invitaciones)?data.invitaciones:[];
  const active=admins.filter(a=>a.activo);
  const pending=invites.filter(i=>i.estado==='pendiente');
  $('admin-managers-summary').textContent=active.length+' administrador'+(active.length===1?' activo':'es activos')+
    (pending.length?' · '+pending.length+' invitación'+(pending.length===1?' pendiente':'es pendientes'):'');
  const root=$('admin-managers-list');root.replaceChildren();

  for(const a of active){
    const card=el('article','admin-manager-card');
    const identity=el('div','admin-account-identity');
    identity.append(el('strong','',a.email||'Administrador'),el('small','',a.es_actual?'Tu cuenta':'Administrador activo'));
    const controls=el('div','admin-account-controls');
    controls.append(el('span','admin-mini-status state-abierta','✓ Activo'));
    if(a.es_actual)controls.append(el('span','admin-manager-you','Eres tú'));
    if(active.length>1){
      const revoke=el('button','admin-outline','Revocar');
      revoke.type='button';
      revoke.addEventListener('click',async()=>{
        if(!window.confirm('¿Revocar los permisos de administrador de '+a.email+'? La cuenta seguirá existiendo, pero no podrá administrar.'))return;
        revoke.disabled=true;
        try{
          await rpc('revocar_administrador_cofradia',{p_usuario_id:a.usuario_id});
          await loadManagers();feedback('Permisos de administrador revocados.');
          if(a.es_actual)logout();
        }catch(error){feedback('No se pudo revocar: '+error.message,true);revoke.disabled=false;}
      });
      controls.append(revoke);
    }
    card.append(identity,controls);root.append(card);
  }

  for(const i of pending){
    const card=el('article','admin-manager-card is-pending');
    const identity=el('div','admin-account-identity');
    identity.append(el('strong','',i.email),el('small','','Esperando a que cree y confirme su cuenta'));
    const controls=el('div','admin-account-controls');
    controls.append(el('span','admin-mini-status state-programada','Pendiente'));
    const copy=el('button','admin-outline','Copiar enlace de alta');copy.type='button';
    copy.addEventListener('click',async()=>{
      copy.disabled=true;
      try{
        const renewed=await rpc('renovar_invitacion_admin_cofradia',{p_id:i.id});
        await copyText(activationUrl(renewed.email,renewed.token));
        feedback('Nuevo enlace privado copiado. Caduca en 7 días y puedes enviárselo a '+i.email+'.');
      }catch(error){feedback('No se pudo generar el enlace: '+error.message,true);}
      finally{copy.disabled=false;}
    });
    const cancel=el('button','admin-outline','Cancelar');cancel.type='button';
    cancel.addEventListener('click',async()=>{
      if(!window.confirm('¿Cancelar la autorización pendiente de '+i.email+'?'))return;
      cancel.disabled=true;
      try{await rpc('cancelar_invitacion_admin_cofradia',{p_id:i.id});await loadManagers();feedback('Invitación cancelada.');}
      catch(error){feedback('No se pudo cancelar: '+error.message,true);cancel.disabled=false;}
    });
    controls.append(copy,cancel);card.append(identity,controls);root.append(card);
  }
  if(!active.length&&!pending.length)root.append(el('p','admin-list-empty','No hay administradores ni invitaciones.'));
}
async function authorizeManager(event){
  event.preventDefault();
  const input=$('admin-manager-email');
  const email=str(input.value).toLowerCase();
  if(!input.checkValidity()){feedback('Introduce un correo electrónico válido.',true);input.focus();return;}
  if(!window.confirm('¿Autorizar '+email+' como administrador? Esa persona creará su propia contraseña.'))return;
  const submit=event.currentTarget.querySelector('button[type="submit"]');submit.disabled=true;
  try{
    const result=await rpc('autorizar_administrador_cofradia',{p_email:email});
    input.value='';await loadManagers();
    if(result?.estado==='activado'){
      feedback(email+' ya tenía una cuenta confirmada y ha quedado activado como administrador.');
    }else if(result?.token){
      await copyText(activationUrl(email,result.token));
      feedback(email+' autorizado. Su enlace privado de alta se ha copiado al portapapeles y caduca en 7 días.');
    }else feedback(email+' autorizado. Genera su enlace privado desde la lista.');
  }catch(error){feedback('No se pudo autorizar: '+error.message,true);}
  finally{submit.disabled=false;}
}
async function dashboard(){
  const authorized=await rpc('soy_admin_cofradia');
  if(authorized!==true)throw new Error('Esta cuenta no está autorizada como administradora.');
  $('admin-user-label').textContent='Sesión iniciada: '+(session.email||'administrador autorizado');
  view(false);await reload(false);
  await loadAccounts().catch(error=>feedback('Cuentas: '+error.message,true));
  await loadManagers().catch(error=>feedback('Administradores: '+error.message,true));
}
async function login(event){
  event.preventDefault();if(busy)return;
  lock(true);
  try{
    const response=await fetch(API+'/auth/v1/token?grant_type=password',{
      method:'POST',headers:headers(),body:JSON.stringify({
        email:str($('admin-email').value),password:$('admin-password').value
      })});
    setSession(await parseResponse(response));
    $('admin-password').value='';await dashboard();
    feedback('Acceso autorizado.');
  }catch(error){
    clearSession();view(true);feedback('No se pudo acceder: '+error.message,true);
  }finally{lock(false);}
}
function logout(){
  const token=session?.access_token;clearSession();view(true);polls=[];selectedId=null;
  if(token)fetch(API+'/auth/v1/logout',{method:'POST',headers:headers(token)}).catch(()=>{});
  feedback('Sesión cerrada.');
}
$('admin-login-form').addEventListener('submit',login);
$('admin-poll-form').addEventListener('submit',save);
$('admin-new').addEventListener('click',()=>resetForm());
$('admin-delete').addEventListener('click',remove);
$('admin-archive').addEventListener('click',archivePoll);
$('admin-logout').addEventListener('click',logout);
$('admin-accounts-refresh').addEventListener('click',()=>loadAccounts().catch(error=>feedback('Cuentas: '+error.message,true)));
$('admin-managers-refresh').addEventListener('click',()=>loadManagers().catch(error=>feedback('Administradores: '+error.message,true)));
$('admin-manager-invite-form').addEventListener('submit',authorizeManager);
$('admin-search').addEventListener('input',renderList);
$('admin-filter').addEventListener('change',renderList);
$('admin-poll-form').addEventListener('input',()=>{dirty=true;refreshEditor();});
$('admin-poll-form').addEventListener('change',()=>{dirty=true;refreshEditor();});
window.addEventListener('beforeunload',e=>{
  if(dirty&&!busy&&!$('admin-dashboard').hidden){e.preventDefault();e.returnValue='';}
});
installEmojiPicker();
(async()=>{
  try{session=JSON.parse(sessionStorage.getItem(SESSION)||'null');}catch{session=null;}
  if(!session?.access_token||!session?.refresh_token){view(true);return;}
  try{await dashboard();}catch(error){clearSession();view(true);feedback('Inicia sesión de nuevo: '+error.message,true);}
})();
