// Informe de una sola página A4 de una comida con liquidación cerrada.
// La exportación es solo lectura: no cambia ni marca como pagadas las transferencias.
let jsPdfPromise;
function pdfLibrary(){
  if(window.jspdf?.jsPDF)return Promise.resolve(window.jspdf.jsPDF);
  if(!jsPdfPromise)jsPdfPromise=new Promise((resolve,reject)=>{
    const script=document.createElement("script");
    script.src="../js/vendor/jspdf.umd.min.js";
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
  const asistentesLista=(detalle.asistencias||[]).filter(a=>a.estado==="si").map(a=>clean(a.nombre||nombres.get(String(a.cofrade_id)))).filter(Boolean);
  const organizadoresLista=(detalle.organizadores||[]).map(id=>nombres.get(String(id))||"").filter(Boolean);
  const gastos=(economia.gastos||[]).map(g=>({
    concepto:clean(g.concepto)||"Gasto adicional",importe:Number(g.importe||0),
    pagadores:g.pagado_con_remanente?"Bote común":(g.pagos||[]).length?(g.pagos||[]).map(p=>(nombres.get(String(p.cofrade_id))||"Cofrade")+" ("+money(p.importe)+")").join(", "):(nombres.get(String(g.pagador_id))||"Sin pagador registrado")
  }));
  const totalRest=Number(economia.restaurante_total??comida.importe_restaurante_total??0);
  const totalExtras=gastos.reduce((n,g)=>n+g.importe,0);
  return {restaurante,comida,gastos,totalRest,totalExtras,estado,asistentesLista,organizadoresLista,
    asistentes:(detalle.asistencias||[]).filter(a=>a.estado==="si").length,
    pagadoresRest:(pagos||[]).map(p=>(nombres.get(String(p.cofrade_id))||"Cofrade")+" ("+money(p.importe)+")").join(", "),
    bote:Number(economia.bote_aplicado||0)
  };
}
function filename(d){return "Comida "+safeName(d.restaurante.nombre)+" "+date(d.comida.fecha).replaceAll("/","-")+".pdf"}

async function cargarLogo(){
  try{
    const image=new Image();image.crossOrigin="anonymous";
    image.src="https://raw.githubusercontent.com/DTV79/AMesaPuesta/main/docs/Fotos/logo-cangrejo.png";
    await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject});
    const c=document.createElement("canvas");c.width=image.naturalWidth;c.height=image.naturalHeight;
    c.getContext("2d").drawImage(image,0,0);
    return c.toDataURL("image/png");
  }catch(e){console.warn("Logotipo no disponible para el PDF",e);return null}
}
async function makePdf(data){
  const PDF=await pdfLibrary();
  const logo=await cargarLogo();
  const doc=new PDF({orientation:"portrait",unit:"mm",format:"a4",compress:true});
  const colors={wine:[92,28,40],wine2:[129,57,66],cream:[250,246,239],sand:[237,226,213],ink:[39,34,32],gray:[103,96,89],gold:[181,138,74],white:[255,255,255],green:[52,108,81]};
  const L=14,R=196,W=182;
  const menus=[["ENTRANTES",data.comida.menu_entrantes],["PRINCIPALES",data.comida.menu_principales],["POSTRES",data.comida.menu_postres],["BEBIDAS",data.comida.menu_bebidas]].map(([label,value])=>({label,value:clean(value)||"No especificado"}));
  const transfers=[
    ...(data.estado.movimientos||[]).map(m=>({who:clean(m.de)+"  a  "+clean(m.a),amount:Number(m.importe)})),
    ...(data.estado.bote||[]).map(m=>({who:"Bote común  a  "+clean(m.a),amount:Number(m.importe)})),
    ...(data.estado.invitados||[]).map(m=>({who:clean(m.de)+" (invitado)  a  "+clean(m.a),amount:Number(m.importe)}))
  ];
  function drawing(scale,visible){
    let y=13;
    function fill(key){if(visible)doc.setFillColor(...colors[key])}
    function stroke(key){if(visible)doc.setDrawColor(...colors[key])}
    function rect(x,yy,w,h,color,rad=3){
      if(!visible)return;
      fill(color);doc.roundedRect(L+(x-L)*scale,13+(yy-13)*scale,w*scale,h*scale,rad*scale,rad*scale,"F")
    }
    function line(x1,yy,x2,color="sand"){
      if(!visible)return;
      stroke(color);doc.setLineWidth(.25*scale);doc.line(L+(x1-L)*scale,13+(yy-13)*scale,L+(x2-L)*scale,13+(yy-13)*scale)
    }
    function text(t,x,yy,size=9,color="ink",weight="normal",options={}){
      const val=clean(t);if(!val)return;
      if(visible){
        doc.setFont("helvetica",weight);doc.setFontSize(size*scale);doc.setTextColor(...colors[color]);
        doc.text(val,L+(x-L)*scale,13+(yy-13)*scale,options);
      }
    }
    function wrapped(t,x,yy,width,size=8,color="ink",weight="normal",lineHeight=4.2,maxLines=0){
      doc.setFont("helvetica",weight);doc.setFontSize(size*scale);
      const raw=doc.splitTextToSize(clean(t)||"—",width*scale);
      const rows=maxLines?raw.slice(0,maxLines):raw;
      if(maxLines&&raw.length>maxLines)rows[rows.length-1]=rows[rows.length-1].replace(/.{0,3}$/,"...");
      rows.forEach((r,i)=>text(r,x,yy+i*lineHeight,size,color,weight));
      return rows.length*lineHeight;
    }
    function section(label){y+=3;text(label,L+2,y+4.7,10,"wine","bold");y+=9}
    // Cabecera vino oscuro y sello de la cofradía
    rect(L,y,W,34,"wine",4);
    if(visible&&logo)try{doc.addImage(logo,"PNG", (L+5)*scale+L*(1-scale),13+(y-13+4)*scale,26*scale,26*scale)}catch(e){console.warn("Logo PDF",e)}
    const hx=logo?L+37:L+8;
    text("COFRADÍA A MESA PUESTA",hx,y+10,11,"white","bold");
    text("RESUMEN DE NUESTRA COMIDA",hx,y+17,8,"white","normal");
    text(clean(data.restaurante.nombre)||"Restaurante",hx,y+27,15,"white","bold");
    y+=40;
    rect(L,y,W,20,"cream",3);
    text(date(data.comida.fecha),L+5,y+7.5,10,"wine","bold");
    wrapped(clean(data.restaurante.direccion)||"Dirección no registrada",L+5,y+13,122,8,"gray","normal",3.4,2);
    text("TEL. "+(clean(data.restaurante.telefono)||"—"),R-5,y+7.5,8,"ink","bold",{align:"right"});
    text(String(data.asistentesLista.length)+" ASISTENTES",R-5,y+14,8,"wine","bold",{align:"right"});
    y+=24;
    section("NUESTRA GENTE");
    const org= data.organizadoresLista.join("  ·  ")||"No consta";
    const who= data.asistentesLista.join("  ·  ")||"No constan asistentes";
    const peopleWidth=W;
    doc.setFontSize(8*scale);
    const orgLines=doc.splitTextToSize(org,(peopleWidth-13)*scale);
    const whoLines=doc.splitTextToSize(who,(peopleWidth-13)*scale);
    const boxHeight=11+orgLines.length*3.5+5+whoLines.length*3.5+5;
    rect(L,y,W,boxHeight,"cream",3);
    text("ORGANIZARON",L+5,y+6,7.6,"wine","bold");
    let pos=y+10;
    pos+=wrapped(org,L+5,pos,peopleWidth-12,8,"ink","normal",3.5);
    text("ASISTIERON",L+5,pos+3,7.6,"wine","bold");
    pos+=7;
    wrapped(who,L+5,pos,peopleWidth-12,8,"ink","normal",3.5);
    y+=boxHeight+2;
    section("EL MENÚ");
    const gap=3,cardWidth=(W-gap)/2,cardHeights=[];
    for(const menu of menus){
      doc.setFont("helvetica","normal");doc.setFontSize(8*scale);
      const n=doc.splitTextToSize(menu.value,(cardWidth-12)*scale).length;
      cardHeights.push(11+n*3.7+3);
    }
    for(let row=0;row<2;row++){
      const height=Math.max(cardHeights[row*2],cardHeights[row*2+1]);
      for(let col=0;col<2;col++){
        const m=menus[row*2+col],x=L+col*(cardWidth+gap);
        rect(x,y,cardWidth,height,"cream",2.5);
        text(m.label,x+5,y+6,8,"wine","bold");
        wrapped(m.value,x+5,y+11,cardWidth-10,8,"ink","normal",3.7);
      }
      y+=height+gap;
    }
    section("RESUMEN ECONÓMICO");
    rect(L,y,W,15,"wine",3);
    text("GASTO TOTAL DE LA COMIDA",L+5,y+9,10,"white","bold");
    text(money(data.totalRest+data.totalExtras),R-5,y+9.5,13,"white","bold",{align:"right"});
    y+=20;
    function cost(name,amount,note){
      const nameHeight=wrapped(name,L+3,y+4,127,8.8,"ink","normal",3.7);
      text(money(amount),R-3,y+4,9.5,"wine","bold",{align:"right"});
      y+=Math.max(6,nameHeight+1);
      if(clean(note))y+=wrapped(note,L+3,y,160,7.4,"gray","normal",3.2);
      line(L+2,y+1,R-2);y+=4;
    }
    cost("Restaurante",data.totalRest,data.pagadoresRest?"Adelantado por: "+data.pagadoresRest:"");
    for(const g of data.gastos)cost(g.concepto,g.importe,"Pagado por: "+g.pagadores);
    rect(L,y,W,11,"cream",2);
    text("Aportación del bote a la comida",L+4,y+7.2,8.7,"ink","bold");
    text(money(data.bote),R-4,y+7.2,9,"wine","bold",{align:"right"});
    y+=14;
    section("PAGOS A REALIZAR");
    if(!transfers.length){
      rect(L,y,W,11,"cream",2);
      text("No hay transferencias entre cofrades.",L+5,y+7,8.5,"green","bold");y+=14;
    }else{
      for(const m of transfers){
        doc.setFontSize(8.6*scale);
        const rows=doc.splitTextToSize(m.who,138*scale);
        const height=Math.max(9,rows.length*4+3);
        rect(L,y,W,height,"cream",2);
        wrapped(m.who,L+5,y+5,135,8.5,"ink","normal",4);
        text(money(m.amount),R-5,y+5,9.5,"wine","bold",{align:"right"});
        y+=height+2;
      }
    }
    y+=4;
    line(L,y,R,"gold");y+=4;
    text("Cofradía A Mesa Puesta · Recuerdo de nuestra comida",L+2,y,7,"gray");
    return y+4;
  }
  const total=drawing(1,false);
  const scale=Math.min(1,(280-13)/(total-13));
  if(scale<.7)throw Error("El contenido de esta comida es demasiado extenso para una sola hoja A4 legible. Abrevia el menú o las descripciones.");
  drawing(scale,true);
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
    if(compartir)window.dispatchEvent(new CustomEvent("amp-informe-aviso",{detail:{title:"PDF descargado",message:"Para compartirlo por WhatsApp, adjunta el archivo desde el grupo de la cofradía."}}));
    return;
  }
  await prepararLiquidacionPdf({sb,id,cofrades});
  if(compartir){
    window.dispatchEvent(new CustomEvent("amp-informe-aviso",{detail:{title:"PDF preparado",message:"Pulsa otra vez «Compartir por WhatsApp» para elegir el grupo de la cofradía."}}));
    return;
  }
  const done=cache.get(String(id));
  save(done.blob,done.name);
}
