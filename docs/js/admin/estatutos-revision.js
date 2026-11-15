import {compararBloques} from "./estatutos-diff.js";

const nombreVersion = valor => String(valor ?? "").replace(/^versi[oó]n\s+/i,"").trim();
const fechaOrden = v => Date.parse(v?.creado_en || v?.fecha_aprobacion || "") || 0;

// Se usa la cronología real, no el estado vigente, para revisar versiones ya aprobadas.
export function encontrarVersionAnterior(actual,lista=[]){
  if(!actual?.id)return null;
  const aprobadas=lista.filter(v=>v.estado!=="borrador")
    .sort((a,b)=>fechaOrden(a)-fechaOrden(b) || String(a.id).localeCompare(String(b.id)));
  if(actual.estado==="borrador"){
    return aprobadas.find(v=>v.estado==="vigente") || aprobadas[aprobadas.length-1] || null;
  }
  const index=aprobadas.findIndex(v=>String(v.id)===String(actual.id));
  return index>0?aprobadas[index-1]:null;
}
export function crearRevision({sb,$,esc,getLista}){
  const contenido=x=>esc(String(x?.contenido??"—")).replaceAll("\n","<br>");
  const etiqueta=c=>c.estado==="anadido"?"➕ Añadido":c.estado==="eliminado"?"➖ Eliminado":"✏️ Modificado";
  function tarjeta(c){
    const x=c.nuevo||c.anterior;
    let html='<div class="card" style="margin-top:9px"><div class="row"><strong>'+esc(x.titulo)+'</strong><span class="pill">'+etiqueta(c.estado)+'</span></div>';
    if(c.estado==="modificado" || c.estado==="eliminado" || c.estado==="anadido"){
      html+='<div class="twocol">';
      if(c.anterior)html+='<div><b>Antes · Versión anterior</b><div class="review">'+contenido(c.anterior)+'</div></div>';
      if(c.nuevo)html+='<div><b>Después · Versión seleccionada</b><div class="review">'+contenido(c.nuevo)+'</div></div>';
      html+='</div>';
    }
    return html+"</div>";
  }
  function tieneAnterior(actual){return Boolean(encontrarVersionAnterior(actual,getLista()))}
  async function comparar(actual,bloques){
    const ref=encontrarVersionAnterior(actual,getLista());
    if(!ref){
      $("revision").innerHTML='<div class="review"><strong>Versión '+esc(nombreVersion(actual.version))+
        ' · Versión inicial</strong><div class="muted" style="margin-top:7px">No existe una versión anterior con la que comparar. El texto original se conserva en el histórico.</div></div>';
      return [];
    }
    $("revision").innerHTML='<div class="review">Comparando las versiones '+esc(nombreVersion(ref.version))+' y '+esc(nombreVersion(actual.version))+'…</div>';
    const {data,error}=await sb.rpc("detalle_estatutos_admin",{p_id:ref.id});
    if(error)throw error;
    if(!data?.version?.id || String(data.version.id)!==String(ref.id) || !Array.isArray(data.bloques))
      throw new Error("No se ha podido recuperar la versión anterior para realizar la comparación.");
    const cambios=compararBloques(data.bloques,bloques);
    const n=e=>cambios.filter(x=>x.estado===e).length;
    $("revision").innerHTML='<div class="review"><strong>Comparación: versión '+esc(nombreVersion(ref.version))+
      ' → versión '+esc(nombreVersion(actual.version))+'</strong><div class="muted" style="margin-top:5px">Antes: versión '+esc(nombreVersion(ref.version))+
      ' · Después: versión '+esc(nombreVersion(actual.version))+'</div><div style="margin-top:7px">➕ '+n("anadido")+
      ' añadidos · ✏️ '+n("modificado")+' modificados · ➖ '+n("eliminado")+' eliminados</div>'+
      (cambios.length?"":'<div class="muted">No hay cambios en el contenido web respecto a la versión anterior.</div>')+
      '</div>'+cambios.map(tarjeta).join("");
    return cambios;
  }
  return {comparar,tieneAnterior};
}
