// Informe de una sola página A4 de una comida con liquidación cerrada.
// La exportación es solo lectura: no cambia ni marca como pagadas las transferencias.
let jsPdfPromise;
function pdfLibrary(){
  if(window.jspdf?.jsPDF)return Promise.resolve(window.jspdf.jsPDF);
  if(!jsPdfPromise)jsPdfPromise=new Promise((resolve,reject)=>{
    const script=document.createElement("script");
    script.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js";
    script.onload=()=>window.jspdf?.jsPDF?resolve(window.jspdf.jsPDF):reject(Error("No se pudo cargar el generador PDF"));
    script.onerror=()=>reject(Error("No se pudo cargar el generador PDF"));
    document.head.appendChild(script);
  }).catch(e=>{jsPdfPromise=null;throw e});
  return jsPdfPromise;
}
const money=n=>Number(n||0).toLocaleString("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2})+" €";
const clean=s=>String(s??"").replace(/\s+/g," ").trim();
const date=s=>/^\d{4}-\d{2}-\d{2}/.test(s||"")?s.slice(8,10)+"/"+s.slice(5,7)+"/"+s.slice(0,4):"Sin fecha";
const safeName=s=>clean(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9 _-]/g,"").replace(/\s+/g," ").trim()||"Restaurante";
async function loadReport(sb,id,cofrades){
  const rpc=(name,args)=>sb.rpc(name,args);
  const results=await Promise.all([
    rpc("detalle_comida_admin",{p_id:id}),
    rpc("resumen_economia_comida_admin",{p_comida:id}),
    rpc("pagos_restaurante_comida_admin",{p_comida:id}),
    rpc("estado_liquidacion_comida_admin",{p_comida:id})
  ]);
  for(const item of results)if(item.error)throw Error("No se pudieron consultar los datos del informe: "+item.error.message);
  const [detalle,economia,pagos,estado]=results.map(x=>x.data||{});
  if(!estado.cerrada)throw Error("Cierra primero la liquidación para generar el resumen definitivo.");
  const comida=detalle.comida||{},restaurante=detalle.restaurante||{};
  const nombres=new Map(cofrades.map(c=>[String(c.id),clean(c.nombre)]));
  const gastos=(economia.gastos||[]).map(g=>({
    concepto:clean(g.concepto)||"Gasto adicional",importe:Number(g.importe||0),
    pagadores:g.pagado_con_remanente?"Bote común":(g.pagos||[]).length?(g.pagos||[]).map(p=>(nombres.get(String(p.cofrade_id))||"Cofrade")+" ("+money(p.importe)+")").join(", "):(nombres.get(String(g.pagador_id))||"Sin pagador registrado")
  }));
  const totalRest=Number(economia.restaurante_total??comida.importe_restaurante_total??0);
  const totalExtras=gastos.reduce((n,g)=>n+g.importe,0);
  return {restaurante,comida,gastos,totalRest,totalExtras,estado,
    asistentes:(detalle.asistencias||[]).filter(a=>a.estado==="si").length,
    pagadoresRest:(pagos||[]).map(p=>(nombres.get(String(p.cofrade_id))||"Cofrade")+" ("+money(p.importe)+")").join(", "),
    bote:Number(economia.bote_aplicado||0)
  };
}
function filename(d){return "Comida "+safeName(d.restaurante.nombre)+" "+date(d.comida.fecha).replaceAll("/","-")+".pdf"}
async function makePdf(data){
  const PDF=await pdfLibrary();
  const doc=new PDF({orientation:"portrait",unit:"mm",format:"a4",compress:true});
  const x=16,right=194,width=178,blocks=[];
  const add=(kind,...args)=>blocks.push({kind,args});
  add("heading","COFRADÍA A MESA PUESTA");
  add("title","Resumen de la comida");
  add("text",clean(data.restaurante.nombre)||"Restaurante sin nombre");
  add("text","Fecha: "+date(data.comida.fecha)+"   |   Asistentes: "+data.asistentes);
  if(clean(data.restaurante.direccion))add("text","Dirección: "+clean(data.restaurante.direccion));
  if(clean(data.restaurante.telefono))add("text","Teléfono: "+clean(data.restaurante.telefono));
  add("section","MENÚ");
  const menus=[["Entrantes",data.comida.menu_entrantes],["Principales",data.comida.menu_principales],["Postres",data.comida.menu_postres],["Bebidas",data.comida.menu_bebidas]];
  let hasMenu=false;
  for(const [label,value] of menus)if(clean(value)){hasMenu=true;add("text",label+": "+clean(value))}
  if(!hasMenu)add("text","Menú no registrado.");
  add("section","GASTOS DE LA COMIDA");
  add("item","Restaurante",money(data.totalRest));
  if(data.pagadoresRest)add("small","Adelantado por: "+data.pagadoresRest);
  for(const g of data.gastos){add("item",g.concepto,money(g.importe));add("small","Pagado por: "+g.pagadores)}
  add("total","TOTAL GASTOS",money(data.totalRest+data.totalExtras));
  add("item","Bote común previsto para restaurante",money(data.bote));
  add("section","PAGOS ACORDADOS AL CIERRE");
  const moves=[...(data.estado.movimientos||[]).map(m=>[m.de+" a "+m.a,m.importe]),
    ...(data.estado.bote||[]).map(m=>["Bote común a "+m.a,m.importe]),
    ...(data.estado.invitados||[]).map(m=>[m.de+" (invitado) → "+m.a,m.importe])];
  if(!moves.length)add("text","No hay transferencias que realizar.");
  for(const [who,amount] of moves)add("item",who,money(amount));
  add("footer","Resumen informativo al cierre. El seguimiento de los pagos se realiza en Administración.");
  const plans=blocks.map(b=>{
    const [a,value]=b.args;
    let fs=9.5,space=1.3,after=0;
    if(b.kind==="heading"){fs=9;after=2.5}
    if(b.kind==="title"){fs=18;after=3}
    if(b.kind==="section"){fs=11;after=2}
    if(b.kind==="small"){fs=8;after=1}
    if(b.kind==="total"){fs=10;after=2}
    if(b.kind==="footer"){fs=7.5;after=0}
    doc.setFont("helvetica",["heading","section","total","title"].includes(b.kind)?"bold":"normal");
    doc.setFontSize(fs);
    // Se reserva la última columna para importes sin cortar el texto.
    const textWidth=["item","total"].includes(b.kind)?139:width;
    const lines=doc.splitTextToSize(String(a),textWidth);
    const lh=fs*.40+space;
    return {...b,fs,lines,lh,height:lines.length*lh+after+(b.kind==="section"?2.5:0)};
  });
  const totalHeight=plans.reduce((sum,p)=>sum+p.height,0);
  const scale=Math.min(1,258/totalHeight);
  if(scale<.68)throw Error("Este resumen contiene demasiado texto para una hoja A4 legible. Acorta las descripciones de gastos o menú.");
  let y=17;
  for(const p of plans){
    const [a,value]=p.args;
    if(p.kind==="section"){
      doc.setDrawColor(200,185,172);doc.line(x,y+1,right,y+1);y+=3*scale;
    }
    doc.setFont("helvetica",["heading","section","total","title"].includes(p.kind)?"bold":"normal");
    doc.setFontSize(p.fs*scale);
    doc.setTextColor(p.kind==="heading"||p.kind==="section"||p.kind==="total"?91:43, p.kind==="heading"||p.kind==="section"||p.kind==="total"?25:40,p.kind==="heading"||p.kind==="section"||p.kind==="total"?35:39);
    for(let i=0;i<p.lines.length;i++){
      const ty=y+(i+1)*p.lh*scale;
      doc.text(p.lines[i],x,ty);
    }
    if(["item","total"].includes(p.kind))doc.text(String(value),right,y+p.lh*scale,{align:"right"});
    y+=(p.lines.length*p.lh+(p.height-p.lines.length*p.lh-(p.kind==="section"?2.5:0)))*scale;
    if(p.kind==="section")y+=0; // espacio de sección ya consumido en el separador
  }
  return doc.output("blob");
}
function save(blob,name){
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}
const cache=new Map();
export function invalidarLiquidacionPdf(id){cache.delete(String(id))}
export async function prepararLiquidacionPdf({sb,id,cofrades}){
  const key=String(id);
  if(cache.has(key))return cache.get(key);
  const data=await loadReport(sb,id,cofrades);
  const blob=await makePdf(data),name=filename(data),file=new File([blob],name,{type:"application/pdf"});
  const prepared={blob,name,file,data};
  cache.set(key,prepared);
  return prepared;
}
export async function exportarLiquidacionPdf({sb,id,cofrades,compartir=false}){
  // Con el PDF precargado, navigator.share se inicia directamente desde el toque del usuario.
  const ready=cache.get(String(id));
  if(ready){
    if(compartir&&navigator.canShare?.({files:[ready.file]})&&navigator.share){
      try{await navigator.share({files:[ready.file],title:"Comida "+clean(ready.data.restaurante.nombre)})}
      catch(e){if(e.name!=="AbortError")throw e}
      return;
    }
    save(ready.blob,ready.name);
    if(compartir)alert("PDF descargado. Para enviarlo por WhatsApp, adjunta el archivo desde la conversación o el grupo.");
    return;
  }
  await prepararLiquidacionPdf({sb,id,cofrades});
  if(compartir){
    alert("El PDF ya está preparado. Pulsa Compartir por WhatsApp de nuevo para elegir el grupo.");
    return;
  }
  const done=cache.get(String(id));
  save(done.blob,done.name);
}
