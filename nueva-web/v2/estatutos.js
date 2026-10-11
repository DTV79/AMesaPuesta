import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from "./config.js";
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const date=v=>{if(!v)return "";const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(v);return m?m[3]+"/"+m[2]+"/"+m[1]:esc(v)};
async function iniciar(){
try{
const response=await fetch(SUPABASE_URL+"/rest/v1/rpc/estatutos_vigentes_publicos",{method:"POST",headers:{"apikey":SUPABASE_PUBLISHABLE_KEY,"Content-Type":"application/json"},body:"{}"});
if(!response.ok)throw new Error("No se pudieron cargar los estatutos ("+response.status+")");
const data=await response.json(),v=data||{},bloques=data?.bloques||[];
if(!bloques.length){$("estatutos-contenido").textContent="No hay contenido público disponible en la versión vigente.";return}
$("estatutos-meta").innerHTML="<span>Versión <strong>"+esc(v.version||"")+"</strong> · Vigente</span>"+(v.fecha_aprobacion?"<span>Aprobada el <strong>"+date(v.fecha_aprobacion)+"</strong></span>":"");
$("estatutos-revision").textContent=v.fecha_aprobacion?"Última aprobación: "+date(v.fecha_aprobacion):"";
const pdf=v.pdf_url||v.pdf_ruta;
if(pdf&&/^https:\/\//.test(pdf)){$("estatutos-acciones").innerHTML='<a class="button-primary" target="_blank" rel="noopener noreferrer" href="'+esc(pdf)+'" download>Ver / Descargar PDF oficial</a>'}
let chapters=[],current=null;
for(const b of bloques){if(b.tipo==="capitulo"){current={title:b.titulo||"Capítulo",items:[]};chapters.push(current)}else{if(!current){current={title:"Disposiciones generales",items:[]};chapters.push(current)}current.items.push(b)}}
const index=chapters.map((c,i)=>'<li><a href="#capitulo-'+(i+1)+'"><span>'+String(i+1).padStart(2,"0")+'</span> '+esc(c.title)+'</a></li>').join("");
$("indice-estatutos").innerHTML=index;$("indice-movil").innerHTML=index;
$("estatutos-contenido").innerHTML=chapters.map((c,i)=>'<section class="capitulo" id="capitulo-'+(i+1)+'"><div class="capitulo-head"><h2>'+esc(c.title)+'</h2></div><div class="capitulo-body">'+c.items.map(b=>'<article class="articulo"><h3>'+esc(b.titulo||"")+'</h3><div>'+esc(b.contenido||"").replace(/\n/g,"<br>")+'</div></article>').join("")+'</div></section>').join("");
}catch(err){$("estatutos-contenido").textContent="No se han podido cargar los estatutos vigentes. Inténtalo de nuevo más tarde.";console.error(err)}
}
iniciar();