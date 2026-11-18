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
  const JsPDF=await obtenerJsPdf();
  const logo=await cargarLogo();
  const pdf=new JsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
  const paleta={vino:[120,37,49],oscuro:[43,35,32],gris:[111,98,91],crema:[249,245,239],oro:[198,149,93],claro:[232,220,209],blanco:[255,255,255],verde:[39,109,76],rosa:[238,218,212]};
  const tinta=nombre=>paleta[nombre]||paleta.oscuro;
  const texto=(valor,x,y,tamano=10,color='oscuro',peso='normal',opciones={})=>{
    pdf.setFont('helvetica',peso);pdf.setFontSize(tamano);pdf.setTextColor(...tinta(color));
    pdf.text(String(valor??''),x,y,opciones);
  };
  const caja=(x,y,ancho,alto,fondo='crema',radio=3)=>{
    pdf.setFillColor(...tinta(fondo));pdf.roundedRect(x,y,ancho,alto,radio,radio,'F');
  };
  const raya=y=>{pdf.setDrawColor(...paleta.claro);pdf.setLineWidth(.35);pdf.line(18,y,192,y)};
  const fechaCorta=valor=>String(valor||'').slice(0,10).split('-').reverse().join('/');
  const limpiar=valor=>String(valor??'').replace(/\s+/g,' ').trim();
  const porcentaje=valor=>valor===null||valor===undefined?'—':Number(valor).toLocaleString('es-ES',{maximumFractionDigits:1})+' %';
  const parrafo=(valor,x,y,ancho=174,tamano=9,color='gris',paso=4.8)=>{
    const limpio=limpiar(valor);if(!limpio)return y;
    pdf.setFont('helvetica','normal');pdf.setFontSize(tamano);
    const lineas=pdf.splitTextToSize(limpio,ancho);
    lineas.forEach((linea,i)=>texto(linea,x,y+i*paso,tamano,color));
    return y+lineas.length*paso;
  };
  const encabezado=seccion=>{
    pdf.setFillColor(...paleta.vino);pdf.rect(0,0,210,31,'F');
    if(logo)pdf.addImage(logo,'PNG',17,5.5,20,20);
    else{pdf.setFillColor(...paleta.crema);pdf.circle(27,15,10,'F');texto('AMP',27,18,9,'vino','bold',{align:'center'})}
    texto('A Mesa Puesta',43,15.5,17,'blanco','bold');
    texto(seccion,43,23,9,'blanco');
  };
  const titulo=(valor,y=44)=>{texto(valor,18,y,18,'vino','bold');return y+10};
  const bloque=(valor,y)=>{texto(valor,18,y,12,'vino','bold');raya(y+4);return y+13};
  const fila=(valores,y,anchos=[81,50,41],alto=9)=>{
    let x=19;
    valores.forEach((valor,i)=>{
      const ancho=anchos[i]||35;pdf.setFont('helvetica',i===0?'bold':'normal');pdf.setFontSize(9);
      const partes=pdf.splitTextToSize(limpiar(valor)||'—',ancho-4);
      texto(partes[0]||'—',x,y,9,'oscuro',i===0?'bold':'normal');
      x+=ancho;
    });
    raya(y+3);return y+alto;
  };
  // Los empates se cuentan una sola vez: los nombres van juntos,
  // sin repetir una fila por cada cofrade con el mismo resultado.
  const gruposDe=(lista,obtenerClave,obtenerEtiqueta)=>{
    const mapa=new Map();
    for(const dato of (lista||[])){
      const clave=obtenerClave(dato);
      if(!mapa.has(clave))mapa.set(clave,{etiqueta:obtenerEtiqueta(dato),nombres:[]});
      mapa.get(clave).nombres.push(limpiar(dato.nombre||'Sin nombre'));
    }
    return [...mapa.values()];
  };
  const tarjetaEmpate=(grupo,posicion,siguientePagina)=>{
    pdf.setFont('helvetica','normal');pdf.setFontSize(9.5);
    const lineas=pdf.splitTextToSize(grupo.nombres.join('  ·  '),158);
    const alto=Math.max(25,17+lineas.length*5.7);
    let yy=posicion;
    if(yy+alto>272)yy=siguientePagina();
    caja(18,yy,174,alto,'crema');
    texto(grupo.etiqueta,24,yy+10,10,'vino','bold');
    lineas.forEach((linea,i)=>texto(linea,24,yy+18+i*5.7,9.5,'oscuro'));
    return yy+alto+5;
  };

  const periodo=modelo.periodo==='todos'?'Nuestra historia completa':'Año '+modelo.periodo;
  const eventos=Array.isArray(modelo.comidas)?modelo.comidas:[];
  const anuales=Array.isArray(modelo.anual)?modelo.anual:[];
  const platos=Number(modelo.comidasTotales)||0;

  // Portada: recuerdos, protagonistas y primer gráfico.
  encabezado('El anuario de la Cofradía · '+periodo);
  titulo(modelo.periodo==='todos'?'Nuestra historia para mojar pan':'Un año para mojar pan',46);
  texto('A mesa puesta… y el vaso lleno desde 2022.',18,57,10,'gris');
  const indicadores=[
    ['COMIDAS CELEBRADAS',String(platos)],
    ['CUBIERTOS OCUPADOS',String(modelo.asistentesTotal||0)],
    ['MEDIA EN LA MESA',Number(modelo.mediaAsistencia||0).toLocaleString('es-ES',{maximumFractionDigits:1})],
    ['VALORACIONES',String(modelo.valoraciones||0)]
  ];
  indicadores.forEach((indicador,i)=>{
    const x=18+(i%2)*89, y=66+Math.floor(i/2)*36;
    caja(x,y,85,32);
    texto(indicador[0],x+6,y+9,8,'gris','bold');
    texto(indicador[1],x+6,y+25,19,'vino','bold');
  });
  let y=bloque('El dato que dará conversación',151);
  if(modelo.maximaComida){
    caja(18,y,174,26);
    texto('LA MESA MÁS CONCURRIDA',24,y+9,8,'vino','bold');
    texto(limpiar(modelo.maximaComida.restaurante||'Nuestra comida').slice(0,48),24,y+20,11,'oscuro','bold');
    texto(String(modelo.maximaComida.asistentes)+' comensales',186,y+20,9,'gris','normal',{align:'right'});
    y+=33;
  }else{
    y=parrafo('El mantel está preparado. Las estadísticas llegarán con la primera comida.',18,y,174,10);
  }
  if(modelo.restauranMas){
    y=parrafo('Donde repetimos plato: '+modelo.restauranMas.nombre+' ('+modelo.restauranMas.visitas+' visitas por restaurante).',18,y+2,173,9);
  }else if(platos){
    y=parrafo('Ningún restaurante repetido: por ahora, nos puede la curiosidad gastronómica.',18,y+2,173,9);
  }
  texto('COMIDAS POR AÑO',18,218,9,'vino','bold');
  const porPeriodo=(modelo.porPeriodo||[]).slice(-6);
  const mayor=Math.max(1,...porPeriodo.map(a=>Number(a.comidas)||0));
  if(!porPeriodo.length)parrafo('En cuanto haya comidas, aquí veremos cómo crece nuestro historial.',18,230,174,9);
  porPeriodo.forEach((a,i)=>{
    const yy=229+i*7.6;
    texto(String(a.anio),19,yy+1.5,9,'oscuro','bold');
    caja(47,yy-2,127,4.5,'claro',2);
    if(Number(a.comidas)>0)caja(47,yy-2,127*Number(a.comidas)/mayor,4.5,'vino',2);
    texto(String(a.comidas),188,yy+1.5,9,'vino','bold',{align:'right'});
  });

  // La ruta gastronómica: cada comida tiene su menú, no solo una fila.
  pdf.addPage();encabezado('De mesa en mesa · '+periodo);
  titulo('La ruta del tenedor',45);
  texto('Las fechas importantes suelen coincidir con algo bueno en el plato.',18,56,9,'gris');
  y=69;
  if(!eventos.length)y=parrafo('Aún no hay comidas que contar. De momento, queda hambre de estadísticas.',19,80,171,10);
  for(const comida of eventos){
    const platosPrincipales=String(comida.principales||'').split(/\r?\n|;/)
      .map(x=>limpiar(x)).filter(Boolean);
    const lineas=(platosPrincipales.length?platosPrincipales:['Los platos principales no quedaron apuntados.'])
      .flatMap(plato=>pdf.splitTextToSize('• '+plato,155));
    const alto=Math.max(eventos.length<=2?70:48,42+lineas.length*5.9);
    if(y+alto>272){
      pdf.addPage();encabezado('De mesa en mesa · '+periodo);
      titulo('La ruta sigue dando hambre',45);
      y=69;
    }
    caja(18,y,174,alto,'crema');
    texto(fechaCorta(comida.fecha),24,y+10,9,'gris');
    texto(String(comida.asistentes||0)+' a la mesa',186,y+10,9,'vino','bold',{align:'right'});
    texto(limpiar(comida.restaurante||'Nuestra comida').slice(0,48),24,y+23,13,'oscuro','bold');
    texto('LO QUE CAYÓ EN EL PLATO',24,y+35,8,'vino','bold');
    lineas.forEach((linea,i)=>texto(linea,25,y+43+i*5.9,9.5,'oscuro'));
    y+=alto+8;
  }

  // Dos ligas sin duplicados: más del 50 % arriba, hasta el 50 % abajo.
  // Los empates van agrupados y solo participan quienes tuvieron oportunidades.
  pdf.addPage();encabezado('Participación en la web · '+periodo);
  titulo('Los que siempre tienen algo que decir',45);
  texto('Entre encuestas y valoraciones, también se vota con el tenedor.',18,56,9,'gris');
  const siguienteClic=(tituloContinuacion)=>{
    pdf.addPage();encabezado('Participación en la web · '+periodo);
    titulo(tituloContinuacion,45);return 70;
  };
  const siguienteLiga=()=>siguienteClic('La liga del clic continúa');
  const siguienteEquipo=()=>siguienteClic('El «ahora respondo» continúa');
  const todosConOportunidad=Array.isArray(modelo.webMas)?modelo.webMas:[];
  const porcentual=(a,b)=>b.actividadPct-a.actividadPct || b.respuestas-a.respuestas || a.nombre.localeCompare(b.nombre,'es');
  const liga=gruposDe(todosConOportunidad.filter(c=>c.oportunidades>0 && c.actividadPct>50).sort(porcentual),
    c=>[c.respuestas,c.oportunidades,c.actividadPct].join('|'),
    c=>c.respuestas+' de '+c.oportunidades+' respuestas · '+porcentaje(c.actividadPct));
  y=bloque('La liga del clic · Más del 50 %',73);
  if(!liga.length)y=parrafo('Todavía no hay nadie por encima del 50 %. ¡Hay margen para remontar!',19,y,170,9);
  for(const grupo of liga)y=tarjetaEmpate(grupo,y,siguienteLiga);
  if(y+37>270)y=siguienteEquipo();
  y=bloque('El equipo del «ahora respondo» · Hasta el 50 %',y+6);
  const equipo=gruposDe(todosConOportunidad.filter(c=>c.oportunidades>0 && c.actividadPct<=50).sort(porcentual),
    c=>[c.respuestas,c.oportunidades,c.actividadPct].join('|'),
    c=>c.respuestas+' de '+c.oportunidades+' respuestas · '+porcentaje(c.actividadPct));
  if(!equipo.length)y=parrafo('¡Nadie por aquí! Todos han superado la mitad de sus oportunidades.',19,y,174,9);
  for(const grupo of equipo)y=tarjetaEmpate(grupo,y,siguienteEquipo);
  if(y+22>270)y=siguienteEquipo();
  parrafo('Los empates comparten mantel y nadie aparece dos veces. Solo cuentan las oportunidades de participar que tuvo cada cofrade.',18,y+8,174,8);

  // Asistencia y organización sin recortar la lista ni repetir los empates.
  pdf.addPage();encabezado('Premios del tenedor · '+periodo);
  titulo('El palmarés del buen comer',45);
  const siguientePremio=()=>{
    pdf.addPage();encabezado('Premios del tenedor · '+periodo);
    titulo('El palmarés sigue repartiendo medallas',45);return 70;
  };
  y=bloque('Abonados al mantel',65);
  const gruposAsistencia=gruposDe(modelo.mejoresAsistentes,
    c=>[c.comidas,c.posiblesComidas,c.asistenciaPct].join('|'),
    c=>c.comidas+' de '+c.posiblesComidas+' comidas · '+porcentaje(c.asistenciaPct));
  if(!gruposAsistencia.length)y=parrafo('Sin clasificaciones de asistencia por ahora.',18,y,174,9);
  for(const grupo of gruposAsistencia)y=tarjetaEmpate(grupo,y,siguientePremio);
  if(y+32>270)y=siguientePremio();
  y=bloque('Los que montan el sarao',y+6);
  const gruposOrganizacion=gruposDe(modelo.organizanMas,
    c=>[c.organizaciones,c.voluntarias,c.sorteos].join('|'),
    c=>c.organizaciones+' '+(c.organizaciones===1?'comida organizada':'comidas organizadas')+
      (c.voluntarias?' · '+c.voluntarias+' volunt.':'')+
      (c.sorteos?' · '+c.sorteos+' por sorteo':''));
  if(!gruposOrganizacion.length)y=parrafo('Todavía no hay organizadores a los que colgarles una medalla.',18,y,174,9);
  for(const grupo of gruposOrganizacion)y=tarjetaEmpate(grupo,y,siguientePremio);
  if(y+32>270)y=siguientePremio();
  y=bloque('La crítica gastronómica ha hablado',y+6);
  const gruposRestaurantes=gruposDe((modelo.restaurantes||[]).map(r=>({...r,nombre:r.nombre})),
    r=>[r.visitas,r.media===null?'sin':r.media,r.votos].join('|'),
    r=>r.visitas+' '+(r.visitas===1?'visita':'visitas')+' · '+
      (r.media===null?'Sin votos':Number(r.media).toLocaleString('es-ES',{maximumFractionDigits:1})+' / 5 ('+r.votos+' valoraciones)'));
  if(!gruposRestaurantes.length)y=parrafo('Todavía no hay restaurantes para puntuar.',18,y,174,9);
  for(const grupo of gruposRestaurantes)y=tarjetaEmpate(grupo,y,siguientePremio);

  // Cada restaurante reúne su frase del día y todas sus valoraciones
  // con los nombres que constan en las fichas de los cofrades.
  pdf.addPage();encabezado('Voces de la sobremesa · '+periodo);
  titulo('Lo que quedó para la posteridad',45);
  texto('Palabras textuales. Algunas merecen su propio plato.',18,56,9,'gris');
  y=70;
  const recuerdos=Array.isArray(modelo.vocesPorComida)?modelo.vocesPorComida:[];
  if(!recuerdos.length)parrafo('Este año los platos hablaron más que los teclados. Cuando haya frases y comentarios, los guardaremos aquí.',18,77,174,10);
  const siguienteVoz=()=>{
    pdf.addPage();encabezado('Voces de la sobremesa · '+periodo);
    titulo('La sobremesa todavía no termina',45);return 70;
  };
  for(const recuerdo of recuerdos){
    const nombre=limpiar(recuerdo.restaurante||'Nuestra comida');
    const pintaRestaurante=(continuacion=false)=>{
      if(y+65>271)y=siguienteVoz();
      caja(18,y,174,16,'vino');
      texto(nombre.slice(0,43)+(continuacion?' (sigue)':''),24,y+10,11,'blanco','bold');
      texto(fechaCorta(recuerdo.fecha),186,y+10,8.5,'blanco','normal',{align:'right'});
      y+=20;
    };
    const aseguro=(espacio)=>{
      if(y+espacio>272){y=siguienteVoz();pintaRestaurante(true);}
    };
    const pintaComentario=(cita,autor)=>{
      const limpia=limpiar(cita);
      const recorte=limpia.length>450?limpia.slice(0,447).trimEnd()+'…':limpia;
      pdf.setFont('helvetica','normal');pdf.setFontSize(9.5);
      const lineas=pdf.splitTextToSize('«'+recorte+'»',155);
      const alto=Math.max(20,11+lineas.length*4.8+(autor?5:0));
      aseguro(alto+6);
      caja(18,y,174,alto,'crema');
      lineas.forEach((linea,i)=>texto(linea,24,y+8+i*4.8,9.5,'oscuro'));
      if(autor)texto('— '+limpiar(autor).slice(0,42),185,y+alto-4,8.5,'vino','bold',{align:'right'});
      y+=alto+3;
    };
    pintaRestaurante();
    if(recuerdo.frase){
      aseguro(36);
      texto('LA FRASE QUE QUEDÓ PARA LA HISTORIA',22,y+6,8.5,'vino','bold');
      y+=8;
      pintaComentario(recuerdo.frase,recuerdo.autorFrase);
    }
    if((recuerdo.comentarios||[]).length){
      aseguro(35);
      texto('LO QUE SOLTARON AL VALORAR',22,y+6,8.5,'vino','bold');
      y+=8;
      for(const comentario of recuerdo.comentarios)pintaComentario(comentario.texto,comentario.autor);
    }
    y+=5;
  }

  // Cierre económico: una explicación sencilla y un gráfico real.
  pdf.addPage();encabezado('Las cuentas · '+periodo);
  titulo('Las cuentas, sin aguar el vino',45);
  texto('Porque el bote también merece que le echemos un vistazo.',18,56,9,'gris');
  const cifras=[
    ['APORTACIONES',modelo.balance?.ingresos||0],
    ['GASTOS DEL BOTE',modelo.balance?.gastos||0],
    ['RESULTADO DEL PERIODO',modelo.balance?.resultado||0],
    ['REMANENTE ACUMULADO',modelo.balance?.remanente||0]
  ];
  cifras.forEach((k,i)=>{
    const x=18+(i%2)*89, yy=65+Math.floor(i/2)*31;
    caja(x,yy,85,27,i===3?'crema':'blanco');
    texto(k[0],x+5,yy+9,8,'gris','bold');
    texto(dinero(k[1]),x+5,yy+22,15,i===3?'verde':'vino','bold');
  });
  texto('APORTACIONES Y GASTOS POR AÑO',18,139,9,'vino','bold');
  caja(18,143,5,3.5,'vino',1);texto('Entradas',26,146,8,'gris');
  caja(70,143,5,3.5,'oro',1);texto('Salidas',78,146,8,'gris');
  const cinco=anuales.slice(-5);
  const maxEuros=Math.max(1,...cinco.flatMap(a=>[Number(a.ingresos)||0,Number(a.gastos)||0]));
  cinco.forEach((a,i)=>{
    const yy=156+i*9.2;
    texto(String(a.ejercicio),19,yy+3,8.5,'oscuro','bold');
    caja(47,yy-1,130,6.8,'claro',1);
    const anchoI=130*Math.max(0,Number(a.ingresos)||0)/maxEuros;
    const anchoG=130*Math.max(0,Number(a.gastos)||0)/maxEuros;
    if(anchoI>0)caja(47,yy-1,anchoI,3,'vino',.6);
    if(anchoG>0)caja(47,yy+2.5,anchoG,3,'oro',.6);
  });
  y=bloque('El bote año a año',215);
  texto('AÑO',19,y,8,'vino','bold');
  texto('ENTRADAS',53,y,8,'vino','bold');
  texto('GASTOS',119,y,8,'vino','bold');
  texto('BOTE',163,y,8,'vino','bold');y+=7;
  for(const a of cinco){
    y=fila([a.ejercicio,dinero(a.ingresos),dinero(a.gastos),dinero(a.remanente)],y,[31,66,44,31],7.6);
  }
  

  // Numeración con el número real de páginas, también si las citas ocupan más.
  const total=pdf.getNumberOfPages();
  for(let pagina=1;pagina<=total;pagina++){
    pdf.setPage(pagina);
    pdf.setDrawColor(...paleta.oro);pdf.setLineWidth(.6);pdf.line(18,281,192,281);
    texto('A Mesa Puesta… y el vaso lleno desde 2022.',18,289,8,'gris');
    texto(String(pagina)+' / '+String(total),191,289,8,'gris','normal',{align:'right'});
  }
  const nombre=modelo.periodo==='todos'?'Historico completo':String(modelo.periodo);
  pdf.save('A Mesa Puesta - Anuario '+nombre+(modelo.incluirBajas?' - Con bajas':'')+'.pdf');
}
