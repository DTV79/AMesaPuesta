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
async function cargar(){
  const {data:{session}}=await sb.auth.getSession();
  if(!session)return;
  const {data:plan,error}=await sb.rpc('consultar_organizacion_admin');
  if(error||!plan)return;
  // Los detalles del restaurante solo llegan después de la entrega voluntaria.
  // Las tareas y conversaciones privadas nunca se incluyen en esta respuesta.
  const entregado=!!plan.entregado_en;
  const d=entregado?(plan.datos||{}):{};
  if(!(plan.organizadores||[]).length)return;

  const card=document.createElement('section');
  card.className='panel';
  card.style.cssText='margin:13px 0 18px;padding:18px;border:1px solid #d9c4af;border-radius:16px;background:#fff9f2';
  const title=document.createElement('h2');
  title.textContent='👥 Organización de la próxima comida';
  title.style.cssText='margin:0 0 10px;color:#7e2633;font:700 22px Georgia,serif';
  card.append(title);
  card.append(line('Organizan',nombres(plan.organizadores)));
  card.append(line('Fecha',plan.fecha_definitiva
    ?new Intl.DateTimeFormat('es-ES',{dateStyle:'long'}).format(new Date(plan.fecha_definitiva+'T12:00:00'))
    :'Por confirmar'));
  if(plan.fecha_encuesta){
    card.append(line('Votación de fecha',plan.fecha_encuesta.cerrada?'Plazo cerrado':'En votación'));
  }
  if(plan.asistencia_encuesta){
    const a=plan.asistencia_encuesta;
    card.append(line('Asistencia',a.cerrada?'Plazo cerrado':'En votación'));
    card.append(line('Confirmados',String((a.si||[]).length)+
      ' · No asisten: '+(a.no||[]).length+' · Sin responder: '+(a.sin_respuesta||[]).length));
  }
  if(!entregado){
    const aviso=document.createElement('p');
    aviso.className='muted';
    aviso.style.cssText='padding:12px 14px;border-radius:10px;background:#f3eae2;margin:12px 0;line-height:1.5';
    aviso.textContent='🔐 Preparación reservada a los dos organizadores. El restaurante y el menú aparecerán aquí cuando entreguen su ficha. Sus tareas y conversaciones seguirán siendo privadas.';
    card.append(aviso);
  }else{
    card.append(line('Ficha entregada',momento(plan.entregado_en)));
    card.append(line('Restaurante',d.restaurante||'No indicado'));
    if(d.reserva)card.append(line('Reserva',d.reserva));
    const extra=document.createElement('details');
    extra.style.cssText='padding:10px 0;line-height:1.5';
    const summary=document.createElement('summary');
    summary.textContent='Ver ficha entregada y asistentes';
    summary.style.cssText='cursor:pointer;font-weight:700;color:#6d2e37';
    extra.append(summary);
    const campos=[
      ['Dirección',d.direccion],['Teléfono',d.telefono],
      ['Contacto',d.contacto],['Fecha y hora comida',d.hora],['Precio orientativo',d.precio_orientativo],
      ['Entrantes',d.entrantes],['Platos principales',d.principales],
      ['Postres',d.postres],['Bebidas',d.bebidas]
    ];
    for(const [label,value] of campos){if(value)extra.append(line(label,value))}
    if(plan.asistencia_encuesta){
      extra.append(line('Asistirán',nombres(plan.asistencia_encuesta.si)));
      extra.append(line('No asistirán',nombres(plan.asistencia_encuesta.no)));
      extra.append(line('Sin responder',nombres(plan.asistencia_encuesta.sin_respuesta)));
    }
    card.append(extra);
  }
  const actions=document.createElement('div');
  actions.style.cssText='display:flex;gap:9px;flex-wrap:wrap;align-items:center;margin-top:12px';
  const copiar=document.createElement('button');
  copiar.type='button';copiar.className='btn soft';copiar.textContent='📋 Cargar datos en una nueva comida';
  const encuestas=document.createElement('a');
  encuestas.href='encuestas.html';encuestas.className='btn soft';
  encuestas.textContent='📊 Gestionar encuestas';
  const cambiarFecha=document.createElement('button');
  cambiarFecha.type='button';cambiarFecha.className='btn soft';
  cambiarFecha.textContent='📅 Modificar fecha';
  cambiarFecha.style.cssText='font-size:13px;padding:8px 11px;background:transparent;border:1px solid #ded0c4;color:#76645f';
  if(entregado)actions.append(copiar);
  actions.append(cambiarFecha,encuestas);
  card.append(actions);
  if(entregado){
    const nota=document.createElement('p');
    nota.className='muted';nota.style.cssText='font-size:13px;margin-top:9px';
    nota.textContent='La importación solo rellena el formulario; no publica nada ni modifica las cuentas. Revisa antes de guardar.';
    card.append(nota);
  }
  cambiarFecha.addEventListener('click',async()=>{
    const fecha=await AMPDialog.prompt(
      'Selecciona el día definitivo para la próxima comida.',
      plan.fecha_definitiva||'',
      {titulo:'📅 Modificar fecha',tipoCampo:'date',etiqueta:'Fecha de la comida',aceptar:'Continuar'}
    );
    if(fecha===null)return;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(fecha)){
      await AMPDialog.alert('Selecciona una fecha válida para la comida.',{titulo:'Falta la fecha'});return;
    }
    if(!(await AMPDialog.confirm(
      '¿Quieres establecer esta fecha como definitiva?\n\nSi ya se votó la asistencia, comprueba si es necesario pedir una nueva confirmación a los cofrades.',
      {titulo:'Confirmar fecha',aceptar:'Guardar fecha'}
    )))return;
    const {error}=await sb.rpc('ajustar_fecha_organizacion_admin',{p_fecha:fecha});
    if(error){await AMPDialog.alert(error.message,{titulo:'No se pudo modificar la fecha'});return}
    location.reload();
  });
  copiar.addEventListener('click',()=>{
    if(!$('nuevo')||!$('personas')?.children.length){
      alert('Espera a que termine de cargar la administración y vuelve a intentarlo.');return;
    }
    if(!confirm('¿Abrimos una nueva ficha y copiamos los preparativos? Los datos sin guardar en el editor actual se perderán.'))return;
    $('nuevo').click();
    // Conservamos el identificador exacto para vincular la nueva comida oficial.
    document.body.dataset.ampPreparacionOrigen=plan.id;
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
