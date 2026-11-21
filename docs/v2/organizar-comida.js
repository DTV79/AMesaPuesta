import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './config.js';

const $=id=>document.getElementById(id);
const token=localStorage.getItem('amp_cofrade_token')||'';
const base=SUPABASE_URL.replace(/\/$/,'');
const campos=['restaurante','direccion','telefono','contacto','reserva','hora',
  'entrantes','principales','postres','bebidas','precio_orientativo'];
const OPCION_NINGUNA='Ninguna fecha me viene bien';
let plan=null;
let encuestasExtra=[];
let encuestaEnEdicion=null;
function recibirPlan(nuevo){
  plan={...nuevo,yo_id:nuevo.yo_id||plan?.yo_id,
    entregado_en:Object.prototype.hasOwnProperty.call(nuevo,'entregado_en')
      ?nuevo.entregado_en:plan?.entregado_en};
}

async function rpc(nombre,parametros){
  const respuesta=await fetch(base+'/rest/v1/rpc/'+nombre,{
    method:'POST',cache:'no-store',
    headers:{'apikey':SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},
    body:JSON.stringify(parametros)
  });
  const datos=await respuesta.json().catch(()=>null);
  if(!respuesta.ok)throw Error(datos?.message||datos?.error||'No se pudo completar la operación');
  return datos;
}
const tiempo=(valor)=>valor?new Intl.DateTimeFormat('es-ES',{
  dateStyle:'long',timeStyle:'short',timeZone:'Europe/Madrid'
}).format(new Date(valor)):'—';
const momento=valor=>valor?new Intl.DateTimeFormat('es-ES',{
  day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',
  hour12:false,timeZone:'Europe/Madrid'
}).format(new Date(valor)).replace(',',''):'—';
const fechaTexto=(iso)=>{
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso||''));
  if(!m)return iso||'—';
  return new Intl.DateTimeFormat('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'})
    .format(new Date(+m[1],+m[2]-1,+m[3]));
};
const accesoCofrades='https://dtv79.github.io/AMesaPuesta/acceso.html';
function prepararAvisoWhatsApp(tipo,encuesta){
  const esFecha=tipo==='fecha';
  const motivo=esFecha
    ?'📅 Tenemos abierta la votación para elegir la fecha de la próxima comida.'
    :'🍽️ Ya está abierta la votación para confirmar quién asistirá a la próxima comida'
      +(plan?.fecha_definitiva?' del '+fechaTexto(plan.fecha_definitiva):'')+'.';
  const mensaje=[
    '🦀 *Cofradía A Mesa Puesta*',
    '',motivo,
    '',
    'Entrad en *Mi Pizarra* y '+(esFecha?'votad':'confirmad vuestra asistencia')
      +' antes del '+tiempo(encuesta.cierra_en)+'.',
    '',
    'Acceso con vuestro usuario:',
    accesoCofrades
  ].join('\n');
  // Los IDs del HTML son "date" y "attendance", no "fecha" y "attendance".
  const enlace=$(esFecha?'org-share-date':'org-share-attendance');
  if(enlace)enlace.href='https://wa.me/?text='+encodeURIComponent(mensaje);
}
const localInput=(fecha)=>{
  const d=new Date(fecha),pad=n=>String(n).padStart(2,'0');
  return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'
    +pad(d.getHours())+':'+pad(d.getMinutes());
};
function nota(id,texto,correcto=false){
  const el=$(id);if(!el)return;el.textContent=texto;
  el.style.color=correcto?'#286c4d':'#9c3530';
}
function ponerOculto(id,oculto){$(id).hidden=oculto;}
function badgeEstado(el,terminado){
  el.classList.toggle('org-step--locked',!terminado);
  el.classList.toggle('org-step--done',terminado);
}
function agregarFecha(iso=''){
  const cont=$('org-dates');
  if(cont.children.length>=12)return;
  const div=document.createElement('div');
  div.className='org-field';
  const id='org-fecha-'+cont.children.length+'-'+Date.now();
  const label=document.createElement('label');label.htmlFor=id;label.textContent='Fecha propuesta';
  const input=document.createElement('input');input.id=id;input.type='date';
  input.className='org-date';input.required=true;input.value=iso;
  const manana=new Date();manana.setDate(manana.getDate()+1);
  input.min=localInput(manana).slice(0,10);
  div.append(label,input);
  cont.append(div);
  $('org-add-date').disabled=cont.children.length>=12;
}
const fechaEncuestaISO=texto=>{
  const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto||'');
  return m?`${m[3]}-${m[2]}-${m[1]}`:texto;
};
const fechaEncuestaTexto=iso=>{
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso||'');
  return m?`${m[3]}/${m[2]}/${m[1]}`:iso;
};
const nombreTipo={secreta:'🔒 Secreta',participacion:'👥 Participación',publica:'📢 Pública'};
function mensajeEncuestaExtra(encuesta){
  const cuerpo=[
    '🦀 *Cofradía A Mesa Puesta*','',
    '📊 Nueva votación pendiente: *'+encuesta.titulo+'*',
    '',
    'Entrad en *Mi Pizarra* para votar antes del '+tiempo(encuesta.cierra_en)+'.',
    '', 'Acceso con vuestro usuario:',accesoCofrades
  ].join('\n');
  return 'https://wa.me/?text='+encodeURIComponent(cuerpo);
}
function pintarEncuestasExtra(){
  const cont=$('org-extra-list');cont.replaceChildren();
  if(!encuestasExtra.length){
    cont.append(textoEl('p','org-muted','Todavía no se han creado votaciones adicionales.'));
    return;
  }
  for(const encuesta of encuestasExtra){
    const card=document.createElement('article');card.className='org-vote-card';
    card.append(textoEl('h3','',encuesta.titulo));
    const cerrada=!!encuesta.cerrada;
    card.append(textoEl('p','org-muted',
      (nombreTipo[encuesta.tipo]||'Votación')+' · '+
      (cerrada?'Cerrada':'Abierta hasta '+tiempo(encuesta.cierra_en))+
      ' · '+encuesta.participantes+' participante(s)'));
    if(encuesta.descripcion)card.append(textoEl('p','',encuesta.descripcion));
    const opciones=document.createElement('ul');opciones.className='org-list';
    for(const o of encuesta.opciones||[]){
      const li=document.createElement('li');li.append(textoEl('span','',o.texto));
      li.append(textoEl('strong','',o.votos===null?'🔒 Hasta el cierre':o.votos+' votos'));
      opciones.append(li);
    }
    card.append(opciones);
    const acciones=document.createElement('div');acciones.className='org-row';
    if(!cerrada){
      const aviso=document.createElement('a');aviso.className='org-btn org-btn--soft org-share';
      aviso.href=mensajeEncuestaExtra(encuesta);aviso.target='_blank';aviso.rel='noopener noreferrer';
      aviso.textContent='📲 Avisar por WhatsApp';acciones.append(aviso);
      const editar=document.createElement('button');editar.type='button';
      editar.className='org-btn org-btn--soft';editar.textContent='✏️ Editar encuesta';
      editar.addEventListener('click',()=>abrirEdicionEncuesta(encuesta.id));acciones.append(editar);
    }
    card.append(acciones);cont.append(card);
  }
}
async function cargarEncuestasExtra(){
  encuestasExtra=await rpc('listar_encuestas_extra_organizacion_cofrade',{p_token:token});
  pintarEncuestasExtra();
}
function añadirOpcion(destino,valor='',modo='texto',bloqueada=false){
  if(destino.children.length>=12)return;
  const fila=document.createElement('div');fila.className='org-choice-row';
  const campo=document.createElement('input');campo.type=modo==='fecha'?'date':'text';
  campo.value=valor;campo.required=true;campo.maxLength=180;
  campo.disabled=bloqueada;
  campo.setAttribute('aria-label','Opción '+(destino.children.length+1));
  fila.append(campo);
  if(!bloqueada){
    const borrar=document.createElement('button');borrar.type='button';
    borrar.className='org-btn org-btn--soft';borrar.textContent='✕';
    borrar.setAttribute('aria-label','Quitar opción');
    borrar.addEventListener('click',()=>{
      if(destino.children.length<=2)return;
      fila.remove();actualizarNumeroOpciones(destino);
    });
    fila.append(borrar);
  }
  destino.append(fila);actualizarNumeroOpciones(destino);
}
function actualizarNumeroOpciones(destino){
  const clase=destino.id.includes('edit')?'edit':'extra';
  const seleccion=$('org-'+clase+'-max'),actual=Number(seleccion.value)||1;
  seleccion.replaceChildren();
  for(let n=1;n<=destino.children.length;n++){
    const opcion=document.createElement('option');opcion.value=String(n);
    opcion.textContent=n===1?'Solo una':'Hasta '+n+' opciones';seleccion.append(opcion);
  }
  seleccion.value=String(clase==='edit'&&encuestaEnEdicion?.clase==='fecha'
    ?destino.children.length:Math.min(actual,destino.children.length));
  $('org-'+clase+'-add-option').disabled=destino.children.length>=12;
}
function opcionesFormulario(id,modo){
  return [...$(id).querySelectorAll('input')].map(input=>{
    const texto=input.value.trim();
    return modo==='fecha'?fechaEncuestaTexto(texto):texto;
  });
}
async function refrescarVotaciones(){
  recibirPlan(await rpc('consultar_organizacion_cofrade',{p_token:token}));
  pintar();await cargarEncuestasExtra();
}
async function abrirEdicionEncuesta(id){
  nota('org-edit-msg','');
  try{
    const encuesta=await rpc('consultar_edicion_encuesta_organizacion_cofrade',{p_token:token,p_id:id});
    if(encuesta.cerrada)throw Error('Esta votación ya está cerrada.');
    encuestaEnEdicion=encuesta;
    $('org-edit-question').value=encuesta.titulo;
    $('org-edit-description').value=encuesta.descripcion||'';
    $('org-edit-type').value=encuesta.tipo;
    $('org-edit-deadline').value=localInput(encuesta.cierra_en);
    const fija=encuesta.clase!=='extra',conVotos=Number(encuesta.participantes)>0;
    $('org-edit-type-field').hidden=fija;
    $('org-edit-type').disabled=fija||conVotos;
    $('org-edit-fixed-type').hidden=!fija;
    $('org-edit-fixed-type').textContent=encuesta.clase==='fecha'
      ?'🔒 Modalidad fija: secreta. Esta encuesta siempre será secreta.'
      :'📢 Modalidad fija: pública. La confirmación de asistencia siempre será visible.';
    $('org-edit-info').hidden=true;
    $('org-edit-info-toggle').setAttribute('aria-expanded','false');
    const cont=$('org-edit-options');cont.replaceChildren();
    const bloqueada=conVotos||encuesta.clase==='asistencia';
    for(const texto of (encuesta.opciones||[]).filter(texto=>
      encuesta.clase!=='fecha'||texto!==OPCION_NINGUNA))
      añadirOpcion(cont,encuesta.clase==='fecha'?fechaEncuestaISO(texto):texto,
        encuesta.clase==='fecha'?'fecha':'texto',bloqueada);
    $('org-edit-none-option').hidden=encuesta.clase!=='fecha';
    $('org-edit-add-option').hidden=bloqueada;
    $('org-edit-max').value=String(encuesta.max_opciones);
    $('org-edit-max').disabled=fija||conVotos;
    $('org-edit-max-field').hidden=fija;
    $('org-edit-explanation').textContent=conVotos
      ?'Ya hay votos: únicamente podéis cambiar el título, la explicación o la fecha de cierre.'
      :fija?'Esta votación principal conserva su modalidad y sus reglas de respuesta.'
        :'Podéis cambiar la modalidad y las respuestas mientras nadie haya votado.';
    $('org-edit-section').hidden=false;
    $('org-edit-section').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(error){nota('org-extra-msg',error.message);}
}
function cargarDatosPrivados(datos){
  campos.forEach(campo=>{$('org-'+campo).value=String(datos?.[campo]||'')});
  $('org-private-updated').textContent=plan?.actualizado_en
    ?'Últimos cambios: '+tiempo(plan.actualizado_en)+(plan.actualizado_por?' · '+plan.actualizado_por:''):'Borrador compartido entre los dos organizadores.';
}
const textoEl=(etiqueta,clase,texto)=>{
  const el=document.createElement(etiqueta);
  if(clase)el.className=clase;
  el.textContent=texto;
  return el;
};
const botonEl=(texto,clase,accion)=>{
  const b=document.createElement('button');b.type='button';
  b.className='org-link-btn'+(clase?' '+clase:'');b.textContent=texto;
  b.addEventListener('click',accion);return b;
};
function actualizarColaboracion(datos){
  // Conservamos el borrador del restaurante y cualquier comentario en edición.
  // Sin cambios, no repintamos las listas ni interrumpimos sus controles.
  const tareas=datos.tareas||[];
  const comentarios=datos.comentarios||[];
  const hayCambios=JSON.stringify(plan.tareas||[])!==JSON.stringify(tareas)
    ||JSON.stringify(plan.comentarios||[])!==JSON.stringify(comentarios);
  plan.tareas=tareas;
  plan.comentarios=comentarios;
  if(datos.yo_id)plan.yo_id=datos.yo_id;
  if(Object.prototype.hasOwnProperty.call(datos,'entregado_en')
    &&datos.entregado_en!==plan.entregado_en){
    plan.entregado_en=datos.entregado_en;
    pintarEntrega();
  }
  if(hayCambios)pintarColaboracion();
}
async function actuar(tipo,accion,valores={}){
  const destino=tipo==='tarea'?'org-tasks-msg':'org-comments-msg';
  nota(destino,'');
  const respuesta=await rpc(tipo==='tarea'?'gestionar_tarea_organizacion_cofrade'
    :'gestionar_comentario_organizacion_cofrade',{
    p_token:token,p_accion:accion,p_id:valores.id||null,
    p_texto:valores.texto??null,
    ...(tipo==='tarea'?{p_responsable:valores.responsable||null}:{})
  });
  actualizarColaboracion(respuesta);
}
function pintarColaboracion(){
  if(!plan)return;
  const tareas=$('org-tasks-list');tareas.replaceChildren();
  const listaTareas=plan.tareas||[];
  if(!listaTareas.length)tareas.append(textoEl('li','org-empty','Todavía no hay tareas. Añadid la primera cuando queráis.'));
  for(const t of listaTareas){
    const hecho=!!t.completada_en;
    const li=document.createElement('li');li.className='org-task'+(hecho?' org-task--done':'');
    const fila=document.createElement('div');fila.className='org-task-main';
    const check=document.createElement('input');check.type='checkbox';check.checked=hecho;
    check.setAttribute('aria-label',(hecho?'Reabrir':'Marcar como hecha')+': '+t.texto);
    check.addEventListener('change',async()=>{
      check.disabled=true;
      try{await actuar('tarea',check.checked?'completar':'reabrir',{id:t.id})}
      catch(e){nota('org-tasks-msg',e.message);check.checked=hecho;check.disabled=false}
    });
    const copia=document.createElement('div');copia.className='org-task-copy';
    copia.append(textoEl('div','org-task-text',t.texto));
    if(t.responsable)copia.append(textoEl('div','org-small','Encargado: '+t.responsable));
    if(hecho)copia.append(textoEl('div','org-small','✓ Hecho por '+t.completador+' · '+momento(t.completada_en)));
    else copia.append(textoEl('div','org-small','Pendiente · añadida por '+t.creador+' · '+momento(t.creada_en)));
    fila.append(check,copia);li.append(fila);
    const acciones=document.createElement('div');acciones.className='org-task-actions';
    acciones.append(botonEl('Eliminar tarea','org-link-btn--danger',async()=>{
      if(!confirm('¿Quitar esta tarea de la lista?'))return;
      try{await actuar('tarea','eliminar',{id:t.id})}
      catch(e){nota('org-tasks-msg',e.message)}
    }));
    li.append(acciones);tareas.append(li);
  }

  const chat=$('org-comments-list');chat.replaceChildren();
  const comentarios=plan.comentarios||[];
  if(!comentarios.length)chat.append(textoEl('li','org-empty','Todavía no hay comentarios. La conversación empieza aquí.'));
  for(const c of comentarios){
    const propio=!!plan.yo_id&&c.autor_id===plan.yo_id;
    const li=document.createElement('li');li.className='org-message'+(propio?' org-message--mine':'');
    li.append(textoEl('div','org-message-meta',momento(c.creado_en)+' · '+c.autor+(c.editado_en?' · editado':'')));
    const cuerpo=textoEl('div','org-message-text',c.texto);li.append(cuerpo);
    if(propio){
      const acciones=document.createElement('div');acciones.className='org-message-actions';
      const editar=botonEl('Editar','',()=>{
        acciones.hidden=true;cuerpo.hidden=true;
        const form=document.createElement('form');form.className='org-message-edit';
        const campo=document.createElement('textarea');campo.value=c.texto;campo.maxLength=2000;
        campo.required=true;campo.rows=3;
        campo.style.cssText='width:100%;box-sizing:border-box;font:16px system-ui,sans-serif;padding:10px;border:1px solid #cbbdb5;border-radius:9px';
        const fila=document.createElement('div');fila.className='org-row';
        const guardar=document.createElement('button');guardar.type='submit';
        guardar.className='org-btn';guardar.textContent='Guardar edición';
        const cancelar=botonEl('Cancelar','',()=>{
          form.remove();cuerpo.hidden=false;acciones.hidden=false;
        });
        fila.append(guardar,cancelar);form.append(campo,fila);
        form.addEventListener('submit',async event=>{
          event.preventDefault();guardar.disabled=true;
          try{await actuar('comentario','editar',{id:c.id,texto:campo.value.trim()})}
          catch(e){nota('org-comments-msg',e.message);guardar.disabled=false}
        });
        li.append(form);campo.focus();
      });
      const borrar=botonEl('Borrar','org-link-btn--danger',async()=>{
        if(!confirm('¿Borrar tu comentario?'))return;
        try{await actuar('comentario','eliminar',{id:c.id})}
        catch(e){nota('org-comments-msg',e.message)}
      });
      acciones.append(editar,borrar);li.append(acciones);
    }
    chat.append(li);
  }
}
function verGrupo(titulo,personas){
  const div=document.createElement('div');
  const h=document.createElement('h3');h.textContent=titulo+' · '+personas.length;
  const ul=document.createElement('ul');
  for(const persona of personas){
    const li=document.createElement('li');li.textContent=persona.nombre;ul.append(li);
  }
  if(!personas.length){const li=document.createElement('li');li.textContent='Ninguno';ul.append(li)}
  div.append(h,ul);return div;
}
function pintarEntrega(){
  const boton=$('org-deliver'),estado=$('org-delivery-status');
  const entregado=!!plan?.entregado_en;
  const asistenciaCerrada=!!plan?.asistencia_encuesta?.cerrada;
  const restauranteGuardado=!!String(plan?.datos?.restaurante||'').trim();
  boton.hidden=entregado;
  boton.disabled=entregado||!asistenciaCerrada||!restauranteGuardado;
  estado.textContent=entregado
    ?'✓ Ficha entregada el '+momento(plan.entregado_en)+'. Administración ya puede consultar restaurante y menú.'
    :!asistenciaCerrada
      ?'Disponible cuando termine la encuesta de asistencia.'
      :!restauranteGuardado
        ?'Guardad primero el nombre del restaurante.'
        :'Listo para entregar cuando lo decidáis. Las tareas y notas seguirán siendo privadas.';
  estado.style.color=entregado?'#286c4d':'#666';
}
function pintar(){
  if(!plan)return;
  const fecha=plan.fecha_encuesta,asistencia=plan.asistencia_encuesta,definitiva=plan.fecha_definitiva;
  $('org-team').textContent='Organizan: '+(plan.organizadores||[]).map(x=>x.nombre).join(' y ');
  ponerOculto('org-create-date',!!fecha);
  ponerOculto('org-date-results',!fecha);
  ponerOculto('org-fixed-date',!definitiva);
  if(definitiva){
    $('org-fixed-date').textContent='✅ Fecha confirmada: '+fechaTexto(definitiva)+'.';
  }
  if(fecha){
    const cerrado=!!fecha.cerrada;
    ponerOculto('org-share-date-row',cerrado);
    ponerOculto('org-edit-date-row',cerrado);
    if(!cerrado)prepararAvisoWhatsApp('fecha',fecha);
    $('org-date-status').textContent=cerrado
      ?'Encuesta cerrada · '+fecha.participantes+' cofrades votaron.'
      :'Encuesta abierta hasta '+tiempo(fecha.cierra_en)+'. Han votado '+fecha.participantes+' cofrades.';
    const lista=$('org-date-options');lista.replaceChildren();
    const opciones=fecha.opciones||[];
    const opcionesFechas=opciones.filter(o=>o.fecha!==OPCION_NINGUNA);
    const max=Math.max(0,...opcionesFechas.map(o=>Number(o.votos)||0));
    for(const opcion of opciones){
      const li=document.createElement('li');
      const nombre=document.createElement('span');nombre.textContent=opcion.fecha;
      const votos=document.createElement('strong');
      votos.textContent=opcion.votos===null?'🔒 Secreto hasta el cierre':opcion.votos+' votos';
      li.append(nombre,votos);lista.append(li);
    }
    const puedeConfirmar=cerrado&&!definitiva&&max>0;
    ponerOculto('org-form-confirm-date',!puedeConfirmar);
    const seleccion=$('org-final-date');seleccion.replaceChildren();
    if(puedeConfirmar){
      opcionesFechas.filter(o=>Number(o.votos)===max).forEach(opcion=>{
        const partes=String(opcion.fecha).split('/');
        const opt=document.createElement('option');
        opt.value=partes.length===3?partes[2]+'-'+partes[1]+'-'+partes[0]:'';
        opt.textContent=opcion.fecha+' · '+opcion.votos+' votos';
        seleccion.append(opt);
      });
    }
    if(cerrado&&!definitiva&&max===0)nota('org-msg-confirm',
      'Ninguna fecha recibió votos favorables. Consultad con Administración para decidir cómo continuar.');
  }
  else{ponerOculto('org-share-date-row',true);ponerOculto('org-edit-date-row',true)}
  badgeEstado($('org-step1'),!!definitiva);
  badgeEstado($('org-step2'),!!definitiva);
  ponerOculto('org-attendance-locked',!!definitiva);
  ponerOculto('org-form-attendance',!definitiva||!!asistencia);
  ponerOculto('org-attendance-results',!asistencia);
  if(asistencia){
    ponerOculto('org-share-attendance-row',!!asistencia.cerrada);
    ponerOculto('org-edit-attendance-row',!!asistencia.cerrada);
    if(!asistencia.cerrada)prepararAvisoWhatsApp('attendance',asistencia);
    const grupos=$('org-attendance-groups');grupos.replaceChildren();
    const si=asistencia.si||[],no=asistencia.no||[],sin=asistencia.sin_respuesta||[];
    grupos.append(verGrupo('✅ Asistirán',si),verGrupo('❌ No asistirán',no),verGrupo('⏳ Sin responder',sin));
    $('org-attendance-status').textContent=asistencia.cerrada
      ?'Plazo cerrado. Asistentes confirmados: '+si.length+'.'
      :'Encuesta pública abierta hasta '+tiempo(asistencia.cierra_en)+'. Puedes consultar quién ha respondido.';
    ponerOculto('org-attendance-summary',!asistencia.cerrada);
    if(asistencia.cerrada)$('org-attendance-summary').textContent=
      '✅ Asistencia cerrada: '+si.length+' confirmados, '+no.length+
      ' no asistirán y '+sin.length+' sin responder. Ya podéis completar los datos del restaurante y entregar la ficha a Administración.';
  }
  else{
    ponerOculto('org-share-attendance-row',true);
    ponerOculto('org-edit-attendance-row',true);
    ponerOculto('org-attendance-summary',true);
  }
  cargarDatosPrivados(plan.datos);
  const responsable=$('org-task-owner');responsable.replaceChildren();
  const libre=document.createElement('option');libre.value='';libre.textContent='Cualquiera de los dos';
  responsable.append(libre);
  (plan.organizadores||[]).forEach(persona=>{
    const option=document.createElement('option');option.value=persona.id;option.textContent=persona.nombre;
    responsable.append(option);
  });
  pintarColaboracion();
  pintarEntrega();
}

function alternarFormulario(id,visible){ponerOculto(id,!visible)}
function enfocarFormularioVisible(idFormulario,idCampo){
  const formulario=$(idFormulario),campo=$(idCampo);
  // En iPhone, abrir el teclado reduce la zona visible DESPUÉS del focus.
  // Situamos el formulario ahora y lo reajustamos cuando termina de abrirse.
  if(window.matchMedia('(max-width:650px)').matches)
    formulario.scrollIntoView({block:'center',behavior:'instant'});
  campo.focus({preventScroll:true});
  if(!window.matchMedia('(max-width:650px)').matches)return;
  const ajustar=()=>{
    if(formulario.hidden||document.activeElement!==campo)return;
    const vista=window.visualViewport;
    const cabecera=document.querySelector('.site-header')?.getBoundingClientRect().height||0;
    const superior=Math.max((vista?.offsetTop||0)+12,cabecera+12);
    const inferior=(vista?.offsetTop||0)+(vista?.height||window.innerHeight)-16;
    const disponible=Math.max(100,inferior-superior);
    const rect=formulario.getBoundingClientRect();
    const destino=superior+Math.max(0,(disponible-Math.min(rect.height,disponible))/2);
    const desplazamiento=rect.top-destino;
    if(Math.abs(desplazamiento)>6)
      window.scrollBy({top:Math.round(desplazamiento),behavior:'instant'});
  };
  requestAnimationFrame(ajustar);
  setTimeout(ajustar,250);
  setTimeout(ajustar,500);
}
$('org-toggle-task').addEventListener('click',()=>{
  const abrir=$('org-task-form').hidden;
  alternarFormulario('org-task-form',abrir);
  if(abrir)enfocarFormularioVisible('org-task-form','org-task-text');
});
$('org-cancel-task').addEventListener('click',()=>alternarFormulario('org-task-form',false));
$('org-task-form').addEventListener('submit',async event=>{
  event.preventDefault();const boton=event.submitter;boton.disabled=true;
  try{
    await actuar('tarea','crear',{texto:$('org-task-text').value.trim(),responsable:$('org-task-owner').value});
    $('org-task-form').reset();alternarFormulario('org-task-form',false);
  }catch(error){nota('org-tasks-msg',error.message)}
  finally{boton.disabled=false}
});
$('org-toggle-comment').addEventListener('click',()=>{
  const abrir=$('org-comment-form').hidden;
  alternarFormulario('org-comment-form',abrir);
  if(abrir)enfocarFormularioVisible('org-comment-form','org-comment-text');
});
$('org-cancel-comment').addEventListener('click',()=>alternarFormulario('org-comment-form',false));
$('org-comment-form').addEventListener('submit',async event=>{
  event.preventDefault();const boton=event.submitter;boton.disabled=true;
  try{
    await actuar('comentario','crear',{texto:$('org-comment-text').value.trim()});
    $('org-comment-form').reset();alternarFormulario('org-comment-form',false);
  }catch(error){nota('org-comments-msg',error.message)}
  finally{boton.disabled=false}
});
let sincronizandoColaboracion=false;
async function actualizarMensajes(){
  if(sincronizandoColaboracion||document.visibilityState!=='visible'
    ||document.querySelector('.org-message-edit'))return;
  sincronizandoColaboracion=true;
  try{
    const respuesta=await rpc('consultar_organizacion_cofrade',{p_token:token});
    actualizarColaboracion(respuesta);
  }finally{
    sincronizandoColaboracion=false;
  }
}

$('org-add-date').addEventListener('click',()=>agregarFecha());
$('org-form-date').addEventListener('submit',async event=>{
  event.preventDefault();
  const boton=event.submitter;boton.disabled=true;
  nota('org-msg-date','');
  try{
    const fechas=[...document.querySelectorAll('.org-date')].map(x=>x.value).filter(Boolean);
    if(fechas.length<2||new Set(fechas).size!==fechas.length)
      throw Error('Pon al menos dos fechas distintas.');
    const cierre=$('org-deadline-date').value;
    if(!cierre)throw Error('Indica el cierre de la votación.');
    if(!confirm('¿Publicamos la encuesta de fecha para todos los cofrades? Será secreta.'))return;
    recibirPlan(await rpc('crear_encuesta_fecha_organizadores',{
      p_token:token,p_fechas:fechas,p_cierre:new Date(cierre).toISOString()
    }));
    pintar();
  }catch(error){nota('org-msg-date',error.message)}
  finally{boton.disabled=false;}
});
$('org-form-confirm-date').addEventListener('submit',async event=>{
  event.preventDefault();const boton=event.submitter;boton.disabled=true;
  try{
    const fecha=$('org-final-date').value;
    if(!fecha)throw Error('Elige la fecha definitiva.');
    if(!confirm('¿Confirmamos el '+fechaTexto(fecha)+'? Se desbloqueará la encuesta de asistencia.'))return;
    recibirPlan(await rpc('confirmar_fecha_organizadores',{p_token:token,p_fecha:fecha}));
    pintar();
  }catch(error){nota('org-msg-confirm',error.message)}
  finally{boton.disabled=false;}
});
$('org-form-attendance').addEventListener('submit',async event=>{
  event.preventDefault();const boton=event.submitter;boton.disabled=true;
  try{
    const cierre=$('org-deadline-attendance').value;
    if(!cierre)throw Error('Indica hasta cuándo se puede confirmar.');
    if(!confirm('¿Publicamos la encuesta pública para confirmar asistencia?'))return;
    recibirPlan(await rpc('crear_encuesta_asistencia_organizadores',{
      p_token:token,p_cierre:new Date(cierre).toISOString()
    }));
    pintar();
  }catch(error){nota('org-msg-attendance',error.message)}
  finally{boton.disabled=false;}
});
$('org-edit-date').addEventListener('click',()=>{
  if(plan?.fecha_encuesta?.id)abrirEdicionEncuesta(plan.fecha_encuesta.id);
});
$('org-edit-attendance').addEventListener('click',()=>{
  if(plan?.asistencia_encuesta?.id)abrirEdicionEncuesta(plan.asistencia_encuesta.id);
});
for(const clase of ['extra','edit']){
  $('org-'+clase+'-info-toggle').addEventListener('click',()=>{
    const info=$('org-'+clase+'-info'),abrir=info.hidden;
    info.hidden=!abrir;
    $('org-'+clase+'-info-toggle').setAttribute('aria-expanded',String(abrir));
  });
}
$('org-extra-toggle').addEventListener('click',()=>{
  const abrir=$('org-extra-form').hidden;
  $('org-extra-form').hidden=!abrir;
  if(abrir)$('org-extra-title-input').focus();
});
$('org-extra-cancel').addEventListener('click',()=>{$('org-extra-form').hidden=true});
$('org-extra-add-option').addEventListener('click',()=>añadirOpcion($('org-extra-options')));
$('org-edit-add-option').addEventListener('click',()=>añadirOpcion($('org-edit-options'),'',
  encuestaEnEdicion?.clase==='fecha'?'fecha':'texto'));
$('org-edit-cancel').addEventListener('click',()=>{
  $('org-edit-section').hidden=true;encuestaEnEdicion=null;
});
$('org-extra-form').addEventListener('submit',async event=>{
  event.preventDefault();const boton=event.submitter;boton.disabled=true;
  nota('org-extra-msg','');
  try{
    const opciones=opcionesFormulario('org-extra-options','texto');
    if(opciones.length<2||new Set(opciones.map(x=>x.toLocaleLowerCase('es-ES'))).size!==opciones.length
      ||opciones.some(x=>!x))throw Error('Introduce al menos dos opciones distintas.');
    const plazo=$('org-extra-deadline').value;
    if(!plazo)throw Error('Indica la fecha y la hora de cierre.');
    if(!confirm('¿Publicamos esta votación '+$('org-extra-type').selectedOptions[0].text.toLowerCase()+' para los cofrades?'))return;
    encuestasExtra=await rpc('crear_encuesta_extra_organizacion_cofrade',{
      p_token:token,p_titulo:$('org-extra-title-input').value.trim(),
      p_descripcion:$('org-extra-description').value.trim(),
      p_tipo:$('org-extra-type').value,p_opciones:opciones,
      p_max_opciones:Number($('org-extra-max').value),
      p_cierre:new Date(plazo).toISOString()
    });
    pintarEncuestasExtra();
    $('org-extra-form').reset();$('org-extra-options').replaceChildren();
    añadirOpcion($('org-extra-options'));añadirOpcion($('org-extra-options'));
    $('org-extra-form').hidden=true;
  }catch(error){nota('org-extra-msg',error.message);}
  finally{boton.disabled=false;}
});
$('org-edit-form').addEventListener('submit',async event=>{
  event.preventDefault();const boton=event.submitter;boton.disabled=true;
  nota('org-edit-msg','');
  try{
    if(!encuestaEnEdicion)throw Error('Elige primero la encuesta.');
    const opciones=opcionesFormulario('org-edit-options',
      encuestaEnEdicion.clase==='fecha'?'fecha':'texto');
    if(encuestaEnEdicion.clase==='fecha')opciones.push(OPCION_NINGUNA);
    const plazo=$('org-edit-deadline').value;
    if(!plazo)throw Error('Indica el cierre de la encuesta.');
    await rpc('editar_encuesta_organizacion_cofrade',{
      p_token:token,p_id:encuestaEnEdicion.id,
      p_titulo:$('org-edit-question').value.trim(),
      p_descripcion:$('org-edit-description').value.trim(),
      p_tipo:$('org-edit-type').value,p_opciones:opciones,
      p_max_opciones:Number($('org-edit-max').value),
      p_cierre:new Date(plazo).toISOString()
    });
    $('org-edit-section').hidden=true;encuestaEnEdicion=null;
    await refrescarVotaciones();
    nota('org-extra-msg','✓ Encuesta actualizada correctamente.',true);
  }catch(error){nota('org-edit-msg',error.message);}
  finally{boton.disabled=false;}
});
$('org-form-private').addEventListener('submit',async event=>{
  event.preventDefault();const boton=event.submitter;boton.disabled=true;
  nota('org-private-msg','');
  try{
    const datos=Object.fromEntries(campos.map(campo=>[campo,$('org-'+campo).value.trim()]));
    recibirPlan(await rpc('guardar_preparativos_cofrade',{
      p_token:token,p_datos:datos,p_revision:plan.revision
    }));
    pintar();
    nota('org-private-msg','✓ Guardado para los dos organizadores.',true);
  }catch(error){nota('org-private-msg',error.message+' Si otra persona guardó, recarga para ver sus cambios.')}
  finally{boton.disabled=false;}
});

$('org-deliver').addEventListener('click',async()=>{
  if(!plan||plan.entregado_en)return;
  if(!confirm('¿Entregar la ficha a Administración? Podrán ver el restaurante, dirección y menú para crear la comida oficial. Las tareas y comentarios entre organizadores seguirán siendo privados.'))return;
  const boton=$('org-deliver');boton.disabled=true;
  try{
    recibirPlan(await rpc('entregar_preparativos_cofrade',{p_token:token}));
    pintarEntrega();
  }catch(error){
    nota('org-delivery-status',error.message);
  }finally{
    if(!plan?.entregado_en)boton.disabled=false;
  }
});


const pestañasOrganizacion=['votaciones','anotaciones','restaurante'];
function mostrarPestanaOrganizacion(nombre,{enfocar=false,desplazar=false}={}){
  if(!pestañasOrganizacion.includes(nombre))return;
  for(const clave of pestañasOrganizacion){
    const tab=$('org-tab-'+clave),panel=$('org-panel-'+clave);
    const activa=clave===nombre;
    tab.setAttribute('aria-selected',String(activa));
    tab.tabIndex=activa?0:-1;
    panel.hidden=!activa;
  }
  if(enfocar)$('org-tab-'+nombre).focus({preventScroll:true});
  if(desplazar)requestAnimationFrame(()=>
    document.querySelector('.org-tabs').scrollIntoView({behavior:'smooth',block:'start'}));
}
for(const [indice,nombre] of pestañasOrganizacion.entries()){
  $('org-tab-'+nombre).addEventListener('click',()=>
    mostrarPestanaOrganizacion(nombre,{desplazar:true}));
  $('org-tab-'+nombre).addEventListener('keydown',event=>{
    let siguiente;
    if(event.key==='ArrowRight')siguiente=(indice+1)%pestañasOrganizacion.length;
    else if(event.key==='ArrowLeft')siguiente=(indice+pestañasOrganizacion.length-1)%pestañasOrganizacion.length;
    else if(event.key==='Home')siguiente=0;
    else if(event.key==='End')siguiente=pestañasOrganizacion.length-1;
    else return;
    event.preventDefault();
    mostrarPestanaOrganizacion(pestañasOrganizacion[siguiente],{enfocar:true,desplazar:true});
  });
}
// La cabecera es fija al desplazarse; las pestañas quedan justo debajo,
// incluso si cambia su altura entre móvil y ordenador.
const cabeceraOrganizacion=document.querySelector('.site-header');
function ajustarCabeceraOrganizacion(){
  if(cabeceraOrganizacion)document.documentElement.style.setProperty(
    '--org-header-height',Math.ceil(cabeceraOrganizacion.getBoundingClientRect().height)+'px');
}
ajustarCabeceraOrganizacion();
if(cabeceraOrganizacion&&'ResizeObserver' in window)
  new ResizeObserver(ajustarCabeceraOrganizacion).observe(cabeceraOrganizacion);
window.addEventListener('resize',ajustarCabeceraOrganizacion,{passive:true});
mostrarPestanaOrganizacion('votaciones');

(async()=>{
  try{
    if(!token)throw Error('Inicia sesión para acceder.');
    plan=await rpc('consultar_organizacion_cofrade',{p_token:token});
    $('org-deadline-date').value=localInput(Date.now()+3*86400000);
    $('org-deadline-attendance').value=localInput(Date.now()+3*86400000);
    $('org-extra-deadline').value=localInput(Date.now()+3*86400000);
    añadirOpcion($('org-extra-options'));añadirOpcion($('org-extra-options'));
    agregarFecha();agregarFecha();
    pintar();await cargarEncuestasExtra();
    ponerOculto('org-loading',true);ponerOculto('org-content',false);
    const sincronizar=()=>actualizarMensajes().catch(()=>{});
    setInterval(sincronizar,15000);
    document.addEventListener('visibilitychange',()=>{
      if(document.visibilityState==='visible')sincronizar();
    });
    window.addEventListener('focus',sincronizar);
  }catch(error){
    $('org-loading').textContent='⛔ '+error.message;
  }
})();
