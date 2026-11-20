import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './config.js';

const $=id=>document.getElementById(id);
const token=localStorage.getItem('amp_cofrade_token')||'';
const base=SUPABASE_URL.replace(/\/$/,'');
const campos=['restaurante','direccion','telefono','contacto','reserva','hora',
  'entrantes','principales','postres','bebidas','precio_orientativo'];
let plan=null;
function recibirPlan(nuevo){plan={...nuevo,yo_id:nuevo.yo_id||plan?.yo_id}}

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
  // No tocamos ni la revisión ni los campos del restaurante que alguien pueda
  // tener a medio escribir; los mensajes y tareas se guardan por separado.
  plan.tareas=datos.tareas||[];
  plan.comentarios=datos.comentarios||[];
  if(datos.yo_id)plan.yo_id=datos.yo_id;
  pintarColaboracion();
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
    $('org-date-status').textContent=cerrado
      ?'Encuesta cerrada · '+fecha.participantes+' cofrades votaron.'
      :'Encuesta abierta hasta '+tiempo(fecha.cierra_en)+'. Han votado '+fecha.participantes+' cofrades.';
    const lista=$('org-date-options');lista.replaceChildren();
    const opciones=fecha.opciones||[];
    const max=Math.max(0,...opciones.map(o=>Number(o.votos)||0));
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
      opciones.filter(o=>Number(o.votos)===max).forEach(opcion=>{
        const partes=String(opcion.fecha).split('/');
        const opt=document.createElement('option');
        opt.value=partes.length===3?partes[2]+'-'+partes[1]+'-'+partes[0]:'';
        opt.textContent=opcion.fecha+' · '+opcion.votos+' votos';
        seleccion.append(opt);
      });
    }
    if(cerrado&&!definitiva&&max===0)nota('org-msg-confirm','No hubo votos. Administración puede resolverlo.');
  }
  badgeEstado($('org-step1'),!!definitiva);
  badgeEstado($('org-step2'),!!definitiva);
  ponerOculto('org-attendance-locked',!!definitiva);
  ponerOculto('org-form-attendance',!definitiva||!!asistencia);
  ponerOculto('org-attendance-results',!asistencia);
  if(asistencia){
    const grupos=$('org-attendance-groups');grupos.replaceChildren();
    const si=asistencia.si||[],no=asistencia.no||[],sin=asistencia.sin_respuesta||[];
    grupos.append(verGrupo('✅ Asistirán',si),verGrupo('❌ No asistirán',no),verGrupo('⏳ Sin responder',sin));
    $('org-attendance-status').textContent=asistencia.cerrada
      ?'Plazo cerrado. Asistentes confirmados: '+si.length+'.'
      :'Encuesta pública abierta hasta '+tiempo(asistencia.cierra_en)+'. Puedes consultar quién ha respondido.';
  }
  const terminada=!!asistencia?.cerrada;
  badgeEstado($('org-step3'),terminada);
  $('org-step3-note').textContent=terminada
    ?'✅ Asistencia cerrada. Ya podéis completar los últimos detalles. Administración podrá trasladar los asistentes y vuestra ficha al registro de comidas cuando corresponda.'
    :'🔒 Este paso estará disponible al cerrar la encuesta de asistencia.';
  $('org-step3-note').classList.toggle('org-success',terminada);
  cargarDatosPrivados(plan.datos);
  const responsable=$('org-task-owner');responsable.replaceChildren();
  const libre=document.createElement('option');libre.value='';libre.textContent='Cualquiera de los dos';
  responsable.append(libre);
  (plan.organizadores||[]).forEach(persona=>{
    const option=document.createElement('option');option.value=persona.id;option.textContent=persona.nombre;
    responsable.append(option);
  });
  pintarColaboracion();
}

function alternarFormulario(id,visible){ponerOculto(id,!visible)}
$('org-toggle-task').addEventListener('click',()=>{
  const abrir=$('org-task-form').hidden;
  alternarFormulario('org-task-form',abrir);
  if(abrir)$('org-task-text').focus();
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
  if(abrir)$('org-comment-text').focus();
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
async function actualizarMensajes(){
  const respuesta=await rpc('consultar_organizacion_cofrade',{p_token:token});
  actualizarColaboracion(respuesta);
}
$('org-refresh-notes').addEventListener('click',async()=>{
  const boton=$('org-refresh-notes');boton.disabled=true;
  try{await actualizarMensajes();nota('org-comments-msg','Lista actualizada.',true)}
  catch(error){nota('org-comments-msg',error.message)}
  finally{boton.disabled=false}
});

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

(async()=>{
  try{
    if(!token)throw Error('Inicia sesión para acceder.');
    plan=await rpc('consultar_organizacion_cofrade',{p_token:token});
    $('org-deadline-date').value=localInput(Date.now()+3*86400000);
    $('org-deadline-attendance').value=localInput(Date.now()+3*86400000);
    agregarFecha();agregarFecha();
    pintar();ponerOculto('org-loading',true);ponerOculto('org-content',false);
    setInterval(()=>{
      if(document.visibilityState!=='visible'||document.querySelector('.org-message-edit'))return;
      actualizarMensajes().catch(()=>{});
    },30000);
  }catch(error){
    $('org-loading').textContent='⛔ '+error.message;
  }
})();
