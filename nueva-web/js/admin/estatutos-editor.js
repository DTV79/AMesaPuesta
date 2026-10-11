export function crearEditor({$,esc}){
let bloques=[],soloLectura=false;
const roman=n=>{let out="";for(const [v,t] of [[1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],[100,"C"],[90,"XC"],[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]])while(n>=v){out+=t;n-=v}return out};
const nuevo=tipo=>({tipo,clave:crypto.randomUUID(),titulo:tipo==="capitulo"?"Nuevo capítulo":"Nuevo artículo",contenido:""});
function renumerar(){
let cap=0,art=0;
for(const b of bloques){
if(b.tipo==="capitulo"){cap++;b.titulo=b.titulo.replace(/^(?:cap[ií]tulo\s+)(?:[IVXLCDM]+|\d+)\s*[.·:—-]?\s*/i,"").trim();b.titulo="Capítulo "+roman(cap)+(b.titulo?" — "+b.titulo:"")}
if(b.tipo==="articulo"){art++;b.titulo=b.titulo.replace(/^(?:art[ií]culo|art\.)\s*\d+\s*[º°.]?\s*[.·:—-]?\s*/i,"").trim();b.titulo="Artículo "+art+(b.titulo?" — "+b.titulo:"")}
}
}
function sync(){document.querySelectorAll(".bloque").forEach(el=>{const i=Number(el.dataset.i);if(!bloques[i])return;bloques[i].tipo=el.querySelector(".bTipo").value;bloques[i].titulo=el.querySelector(".bTitulo").value;bloques[i].contenido=el.querySelector(".bContenido").value})}
function set(v){bloques=(v||[]).map(x=>({...x}));render()}
function get(){sync();return bloques.map((x,i)=>({...x,orden:i+1,padre_id:undefined,id:undefined,version_id:undefined}))}
function insertar(tipo,indice){sync();bloques.splice(indice,0,nuevo(tipo));renumerar();render()}
function mover(i,d){sync();const j=i+d;if(j<0||j>=bloques.length)return;[bloques[i],bloques[j]]=[bloques[j],bloques[i]];renumerar();render()}
function render(){
$("bloques").innerHTML=bloques.map((b,i)=>'<div class="card bloque" data-i="'+i+'"><div class="row"><select class="bTipo" style="max-width:150px"><option value="capitulo" '+(b.tipo==="capitulo"?"selected":"")+'>Capítulo</option><option value="articulo" '+(b.tipo==="articulo"?"selected":"")+'>Artículo</option><option value="disposicion" '+(b.tipo==="disposicion"?"selected":"")+'>Disposición</option><option value="nota" '+(b.tipo==="nota"?"selected":"")+'>Nota</option></select><div><button class="btn soft up" type="button">↑</button><button class="btn soft down" type="button">↓</button><button class="btn danger del" type="button">Eliminar</button></div></div><label>Título</label><input class="bTitulo" value="'+esc(b.titulo||"")+'"><label>Contenido</label><textarea class="bContenido">'+esc(b.contenido||"")+'</textarea></div>').join("");
const els=[...document.querySelectorAll(".bloque")];
els.forEach((el,i)=>{
el.querySelector(".del").onclick=()=>{sync();bloques.splice(i,1);renumerar();render()};
el.querySelector(".up").onclick=()=>mover(i,-1);
el.querySelector(".down").onclick=()=>mover(i,1);
el.querySelector(".bTipo").onchange=()=>{sync();renumerar();render()};
if(bloques[i].tipo!=="capitulo")return;
const head=document.createElement("div");head.className="chapter-head";
const toggle=document.createElement("button");toggle.type="button";toggle.className="btn soft";toggle.textContent="▾ "+(bloques[i].titulo||"Capítulo");
const add=document.createElement("button");add.type="button";add.className="btn soft";add.textContent="+ Añadir artículo";add.disabled=soloLectura;
head.append(toggle,add);el.prepend(head);
const body=document.createElement("div");body.className="chapter-body";while(head.nextSibling)body.appendChild(head.nextSibling);el.appendChild(body);
add.onclick=()=>{let j=i+1;while(j<bloques.length&&bloques[j].tipo!=="capitulo")j++;insertar("articulo",j)};
toggle.onclick=()=>{const closed=body.hidden;body.hidden=!closed;let j=i+1;while(j<bloques.length&&bloques[j].tipo!=="capitulo"){els[j].hidden=!closed;j++}toggle.textContent=(closed?"▾ ":"▸ ")+(el.querySelector(".bTitulo")?.value||"Capítulo")};
});
if(soloLectura)bloquear(true);
}
function add(tipo){insertar(tipo,bloques.length)}
function bloquear(si){soloLectura=si;document.querySelectorAll("#editor input,#editor textarea,#editor select,#addCap,#addArt,#guardar,#aprobar,.bloque button:not(.chapter-head button)").forEach(x=>x.disabled=si);document.querySelectorAll(".chapter-head button").forEach(x=>{if(x.textContent.includes("Añadir"))x.disabled=si})}
return{set,get,add,bloquear}
}