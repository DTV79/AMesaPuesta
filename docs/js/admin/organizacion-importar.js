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

async function cargar(){
  const {data:{session}}=await sb.auth.getSession();
  if(!session)return;
  const {data:plan,error}=await sb.rpc('consultar_organizacion_admin');
  if(error||!plan)return;
  const d=plan.datos||{};
  if(!plan.fecha_encuesta&&!plan.asistencia_encuesta
    &&!Object.values(d).some(v=>String(v||'').trim()))return;

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
    ['Contacto',d.contacto],['Hora',d.hora],['Precio orientativo',d.precio_orientativo],
    ['Entrantes',d.entrantes],['Platos principales',d.principales],
    ['Postres',d.postres],['Bebidas',d.bebidas],
    ['Tareas pendientes',d.tareas],['Notas internas',d.notas]
  ];
  for(const [label,value] of campos){if(value)extra.append(line(label,value))}
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
  actions.append(copiar,encuestas);
  card.append(actions);
  const nota=document.createElement('p');
  nota.className='muted';nota.style.cssText='font-size:13px;margin-top:9px';
  nota.textContent='La importación solo rellena el formulario; no publica nada ni modifica las cuentas. Revisa antes de guardar.';
  card.append(nota);
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
