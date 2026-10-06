import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

// Solo datos previamente públicos: NO se consultan cuotas, cargos ni saldos.
const API = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/rpc/listar_cofrades_publicos';

const crear = (etiqueta, clase = '', valor = null) => {
  const nodo = document.createElement(etiqueta);
  if (clase) nodo.className = clase;
  if (valor !== null) nodo.textContent = String(valor);
  return nodo;
};
const texto = valor => String(valor ?? '').trim();
const cantidad = valor => {
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
};
const sinTildes = valor => texto(valor)
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
const nombreOrden = (a, b) => texto(a.nombre).localeCompare(texto(b.nombre), 'es', { sensitivity: 'base' });
const esHistorico = persona => Boolean(persona.fecha_baja);
const esFundador = persona => persona.fundador === true;
const esAprendiz = persona => sinTildes(persona.categoria).includes('aprendiz');

function fecha(iso) {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto(iso));
  if (!partes) return 'Fecha no disponible';
  const fecha = new Date(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]), 12);
  return new Intl.DateTimeFormat('es-ES', {day:'numeric', month:'short', year:'numeric'}).format(fecha);
}
function iniciales(nombre) {
  const partes = texto(nombre).split(/\s+/).filter(Boolean);
  return (partes.length > 1 ? partes.slice(0,2) : partes.slice(0,1))
    .map(p=>Array.from(p)[0]||'').join('').toLocaleUpperCase('es') || 'AM';
}
async function consultarCofrades() {
  const controller = new AbortController();
  const reloj = setTimeout(() => controller.abort(), 16000);
  try {
    const response = await fetch(API, {
      method:'POST',
      headers:{
        apikey:SUPABASE_PUBLISHABLE_KEY,
        'Content-Type':'application/json',
        'Accept':'application/json'
      },
      body:'{}',
      cache:'no-store',
      signal:controller.signal
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const datos = await response.json();
    if (!Array.isArray(datos)) throw new Error('Formato de cofrades inesperado');
    return datos.filter(c=>c && typeof c.nombre==='string' && c.nombre.trim());
  } finally {
    clearTimeout(reloj);
  }
}
function mensaje(contenedor, contenido, error = false) {
  contenedor.replaceChildren(crear('div','message'+(error?' error':''), contenido));
}
function dato(label,valor){
  const bloque=crear('div','member-stat');
  bloque.append(crear('strong','',String(valor)),crear('span','',label));
  return bloque;
}
function ficha(persona) {
  const historico = esHistorico(persona);
  const fundador = esFundador(persona);
  const aprendiz = esAprendiz(persona);
  const clase = historico ? 'historico' : fundador ? 'fundador' : aprendiz ? 'aprendiz' : 'cofrade';

  const tarjeta = crear('article','member-card member-'+clase);
  const cabecera = crear('div','member-card-head');
  const avatar = crear('span','member-avatar member-avatar-'+clase,iniciales(persona.nombre));
  avatar.setAttribute('aria-hidden','true');
  const encabezado = crear('div','member-card-identity');
  encabezado.append(crear('h3','',persona.nombre));
  const categoria = historico ? 'Histórico' : texto(persona.categoria) || 'Cofrade';
  encabezado.append(crear('span','member-category member-category-'+clase,categoria));
  cabecera.append(avatar,encabezado);

  const fechaAlta=crear('p','member-joined');
  fechaAlta.append(crear('span','', 'En la cofradía desde '), crear('strong','',fecha(persona.fecha_ingreso)));
  if (historico) {
    fechaAlta.append(crear('span','member-left',' · Hasta '+fecha(persona.fecha_baja)));
  }

  const numeritos=crear('div','member-numbers');
  numeritos.append(
    dato('Comidas asistidas',cantidad(persona.comidas_asistidas)),
    dato('Comidas organizadas',cantidad(persona.comidas_organizadas))
  );
  tarjeta.append(cabecera,fechaAlta,numeritos);
  return tarjeta;
}
function pintarCifras(cofrades) {
  const activos=cofrades.filter(c=>!esHistorico(c));
  const fundadores=activos.filter(esFundador);
  const asistencias=cofrades.reduce((total,c)=>total+cantidad(c.comidas_asistidas),0);
  document.getElementById('stat-activos').textContent=String(activos.length);
  document.getElementById('stat-fundadores').textContent=String(fundadores.length);
  document.getElementById('stat-asistencias').textContent=String(asistencias);
}
function iniciarFiltros(cofrades) {
  const buscar=document.getElementById('buscar-cofrades');
  const filtro=document.getElementById('filtro-cofrades');
  const orden=document.getElementById('orden-cofrades');
  const limpiar=document.getElementById('limpiar-cofrades');
  const contador=document.getElementById('cofrades-contador');
  const lista=document.getElementById('cofrades-lista');

  function actualizar() {
    const consulta=sinTildes(buscar.value);
    const condicion=filtro.value;
    const seleccionados=cofrades.filter(persona=>{
      if (condicion==='activos' && esHistorico(persona)) return false;
      if (condicion==='bajas' && !esHistorico(persona)) return false;
      if (condicion==='fundadores' && (esHistorico(persona) || !esFundador(persona))) return false;
      if (condicion==='aprendices' && (esHistorico(persona) || !esAprendiz(persona))) return false;
      return !consulta || sinTildes(persona.nombre+' '+texto(persona.categoria)).includes(consulta);
    });
    seleccionados.sort((a,b)=>{
      if (orden.value==='nombre_desc') return -nombreOrden(a,b);
      if (orden.value==='asistencia') return cantidad(b.comidas_asistidas)-cantidad(a.comidas_asistidas) || nombreOrden(a,b);
      if (orden.value==='antiguedad') return texto(a.fecha_ingreso).localeCompare(texto(b.fecha_ingreso)) || nombreOrden(a,b);
      return nombreOrden(a,b);
    });
    contador.textContent='Mostrando '+seleccionados.length+' de '+cofrades.length+' cofrades';
    if(!seleccionados.length){
      mensaje(lista,'No encontramos cofrades con esos filtros. Prueba otro nombre o categoría.');
      return;
    }
    lista.replaceChildren(...seleccionados.map(ficha));
  }
  buscar.addEventListener('input',actualizar);
  filtro.addEventListener('change',actualizar);
  orden.addEventListener('change',actualizar);
  limpiar.addEventListener('click',()=>{
    buscar.value=''; filtro.value='activos'; orden.value='nombre'; actualizar(); buscar.focus();
  });
  actualizar();
}
async function iniciar() {
  const target=document.getElementById('cofrades-lista');
  try {
    const cofrades=await consultarCofrades();
    pintarCifras(cofrades);
    iniciarFiltros(cofrades);
  } catch (error) {
    console.error('No se pudo cargar la ficha pública de cofrades:',error);
    document.getElementById('cofrades-contador').textContent='Sin conexión con Cofrades';
    mensaje(target,'No se pudo cargar el listado. Inténtalo otra vez en unos momentos.',true);
  }
}
iniciar();
