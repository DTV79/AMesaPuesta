// Anuario A4 generado íntegramente en el navegador con datos actuales.
// La función que suministra los datos solo está disponible para administradores.
import {dinero} from './estadisticas-datos.js';

let libreria;
function obtenerJsPdf(){
  if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  if (!libreria) libreria = new Promise((resolve,reject)=>{
    const script = document.createElement('script');
    script.src = '../js/vendor/jspdf.umd.min.js';
    script.onload = () => window.jspdf?.jsPDF ? resolve(window.jspdf.jsPDF) : reject(Error('Generador PDF no disponible'));
    script.onerror = () => reject(Error('No se pudo cargar el generador PDF'));
    document.head.append(script);
  }).catch(error=>{libreria=null;throw error});
  return libreria;
}
async function cargarLogo(){
  try{
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src='../Fotos/logo-cangrejo.png';
    await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject});
    const canvas=document.createElement('canvas');
    canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
    canvas.getContext('2d').drawImage(img,0,0);
    return canvas.toDataURL('image/png');
  }catch{return null;}
}

export async function descargarAnuario(modelo){
  const JsPDF = await obtenerJsPdf();
  const logo = await cargarLogo();
  const pdf = new JsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
  const tonos={vino:[111,29,43],oscuro:[42,35,34],muted:[111,99,94],crema:[249,245,238],oro:[213,164,99],claro:[237,225,215],blanco:[255,255,255],verde:[39,104,72]};
  const texto=(t,x,y,size=10,color='oscuro',peso='normal',opt={})=>{
    pdf.setFont('helvetica',peso);pdf.setFontSize(size);pdf.setTextColor(...tonos[color]);
    pdf.text(String(t??''),x,y,opt);
  };
  const tarjeta=(x,y,w,h,fondo='crema')=>{
    pdf.setFillColor(...tonos[fondo]);pdf.roundedRect(x,y,w,h,3,3,'F');
  };
  const linea=(y)=>{pdf.setDrawColor(...tonos.claro);pdf.setLineWidth(.5);pdf.line(17,y,193,y)};
  const bloque=(titulo,y)=>{
    texto(titulo,18,y,13,'vino','bold');linea(y+4);return y+14;
  };
  const fila=(cols,y,anchos=[80,45,45],h=9)=>{
    let x=19;
    cols.forEach((c,i)=>{
      const ancho=anchos[i]||45;
      pdf.setFont('helvetica','normal');pdf.setFontSize(9);
      const cortado=pdf.splitTextToSize(String(c??'—'),ancho-4);
      texto(cortado[0]||'—',x,y,9);
      x+=ancho;
    });
    linea(y+3);return y+h;
  };
  const nota=(t,y,ancho=174)=>{
    pdf.setFont('helvetica','normal');pdf.setFontSize(9);
    const partes=pdf.splitTextToSize(String(t),ancho);
    partes.forEach((p,i)=>texto(p,18,y+i*5,9,'muted'));
    return y+partes.length*5+4;
  };
  const tituloPagina=(subtitulo,numero)=>{
    pdf.setFillColor(...tonos.vino);pdf.rect(0,0,210,31,'F');
    if(logo)pdf.addImage(logo,'PNG',17,5.5,20,20);
    else{pdf.setFillColor(...tonos.crema);pdf.circle(27,15.5,10,'F');texto('AMP',27,18,9,'vino','bold',{align:'center'});}
    texto('A Mesa Puesta',43,15.5,17,'blanco','bold');
    texto(subtitulo,43,23.4,9,'blanco');
    pdf.setDrawColor(...tonos.oro);pdf.setLineWidth(.7);pdf.line(16,283,194,283);
    texto('Cofradía A Mesa Puesta · Anuario de uso interno',17,289,8,'muted');
    texto(`${numero} / 5`,193,289,8,'muted','normal',{align:'right'});
  };
  const periodo=modelo.periodo==='todos'?'Histórico completo':`Año ${modelo.periodo}`;

  // Portada y principales hitos.
  tituloPagina(`Anuario estadístico · ${periodo}`,1);
  texto('La Cofradía en cifras',18,48,23,'vino','bold');
  texto('Amigos, comidas y alguna buena sobremesa.',18,56,11,'muted');
  const indicadores=[
    ['COMIDAS',String(modelo.comidasTotales)],
    ['ASISTENCIAS',String(modelo.asistentesTotal)],
    ['MEDIA POR COMIDA',modelo.mediaAsistencia.toLocaleString('es-ES',{maximumFractionDigits:1})],
    ['VALORACIONES',String(modelo.valoraciones)]
  ];
  indicadores.forEach((item,i)=>{
    const x=18+(i%2)*89,y=69+Math.floor(i/2)*40;
    tarjeta(x,y,85,35);
    texto(item[0],x+6,y+10,9,'muted','bold');
    texto(item[1],x+6,y+27,19,'vino','bold');
  });
  let y=bloque('Una mirada al periodo',163);
  y=nota(`Han tenido lugar ${modelo.comidasTotales} comidas con ${modelo.asistentesTotal} asistencias registradas. Las cifras provienen de las fichas de comidas publicadas, no de estimaciones.`,y);
  if(modelo.maximaComida){
    y+=5;tarjeta(18,y,174,31);
    texto('LA MESA MÁS CONCURRIDA',24,y+10,9,'vino','bold');
    texto(`${modelo.maximaComida.restaurante || 'Restaurante'} · ${modelo.maximaComida.asistentes} asistentes`,24,y+22,11,'oscuro','bold');
    y+=39;
  }
  if(modelo.restauranMas){
    y=nota(`El restaurante más repetido de toda la historia: ${modelo.restauranMas.nombre} (${modelo.restauranMas.visitas} comidas desde 2022).`,y);
  }
  y+=6;
  nota('Todos los importes están tomados de la tesorería registrada. Las votaciones históricas importadas se identifican y no se consideran oportunidades perdidas de voto.',y);

  // Comidas y asistencia.
  pdf.addPage();tituloPagina(`Comidas y asistencia · ${periodo}`,2);
  y=bloque('Las comidas celebradas',44);
  texto('FECHA',19,y,8,'vino','bold');texto('RESTAURANTE',47,y,8,'vino','bold');texto('ASIST.',175,y,8,'vino','bold');y+=7;
  for(const comida of modelo.comidas.slice(-16)){
    const f=String(comida.fecha).split('-').reverse().join('/');
    const nomb=String(comida.restaurante||'Sin restaurante');
    pdf.setFontSize(9);
    const corto=pdf.splitTextToSize(nomb,114)[0]||nomb;
    texto(f,19,y,8.5);texto(corto,47,y,8.5);
    texto(String(comida.asistentes),182,y,9,'oscuro','normal',{align:'right'});linea(y+3);y+=10;
    if(y>251)break;
  }
  y=Math.max(y+5, Math.min(235,y+5));
  if(y<261)y=nota('Las asistencias se contabilizan solo en comidas celebradas y publicadas, según las fichas individuales.',y);
  if(modelo.comidas.length>16)nota('El listado muestra las 16 comidas más recientes; los indicadores incluyen todo el periodo.',y);

  // Participación en la web: el criterio está explicitado.
  pdf.addPage();tituloPagina(`Participación en la web · ${periodo}`,3);
  y=bloque('Quienes más responden',44);
  texto('COFRADE',19,y,8,'vino','bold');texto('RESPUESTAS',105,y,8,'vino','bold');texto('OPORTUNIDADES',153,y,8,'vino','bold');y+=7;
  for(const c of modelo.webMas.slice(0,9)){
    y=fila([c.nombre,String(c.participacionesTotales),`${c.respuestas} / ${c.oportunidades}`],y,[86,48,38]);
  }
  y=Math.max(y+6,160);
  y=bloque('Menor participación registrada',y);
  if(!modelo.webMenos.length)y=nota('No constan oportunidades comparables de participación en este periodo.',y);
  else for(const c of modelo.webMenos.slice(0,5)){
    y=fila([c.nombre,`${c.respuestas} / ${c.oportunidades}`,`${(c.actividadPct ?? 0).toLocaleString('es-ES')} %`],y,[86,48,38]);
  }
  y+=4;
  y=nota(`Encuestas contabilizadas: ${modelo.numeroEncuestasReales} nativas y ${modelo.numeroEncuestasLegado} históricas importadas. Las importadas suman respuestas conocidas, pero no ausencias.`,y);
  nota('Solo se espera voto en encuestas elegibles por fecha y categoría. Las valoraciones cuentan únicamente para asistentes cuando el formulario ya estaba habilitado. Sin oportunidades no significa desinterés.',y);

  // Clasificaciones de sobremesa y restaurantes.
  pdf.addPage();tituloPagina(`Curiosidades gastronómicas · ${periodo}`,4);
  y=bloque('Los más fieles a la mesa',44);
  for(const c of modelo.mejoresAsistentes.slice(0,5)){
    y=fila([c.nombre,`${c.comidas} de ${c.posiblesComidas} comidas`,c.asistenciaPct===null?'—':`${c.asistenciaPct.toLocaleString('es-ES')} %`],y,[86,55,31]);
  }
  y+=6;
  y=bloque('Quienes más han organizado',y);
  if(!modelo.organizanMas.length)y=nota('No se registraron organizadores en este periodo.',y);
  else for(const c of modelo.organizanMas.slice(0,4)){
    y=fila([c.nombre,`${c.organizaciones} comidas`,`${c.voluntarias} volunt.`],y,[86,55,31]);
  }
  y+=5;
  y=bloque('Restaurantes y valoraciones',y);
  if(!modelo.restaurantes.length)y=nota('No existen comidas registradas para este periodo.',y);
  else for(const r of modelo.restaurantes.slice(0,5)){
    y=fila([r.nombre,`${r.visitas} visitas`,r.media===null?'Sin votos':`${r.media.toLocaleString('es-ES',{maximumFractionDigits:1})}/5 (${r.votos})`],y,[86,46,40]);
  }

  // Tesorería y explicación de auditoría histórica.
  pdf.addPage();tituloPagina(`Economía y método · ${periodo}`,5);
  y=bloque('Tesorería del periodo',44);
  const k=[['APORTACIONES',modelo.balance.ingresos],['GASTOS DEL BOTE',modelo.balance.gastos],['RESULTADO',modelo.balance.resultado],['REMANENTE ACUMULADO',modelo.balance.remanente]];
  k.forEach((item,i)=>{
    const yy=y+i*24;
    tarjeta(18,yy,174,23,i===3?'crema':'blanco');
    texto(item[0],24,yy+9,9,'muted','bold');
    texto(dinero(item[1]),186,yy+16,13,i===3?'verde':'vino','bold',{align:'right'});
  });
  y+=106;
  y=bloque('Evolución por ejercicios',y);
  texto('AÑO',19,y,8,'vino','bold');texto('APORTACIONES',50,y,8,'vino','bold');texto('GASTOS',113,y,8,'vino','bold');texto('REMANENTE',155,y,8,'vino','bold');y+=7;
  for(const a of modelo.anual.slice(-6)){
    y=fila([a.ejercicio,dinero(a.ingresos),dinero(a.gastos),dinero(a.remanente)],y,[31,63,42,36]);
  }
  y+=9;
  y=nota('El remanente es acumulado hasta el ejercicio indicado, no el saldo generado solo durante ese año. Las cuentas se leen tal como figuran en el sistema.',y);
  nota('Este anuario no sustituye la auditoría económica ni la comprobación de movimientos de banco y efectivo. Los datos de participación proceden exclusivamente de los registros disponibles.',y);

  const nombre = modelo.periodo === 'todos' ? 'Historico completo' : String(modelo.periodo);
  pdf.save(`A Mesa Puesta - Anuario ${nombre}.pdf`);
}
