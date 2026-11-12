// Tarjetas de anuncios para compartir. No realiza cambios en la base de datos.
const LOGO_URL = new URL("../../Fotos/logo-cangrejo.png", import.meta.url).href;
const ANCHO = 1080;
const NOMBRES = {General:"📣 GENERAL",Comida:"🍽️ COMIDA",Reunión:"👥 REUNIÓN",Tesorería:"💶 TESORERÍA",Urgente:"🚨 URGENTE",Recordatorio:"⏰ RECORDATORIO"};
let vistaActual=null;

function rectRedondeado(ctx,x,y,w,h,r) {
  const q=Math.min(r,w/2,h/2);
  ctx.beginPath();ctx.moveTo(x+q,y);ctx.arcTo(x+w,y,x+w,y+h,q);
  ctx.arcTo(x+w,y+h,x,y+h,q);ctx.arcTo(x,y+h,x,y,q);
  ctx.arcTo(x,y,x+w,y,q);ctx.closePath();
}

function saltosDeLinea(ctx,valor,ancho) {
  const lineas=[];
  for (const parrafo of String(valor??"").replace(/\r/g,"").split("\n")) {
    if (!parrafo.trim()) {lineas.push("");continue;}
    let actual="";
    for (const palabra of parrafo.trim().split(/\s+/)) {
      const candidata=actual?actual+" "+palabra:palabra;
      if (ctx.measureText(candidata).width<=ancho) {actual=candidata;continue;}
      if (actual) {lineas.push(actual);actual="";}
      if (ctx.measureText(palabra).width<=ancho) {actual=palabra;continue;}
      // También partir palabras o enlaces muy largos para que nunca se salgan.
      for (const caracter of Array.from(palabra)) {
        if (actual&&ctx.measureText(actual+caracter).width>ancho) {lineas.push(actual);actual="";}
        actual+=caracter;
      }
    }
    if (actual)lineas.push(actual);
  }
  return lineas;
}

function fechaLegible(valor) {
  const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(valor||""));
  return m?m[3]+"/"+m[2]+"/"+m[1]:"";
}

function nombreArchivo(valor) {
  const slug=String(valor||"anuncio").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,55);
  return "a-mesa-puesta-"+(slug||"anuncio")+".png";
}

function cargarImagen(url) {
  return new Promise((resolve,reject)=>{
    const imagen=new Image();
    imagen.onload=()=>resolve(imagen);
    imagen.onerror=()=>reject(new Error("Imagen no disponible"));
    imagen.src=url;
  });
}

export async function crearTarjetaAnuncio(anuncio) {
  const canvas=document.createElement("canvas");
  canvas.width=ANCHO;
  const ctx=canvas.getContext("2d");
  if (!ctx) throw new Error("El navegador no puede generar imágenes.");

  const cuerpo=String(anuncio.texto||"").replace(/\r/g,"").trim();
  const titulo=String(anuncio.titulo||"Anuncio de la Cofradía").trim();
  ctx.font="700 65px Georgia,serif";
  const titulos=saltosDeLinea(ctx,titulo,850);
  ctx.font="36px Arial,sans-serif";
  const lineas=saltosDeLinea(ctx,cuerpo,850);
  const fecha=fechaLegible(anuncio.fecha_publicacion||anuncio.fecha);
  const hora=String(anuncio.hora_publicacion||"").slice(0,5);
  const autor=String(anuncio.autor||"").trim();
  const evento=fechaLegible(anuncio.fecha_evento);
  const alturaMeta=evento?45:0;
  const tituloInicio=345;
  const bajoTitulo=tituloInicio+titulos.length*82;
  const separadorY=bajoTitulo+105+alturaMeta;
  const textoInicio=separadorY+72;
  const altoTexto=Math.max(120,lineas.length*54);
  const alto=Math.max(940,textoInicio+altoTexto+150);

  // Mantener un tamaño adecuado para la memoria gráfica de Safari en iPhone.
  if (alto>7600) throw new Error("Este anuncio es demasiado largo para una sola imagen. Divide el contenido antes de generar la tarjeta.");
  canvas.height=alto;
  const papel=ctx.createLinearGradient(0,0,ANCHO,alto);
  papel.addColorStop(0,"#faf6ef");papel.addColorStop(1,"#f0e9e0");
  ctx.fillStyle=papel;ctx.fillRect(0,0,ANCHO,alto);
  ctx.save();
  rectRedondeado(ctx,44,34,992,alto-68,36);
  ctx.fillStyle="#fffdf9";ctx.fill();
  ctx.strokeStyle="#dbcbbd";ctx.lineWidth=3;ctx.stroke();
  ctx.restore();

  // Marca de la Cofradía.
  ctx.save();ctx.beginPath();ctx.arc(149,134,56,0,Math.PI*2);ctx.clip();
  ctx.fillStyle="#ffffff";ctx.fillRect(93,78,112,112);
  try {const logo=await cargarImagen(LOGO_URL);ctx.drawImage(logo,93,78,112,112);}
  catch (_) {ctx.textAlign="center";ctx.font="66px sans-serif";ctx.fillText("🦀",149,159);ctx.textAlign="left";}
  ctx.restore();
  ctx.fillStyle="#28221f";
  ctx.font="bold 59px Georgia,serif";
  ctx.fillText("A Mesa Puesta",229,137);
  ctx.fillStyle="#942d35";
  ctx.font="bold 22px Arial,sans-serif";
  ctx.fillText("LA COFRADÍA · TABLÓN DE ANUNCIOS",232,176);
  ctx.strokeStyle="#e8dcd0";ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(100,223);ctx.lineTo(981,223);ctx.stroke();

  // Categoría y título completos.
  const tipo=NOMBRES[anuncio.tipo]||"📌 "+String(anuncio.tipo||"GENERAL").toUpperCase();
  ctx.font="bold 25px Arial,sans-serif";
  const chipAncho=Math.min(770,ctx.measureText(tipo).width+49);
  rectRedondeado(ctx,103,258,chipAncho,48,21);
  ctx.fillStyle="#f1e6df";ctx.fill();
  ctx.fillStyle="#85272f";ctx.fillText(tipo,126,291);
  if (anuncio.destacado) {
    ctx.textAlign="right";ctx.fillStyle="#9a4550";
    ctx.font="bold 23px Arial,sans-serif";ctx.fillText("★ DESTACADO",973,290);
    ctx.textAlign="left";
  }

  ctx.font="bold 65px Georgia,serif";ctx.fillStyle="#28221f";
  let yy=tituloInicio+8;
  for (const linea of titulos) {ctx.fillText(linea,105,yy);yy+=82;}

  // Publicación, autor y fecha del evento.
  ctx.font="27px Arial,sans-serif";ctx.fillStyle="#73665e";
  const publicado=fecha?"Publicado: "+fecha+(hora&&hora!=="00:00"?" · "+hora:""):"Anuncio de la Cofradía";
  ctx.fillText(publicado,105,bajoTitulo+28);
  if (autor) {
    ctx.font="25px Arial,sans-serif";
    const autores=saltosDeLinea(ctx,"Por "+autor,850);
    ctx.fillText(autores[0]||"",105,bajoTitulo+67);
  }
  if (evento) {
    ctx.fillStyle="#8c3038";ctx.font="bold 26px Arial,sans-serif";
    ctx.fillText("Fecha del evento: "+evento,105,bajoTitulo+101);
  }
  ctx.strokeStyle="#e6d9ce";ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(104,separadorY);ctx.lineTo(976,separadorY);ctx.stroke();

  // Respetar los saltos de párrafo y no cortar el texto del anuncio.
  ctx.font="36px Arial,sans-serif";ctx.fillStyle="#403832";
  let y=textoInicio;
  for (const linea of lineas) {if (linea) ctx.fillText(linea,105,y);y+=54;}
  ctx.strokeStyle="#e6d9ce";
  ctx.beginPath();ctx.moveTo(104,alto-112);ctx.lineTo(976,alto-112);ctx.stroke();
  ctx.font="bold 23px Arial,sans-serif";ctx.fillStyle="#9a3039";
  ctx.fillText("COFRADÍA A MESA PUESTA",104,alto-68);
  ctx.font="23px Arial,sans-serif";ctx.textAlign="right";ctx.fillStyle="#746a62";
  ctx.fillText("Tablón de anuncios",974,alto-68);ctx.textAlign="left";

  return new Promise((resolve,reject)=>{
    canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("No se pudo crear la imagen.")),"image/png");
  });
}

function descargarArchivo(archivo) {
  const url=URL.createObjectURL(archivo);
  const enlace=document.createElement("a");
  enlace.href=url;enlace.download=archivo.name;
  document.body.appendChild(enlace);enlace.click();enlace.remove();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
}

export async function abrirTarjetaAnuncio(anuncio) {
  const dialogo=document.getElementById("tarjetaAnuncioDialogo");
  if (!dialogo) throw new Error("No está disponible la vista previa de la tarjeta.");
  const blob=await crearTarjetaAnuncio(anuncio);
  if (vistaActual?.url)URL.revokeObjectURL(vistaActual.url);
  const archivo=new File([blob],nombreArchivo(anuncio.titulo),{type:"image/png"});
  const url=URL.createObjectURL(blob);
  vistaActual={archivo,url};
  document.getElementById("tarjetaAnuncioVista").src=url;
  document.getElementById("tarjetaAnuncioEstado").textContent="";
  dialogo.showModal();
}

export function configurarCompartirTarjeta() {
  const dialogo=document.getElementById("tarjetaAnuncioDialogo");
  const compartir=document.getElementById("tarjetaAnuncioCompartir");
  const guardar=document.getElementById("tarjetaAnuncioGuardar");
  const cerrar=document.getElementById("tarjetaAnuncioCerrar");
  const estado=document.getElementById("tarjetaAnuncioEstado");

  cerrar.addEventListener("click",()=>dialogo.close());
  dialogo.addEventListener("click",event=>{if(event.target===dialogo)dialogo.close();});
  dialogo.addEventListener("close",()=>{
    document.getElementById("tarjetaAnuncioVista").removeAttribute("src");
    if (vistaActual?.url)URL.revokeObjectURL(vistaActual.url);
    vistaActual=null;
  });

  compartir.addEventListener("click",()=>{
    const archivo=vistaActual?.archivo;if (!archivo)return;
    const puedeCompartir=typeof navigator.share==="function" &&
      (typeof navigator.canShare!=="function"||navigator.canShare({files:[archivo]}));
    if (!puedeCompartir) {
      descargarArchivo(archivo);
      estado.textContent="Imagen descargada. Puedes enviarla por WhatsApp desde tus archivos.";
      return;
    }
    // El archivo ya está preparado: mantener la activación de usuario para Safari/iOS.
    navigator.share({files:[archivo]})
      .then(()=>{estado.textContent="";})
      .catch(error=>{if(error?.name!=="AbortError")estado.textContent="No se pudo compartir. Utiliza Guardar PNG.";});
  });

  guardar.addEventListener("click",()=>{
    if (!vistaActual?.archivo)return;
    descargarArchivo(vistaActual.archivo);
    estado.textContent="Imagen descargada para compartirla donde quieras.";
  });
}
