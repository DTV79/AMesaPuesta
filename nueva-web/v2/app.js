import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

const API = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/rpc/listar_comidas_publicas_v2';
let comidas = [];
let valoracionesDisponibles = new Map();

function el(tag, clase = '', texto = null) {
  const node = document.createElement(tag);
  if (clase) node.className = clase;
  if (texto !== null) node.textContent = String(texto);
  return node;
}
function txt(v) { return String(v ?? '').trim(); }
function fecha(iso, corto = false) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(txt(iso));
  if (!match) return 'Fecha pendiente';
  const date = new Date(+match[1], +match[2]-1, +match[3], 12);
  return new Intl.DateTimeFormat('es-ES', corto
    ? {day:'numeric',month:'short',year:'numeric'}
    : {day:'numeric',month:'long',year:'numeric'}).format(date);
}
const STORAGE_FOTOS = SUPABASE_URL.replace(/\/$/,'') + '/storage/v1/object/public/comidas/';
function fotosLegacy(m) {
  return /^[a-zA-Z0-9_-]+$/.test(txt(m.carpeta_fotos)) && Number.isInteger(Number(m.numero_fotos)) && Number(m.numero_fotos)>0 && Number(m.numero_fotos)<=500;
}
function origenFotoLegacy(m,index) {
  return 'https://raw.githubusercontent.com/DTV79/AMesaPuesta/53b6073bb0bab12113dc6a1ba52bc687ac39b9bc/docs/Fotos/' + encodeURIComponent(m.carpeta_fotos) + '/' + (index+1) + '.webp';
}
function urlFotoGuardada(ruta) {
  if(String(ruta).startsWith('https://')) return ruta;
  return STORAGE_FOTOS + String(ruta).split('/').map(encodeURIComponent).join('/');
}
function urlsFotos(m) {
  const nuevas=(Array.isArray(m.fotos_nuevas)?m.fotos_nuevas:[]).filter(f=>f&&f.ruta).map(f=>urlFotoGuardada(f.ruta));
  const historicas=fotosLegacy(m)?Array.from({length:Number(m.numero_fotos)},(_,i)=>origenFotoLegacy(m,i)):[];
  return [...new Set([...nuevas,...historicas])];
}
function fotosDisponibles(m) { return urlsFotos(m).length>0; }
function origenFoto(m,index) { return urlsFotos(m)[index] || ''; }
function foto(m,clase) {
  const box=el('div',clase);
  const fallback=el('span','image-fallback','🍽');
  fallback.setAttribute('aria-hidden','true');
  box.append(fallback);
  const urls=urlsFotos(m);
  if(urls.length){
    const img=el('img');
    let i=0;
    img.src=urls[0];
    img.alt='Recuerdo de '+txt(m.restaurante);
    img.loading='lazy';
    img.decoding='async';
    img.addEventListener('load',()=>{fallback.hidden=true;});
    img.addEventListener('error',()=>{if(++i<urls.length)img.src=urls[i];else img.remove();});
    box.append(img);
  }
  return box;
}
function estrellas(n) {
  const x = Number(n);
  return Number.isInteger(x)&&x>0&&x<=5 ? '★'.repeat(x)+'☆'.repeat(5-x) : 'Sin valoración';
}
function linkExterno(url) {
  try {const parsed=new URL(txt(url));return ['https:','http:'].includes(parsed.protocol)?parsed.href:'';}
  catch{return '';}
}
function ubicacion(m) {
  const lat=Number(m.latitud),lon=Number(m.longitud);
  const coords=Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90
    && Math.abs(lon)<=180&&lat!==0&&lon!==0;
  const query=coords ? String(lat)+','+String(lon) : txt(m.direccion)||txt(m.restaurante);
  return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(query);
}
function mostrarMensaje(destino, contenido, error=false) {
  destino.replaceChildren(el('div','message'+(error?' error':''),contenido));
}
async function consultarHistorial() {
  const c=new AbortController();
  const timer=setTimeout(()=>c.abort(),16000);
  try {
    const res=await fetch(API,{
      method:'POST',
      headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json','Accept':'application/json'},
      body:'{}',cache:'no-store',signal:c.signal
    });
    if (!res.ok) throw new Error('HTTP '+res.status);
    const list=await res.json();
    if(!Array.isArray(list)) throw new Error('Formato no válido');
    return list.filter(x=>x&&x.codigo&&x.fecha&&x.restaurante);
  } finally {clearTimeout(timer);}
}
function resumenCard(m) {
  const card=el('article','meal-card');
  const cover=foto(m,'card-image');
  cover.append(el('span','date-tag',fecha(m.fecha,true)));
  const body=el('div','card-body');
  const meta=el('div','card-meta');
  meta.append(el('span','',esProxima(m) ? '📅 Próxima comida' : 'Un encuentro para recordar'));
  const rating=el('span','',estrellas(m.valoracion));
  rating.setAttribute('aria-label','Valoración '+String(m.valoracion||0)+' de 5');
  meta.append(rating);
  body.append(meta,el('h3','',m.restaurante));
  body.append(el('p','summary',txt(m.comentario)||txt(m.direccion)||'Otra mesa para recordar.'));
  const link=el('a','card-link','Ver esta comida →');
  link.href='restaurantes.html#'+encodeURIComponent(m.codigo);
  body.append(link);
  card.append(cover,body);
  return card;
}
function renderHome() {
  document.getElementById('home-comidas').textContent=String(comidas.length);
  document.getElementById('home-restaurantes').textContent=
    String(new Set(comidas.map(x=>txt(x.restaurante))).size);
  const destino=document.getElementById('home-reciente');
  if (!comidas.length){mostrarMensaje(destino,'Pronto habrá nuevas comidas para recordar.');return;}
  destino.replaceChildren(...comidas.slice(0,3).map(resumenCard));
}

let galeria=null, indice=0, botonAnterior=null;
function refrescarGaleria() {
  if(!galeria) return;
  const img=document.getElementById('gallery-image');
  img.src=origenFoto(galeria,indice);
  img.alt=galeria.restaurante+' · Foto '+String(indice+1);
  document.getElementById('gallery-title').textContent=galeria.restaurante;
  document.getElementById('gallery-count').textContent=
    'Foto '+String(indice+1)+' de '+String(urlsFotos(galeria).length);
}
function abrirGaleria(m,boton) {
  if(!fotosDisponibles(m)) return;
  galeria=m;indice=0;botonAnterior=boton;
  refrescarGaleria();
  document.getElementById('gallery').showModal();
}
function moverFoto(paso) {
  if(!galeria)return;
  indice=(indice+paso+urlsFotos(galeria).length)%urlsFotos(galeria).length;
  refrescarGaleria();
}
function prepararGaleria(){
  const dialog=document.getElementById('gallery');
  document.getElementById('gallery-close').addEventListener('click',()=>dialog.close());
  document.getElementById('gallery-next').addEventListener('click',()=>moverFoto(1));
  document.getElementById('gallery-prev').addEventListener('click',()=>moverFoto(-1));
  dialog.addEventListener('close',()=>botonAnterior?.focus());
  dialog.addEventListener('click',e=>{if(e.target===dialog) dialog.close();});
  document.addEventListener('keydown',e=>{
    if(!dialog.open)return;
    if(e.key==='ArrowLeft')moverFoto(-1);
    if(e.key==='ArrowRight')moverFoto(1);
  });
  let inicio=0;
  const zona=document.getElementById('gallery-stage');
  zona.addEventListener('touchstart',e=>{inicio=e.changedTouches[0].screenX;},{passive:true});
  zona.addEventListener('touchend',e=>{
    const diff=e.changedTouches[0].screenX-inicio;
    if(Math.abs(diff)>55)moverFoto(diff<0?1:-1);
  },{passive:true});
}
function grupoMenu(label,value){
  if(!txt(value)||txt(value)==='-')return null;
  // Cada plato separado por la barra, punto y coma o salto de línea ocupa
  // su propia línea, sin dividir nombres que contienen comas.
  const platos=txt(value).split(/\s*(?:\/|;|\r?\n)\s*/).map(txt).filter(Boolean);
  if(!platos.length)return null;
  const d=el('section','menu-group');
  d.append(el('h4','',label));
  const lista=el('ul','menu-items');
  for(const plato of platos)lista.append(el('li','',plato));
  d.append(lista);
  return d;
}
function euro(value){
  if(value===null||value===undefined||txt(value)==='') return 'Sin precio registrado';
  const n=Number(value);
  return Number.isFinite(n)
    ? n.toLocaleString('es-ES',{style:'currency',currency:'EUR'})
    : 'Sin precio registrado';
}
function nombres(value){return Array.isArray(value)?value.filter(n=>typeof n==='string'&&n.trim()):[];}
function apartadoPersonas(titulo,list){
  const grupo=el('section','participant-group');
  grupo.append(el('h4','',titulo+' ('+String(list.length)+')'));
  if(!list.length){
    grupo.append(el('p','empty-names','Sin registros'));
    return grupo;
  }
  const ul=el('ul','participant-list');
  for(const persona of list)ul.append(el('li','',persona));
  grupo.append(ul);
  return grupo;
}
function datoEncabezado(label,valor){
  const div=el('div','visit-info-item');
  div.append(el('span','',label),el('strong','',valor));
  return div;
}
function esProxima(m) {
  const valor = txt(m.fecha);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!match) return false;
  const hoy = new Date();
  const fechaHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const fechaComida = new Date(Number(match[1]), Number(match[2])-1, Number(match[3]));
  return fechaComida >= fechaHoy;
}
async function cargarEstadoValoraciones(){
  const res=await fetch(SUPABASE_URL.replace(/\/$/,'')+'/rest/v1/rpc/listar_valoraciones_comidas_publicas',{
    method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:'{}',cache:'no-store'
  });
  if(!res.ok)throw Error('HTTP '+res.status);
  const data=await res.json();
  valoracionesDisponibles=new Map((Array.isArray(data)?data:[]).map(v=>[v.codigo,v]));
}
function valoracionPublica(m){
  const estado=valoracionesDisponibles.get(m.codigo);
  if(!estado)return null;
  const box=el('section','meal-voting');
  if(estado.abierta){
    box.append(el('h3','','⭐ Valoración de la comida'));
    if(estado.votos>0)box.append(el('p','meal-voting-summary','Nota general: '+Number(estado.media_general).toLocaleString('es-ES')+'/5 · '+estado.votos+' '+(estado.votos===1?'valoración':'valoraciones')));
  }
  const tokenComentarios=localStorage.getItem('amp_cofrade_token');
  if(tokenComentarios){
    const comentarios=el('details','meal-comments-toggle');
    const titulo=el('summary','','💬 Ver comentarios de los cofrades');
    comentarios.append(titulo);
    fetch(SUPABASE_URL.replace(/\/$/,'')+'/rest/v1/rpc/comentarios_comida_cofrades',{
      method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({p_token:tokenComentarios,p_codigo:m.codigo}),cache:'no-store'
    }).then(async res=>{if(!res.ok)throw Error('Comentarios no disponibles');return res.json()})
      .then(items=>{
        if(!Array.isArray(items)||!items.length)return;
        titulo.textContent='💬 Ver comentarios ('+items.length+')';
        const lista=el('div','meal-comments-list');
        for(const item of items){
          const entrada=el('div','meal-comment');
          entrada.append(el('strong','',item.autor||'Cofrade'),el('p','',item.texto||''));
          lista.append(entrada);
        }
        comentarios.append(lista);
        box.append(comentarios);
      }).catch(e=>console.warn(e));
  }
  if(!estado.abierta)return box;
  box.append(el('p','meal-voting-note','Solo pueden votar los cofrades asistentes. Una valoración por persona.'));
  const btn=el('button','meal-vote-button','⭐ Valorar esta comida');btn.type='button';box.append(btn);
  const tokenActual=localStorage.getItem('amp_cofrade_token');
  if(tokenActual){
    btn.hidden=true;
    fetch(SUPABASE_URL.replace(/\/$/,'')+'/rest/v1/rpc/mi_valoracion_comida_sesion',{
      method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({p_token:tokenActual,p_codigo:m.codigo}),cache:'no-store'
    }).then(async res=>{if(!res.ok)throw Error('Estado no disponible');return res.json()})
      .then(data=>{if(data.valorada){box.append(el('p','meal-voting-note','✓ Ya has valorado esta comida. ¡Gracias por participar!'));}else btn.hidden=false;})
      .catch(()=>{btn.hidden=false;});
  }
  const form=el('form','meal-vote-form');form.hidden=true;
  for(const [key,label] of [['comida','Comida'],['servicio','Servicio'],['ambiente','Local y ambiente'],['general','Experiencia general']]){
    const field=el('div','meal-rating-field');
    const title=el('span','meal-rating-label',label);field.append(title);
    const row=el('div','meal-rating-row');
    const value=el('input');value.type='hidden';value.name=key;value.value='0';row.append(value);
    const stars=el('span','meal-rating-stars');
    const hint=el('span','meal-rating-hint','Selecciona una puntuación');
    const buttons=[];
    const choose=n=>{value.value=String(n);hint.textContent=n+'/5';buttons.forEach((b,i)=>{b.textContent=i<n?'★':'☆';b.classList.toggle('chosen',i<n);b.setAttribute('aria-pressed',String(i+1===n));});};
    for(let n=1;n<=5;n++){const b=el('button','meal-rating-star','☆');b.type='button';b.setAttribute('aria-label',label+': '+n+' de 5 estrellas');b.setAttribute('aria-pressed','false');b.onclick=()=>choose(n);buttons.push(b);stars.append(b);}
    row.append(stars,hint);field.append(row);form.append(field);
  }
  const comment=el('label','','Comentario (opcional)');const textarea=el('textarea');textarea.name='comentario';textarea.maxLength=1000;textarea.rows=3;comment.append(textarea);form.append(comment);
  const submit=el('button','meal-vote-button','Enviar valoración');submit.type='submit';form.append(submit);
  const msg=el('p','meal-voting-note');msg.setAttribute('role','status');form.append(msg);box.append(form);
  btn.addEventListener('click',()=>{form.hidden=!form.hidden;});
  form.addEventListener('submit',async ev=>{
    ev.preventDefault();submit.disabled=true;msg.textContent='Guardando valoración…';
    try{
      const token=localStorage.getItem('amp_cofrade_token');
      if(!token)throw Error('Identifícate como cofrade para valorar esta comida.');
      const payload={action:'valorar_comida',token,codigo:m.codigo,comida:Number(form.elements.comida.value),servicio:Number(form.elements.servicio.value),ambiente:Number(form.elements.ambiente.value),general:Number(form.elements.general.value),comentario:form.elements.comentario.value};
      if([payload.comida,payload.servicio,payload.ambiente,payload.general].some(v=>!Number.isInteger(v)||v<1||v>5))throw Error('Selecciona las cuatro puntuaciones.');
      const res=await fetch(SUPABASE_URL.replace(/\/$/,'')+'/functions/v1/acceso-cofrade',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const result=await res.json();if(!res.ok||result.error)throw Error(result.error||'No se pudo guardar');
      msg.textContent='¡Valoración registrada! Gracias por participar.';submit.hidden=true;btn.hidden=true;
    }catch(error){msg.textContent=error.message;}finally{submit.disabled=false;}
  });
  return box;
}
function historialCard(m) {
  const card=el('article','history-card');
  card.id=m.codigo;
  const cover=foto(m,'history-photo');
  const contenido=el('div','history-content');
  const estadoValoracion=valoracionesDisponibles.get(m.codigo);
  const notaFinal=estadoValoracion&&!estadoValoracion.abierta&&estadoValoracion.votos>0 ? Number(estadoValoracion.media_general) : null;
  const stars=el('div','rating',estadoValoracion&&!estadoValoracion.abierta ? (notaFinal!==null ? estrellas(Math.max(1,Math.min(5,Math.round(notaFinal)))) : 'Sin valoración') : estrellas(m.valoracion));
  if(estadoValoracion&&!estadoValoracion.abierta)stars.classList.add('rating-final');
  if(notaFinal!==null)stars.title='Media de los cofrades: '+notaFinal.toLocaleString('es-ES')+'/5';
  stars.setAttribute('aria-label',notaFinal!==null?'Media de los cofrades '+notaFinal+' de 5':'Valoración '+String(m.valoracion||0)+' de 5');

  const cabecera=el('div','meal-heading');
  const titulos=el('div','meal-heading-titles');
  titulos.append(el('span','history-date',fecha(m.fecha)),el('h2','',m.restaurante));
  cabecera.append(titulos);
  if(esProxima(m)) {
    card.classList.add('upcoming-meal');
    const etiqueta=el('div','upcoming-meal-badge');
    etiqueta.append(el('strong','','📅 Próxima comida'),el('span','',fecha(m.fecha)));
    cabecera.append(etiqueta);
  }
  contenido.append(cabecera,stars);
  if(txt(m.direccion)) contenido.append(el('p','address',m.direccion));

  const organizadores=nombres(m.organizadores);
  const asistentes=nombres(m.asistentes);
  const ausentes=nombres(m.no_asistentes);
  const invitados=nombres(m.invitados);
  const info=el('div','visit-info');
  info.append(datoEncabezado('Organizaron',organizadores.join(' · ')||'Sin registro'));
  contenido.append(info);

  if(txt(m.comentario)){
    const cita=el('blockquote','visit-quote');
    cita.append(el('p','','“'+m.comentario+'”'));
    if(txt(m.autor_cita))cita.append(el('cite','','— '+m.autor_cita));
    contenido.append(cita);
  }

  const resumenAsistencia=el('div','visit-attendance-summary');
  resumenAsistencia.append(
    el('span','attended-count','✓ Asistieron: '+String(asistentes.length+invitados.length)),
    el('span','absent-count','No asistieron: '+String(ausentes.length))
  );
  contenido.append(resumenAsistencia);

  const actions=el('div','history-actions');
  const maps=el('a','','↗ Cómo llegar');
  maps.href=ubicacion(m);
  maps.target='_blank';
  maps.rel='noopener noreferrer';
  actions.append(maps);
  if(fotosDisponibles(m)){
    const btn=el('button','','▧ Ver fotos');
    btn.type='button';
    btn.addEventListener('click',()=>abrirGaleria(m,btn));
    actions.append(btn);
  }
  const web=linkExterno(m.web);
  if(web){
    const a=el('a','','Sitio web ↗');
    a.href=web;
    a.target='_blank';
    a.rel='noopener noreferrer';
    actions.append(a);
  }
  contenido.append(actions);

  const detalles=el('details','history-details');
  detalles.append(el('summary','','Ver menú, asistentes y precio'));

  // Primero el menú y sus platos: es el protagonista del encuentro.
  const menu=el('section','meal-menu');
  menu.append(el('h3','','Menú de la comida'));
  for(const [nombre,valor] of [
    ['Entrantes',m.menu_entrantes],['Platos principales',m.menu_principales],
    ['Postres',m.menu_postres],['Bebidas',m.menu_bebidas]
  ]){
    const grupo=grupoMenu(nombre,valor);
    if(grupo)menu.append(grupo);
  }
  detalles.append(menu);

  // Después quién asistió y quién no. No duplicar organizadores.
  const participantes=el('div','participant-sections');
  participantes.append(apartadoPersonas('Asistieron',asistentes));
  if(invitados.length)participantes.append(apartadoPersonas('Invitados',invitados));
  participantes.append(apartadoPersonas('No asistieron',ausentes));
  detalles.append(participantes);

  // El importe histórico queda como dato secundario y final.
  const precio=el('p','meal-total');
  precio.append(
    el('span','','Precio total de la comida'),
    el('span','',euro(m.precio_total))
  );
  detalles.append(precio);
  contenido.append(detalles);
  const votar=valoracionPublica(m);if(votar)contenido.append(votar);
  card.append(cover,contenido);
  return card;
}

function iniciarRestaurantes(){
  prepararGaleria();
  const buscar=document.getElementById('buscar'),anio=document.getElementById('anio'),
        limpiar=document.getElementById('limpiar'),contenedor=document.getElementById('historial'),
        contador=document.getElementById('resultado-contador');
  const years=[...new Set(comidas.map(m=>String(m.fecha).slice(0,4)))].sort().reverse();
  for(const year of years){const option=el('option','',year);option.value=year;anio.append(option);}
  function pintar(){
    const q=txt(buscar.value).toLocaleLowerCase('es'),y=anio.value;
    const filtered=comidas.filter(m=>{
      const contenido=[m.restaurante,m.direccion,m.fecha,m.comentario].map(txt).join(' ').toLocaleLowerCase('es');
      return (!q||contenido.includes(q))&&(!y||String(m.fecha).startsWith(y));
    });
    contador.textContent=String(filtered.length)+(filtered.length===1?' comida':' comidas');
    if(!filtered.length){mostrarMensaje(contenedor,'No hay resultados para estos filtros.');return;}
    contenedor.replaceChildren(...filtered.map(historialCard));
  }
  buscar.addEventListener('input',pintar);
  anio.addEventListener('change',pintar);
  limpiar.addEventListener('click',()=>{buscar.value='';anio.value='';pintar();buscar.focus();});
  pintar();
  const codigo=decodeURIComponent(location.hash.slice(1));
  if(/^RES-\d{4}$/.test(codigo)){
    document.getElementById(codigo)?.scrollIntoView({block:'start'});
  }
}
async function iniciar() {
  try {
    comidas=await consultarHistorial();
    try {
      const res=await fetch(SUPABASE_URL.replace(/\/$/,'')+'/rest/v1/rpc/listar_fotos_comidas_publicas_v2',{
        method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:'{}',cache:'no-store'
      });
      if(res.ok){
        const rows=await res.json();
        const porCodigo=new Map(rows.map(r=>[r.codigo,r.fotos]));
        for(const m of comidas)m.fotos_nuevas=porCodigo.get(m.codigo)||[];
      }else console.warn('No se pudieron consultar las portadas nuevas',res.status);
    }catch(e){console.warn('Fotografías nuevas no disponibles; se mantiene el histórico',e);}
    if(document.body.dataset.page==='restaurantes'){try{await cargarEstadoValoraciones()}catch(e){console.warn('Valoraciones no disponibles',e);}}
    if(document.body.dataset.page==='home')renderHome();
    else if(document.body.dataset.page==='restaurantes')iniciarRestaurantes();
  }catch(error){
    console.error('Historial no disponible:',error);
    const box=document.getElementById(document.body.dataset.page==='home'?'home-reciente':'historial');
    if(box)mostrarMensaje(box,'No se pudo cargar el historial. Prueba de nuevo en unos momentos.',true);
    const counter=document.getElementById('resultado-contador');
    if(counter)counter.textContent='Sin conexión';
  }
}
iniciar();