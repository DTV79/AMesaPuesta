import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './config.js';

const $=id=>document.getElementById(id);
const endpoint=SUPABASE_URL.replace(/\/$/,'')+'/rest/v1/rpc/';
const token=localStorage.getItem('amp_cofrade_token')||'';
let propuestas=[];
let editando=null;
const nodo=(tag,clase,texto)=>{
  const elemento=document.createElement(tag);
  if(clase)elemento.className=clase;
  if(texto!==undefined)elemento.textContent=String(texto);
  return elemento;
};
const normalizar=texto=>String(texto||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
const fecha=valor=>new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'short',year:'numeric'}).format(new Date(valor));
const euro=valor=>Number(valor).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';

async function rpc(nombre,datos){
  const respuesta=await fetch(endpoint+nombre,{
    method:'POST',cache:'no-store',
    headers:{'Content-Type':'application/json',apikey:SUPABASE_PUBLISHABLE_KEY},
    body:JSON.stringify({p_token:token,...datos})
  });
  const contenido=await respuesta.json().catch(()=>null);
  if(!respuesta.ok)throw Error(contenido?.message||'No se pudo completar la operación.');
  return contenido;
}
function avisar(mensaje,error=false){
  $('descubrir-aviso').textContent=mensaje;
  $('descubrir-aviso').classList.toggle('error',error);
}
function enlaceSeguro(valor){
  try{const url=new URL(String(valor));return ['http:','https:'].includes(url.protocol)?url.href:'';}
  catch{return '';}
}
function enlaceExterno(destino,texto,url){
  const a=nodo('a','',texto);
  a.href=url;a.target='_blank';a.rel='noopener noreferrer';
  destino.append(a);
}
function cerrarFormulario(){
  $('descubrir-formulario').hidden=true;
  $('descubrir-formulario').reset();editando=null;
}
function abrirFormulario(propuesta=null){
  editando=propuesta?.id||null;
  const formulario=$('descubrir-formulario');
  formulario.reset();
  $('descubrir-form-titulo').textContent=editando?'Editar mi propuesta':'Proponer restaurante';
  $('descubrir-guardar').textContent=editando?'Guardar cambios':'Guardar propuesta';
  if(propuesta){
    for(const nombre of ['nombre','localidad','enlace','motivo'])formulario.elements[nombre].value=propuesta[nombre]||'';
    formulario.elements.precio_orientativo.value=propuesta.precio_orientativo??'';
  }
  formulario.hidden=false;
  formulario.scrollIntoView({block:'start',behavior:'smooth'});
  formulario.elements.nombre.focus({preventScroll:true});
}
function comentar(propuesta,comentario=null){
  const form=nodo('form','descubrir-comentario-form');
  const campo=nodo('textarea');campo.name='texto';campo.rows=2;campo.maxLength=500;
  campo.required=true;campo.placeholder='Añade algo útil sobre este restaurante…';
  campo.value=comentario?.texto||'';
  const acciones=nodo('div','descubrir-comment-actions');
  const boton=nodo('button','descubrir-small',comentario?'Guardar comentario':'Publicar comentario');
  boton.type='submit';
  acciones.append(boton);
  if(comentario){
    const cancelar=nodo('button','','Cancelar');cancelar.type='button';
    cancelar.addEventListener('click',()=>pintar());acciones.append(cancelar);
  }
  form.append(campo,acciones);
  form.addEventListener('submit',async e=>{
    e.preventDefault();boton.disabled=true;
    try{
      await rpc('gestionar_comentario_restaurante_cofrade',{
        p_sugerencia:propuesta.id,p_texto:campo.value,
        p_comentario:comentario?.id||null,p_eliminar:false
      });
      await cargar({mantenerPosicion:true});
      avisar('Comentario guardado.');
    }catch(error){avisar(error.message,true);boton.disabled=false;}
  });
  return form;
}
function tarjeta(propuesta){
  const card=nodo('article','descubrir-card');
  const cabecera=nodo('div','descubrir-card-head');
  const nombres=nodo('div');
  nombres.append(nodo('h3','',propuesta.nombre),nodo('p','descubrir-ubicacion','📍 '+propuesta.localidad));
  cabecera.append(nombres,nodo('span','descubrir-badge'+(propuesta.estado==='visitado'?' visitado':''),propuesta.estado==='visitado'?'✓ Visitado':'Por descubrir'));
  card.append(cabecera);
  if(propuesta.motivo)card.append(nodo('p','descubrir-motivo','«'+propuesta.motivo+'»'));
  const info=[`Propuesto por ${propuesta.proponente}`];
  if(propuesta.creada_en)info.push(fecha(propuesta.creada_en));
  if(propuesta.precio_orientativo!==null&&propuesta.precio_orientativo!==undefined)
    info.push('Aprox. '+euro(propuesta.precio_orientativo)+'/persona');
  card.append(nodo('div','descubrir-proponente',info.join(' · ')));
  const enlaces=nodo('div','descubrir-enlaces');
  const url=enlaceSeguro(propuesta.enlace);
  if(url)enlaceExterno(enlaces,/maps|goo\.gl/i.test(url)?'📍 Ver ubicación':'🌐 Ver enlace',url);
  else enlaceExterno(enlaces,'📍 Buscar en Maps','https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(propuesta.nombre+' '+propuesta.localidad));
  if(propuesta.estado==='visitado'&&propuesta.comida_codigo){
    const a=nodo('a','','🍽️ Ver ficha oficial');
    a.href='restaurantes.html#'+encodeURIComponent(propuesta.comida_codigo);
    enlaces.append(a);
  }
  card.append(enlaces);
  const meta=nodo('div','descubrir-meta');
  meta.append(nodo('span','descubrir-interes','❤️ '+propuesta.interesados+' '+(propuesta.interesados===1?'interesado':'interesados')));
  if(propuesta.estado==='en_lista'){
    const interes=nodo('button','descubrir-small'+(propuesta.me_interesa?' activo':''),propuesta.me_interesa?'♥ Ya me interesa':'♡ Me gustaría ir');
    interes.type='button';interes.setAttribute('aria-pressed',String(!!propuesta.me_interesa));
    interes.addEventListener('click',async()=>{
      interes.disabled=true;
      try{await rpc('cambiar_interes_restaurante_cofrade',{p_id:propuesta.id});await cargar({mantenerPosicion:true});}
      catch(error){avisar(error.message,true);interes.disabled=false;}
    });
    meta.append(interes);
    if(propuesta.es_mia){
      const editar=nodo('button','descubrir-small','✎ Editar');editar.type='button';
      editar.addEventListener('click',()=>abrirFormulario(propuesta));meta.append(editar);
    }
  }
  card.append(meta);
  const comentarios=nodo('details','descubrir-comentarios');
  const lista=Array.isArray(propuesta.comentarios)?propuesta.comentarios:[];
  comentarios.append(nodo('summary','','💬 Comentarios ('+lista.length+')'));
  const ul=nodo('ul');
  for(const item of lista){
    const li=nodo('li');
    li.append(nodo('span','descubrir-comentario-autor',item.autor+' · '+fecha(item.creado_en)),nodo('p','',item.texto));
    if(item.es_mio){
      const acciones=nodo('div','descubrir-comment-actions');
      const editar=nodo('button','','Editar');editar.type='button';
      editar.addEventListener('click',()=>{
        const viejo=comentarios.querySelector('.descubrir-comentario-form');
        if(viejo)viejo.remove();
        const form=comentar(propuesta,item);li.append(form);form.querySelector('textarea').focus();
      });
      const borrar=nodo('button','','Eliminar');borrar.type='button';
      borrar.addEventListener('click',async()=>{
        if(!confirm('¿Eliminar tu comentario?'))return;
        borrar.disabled=true;
        try{
          await rpc('gestionar_comentario_restaurante_cofrade',{
            p_sugerencia:propuesta.id,p_texto:'',p_comentario:item.id,p_eliminar:true
          });
          await cargar({mantenerPosicion:true});avisar('Comentario eliminado.');
        }catch(error){avisar(error.message,true);borrar.disabled=false;}
      });
      acciones.append(editar,borrar);li.append(acciones);
    }
    ul.append(li);
  }
  comentarios.append(ul,comentar(propuesta));card.append(comentarios);
  return card;
}
function pintar(){
  const q=normalizar($('descubrir-buscar').value);
  const estado=$('descubrir-estado').value;
  const orden=$('descubrir-orden').value;
  const visibles=propuestas.filter(p=>(estado==='todos'||p.estado===estado)
    &&(!q||normalizar(p.nombre+' '+p.localidad+' '+p.proponente+' '+p.motivo).includes(q)));
  visibles.sort((a,b)=>orden==='recientes'
    ?new Date(b.creada_en)-new Date(a.creada_en)
    :Number(b.interesados)-Number(a.interesados)||new Date(b.creada_en)-new Date(a.creada_en));
  $('descubrir-contador').textContent=visibles.length+' '+(visibles.length===1?'restaurante':'restaurantes');
  $('descubrir-lista').replaceChildren(...(visibles.length?visibles.map(tarjeta):[
    nodo('p','descubrir-vacio',q?'No hay restaurantes con ese nombre o localidad.':
      estado==='visitado'?'Todavía no hemos visitado ninguno de los restaurantes propuestos.':
      'Todavía no hay propuestas. ¡Anímate a estrenar la lista!')
  ]));
}
async function cargar({mantenerPosicion=false}={}){
  const scroll=window.scrollY;
  propuestas=await rpc('listar_sugerencias_restaurantes_cofrade',{});
  if(!Array.isArray(propuestas))throw Error('No se pudieron consultar las propuestas.');
  pintar();
  if(mantenerPosicion)requestAnimationFrame(()=>window.scrollTo(0,scroll));
}

$('descubrir-abrir').addEventListener('click',()=>abrirFormulario());
$('descubrir-cancelar').addEventListener('click',cerrarFormulario);
for(const id of ['descubrir-buscar','descubrir-estado','descubrir-orden'])
  $(id).addEventListener(id==='descubrir-buscar'?'input':'change',pintar);
$('descubrir-formulario').addEventListener('submit',async e=>{
  e.preventDefault();const guardar=$('descubrir-guardar');guardar.disabled=true;
  try{
    const form=new FormData(e.currentTarget);
    const datos={id:editando,nombre:form.get('nombre'),localidad:form.get('localidad'),
      enlace:form.get('enlace'),motivo:form.get('motivo'),precio_orientativo:form.get('precio_orientativo')};
    await rpc('guardar_sugerencia_restaurante_cofrade',{p_datos:datos});
    cerrarFormulario();$('descubrir-estado').value='en_lista';
    $('descubrir-buscar').value='';await cargar();
    avisar('¡Restaurante guardado! Ya pueden verlo los demás cofrades.');
  }catch(error){avisar(error.message,true);}
  finally{guardar.disabled=false;}
});

if(!token){$('descubrir-lista').replaceChildren(nodo('p','descubrir-vacio','Accede con tu usuario para ver las sugerencias.'));}
else cargar().catch(error=>{
  avisar(error.message,true);
  $('descubrir-lista').replaceChildren(nodo('p','descubrir-vacio','No se pudieron cargar las propuestas. Vuelve a intentarlo más tarde.'));
});
