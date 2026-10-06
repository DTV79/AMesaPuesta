import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

const API = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/rpc/listar_comidas_publicas_v2';
let comidas = [];

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
function fotosDisponibles(m) {
  return /^[a-zA-Z0-9_-]+$/.test(txt(m.carpeta_fotos))
    && Number.isInteger(Number(m.numero_fotos))
    && Number(m.numero_fotos)>0 && Number(m.numero_fotos)<=500;
}
function origenFoto(m, index) {
  return '../Fotos/' + encodeURIComponent(m.carpeta_fotos) + '/' + (index+1) + '.webp';
}
function foto(m, clase) {
  const box = el('div',clase);
  const fallback = el('span','image-fallback','🍽');
  fallback.setAttribute('aria-hidden','true');
  box.append(fallback);
  if (fotosDisponibles(m)) {
    const img = el('img');
    img.src = origenFoto(m,0);
    img.alt = 'Recuerdo de ' + txt(m.restaurante);
    img.loading='lazy';
    img.decoding='async';
    img.addEventListener('error',()=>img.remove());
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
  meta.append(el('span','','Un encuentro para recordar'));
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
  const reciente=comidas[0];
  if (reciente) {
    document.getElementById('home-foto-titulo').textContent=reciente.restaurante;
    document.getElementById('home-foto-fecha').textContent=fecha(reciente.fecha);
    if(fotosDisponibles(reciente)){
      const img=document.getElementById('home-foto');
      img.src=origenFoto(reciente,0);
      img.alt='Comida de la cofradía en '+reciente.restaurante;
      img.hidden=false;
      img.addEventListener('error',()=>{img.hidden=true;});
    }
  }
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
    'Foto '+String(indice+1)+' de '+String(galeria.numero_fotos);
}
function abrirGaleria(m,boton) {
  if(!fotosDisponibles(m)) return;
  galeria=m;indice=0;botonAnterior=boton;
  refrescarGaleria();
  document.getElementById('gallery').showModal();
}
function moverFoto(paso) {
  if(!galeria)return;
  indice=(indice+paso+Number(galeria.numero_fotos))%Number(galeria.numero_fotos);
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
  const d=el('div','menu-group');
  d.append(el('strong','',label),el('p','',value));
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
function historialCard(m) {
  const card=el('article','history-card');
  card.id=m.codigo;
  const cover=foto(m,'history-photo');
  const contenido=el('div','history-content');
  const stars=el('div','rating',estrellas(m.valoracion));
  stars.setAttribute('aria-label','Valoración '+String(m.valoracion||0)+' de 5');

  contenido.append(el('span','history-date',fecha(m.fecha)),el('h2','',m.restaurante),stars);
  if(txt(m.direccion)) contenido.append(el('p','address',m.direccion));

  const organizadores=nombres(m.organizadores);
  const asistentes=nombres(m.asistentes);
  const ausentes=nombres(m.no_asistentes);
  const invitados=nombres(m.invitados);
  const info=el('div','visit-info');
  info.append(
    datoEncabezado('Precio total de la comida',euro(m.precio_total)),
    datoEncabezado('Organizaron',organizadores.join(' · ')||'Sin registro')
  );
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
  detalles.append(el('summary','','Ver asistentes, ausentes y menú'));

  const participantes=el('div','participant-sections');
  participantes.append(
    apartadoPersonas('Organizadores',organizadores),
    apartadoPersonas('Asistieron',asistentes),
    apartadoPersonas('No asistieron',ausentes)
  );
  if(invitados.length)participantes.append(apartadoPersonas('Invitados',invitados));
  detalles.append(participantes);

  const menu=el('div','meal-menu');
  const tituloMenu=el('h3','','Menú de la comida');
  menu.append(tituloMenu);
  for(const [nombre,valor] of [
    ['Entrantes',m.menu_entrantes],['Platos principales',m.menu_principales],
    ['Postres',m.menu_postres],['Bebidas',m.menu_bebidas]
  ]){
    const grupo=grupoMenu(nombre,valor);
    if(grupo)menu.append(grupo);
  }
  detalles.append(menu);
  contenido.append(detalles);
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