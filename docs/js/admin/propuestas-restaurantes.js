import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.0/+esm';

const sb=createClient('https://wmfcpnihymiiwgpvbngj.supabase.co','sb_publishable_ij3sYbyMrLI2B34OOYt6JA_Aez1R2cJ');
const $=id=>document.getElementById(id);
const el=(tag,texto,clase='')=>{const n=document.createElement(tag);if(texto!==undefined)n.textContent=texto;if(clase)n.className=clase;return n;};
const euro=valor=>Number(valor).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
const fecha=valor=>valor?new Intl.DateTimeFormat('es-ES').format(new Date(String(valor).slice(0,10)+'T12:00:00')):'—';
let sugerencias=[],comidas=[];

function estado(mensaje,error=false){$('estado').textContent=mensaje;$('estado').classList.toggle('error',error);}
async function rpc(nombre,parametros={}){
  const {data,error}=await sb.rpc(nombre,parametros);
  if(error)throw Error(error.message);return data;
}
function boton(texto,clase=''){const b=el('button',texto,'boton '+clase);b.type='button';return b;}
function input(labelText,nombre,valor='',tipo='text'){
  const label=el('label',labelText),campo=el('input');campo.name=nombre;campo.type=tipo;campo.value=valor??'';
  if(tipo==='number'){campo.step='0.01';campo.min='0';campo.max='2000';}
  label.append(campo);return label;
}
function editar(propuesta){
  const form=el('form',undefined,'formulario');form.hidden=true;
  const grid=el('div',undefined,'campos');
  grid.append(input('Restaurante','nombre',propuesta.nombre),input('Localidad','localidad',propuesta.localidad),
    input('Enlace a Maps o web','enlace',propuesta.enlace,'url'),
    input('Teléfono','telefono',propuesta.telefono,'tel'),
    input('Precio orientativo (€)','precio_orientativo',propuesta.precio_orientativo,'number'));
  const motivo=el('label','¿Por qué lo recomiendan?'),textarea=el('textarea');
  textarea.name='motivo';textarea.maxLength=600;textarea.rows=3;textarea.value=propuesta.motivo||'';
  motivo.append(textarea);
  const acciones=el('div',undefined,'acciones');
  const guardar=boton('Guardar cambios','principal'),cancelar=boton('Cancelar');guardar.type='submit';
  cancelar.addEventListener('click',()=>form.hidden=true);
  acciones.append(guardar,cancelar);form.append(grid,motivo,acciones);
  form.addEventListener('submit',async e=>{
    e.preventDefault();guardar.disabled=true;
    try{
      const fd=new FormData(form);
      const datos=Object.fromEntries(fd.entries());
      await rpc('editar_sugerencia_restaurante_admin',{p_id:propuesta.id,p_datos:datos});
      await cargar();estado('Propuesta actualizada.');
    }catch(error){estado(error.message,true);guardar.disabled=false;}
  });
  return form;
}
function gestionarEstado(propuesta){
  const form=el('form',undefined,'formulario');form.hidden=true;
  const estados=el('label','Estado'),select=el('select');select.name='estado';
  for(const [value,display] of [['en_lista','Por descubrir'],['visitado','Visitado'],['descartado','Descartado']]){
    const o=el('option',display);o.value=value;select.append(o);
  }
  select.value=propuesta.estado;estados.append(select);
  const comidaLabel=el('label','Comida oficial celebrada'),comidaSelect=el('select');
  comidaSelect.name='comida';
  const inicial=el('option','Selecciona la comida');inicial.value='';comidaSelect.append(inicial);
  for(const c of comidas){const o=el('option',c.nombre+' · '+fecha(c.fecha));o.value=c.id;comidaSelect.append(o);}
  comidaSelect.value=propuesta.comida_id||'';comidaLabel.append(comidaSelect);
  const nota=el('p','Solo puedes vincular comidas celebradas y publicadas. La elección no se comparte antes.','meta');
  const actualizar=()=>{comidaLabel.hidden=select.value!=='visitado';nota.hidden=select.value!=='visitado';comidaSelect.required=select.value==='visitado';};
  select.addEventListener('change',actualizar);actualizar();
  const acciones=el('div',undefined,'acciones');const guardar=boton('Aplicar estado','principal'),cancelar=boton('Cancelar');
  guardar.type='submit';cancelar.addEventListener('click',()=>form.hidden=true);acciones.append(guardar,cancelar);
  form.append(estados,comidaLabel,nota,acciones);
  form.addEventListener('submit',async e=>{
    e.preventDefault();guardar.disabled=true;
    try{
      await rpc('estado_sugerencia_restaurante_admin',{
        p_id:propuesta.id,p_estado:select.value,p_comida:comidaSelect.value||null
      });
      await cargar();estado('Estado de la propuesta actualizado.');
    }catch(error){estado(error.message,true);guardar.disabled=false;}
  });
  return form;
}
function tarjeta(p){
  const card=el('article',undefined,'card');
  const head=el('div',undefined,'cabecera'),texto=el('div');
  texto.append(el('h2',p.nombre),el('p',p.localidad+' · Propuesto por '+p.proponente+' · '+fecha(p.creada_en),'meta'));
  const badge=el('span',({en_lista:'Por descubrir',visitado:'Visitado',descartado:'Descartado'})[p.estado],'pill '+p.estado);
  head.append(texto,badge);card.append(head);
  if(p.motivo)card.append(el('p',p.motivo,'motivo'));
  const detalles=[p.interesados+' interesados',(p.comentarios?.length||0)+' comentarios'];
  if(p.precio_orientativo!==null&&p.precio_orientativo!==undefined)detalles.push(euro(p.precio_orientativo)+'/persona');
  if(p.telefono)detalles.push('Tel. '+p.telefono);
  card.append(el('p',detalles.join(' · '),'meta'));
  if(p.estado==='visitado'&&p.comida_codigo){
    const a=el('a','Ver ficha de la comida','back');a.href='../v2/restaurantes.html#'+encodeURIComponent(p.comida_codigo);card.append(a);
  }
  if(p.comentarios?.length){
    const details=el('details');details.style.marginTop='13px';
    const summary=el('summary','💬 Ver comentarios ('+p.comentarios.length+')');
    summary.style.cssText='cursor:pointer;color:#622330;font-weight:750';
    details.append(summary);
    for(const comentario of p.comentarios){
      const fila=el('div');fila.style.cssText='margin:9px 0;padding:10px;border-radius:10px;background:#f8f3ee';
      fila.append(el('strong',comentario.autor),el('p',comentario.texto,'motivo'));
      const eliminar=boton('Eliminar comentario');
      eliminar.addEventListener('click',async()=>{
        if(!confirm('¿Eliminar definitivamente este comentario?'))return;
        eliminar.disabled=true;
        try{
          await rpc('eliminar_comentario_restaurante_admin',{p_id:comentario.id});
          await cargar();estado('Comentario eliminado.');
        }catch(error){estado(error.message,true);eliminar.disabled=false;}
      });
      fila.append(eliminar);details.append(fila);
    }
    card.append(details);
  }
  const editarForm=editar(p),estadoForm=gestionarEstado(p);
  const acciones=el('div',undefined,'acciones');
  const bEdit=boton('✎ Editar'),bEstado=boton('Cambiar estado');
  bEdit.addEventListener('click',()=>{editarForm.hidden=!editarForm.hidden;estadoForm.hidden=true;});
  bEstado.addEventListener('click',()=>{estadoForm.hidden=!estadoForm.hidden;editarForm.hidden=true;});
  acciones.append(bEdit,bEstado);card.append(acciones,editarForm,estadoForm);
  return card;
}
async function cargar(){
  const d=await rpc('listar_sugerencias_restaurantes_admin');
  sugerencias=Array.isArray(d?.propuestas)?d.propuestas:[];
  comidas=Array.isArray(d?.comidas)?d.comidas:[];
  $('propuestas').replaceChildren(...(sugerencias.length?sugerencias.map(tarjeta):[
    el('p','Todavía no hay propuestas de restaurantes.','vacio')
  ]));
}
async function iniciar(){
  try{
    const {data:{session}}=await sb.auth.getSession();
    if(!session||!(await rpc('soy_admin_cofradia'))){
      $('propuestas').replaceChildren(el('p','Acceso restringido. Inicia sesión como administrador.','vacio'));return;
    }
    await cargar();
  }catch(error){estado(error.message,true);$('propuestas').replaceChildren(el('p','No se pudieron cargar las propuestas.','vacio'));}
}
iniciar();
