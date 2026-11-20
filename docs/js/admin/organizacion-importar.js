import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.0/+esm';

const sb=createClient(
  'https://wmfcpnihymiiwgpvbngj.supabase.co',
  'sb_publishable_ij3sYbyMrLI2B34OOYt6JA_Aez1R2cJ'
);
const $=id=>document.getElementById(id);
const line=(label,value)=>{
  const p=document.createElement('p');p.style.margin='7px 0';
  const b=document.createElement('strong');b.textContent=label+': ';
  p.append(b,document.createTextNode(String(value||'—')));return p;
};
const nombres=list=>(list||[]).map(x=>x.nombre).join(', ')||'Nadie';
const momento=valor=>valor?new Intl.DateTimeFormat('es-ES',{
  day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',
  hour12:false,timeZone:'Europe/Madrid'
}).format(new Date(valor)).replace(',',''):'—';
const boton=(nombre,accion)=>{
  const b=document.createElement('button');b.type='button';b.className='btn soft';
  b.textContent=nombre;b.style.cssText='padding:7px 11px;font-size:13px';
  b.addEventListener('click',accion);return b;
};

async function cargar(){
  const {data:{session}}=await sb.auth.getSession();
  if(!session)return;
  const {data:plan,error}=await sb.rpc('consultar_organizacion_admin');
  if(error||!plan)return;
  const d=plan.datos||{};
  if(!plan.fecha_encuesta&&!plan.asistencia_encuesta
    &&!Object.values(d).some(v=>String(v||'').trim())
    &&!(plan.tareas||[]).length&&!(plan.comentarios||[]).length)return;

  const card=document.createElement('section');
  card.className='panel';
  card.style.cssText='margin:13px 0 18px;padding:18px;border:1px solid #d9c4af;border-radius:16px;background:#fff9f2';
  const title=document.createElement('h2');
  title.textContent='👥 Preparativos de los próximos organizadores';
  title.style.cssText='margin:0 0 10px;color:#7e2633;font:700 22px Georgia,serif';
  card.append(title);
  card.append(line('Organizan',nombres(plan.organizadores)));
  card.append(line('Fecha',plan.fecha_definitiva
    ?new Intl.DateTimeFormat('es-ES',{dateStyle:'long'}).format(new Date(plan.fecha_definitiva+'T12:00:00'))
    :'Por confirmar'));
  card.append(line('Restaurante (privado)',d.restaurante||'Aún sin indicar'));
  if(d.reserva)card.append(line('Reserva',d.reserva));
  if(plan.asistencia_encuesta){
    const a=plan.asistencia_encuesta;
    card.append(line('Asistencia',a.cerrada?'Plazo cerrado':'En votación'));
    card.append(line('Confirmados',String((a.si||[]).length)+
      ' · No asisten: '+(a.no||[]).length+' · Sin responder: '+(a.sin_respuesta||[]).length));
  }
  const extra=document.createElement('details');
  extra.style.cssText='padding:10px 0;line-height:1.5';
  const summary=document.createElement('summary');
  summary.textContent='Ver notas y detalles privados';
  summary.style.cssText='cursor:pointer;font-weight:700;color:#6d2e37';
  extra.append(summary);
  const campos=[
    ['Dirección',d.direccion],['Teléfono',d.telefono],
    ['Contacto',d.contacto],['Fecha y hora comida',d.hora],['Precio orientativo',d.precio_orientativo],
    ['Entrantes',d.entrantes],['Platos principales',d.principales],
    ['Postres',d.postres],['Bebidas',d.bebidas]
  ];
  for(const [label,value] of campos){if(value)extra.append(line(label,value))}
  async function gestionar(tipo,accion,id=null,texto=null,responsable=null){
    const funcion=tipo==='tarea'?'gestionar_tarea_organizacion_admin'
      :'gestionar_comentario_organizacion_admin';
    const parametros={p_accion:accion,p_id:id,p_texto:texto};
    if(tipo==='tarea')parametros.p_responsable=responsable;
    const {error}=await sb.rpc(funcion,parametros);
    if(error){alert(error.message);return}
    location.reload();
  }
  const tareasTitulo=document.createElement('h3');
  tareasTitulo.textContent='Tareas compartidas';tareasTitulo.style.margin='14px 0 8px';
  extra.append(tareasTitulo);
  if(!(plan.tareas||[]).length)extra.append(line('Tareas','Todavía ninguna'));
  for(const tarea of plan.tareas||[]){
    const fila=document.createElement('div');
    fila.style.cssText='padding:9px 0;border-bottom:1px solid #eadbd2';
    const texto=document.createElement('p');texto.style.cssText='margin:0 0 6px';
    texto.textContent=(tarea.completada_en?'✓ ':'☐ ')+tarea.texto
      +(tarea.responsable?' · Encargado: '+tarea.responsable:'');
    fila.append(texto);
    fila.append(line('Estado',tarea.completada_en
      ?'Hecho por '+tarea.completador+' · '+momento(tarea.completada_en)
      :'Pendiente · '+tarea.creador+' · '+momento(tarea.creada_en)));
    const acciones=document.createElement('div');
    acciones.style.cssText='display:flex;gap:7px;flex-wrap:wrap';
    acciones.append(boton(tarea.completada_en?'Reabrir':'Marcar hecha',()=>
      gestionar('tarea',tarea.completada_en?'reabrir':'completar',tarea.id)));
    acciones.append(boton('Eliminar',()=>{
      if(confirm('¿Quitar esta tarea?'))gestionar('tarea','eliminar',tarea.id);
    }));
    fila.append(acciones);extra.append(fila);
  }
  extra.append(boton('+ Añadir tarea',()=>{
    const texto=prompt('Nueva tarea compartida:');
    if(texto?.trim())gestionar('tarea','crear',null,texto.trim());
  }));
  const comentariosTitulo=document.createElement('h3');
  comentariosTitulo.textContent='Notas entre organizadores';
  comentariosTitulo.style.margin='18px 0 8px';extra.append(comentariosTitulo);
  if(!(plan.comentarios||[]).length)extra.append(line('Notas','Todavía ninguna'));
  for(const comentario of plan.comentarios||[]){
    const fila=document.createElement('div');
    fila.style.cssText='padding:10px 0;border-bottom:1px solid #eadbd2';
    const titulo=document.createElement('strong');
    titulo.textContent=momento(comentario.creado_en)+' · '+comentario.autor
      +(comentario.editado_en?' · editado':'');
    const contenido=document.createElement('p');contenido.style.cssText='white-space:pre-wrap;margin:5px 0 8px';
    contenido.textContent=comentario.texto;fila.append(titulo,contenido);
    const acciones=document.createElement('div');
    acciones.style.cssText='display:flex;gap:7px;flex-wrap:wrap';
    acciones.append(boton('Editar',()=>{
      const texto=prompt('Editar comentario:',comentario.texto);
      if(texto!==null&&texto.trim())gestionar('comentario','editar',comentario.id,texto.trim());
    }));
    acciones.append(boton('Borrar',()=>{
      if(confirm('¿Borrar este comentario de la conversación?'))
        gestionar('comentario','eliminar',comentario.id);
    }));
    fila.append(acciones);extra.append(fila);
  }
  extra.append(boton('+ Añadir comentario',()=>{
    const texto=prompt('Comentario de Administración:');
    if(texto?.trim())gestionar('comentario','crear',null,texto.trim());
  }));
  if(plan.asistencia_encuesta){
    extra.append(line('Asistirán',nombres(plan.asistencia_encuesta.si)));
    extra.append(line('No asistirán',nombres(plan.asistencia_encuesta.no)));
    extra.append(line('Sin responder',nombres(plan.asistencia_encuesta.sin_respuesta)));
  }
  card.append(extra);
  const actions=document.createElement('div');
  actions.style.cssText='display:flex;gap:9px;flex-wrap:wrap;align-items:center;margin-top:12px';
  const copiar=document.createElement('button');
  copiar.type='button';copiar.className='btn soft';copiar.textContent='📋 Cargar datos en una nueva comida';
  const encuestas=document.createElement('a');
  encuestas.href='encuestas.html';encuestas.className='btn soft';
  encuestas.textContent='📊 Gestionar encuestas';
  const editar=document.createElement('button');
  editar.type='button';editar.className='btn soft';
  editar.textContent='✏️ Editar ficha privada';
  const cambiarFecha=document.createElement('button');
  cambiarFecha.type='button';cambiarFecha.className='btn soft';
  cambiarFecha.textContent='📅 Corregir fecha';
  actions.append(copiar,editar,cambiarFecha,encuestas);
  card.append(actions);
  const nota=document.createElement('p');
  nota.className='muted';nota.style.cssText='font-size:13px;margin-top:9px';
  nota.textContent='La importación solo rellena el formulario; no publica nada ni modifica las cuentas. Revisa antes de guardar.';
  card.append(nota);
  cambiarFecha.addEventListener('click',async()=>{
    const fecha=prompt('Fecha definitiva (AAAA-MM-DD):',plan.fecha_definitiva||'');
    if(fecha===null)return;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(fecha)){
      alert('Escribe la fecha en formato AAAA-MM-DD.');return;
    }
    if(!confirm('¿Cambiar la fecha? Si ya hubo votos de asistencia, valora si hace falta una nueva confirmación.'))return;
    const {error}=await sb.rpc('ajustar_fecha_organizacion_admin',{p_fecha:fecha});
    if(error){alert(error.message);return}
    location.reload();
  });
  editar.addEventListener('click',()=>{
    const dialog=document.createElement('dialog');
    dialog.style.cssText='border:1px solid #d9c4af;border-radius:17px;padding:20px;width:min(610px,calc(100% - 32px));max-height:85vh;overflow:auto';
    const h=document.createElement('h2');
    h.textContent='Preparativos privados · Administración';
    h.style.cssText='font:700 24px Georgia,serif;color:#782936';
    const form=document.createElement('form');form.style.cssText='display:grid;gap:10px';
    const controles={};
    const camposEditar=[
      ['restaurante','Restaurante'],['direccion','Dirección'],['telefono','Teléfono'],
      ['contacto','Persona de contacto'],['reserva','Estado de reserva'],['hora','Fecha y hora comida'],
      ['precio_orientativo','Precio orientativo'],['entrantes','Entrantes'],
      ['principales','Platos principales'],['postres','Postres'],['bebidas','Bebidas']
    ];
    for(const [clave,rotulo] of camposEditar){
      const label=document.createElement('label');
      label.textContent=rotulo;label.style.cssText='font-weight:700;display:grid;gap:5px';
      const input=['entrantes','principales','postres','bebidas'].includes(clave)
        ?document.createElement('textarea'):document.createElement('input');
      input.value=String(d[clave]||'');
      input.style.cssText='box-sizing:border-box;width:100%;min-height:41px;padding:9px;border:1px solid #cbbdb5;border-radius:9px;font:15px system-ui,sans-serif';
      if(input.tagName==='TEXTAREA')input.rows=3;
      controles[clave]=input;label.append(input);form.append(label);
    }
    const botones=document.createElement('div');
    botones.style.cssText='display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap';
    const cerrar=document.createElement('button');cerrar.type='button';
    cerrar.textContent='Cancelar';cerrar.className='btn soft';
    cerrar.onclick=()=>dialog.close();
    const guardar=document.createElement('button');guardar.type='submit';
    guardar.textContent='Guardar cambios';guardar.className='btn primary';
    botones.append(cerrar,guardar);form.append(botones);
    form.addEventListener('submit',async e=>{
      e.preventDefault();guardar.disabled=true;
      const datos=Object.fromEntries(Object.entries(controles).map(([k,v])=>[k,v.value.trim()]));
      const {error}=await sb.rpc('guardar_preparativos_organizacion_admin',{p_datos:datos});
      if(error){alert(error.message);guardar.disabled=false;return}
      dialog.close();location.reload();
    });
    dialog.append(h,form);document.body.append(dialog);
    dialog.addEventListener('close',()=>dialog.remove());
    dialog.showModal();
  });
  copiar.addEventListener('click',()=>{
    if(!$('nuevo')||!$('personas')?.children.length){
      alert('Espera a que termine de cargar la administración y vuelve a intentarlo.');return;
    }
    if(!confirm('¿Abrimos una nueva ficha y copiamos los preparativos? Los datos sin guardar en el editor actual se perderán.'))return;
    $('nuevo').click();
    const rellenar=(id,valor)=>{if($(id)&&valor)$(id).value=valor};
    rellenar('fecha',plan.fecha_definitiva);
    if(d.restaurante){
      const select=$('restSel');
      const existente=[...select.options].find(o=>o.value&&o.textContent.trim().toLocaleLowerCase('es')
        ===String(d.restaurante).trim().toLocaleLowerCase('es'));
      if(existente){select.value=existente.value;select.dispatchEvent(new Event('change'))}
      else rellenar('rNombre',d.restaurante);
    }
    rellenar('rDireccion',d.direccion);rellenar('rTelefono',d.telefono);
    rellenar('rContacto',d.contacto);
    rellenar('entrantes',d.entrantes);rellenar('principales',d.principales);
    rellenar('postres',d.postres);rellenar('bebidas',d.bebidas);
    const orgIds=new Set((plan.organizadores||[]).map(x=>String(x.id)));
    document.querySelectorAll('[data-org]').forEach(input=>{
      input.checked=!input.disabled&&orgIds.has(input.dataset.org);
    });
    if(plan.asistencia_encuesta?.cerrada){
      const yes=new Set((plan.asistencia_encuesta.si||[]).map(x=>String(x.id)));
      const no=new Set((plan.asistencia_encuesta.no||[]).map(x=>String(x.id)));
      document.querySelectorAll('[data-asis]').forEach(input=>{
        input.value=yes.has(input.dataset.asis)?'si':no.has(input.dataset.asis)?'no':'';
      });
      document.dispatchEvent(new CustomEvent('amp-asistencia-cambio'));
    }
    $('editor').scrollIntoView({behavior:'smooth',block:'start'});
    alert('Preparativos cargados. Comprueba la ficha y guarda cuando esté todo listo. Los que no respondieron quedan sin marcar.');
  });
  const tabs=document.querySelector('.hist-tabs');
  (tabs?.parentNode||document.querySelector('main')).insertBefore(card,tabs||null);
}
cargar().catch(error=>console.warn('No se pudieron cargar los preparativos de los organizadores',error));
