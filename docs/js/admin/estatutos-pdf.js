const BUCKET="estatutos";async function sha256(file){const b=await file.arrayBuffer(),h=await crypto.subtle.digest("SHA-256",b);return Array.from(new Uint8Array(h)).map(x=>x.toString(16).padStart(2,"0")).join("")}function limpio(s){return String(s||"version").replace(/[^a-zA-Z0-9._-]+/g,"-")}export function crearPdfEstatutos({sb,$}){let huella="";function mostrar(ruta,hash){
 const estado=$("pdfEstado");
 $("pdfHuella").textContent=hash?"SHA-256: "+hash:"";
 estado.textContent=ruta?"Preparando enlace privado al PDF…":"Sin PDF asociado";
 if(!ruta)return;
 const presentar=destino=>{
   if($("pdfRuta").value!==ruta)return;
   estado.replaceChildren(document.createTextNode("✓ PDF asociado · "));
   const enlace=document.createElement("a");
   enlace.href=destino;
   enlace.target="_blank";
   enlace.rel="noopener noreferrer";
   enlace.textContent="Ver PDF";
   estado.append(enlace);
 };
 const prefijo="/storage/v1/object/public/estatutos/";
 if(ruta.includes(prefijo)){
   const archivo=decodeURIComponent(ruta.slice(ruta.indexOf(prefijo)+prefijo.length).split("?")[0]);
   sb.storage.from(BUCKET).createSignedUrl(archivo,4*60*60).then(({data,error})=>{
     if(error||!data?.signedUrl)throw Error("No se pudo crear un enlace temporal");
     presentar(data.signedUrl)
   }).catch(()=>{if($("pdfRuta").value===ruta)estado.textContent="PDF asociado. No se pudo abrir; verifica tu sesión de administrador."});
 }else presentar(ruta);
}function set(ruta,hash){$("pdfRuta").value=ruta||"";huella=hash||"";mostrar(ruta,hash)}function get(){return{pdf_ruta:$("pdfRuta").value,pdf_sha256:huella}}async function subir(file,version){if(!file)return null;if(file.type!=="application/pdf"&&!file.name.toLowerCase().endsWith(".pdf"))throw new Error("El documento debe ser un PDF.");if(file.size>15*1024*1024)throw new Error("El PDF supera el límite de 15 MB.");$("pdfEstado").textContent="Calculando huella y subiendo…";const hash=await sha256(file),path="version-"+limpio(version)+"/"+Date.now()+"-"+hash.slice(0,12)+".pdf";const{error}=await sb.storage.from(BUCKET).upload(path,file,{contentType:"application/pdf",upsert:false,cacheControl:"3600"});if(error)throw error;const{data}=sb.storage.from(BUCKET).getPublicUrl(path);set(data.publicUrl,hash);return get()}return{set,get,subir}}