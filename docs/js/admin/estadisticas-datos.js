// Cálculos compartidos por la pantalla y el anuario. Los datos solo llegan
// desde la función de Supabase autorizada para administradores.
const num = value => Number(value) || 0;
const fecha = value => String(value || '').slice(0, 10);
const anio = value => Number(fecha(value).slice(0, 4)) || 0;
const enPeriodo = (value, periodo) => periodo === 'todos' || anio(value) === Number(periodo);
const identificador = value => String(value || '');
const sello = (fechaIso) => Date.parse(fechaIso || '') || 0;
const plusAnos = (f, años) => {
  const d = new Date(`${f}T12:00:00Z`);
  if (!Number.isFinite(d.getTime())) return '';
  d.setUTCFullYear(d.getUTCFullYear() + años);
  return d.toISOString().slice(0, 10);
};
export const dinero = value => num(value).toLocaleString('de-DE', {
  minimumFractionDigits: 2, maximumFractionDigits: 2
}) + ' €';
export const porcentaje = (parte, total) => total > 0 ? Math.round(parte * 1000 / total) / 10 : null;
export const fechaLegible = value => fecha(value) ? fecha(value).split('-').reverse().join('/') : '—';

export function generarResumen(datos, periodo = 'todos', opciones = {}) {
  const incluirBajas = opciones.incluirBajas === true;
  const gente = Array.isArray(datos.cofrades) ? datos.cofrades : [];
  // El filtro se aplica a las personas, no a los hechos históricos de comidas y tesorería.
  const genteIncluida = gente.filter(m => incluirBajas || !m.baja);
  const bajasExcluidas = gente.length - genteIncluida.length;
  const cenas = (datos.comidas || []).filter(m => m.estado === 'celebrada' && m.publicada === true)
    .filter(m => enPeriodo(m.fecha, periodo)).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const cenasTodas = (datos.comidas || []).filter(m => m.estado === 'celebrada' && m.publicada === true);
  const idComidas = new Set(cenas.map(m => identificador(m.id)));
  const idComidasTodas = new Set(cenasTodas.map(m => identificador(m.id)));
  const asistentes = (datos.asistencias || []).filter(a => a.estado === 'si' && idComidas.has(identificador(a.comida_id)));
  const asistentesPorComida = new Map();
  for (const a of asistentes) {
    const id = identificador(a.comida_id);
    if (!asistentesPorComida.has(id)) asistentesPorComida.set(id, new Set());
    asistentesPorComida.get(id).add(identificador(a.cofrade_id));
  }
  const organizadores = (datos.organizadores || []).filter(o => idComidas.has(identificador(o.comida_id)));
  const valoraciones = (datos.valoraciones || []).filter(v => idComidas.has(identificador(v.comida_id)));
  const valoracionesTodas = (datos.valoraciones || []).filter(v => idComidasTodas.has(identificador(v.comida_id)));
  const ratingPorComida = new Map();
  for (const v of valoracionesTodas) {
    const k = identificador(v.comida_id);
    if (!ratingPorComida.has(k)) ratingPorComida.set(k, new Set());
    ratingPorComida.get(k).add(identificador(v.cofrade_id));
  }
  const ratingConfig = new Map((datos.config_valoraciones || []).map(v => [identificador(v.comida_id), v]));
  const participantePorEncuesta = new Set((datos.participaciones || []).map(p => `${p.encuesta_id}|${p.cofrade_id}`));
  const encuestas = (datos.encuestas || []).filter(e => e.mostrar_encuesta === true &&
    (e.estado === 'cerrada' || (e.cierra_en && sello(e.cierra_en) < Date.now())) &&
    enPeriodo(e.cierra_en || e.cerrada_en, periodo));
  const inicioMiembro = m => fecha(m.ingreso);
  const miembroEnFecha = (m, dia) => !!dia && !!inicioMiembro(m) && inicioMiembro(m) <= dia &&
    (!m.baja || fecha(m.baja) >= dia);
  const config = datos.config || {};
  const visitasHasta = (id, hasta) => (datos.asistencias || []).filter(a =>
    identificador(a.cofrade_id) === identificador(id) && a.estado === 'si' &&
    cenasTodas.some(c => identificador(c.id) === identificador(a.comida_id) && c.fecha <= hasta)).length;
  const esCofradeEnFecha = (m, dia) => {
    // No hay historial exacto de ascensos. Para evitar penalizar aprendices,
    // solo se atribuye obligación si su condición se puede inferir con datos
    // seguros: fundador, antigüedad o comidas exigidas por la norma actual.
    if (m.fundador || /fundador/i.test(m.categoria || '')) return true;
    if (/aprendiz/i.test(m.categoria || '')) return false;
    const porTiempo = Number(config.anios_cofrade) > 0 && plusAnos(inicioMiembro(m), config.anios_cofrade) <= dia;
    const porComidas = Number(config.comidas_cofrade) > 0 && visitasHasta(m.id, dia) >= Number(config.comidas_cofrade);
    return porTiempo || porComidas;
  };
  const esElegible = (m, e) => {
    const cierre = fecha(e.cierra_en || e.cerrada_en);
    const apertura = fecha(e.abre_en || e.creada_en);
    if (!cierre || !inicioMiembro(m) || inicioMiembro(m) > cierre) return false;
    if (m.baja && fecha(m.baja) < (apertura && apertura < cierre ? apertura : cierre)) return false;
    const restringida = /cofrades|solo/i.test(e.electores || '');
    return !restringida || esCofradeEnFecha(m, cierre);
  };
  const esLegado = e => {
    const cierre = sello(e.cierra_en || e.cerrada_en);
    // Una encuesta creada/importada después de su cierre no se puede tratar
    // como una oportunidad de respuesta que ofreció esta plataforma.
    return cierre > 0 && sello(e.creada_en) > cierre + 60 * 60 * 1000;
  };

  const encuestasWeb = encuestas.filter(e => !esLegado(e));
  const cofrades = genteIncluida.map(m => {
    const disponibles = cenas.filter(c => miembroEnFecha(m, c.fecha));
    const comidasPropias = asistentes.filter(a => identificador(a.cofrade_id) === identificador(m.id)).length;
    const organ = organizadores.filter(o => identificador(o.cofrade_id) === identificador(m.id));
    // Solo son comparables las respuestas a encuestas realmente disponibles en la web.
    const encElegibles = encuestasWeb.filter(e => esElegible(m, e));
    const encRespondidas = encElegibles.filter(e => participantePorEncuesta.has(`${e.id}|${m.id}`));
    const ratingsPosibles = cenas.filter(c => {
      const rc = ratingConfig.get(identificador(c.id));
      if (!rc || !rc.abre_en || !miembroEnFecha(m, c.fecha)) return false;
      if (!(asistentesPorComida.get(identificador(c.id)) || new Set()).has(identificador(m.id))) return false;
      return sello(rc.abre_en) <= Date.now();
    });
    const ratingsHechos = ratingsPosibles.filter(c => (ratingPorComida.get(identificador(c.id)) || new Set()).has(identificador(m.id)));
    const oportunidades = encElegibles.length + ratingsPosibles.length;
    const respuestas = encRespondidas.length + ratingsHechos.length;
    return {
      ...m, nombre: m.nombre || 'Sin nombre', comidas: comidasPropias,
      posiblesComidas: disponibles.length, asistenciaPct: porcentaje(comidasPropias, disponibles.length),
      organizaciones: organ.length, voluntarias: organ.filter(o => /voluntar/i.test(o.fuente || '')).length,
      sorteos: organ.filter(o => /sorteo/i.test(o.fuente || '')).length,
      encuestas: encRespondidas.length, encuestasActuales: encRespondidas.length,
      valoraciones: ratingsHechos.length,
      oportunidadesEncuestas: encElegibles.length, oportunidadesValoraciones: ratingsPosibles.length,
      respuestas, oportunidades, actividadPct: porcentaje(respuestas, oportunidades),
      participacionesTotales: respuestas
    };
  });
  const activos = cofrades.filter(c => !c.baja || periodo !== 'todos' && anio(c.baja) >= Number(periodo));
  const asistentesTotal = [...asistentesPorComida.values()].reduce((n, s) => n + s.size, 0);
  const mejoresAsistentes = [...cofrades].filter(c => c.posiblesComidas > 0)
    .sort((a,b) => b.comidas - a.comidas || (b.asistenciaPct || 0) - (a.asistenciaPct || 0) || a.nombre.localeCompare(b.nombre,'es'));
  const organizanMas = [...cofrades].filter(c => c.organizaciones > 0)
    .sort((a,b) => b.organizaciones - a.organizaciones || a.nombre.localeCompare(b.nombre,'es'));
  const webConOportunidad = [...cofrades].filter(c => c.oportunidades > 0);
  const webMas = [...webConOportunidad].sort((a,b) =>
    b.respuestas - a.respuestas ||
    (b.actividadPct || 0) - (a.actividadPct || 0) || a.nombre.localeCompare(b.nombre,'es'));
  const webMenos = [...webConOportunidad].sort((a,b) =>
    (a.actividadPct || 0) - (b.actividadPct || 0) ||
    a.respuestas - b.respuestas || a.nombre.localeCompare(b.nombre,'es'));
  // El aviso de ausencia se refiere a oportunidades evaluables, no a votos
  // que se importaron retrospectivamente desde encuestas antiguas.
  const webNunca = webConOportunidad.filter(c => c.respuestas === 0);
  const sinOportunidad = cofrades.filter(c => c.oportunidades === 0);

  const restaurantes = new Map();
  for (const c of cenas) {
    const nombre = c.restaurante || 'Restaurante sin nombre';
    if (!restaurantes.has(nombre)) restaurantes.set(nombre,{nombre,visitas:0,asistentes:0,puntuaciones:[],historicas:0});
    const d = restaurantes.get(nombre);
    d.visitas++;
    d.asistentes += (asistentesPorComida.get(identificador(c.id)) || new Set()).size;
    d.puntuaciones.push(...valoraciones.filter(v => identificador(v.comida_id) === identificador(c.id)).map(v => num(v.general)).filter(Boolean));
    if (!ratingPorComida.has(identificador(c.id)) && c.estrellas_historicas !== null) d.historicas++;
  }
  const restaurantesOrdenados = [...restaurantes.values()].map(r => ({
    ...r, votos:r.puntuaciones.length,
    media:r.puntuaciones.length ? r.puntuaciones.reduce((n,x)=>n+x,0)/r.puntuaciones.length : null
  })).sort((a,b) => (b.media ?? -1) - (a.media ?? -1) || b.visitas-a.visitas);
  const anual = (datos.tesoreria || []).map(x => ({
    ejercicio:Number(x.ejercicio), ingresos:num(x.ingresos), gastos:num(x.gastos),
    resultado:num(x.resultado), remanente:num(x.remanente)
  })).sort((a,b) => a.ejercicio-b.ejercicio);
  const balance = periodo === 'todos' ? {
    ingresos:anual.reduce((n,x)=>n+x.ingresos,0),
    gastos:anual.reduce((n,x)=>n+x.gastos,0),
    resultado:anual.reduce((n,x)=>n+x.resultado,0),
    remanente:anual.at(-1)?.remanente ?? 0
  } : anual.find(x=>x.ejercicio===Number(periodo)) || {ingresos:0,gastos:0,resultado:0,remanente:0};
  const porPeriodo = [...new Set(cenasTodas.map(c=>anio(c.fecha)))].sort((a,b)=>a-b).map(y=>({
    anio:y,comidas:cenasTodas.filter(c=>anio(c.fecha)===y).length
  }));
  const maximaComida = [...cenas].sort((a,b)=>(asistentesPorComida.get(identificador(b.id))?.size||0)-(asistentesPorComida.get(identificador(a.id))?.size||0))[0];
  // Una sola visita no es una repetición. Si hay empate real entre
  // restaurantes repetidos, informamos de todos en vez de escoger uno.
  const porRepeticion = [...restaurantesOrdenados]
    .sort((a,b)=>b.visitas-a.visitas || a.nombre.localeCompare(b.nombre,'es'));
  const maxRepeticiones = porRepeticion[0]?.visitas || 0;
  const empatados = porRepeticion.filter(r=>r.visitas===maxRepeticiones);
  const masRepetido = maxRepeticiones >= 2 ? {
    nombre:empatados.map(r=>r.nombre).join(' · '),
    visitas:maxRepeticiones,
    empate:empatados.length > 1
  } : null;
  return {
    periodo, incluirBajas, bajasExcluidas, cofrades, activos, comidas:cenas.map(c => ({
      ...c, asistentes:asistentesPorComida.get(identificador(c.id))?.size||0
    })), encuestas: encuestasWeb,
    participaciones: cofrades.reduce((n,c)=>n+c.encuestas,0),
    numeroEncuestasReales:encuestasWeb.length,
    asistentesTotal, mediaAsistencia: cenas.length ? asistentesTotal/cenas.length : 0,
    comidasTotales:cenas.length, valoraciones:valoraciones.length,
    mejoresAsistentes, organizanMas, webMas, webMenos, webNunca, sinOportunidad,
    restaurantes:restaurantesOrdenados, anual,balance,porPeriodo,
    maximaComida:maximaComida ? {...maximaComida, asistentes:asistentesPorComida.get(identificador(maximaComida.id))?.size||0} : null,
    restauranMas:masRepetido
  };
}
