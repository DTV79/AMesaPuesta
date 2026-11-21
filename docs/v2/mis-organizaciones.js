import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './config.js';

const $=id=>document.getElementById(id);
const token=localStorage.getItem('amp_cofrade_token')||'';
const base=SUPABASE_URL.replace(/\/$/,'');
const detalleId=new URLSearchParams(location.search).get('id');
const el=(tag,clase,contenido)=>{
  const nodo=document.createElement(tag);
  if(clase)nodo.className=clase;
  if(contenido!==undefined)nodo.textContent=contenido;
  return nodo;
};
const fecha=value=>{
  const match=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(value||''));
  return match?`${match[3]}/${match[2]}/${match[1]}`:'Fecha por confirmar';
};
const instante=value=>{
  if(!value)return '—';
  const d=new Date(value);
  return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat('es-ES',{
    timeZone:'Europe/Madrid',day:'2-digit',month:'2-digit',year:'numeric',
    hour:'2-digit',minute:'2-digit',hour12:false
  }).format(d).replace(',','');
};
const nombreOrganizadores=lista=>(Array.isArray(lista)?lista:[])
  .map(x=>String(x?.nombre||'').trim()).filter(Boolean).join(' y ');
const euros=valor=>valor===null||valor===undefined||valor===''?'—':
  Number(valor).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';

async function rpc(nombre,parametros){
  const respuesta=await fetch(base+'/rest/v1/rpc/'+nombre,{
    method:'POST',cache:'no-store',
    headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},
    body:JSON.stringify(parametros)
  });
  const datos=await respuesta.json().catch(()=>null);
  if(!respuesta.ok)throw Error(datos?.message||'No se pudo consultar este histórico.');
  return datos;
}

function notaVacia(destino,texto){destino.append(el('p','hist-meta',texto));}
function linea(destino,titulo,detalle){
  const fila=el('li','hist-item');
  fila.append(el('strong','',titulo));
  if(detalle)fila.append(el('div','hist-subtle',detalle));
  destino.append(fila);
}
function grupoVotos(destino,titulo,personas){
  destino.append(el('h4','',titulo));
  const nombres=(Array.isArray(personas)?personas:[]).map(p=>p.nombre).filter(Boolean);
  destino.append(el('p','hist-meta',nombres.length?nombres.join(', '):'Ninguno'));
}
function pintarVotaciones(datos){
  const destino=$('hist-panel-votaciones');destino.replaceChildren();
  destino.append(el('h3','','📊 Votaciones'));
  destino.append(el('p','','Fecha definitiva: '+fecha(datos.fecha_definitiva)));
  const encuestaFecha=datos.fecha_encuesta;
  if(encuestaFecha){
    destino.append(el('h4','','Elegir la fecha'));
    const lista=el('ul','hist-list');
    for(const o of encuestaFecha.opciones||[]){
      linea(lista,String(o.fecha||'Fecha propuesta'),
        o.votos===null?'Resultado no disponible':String(o.votos??0)+' votos');
    }
    destino.append(lista);
  }else notaVacia(destino,'No se utilizó la votación de fecha del módulo.');

  const asistencia=datos.asistencia_encuesta;
  if(asistencia){
    destino.append(el('h4','','Confirmación de asistencia'));
    grupoVotos(destino,'✅ Asistirán',asistencia.si);
    grupoVotos(destino,'❌ No asistirán',asistencia.no);
    grupoVotos(destino,'⏳ Sin respuesta',asistencia.sin_respuesta);
  }else notaVacia(destino,'No se utilizó la votación de asistencia del módulo.');
}

function pintarAnotaciones(datos){
  const destino=$('hist-panel-anotaciones');destino.replaceChildren();
  destino.append(el('h3','','✅ Tareas realizadas y pendientes'));
  const tareas=Array.isArray(datos.tareas)?datos.tareas:[];
  const listaTareas=el('ul','hist-list');
  if(!tareas.length)notaVacia(listaTareas,'No se dejaron tareas registradas.');
  for(const tarea of tareas){
    const hecho=!!tarea.completada_en;
    const item=el('li','hist-item'+(hecho?' hist-item--done':''));
    item.append(el('div','hist-task-title',(hecho?'✅ ':'☐ ')+String(tarea.texto||'')));
    const detalle=[
      tarea.responsable?'Encargado: '+tarea.responsable:'',
      'Creada por '+String(tarea.creador||'Organizador')+' · '+instante(tarea.creada_en),
      hecho?'Hecha por '+String(tarea.completador||'Organizador')+' · '+instante(tarea.completada_en):'Quedó pendiente al cerrar'
    ].filter(Boolean);
    item.append(el('div','hist-subtle',detalle.join('\n')));
    listaTareas.append(item);
  }
  destino.append(listaTareas);

  destino.append(el('h3','','💬 Notas entre organizadores'));
  const comentarios=Array.isArray(datos.comentarios)?datos.comentarios:[];
  const listaComentarios=el('ul','hist-list');
  if(!comentarios.length)notaVacia(listaComentarios,'No se dejaron comentarios.');
  for(const comentario of comentarios){
    const item=el('li','hist-item hist-item--mine');
    item.append(el('div','hist-subtle',
      instante(comentario.creado_en)+' · '+String(comentario.autor||'Organizador')+
      (comentario.editado_en?' (editado)':'')));
    item.append(el('div','hist-message',String(comentario.texto||'')));
    listaComentarios.append(item);
  }
  destino.append(listaComentarios);
}

function pintarRestaurante(datos){
  const destino=$('hist-panel-restaurante');destino.replaceChildren();
  destino.append(el('h3','','🍽️ Restaurante y menú'));
  const d=datos.datos||{};
  const oficial=datos.comida_oficial||null;
  destino.append(el('p','hist-meta',oficial
    ?'Ficha definitiva de Administración. Los cambios posteriores se muestran automáticamente.'
    :'Datos que quedaron guardados al cerrar la organización.'));
  const campos=[
    ['Restaurante',oficial?oficial.restaurante:d.restaurante],
    ['Fecha y hora comida',[fecha(oficial?.fecha||datos.fecha_definitiva),d.hora].filter(Boolean).join(' · ')],
    ['Reserva',d.reserva],
    ['Dirección',oficial?oficial.direccion:d.direccion],
    ['Teléfono',oficial?oficial.telefono:d.telefono],
    ['Persona de contacto',oficial?oficial.contacto:d.contacto],
    ...(oficial?[['Web',oficial.web],
      ['Importe total del restaurante',euros(oficial.importe_total)]]:[]),
    ['Precio orientativo de la organización',d.precio_orientativo],
    ['Entrantes',oficial?oficial.entrantes:d.entrantes],
    ['Platos principales',oficial?oficial.principales:d.principales],
    ['Postres',oficial?oficial.postres:d.postres],
    ['Bebidas',oficial?oficial.bebidas:d.bebidas]
  ];
  const rejilla=el('div','hist-fields');
  for(const [titulo,valor] of campos){
    const fila=el('div','hist-field'+(['Entrantes','Platos principales','Postres','Bebidas'].includes(titulo)?' hist-field--wide':''));
    fila.append(el('b','',titulo),el('span','',String(valor||'—')));
    rejilla.append(fila);
  }
  destino.append(rejilla);
}

function activarPestana(nombre){
  for(const clave of ['votaciones','anotaciones','restaurante']){
    const seleccionada=clave===nombre;
    $('hist-tab-'+clave).setAttribute('aria-selected',String(seleccionada));
    $('hist-panel-'+clave).hidden=!seleccionada;
  }
}
for(const nombre of ['votaciones','anotaciones','restaurante']){
  $('hist-tab-'+nombre).addEventListener('click',()=>activarPestana(nombre));
}

function pintarLista(lista){
  const destino=$('hist-cards');destino.replaceChildren();
  if(!lista.length){
    notaVacia(destino,'Todavía no tienes organizaciones archivadas. Se guardarán al asignar a los siguientes organizadores, aunque no haya tareas ni comentarios.');
    return;
  }
  for(const item of lista){
    const enlace=el('a','hist-card');
    enlace.href='mis-organizaciones.html?id='+encodeURIComponent(item.id);
    const arriba=el('div','hist-card-top');
    arriba.append(el('h2','',fecha(item.fecha)+' · '+String(item.restaurante||'Restaurante por confirmar')));
    arriba.append(el('span','hist-badge'+(item.es_demo?' hist-badge--demo':''),
      item.es_demo?'🧪 Ejemplo':'Finalizada'));
    enlace.append(arriba);
    enlace.append(el('p','hist-meta','Organizada por '+nombreOrganizadores(item.organizadores)));
    enlace.append(el('p','hist-meta','Archivada el '+instante(item.cerrado_en)));
    enlace.append(el('div','hist-card-accion','Consultar organización →'));
    destino.append(enlace);
  }
}

function pintarDetalle(datos){
  $('hist-detail-title').textContent=fecha(datos.comida_oficial?.fecha||datos.fecha_definitiva)+' · '+
    String(datos.comida_oficial?.restaurante||datos.datos?.restaurante||'Restaurante por confirmar');
  $('hist-detail-meta').textContent='Organizada por '+nombreOrganizadores(datos.organizadores)+
    ' · Archivada el '+instante(datos.cerrado_en);
  $('hist-demo-warning').hidden=!datos.es_demo;
  pintarVotaciones(datos);
  pintarAnotaciones(datos);
  pintarRestaurante(datos);
  activarPestana('votaciones');
}

(async()=>{
  if(!token)return; // acceso-cofrade.js redirige a la identificación.
  try{
    const lista=await rpc('listar_mis_organizaciones_cofrade',{p_token:token});
    if(!Array.isArray(lista))throw Error('Respuesta de históricos no válida.');
    if(detalleId){
      if(!lista.some(item=>item.id===detalleId))
        throw Error('Este histórico no corresponde a tus organizaciones.');
      const datos=await rpc('consultar_mi_organizacion_historica_cofrade',{
        p_token:token,p_preparacion_id:detalleId
      });
      pintarDetalle(datos);
      $('hist-detail').hidden=false;
    }else{
      pintarLista(lista);
      $('hist-list').hidden=false;
    }
    $('hist-status').hidden=true;
  }catch(error){
    $('hist-status').textContent='⛔ '+error.message;
  }
})();
