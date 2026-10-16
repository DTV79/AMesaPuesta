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
  const colors={wine:[92,28,40],wine2:[129,57,66],cream:[250,246,239],sand:[237,226,213],ink:[39,34,32],gray:[103,96,89],gold:[255,211,119],white:[255,255,255],green:[52,108,81],logoBg:[255,253,251],restaurant:[255,240,214],rose:[255,228,236],vanilla:[255,241,192],sage:[218,246,225],bluegray:[220,240,255],mint:[218,248,243],coral:[255,231,207]};
  const L=14,R=196,W=182;
  const separarPlatos=value=>{
    const original=String(value??"").trim();
    if(!original)return ["No especificado"];
    const parts=original.split(/\r?\n|\s*;\s*|\s*•\s*|\s*·\s*/).map(x=>x.replace(/^[-•·.\s]+/,"").trim()).filter(Boolean);
    return parts.length?parts:[original];
  };
  const menus=[["ENTRANTES",data.comida.menu_entrantes],["PRINCIPALES",data.comida.menu_principales],["POSTRES",data.comida.menu_postres],["BEBIDAS",data.comida.menu_bebidas]].map(([label,value])=>({label,platos:separarPlatos(value)}));
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
    // Cabecera: marca, nombre del restaurante destacado y fecha en la esquina inferior derecha.
    rect(L,y,W,37,"wine",4);
    if(logo){rect(L+4,y+4,28,28,"logoBg",4);if(visible)try{doc.addImage(logo,"PNG",L+6*scale,13+(y+6-13)*scale,24*scale,24*scale)}catch(e){console.warn("Logo PDF",e)}}
    const hx=logo?L+37:L+7;
    text("COFRADÍA A MESA PUESTA",hx,y+10,10.5,"white","bold");
    doc.setFont("helvetica","bold");doc.setFontSize(17*scale);
    const nombre=clean(data.restaurante.nombre)||"Restaurante";
    const nombreFilas=doc.splitTextToSize(nombre,(W-(hx-L)-9)*scale).slice(0,2);
    nombreFilas.forEach((t,i)=>text(t,hx,y+21+i*6.7,17,"gold","bold"));
    text(date(data.comida.fecha),R-6,y+33.4,8.5,"white","bold",{align:"right"});
    y+=41;
    // Datos del establecimiento sin repetir la fecha.
    section("DATOS DEL RESTAURANTE");
    rect(L,y,W,19,"restaurant",3);
    const direccion=clean(data.restaurante.direccion);
    const matchDireccion=/^(.*),\s*(\d{5})\s+([^,]+),\s*([^,]+)$/.exec(direccion);
    const direccionLinea1=matchDireccion?matchDireccion[1].trim():direccion||"Dirección no registrada";
    const direccionLinea2=matchDireccion?matchDireccion[2]+" "+matchDireccion[3].trim()+" ("+matchDireccion[4].trim()+")":"";
    wrapped(direccionLinea1,L+5,y+7,127,8.5,"ink","normal",3.8,2);
    if(direccionLinea2)wrapped(direccionLinea2,L+5,y+13,127,8.5,"ink","normal",3.8,2);
    text("TEL. "+(clean(data.restaurante.telefono)||"—"),R-5,y+10,8,"wine","bold",{align:"right"});
    y+=23;
    section("COMENSALES");
    function listaPersonas(names,yy){
      const list=names.length?names:["No consta"];
      doc.setFont("helvetica","normal");doc.setFontSize(8.2*scale);
      const ancho=(W-18)/2, paso=4.4;
      // Una persona por celda; dos personas por fila.
      for(let i=0;i<list.length;i++){
        const col=i%2,row=Math.floor(i/2);
        const x=L+5+col*(ancho+4);
        const t=doc.splitTextToSize("• "+clean(list[i]),ancho*scale)[0]||"•";
        text(t,x,yy+row*paso,8.2,"ink");
      }
      return Math.ceil(list.length/2)*paso;
    }
    const orgCount=Math.max(1,data.organizadoresLista.length);
    const asisCount=Math.max(1,data.asistentesLista.length);
    const peopleHeight=12+Math.ceil(orgCount/2)*4.4+9+Math.ceil(asisCount/2)*4.4+4;
    rect(L,y,W,peopleHeight,"mint",3);
    text("ORGANIZADORES",L+5,y+6,8.3,"wine","bold");
    let yy=y+11;
    yy+=listaPersonas(data.organizadoresLista,yy);
    line(L+5,yy,R-5,"sand");
    text("ASISTENTES ("+data.asistentesLista.length+")",L+5,yy+5,8.3,"wine","bold");
    yy+=10;listaPersonas(data.asistentesLista,yy);
    y+=peopleHeight+3;
    section("EL MENÚ");
    const gap=3,cardWidth=(W-gap)/2,cardHeights=[];
    function platoAltura(menu){
      doc.setFont("helvetica","normal");doc.setFontSize(8*scale);
      return menu.platos.reduce((height,plato)=>height+Math.max(1,doc.splitTextToSize("• "+plato,(cardWidth-12)*scale).length)*3.9+1.3,0);
    }
    for(const menu of menus)cardHeights.push(11+platoAltura(menu)+3);
    for(let row=0;row<2;row++){
      const height=Math.max(cardHeights[row*2],cardHeights[row*2+1]);
      for(let col=0;col<2;col++){
        const m=menus[row*2+col],x=L+col*(cardWidth+gap);
        rect(x,y,cardWidth,height,["vanilla","coral","rose","restaurant"][row*2+col],2.5);
        text(m.label,x+5,y+6,8.5,"wine","bold");
        let py=y+12;
        for(const plato of m.platos)py+=wrapped("• "+plato,x+5,py,cardWidth-10,8,"ink","normal",3.9)+1.3;
      }
      y+=height+gap;
    }
    section("RESUMEN ECONÓMICO");
    rect(L,y,W,15,"wine",3);
    text("GASTO TOTAL DE LA COMIDA",L+5,y+9,10,"white","bold");
    text(money(data.totalRest+data.totalExtras),R-5,y+9.5,13,"white","bold",{align:"right"});
    y+=20;
    function cost(name,amount,note){
      const concepto=clean(name),importe=money(amount),observacion=clean(note);
      doc.setFont("helvetica","normal");doc.setFontSize(8.8*scale);
      const titleLines=doc.splitTextToSize(concepto,127*scale).length;
      doc.setFontSize(7.4*scale);
      const noteLines=observacion?doc.splitTextToSize(observacion,160*scale).length:0;
      const titleHeight=Math.max(5,titleLines*4);
      const noteHeight=noteLines?3+noteLines*4.1:0;
      const rowHeight=10+titleHeight+noteHeight+2;
      rect(L,y,W,rowHeight,"sage",2);
      const baseline=y+7;
      wrapped(concepto,L+4,baseline,127,8.8,"ink","normal",4);
      text(importe,R-4,baseline,9.5,"wine","bold",{align:"right"});
      // Guía punteada tipo cuenta de restaurante; únicamente cuando cabe en una línea.
      if(visible&&titleLines===1){
        doc.setFont("helvetica","normal");doc.setFontSize(8.8*scale);
        const desde=L+4+doc.getTextWidth(concepto)/scale+3;
        doc.setFont("helvetica","bold");doc.setFontSize(9.5*scale);
        const hasta=R-4-doc.getTextWidth(importe)/scale-3;
        if(hasta-desde>12){
          doc.setDrawColor(174,190,176);
          doc.setLineWidth(.24*scale);
          doc.setLineDashPattern([.55*scale,1.7*scale],0);
          doc.line(L+(desde-L)*scale,13+(baseline-13+0.7)*scale,L+(hasta-L)*scale,13+(baseline-13+0.7)*scale);
          doc.setLineDashPattern([],0);
        }
      }
      if(noteLines)wrapped(observacion,L+4,baseline+titleHeight+1,160,7.6,"gray","normal",4.1);
      y+=rowHeight+2;
    }
    cost("Restaurante",data.totalRest,data.pagadoresRest?"Adelantado por: "+data.pagadoresRest:"");
    for(const g of data.gastos)cost(g.concepto,g.importe,"Pagado por: "+g.pagadores);
    rect(L,y,W,11,"sage",2);
    text("Aportación del bote a la comida",L+4,y+7.2,8.7,"ink","bold");
    text(money(data.bote),R-4,y+7.2,9,"wine","bold",{align:"right"});
    y+=14;
    section("PAGOS A REALIZAR");
    if(!transfers.length){
      rect(L,y,W,11,"bluegray",2);
      text("No hay transferencias entre cofrades.",L+5,y+7,8.5,"green","bold");y+=14;
    }else{
      for(const m of transfers){
        doc.setFontSize(8.6*scale);
        const rows=doc.splitTextToSize(m.who,138*scale);
        const height=Math.max(9,rows.length*4+3);
        rect(L,y,W,height,"bluegray",2);
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
