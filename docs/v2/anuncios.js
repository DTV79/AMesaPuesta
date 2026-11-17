import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";
// Tablón V2: los anuncios vigentes y el histórico se consultan por separado
// del RPC de la Pizarra; únicamente se recuperan avisos visibles y ya publicados.
const input = document.getElementById("board-search");
const typeFilter = document.getElementById("board-type");
const highlightFilter = document.getElementById("board-highlight");
const clearButton = document.getElementById("board-clear");
const countLabel = document.getElementById("board-count");
const featuredSection = document.getElementById("board-featured");
const featuredGrid = document.getElementById("board-featured-grid");
const listSection = document.getElementById("board-list-section");
const listHeading = document.getElementById("board-list-title");
const listGrid = document.getElementById("board-list");
const historySection = document.getElementById("board-history-section");
const historyGrid = document.getElementById("board-history");
const anuncioSeleccionado = new URLSearchParams(window.location.search).get("anuncio");
const detalleSeccion = document.getElementById("board-detail");
const detalleContenido = document.getElementById("board-detail-content");
if (anuncioSeleccionado) {
  document.body.classList.add("board-detail-mode");
  detalleSeccion.hidden = false;
}

let publicables = [];

function txt(value) {
  return String(value ?? "").trim();
}

function normalizar(value) {
  return txt(value).toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function esVerdadero(value) {
  if (typeof value === "boolean") return value;
  return ["si", "true", "1", "x", "yes"].includes(normalizar(value));
}

function fecha(value) {
  const raw = txt(value);
  if (!raw) return null;
  let year, month, day;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  const es = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(raw);
  if (iso) {
    year = +iso[1]; month = +iso[2]; day = +iso[3];
  } else if (es) {
    day = +es[1]; month = +es[2]; year = +es[3];
    if (year < 100) year += 2000;
  } else {
    return null;
  }
  const d = new Date(year, month - 1, day, 12);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day ? d : null;
}

function hoyLocal() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
}

function fechaTexto(value) {
  const d = fecha(value);
  if (!d) return "";
  return new Intl.DateTimeFormat("es-ES", {day: "2-digit", month: "short", year: "numeric"})
    .format(d).replace(/\./g, "");
}

function diaUtc(d) {
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
}

function tipoCanonico(value) {
  return normalizar(value) || "general";
}

const tipos = {
  comida: {nombre: "Comida", icono: "🍽"},
  reunion: {nombre: "Reunión", icono: "👥"},
  tesoreria: {nombre: "Tesorería", icono: "📋"},
  urgente: {nombre: "Urgente", icono: "❗"},
  recordatorio: {nombre: "Recordatorio", icono: "🔔"},
  general: {nombre: "General", icono: "📌"}
};

function tipoInfo(value) {
  const key = tipoCanonico(value);
  return tipos[key] || {nombre: txt(value) || "General", icono: "📌"};
}

function reciente(a, today) {
  const publicada = fecha(a.fechaPublicacion || a.fecha);
  if (!publicada) return false;
  const dias = Math.round((diaUtc(today) - diaUtc(publicada)) / 86400000);
  return dias >= 0 && dias <= 90;
}

function publicable(a, today) {
  if (!a || typeof a !== "object" || !esVerdadero(a.visible)) return false;
  const inicio = fecha(a.fechaPublicacion);
  const fin = fecha(a.fechaFin);
  if (inicio && inicio > today) return false;
  if (fin && fin < today) return false;
  return reciente(a, today) || destacadoActivo(a);
}

function fechaHoraFin(a) {
  const fin = fecha(a.fechaFin);
  if (!fin) return null;
  const hora = txt(a.horaFin || "23:59");
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(hora);
  if (!m || +m[1] > 23 || +m[2] > 59) return null;
  return Date.UTC(fin.getFullYear(), fin.getMonth(), fin.getDate(), +m[1], +m[2]);
}

function disponibleParaTablon(a, instante = ahoraMadrid()) {
  if (!a || !esVerdadero(a.visible)) return false;
  const inicio = fechaHoraPublicacion(a);
  return inicio === null || inicio <= instante;
}

// La caducidad y la antigüedad dejan el aviso en el histórico del Tablón;
// nunca lo reactivan en Mi Pizarra, que mantiene su consulta independiente.
function esVigenteEnTablon(a, today, instante = ahoraMadrid()) {
  if (!publicable(a, today) || !disponibleParaTablon(a, instante)) return false;
  const fin = fechaHoraFin(a);
  return fin === null || instante < fin + 60000;
}

function diasDestacado(a) {
  const n = Number.parseInt(a.dias_destacado ?? a["dias destacado"] ?? a["Días Destacado"] ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 15;
}

// Comparar horas civiles de España peninsular (sin depender de la zona horaria del dispositivo).
function fechaHoraPublicacion(a) {
  const inicio = fecha(a.fechaPublicacion || a.fecha);
  if (!inicio) return null;
  const hora = txt(a.horaPublicacion || "00:00");
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(hora);
  if (!m) return null;
  const hh = Number(m[1]), mm = Number(m[2]);
  if (hh > 23 || mm > 59) return null;
  return Date.UTC(inicio.getFullYear(), inicio.getMonth(), inicio.getDate(), hh, mm);
}

function ahoraMadrid() {
  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(new Date());
  const p = Object.fromEntries(partes.map(x => [x.type, x.value]));
  return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
}

function destacadoActivo(a, instanteActual = ahoraMadrid()) {
  if (!esVerdadero(a.destacado)) return false;
  const inicio = fechaHoraPublicacion(a);
  // Los días destacados empiezan con la publicación, no con la fecha de redacción del anuncio.
  return inicio !== null && instanteActual >= inicio &&
    instanteActual < inicio + diasDestacado(a) * 86400000;
}

function ordenar(lista, today) {
  return [...lista].sort((a, b) => {
    const urgA = tipoCanonico(a.tipo) === "urgente" ? 1 : 0;
    const urgB = tipoCanonico(b.tipo) === "urgente" ? 1 : 0;
    if (urgA !== urgB) return urgB - urgA;
    const destA = destacadoActivo(a) ? 1 : 0;
    const destB = destacadoActivo(b) ? 1 : 0;
    if (destA !== destB) return destB - destA;
    const ordenA = Number.isFinite(Number(a.orden)) ? Number(a.orden) : 999999;
    const ordenB = Number.isFinite(Number(b.orden)) ? Number(b.orden) : 999999;
    if (ordenA !== ordenB) return ordenA - ordenB;
    return (fecha(b.fecha)?.getTime() || 0) - (fecha(a.fecha)?.getTime() || 0);
  });
}

function crear(tag, clase, texto) {
  const el = document.createElement(tag);
  if (clase) el.className = clase;
  if (texto !== undefined) el.textContent = String(texto);
  return el;
}

function enlaceSeguro(value) {
  const raw = txt(value);
  if (!raw) return null;
  try {
    const url = new URL(raw, window.location.href);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function avisoDeEstatutos(a) {
  return normalizar(a.titulo).startsWith("estatutos actualizados") &&
    txt(a.enlace).includes("/AMesaPuesta/v2/estatutos.html");
}

function crearAnuncio(a, destacado, historico = false) {
  const article = crear("article", "board-card" + (destacado ? " board-card-featured" : "") + (historico ? " board-card-historical" : ""));
  if (tipoCanonico(a.tipo) === "urgente") article.classList.add("board-card-urgent");

  const heading = crear("div", "board-card-head");
  const chips = crear("div", "board-card-labels");
  const info = avisoDeEstatutos(a) ? {icono:"📜",nombre:"Estatutos"} : tipoInfo(a.tipo);
  chips.append(crear("span", "board-category", info.icono + " " + info.nombre));
  if (destacado) {
    const dias = diasDestacado(a);
    chips.append(crear("span", "board-featured-tag", "Destacado durante " + dias + (dias === 1 ? " día" : " días")));
  }
  if (historico) chips.append(crear("span", "board-historical-tag", "Anuncio anterior"));
  heading.append(chips);
  const title = crear("h3", "board-card-title", txt(a.titulo) || "Sin título");
  heading.append(title);

  const meta = crear("div", "board-card-meta");
  const pub = fechaTexto(a.fechaPublicacion || a.fecha);
  const evento = fechaTexto(a.fechaEvento);
  if (pub) meta.append(crear("span", "", "Publicado: " + pub));
  if (historico && a.fechaFin) meta.append(crear("span", "", "Finalizó: " + fechaTexto(a.fechaFin)));
  if (evento) meta.append(crear("span", "", "Fecha del evento: " + evento));
  if (txt(a.autor)) meta.append(crear("span", "", "Por " + txt(a.autor)));
  if (meta.childNodes.length) heading.append(meta);
  article.append(heading);

  const contenido = txt(a.texto);
  if (contenido) {
    const body = crear("p", "board-card-body", contenido);
    if (contenido.length > 270 || contenido.split("\n").length > 6) body.classList.add("is-clamped");
    article.append(body);
  }

  const actions = crear("div", "board-card-actions");
  if (contenido && (contenido.length > 270 || contenido.split("\n").length > 6)) {
    const toggle = crear("button", "board-read-more", "Leer anuncio completo");
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", "false");
    toggle.addEventListener("click", () => {
      const body = article.querySelector(".board-card-body");
      const expanded = body.classList.toggle("is-clamped") === false;
      toggle.setAttribute("aria-expanded", String(expanded));
      toggle.textContent = expanded ? "Mostrar menos" : "Leer anuncio completo";
    });
    actions.append(toggle);
  }

  const href = enlaceSeguro(a.enlace);
  if (href) {
    const link = crear("a", "board-external", avisoDeEstatutos(a) ? "Consultar los Estatutos ↗" : "Abrir enlace ↗");
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    actions.append(link);
  }
  if (actions.childNodes.length) article.append(actions);
  return article;
}

function mostrarMensaje(target, message, error = false) {
  target.replaceChildren(crear("div", "message" + (error ? " error" : ""), message));
}

function renderizar() {
  const today = hoyLocal();
  const instante = ahoraMadrid();
  const query = normalizar(input.value);
  const type = typeFilter.value;
  const onlyFeatured = highlightFilter.value === "destacados";

  const filtered = publicables.filter(a => {
    const actual = esVigenteEnTablon(a, today, instante);
    if (type && tipoCanonico(a.tipo) !== type) return false;
    if (onlyFeatured && !(actual && destacadoActivo(a, instante))) return false;
    if (query) {
      const hay = normalizar([a.titulo, a.texto, a.autor, a.tipo, tipoInfo(a.tipo).nombre].join(" "));
      if (!hay.includes(query)) return false;
    }
    return true;
  });
  const actuales = ordenar(filtered.filter(a => esVigenteEnTablon(a, today, instante)),today);
  const anteriores = filtered.filter(a => !esVigenteEnTablon(a, today, instante))
    .sort((a,b) => (fechaHoraPublicacion(b) || 0) - (fechaHoraPublicacion(a) || 0));
  const filtrando = Boolean(query || type || onlyFeatured);
  const todosActuales = publicables.filter(a => esVigenteEnTablon(a,today,instante)).length;
  const todosAnteriores = publicables.length - todosActuales;
  countLabel.textContent = filtrando
    ? filtered.length + " de " + publicables.length + " anuncios"
    : todosActuales + " vigentes · " + todosAnteriores + " anteriores";

  const destacados = filtrando ? [] : actuales.filter(a => destacadoActivo(a, instante));
  const normales = filtrando ? actuales : actuales.filter(a => !destacadoActivo(a, instante));

  featuredSection.hidden = destacados.length === 0;
  featuredGrid.replaceChildren(...destacados.map(a => crearAnuncio(a,true)));

  listSection.hidden = !normales.length && (destacados.length>0 || anteriores.length>0);
  listHeading.textContent = filtrando ? "Avisos vigentes" : "Últimos anuncios";
  if (!normales.length) {
    if (!listSection.hidden) mostrarMensaje(listGrid, filtrando
      ? "No hay anuncios vigentes que coincidan con los filtros."
      : "No hay anuncios vigentes ahora mismo.");
    else listGrid.replaceChildren();
  } else {
    listGrid.replaceChildren(...normales.map(a => crearAnuncio(a, destacadoActivo(a, instante))));
  }
  historySection.hidden = anteriores.length === 0;
  historyGrid.replaceChildren(...anteriores.map(a => crearAnuncio(a,false,true)));
}
function renderizarDetalle() {
  const anuncio = publicables.find(a => String(a.id ?? "") === anuncioSeleccionado);
  if (!anuncio) {
    mostrarMensaje(detalleContenido, "Este anuncio no está disponible. Consulta el Tablón para ver los avisos publicados.");
    return;
  }
  const vigente = esVigenteEnTablon(anuncio, hoyLocal());
  const tarjeta = crearAnuncio(anuncio, vigente && destacadoActivo(anuncio), !vigente);
  tarjeta.querySelector(".board-card-body")?.classList.remove("is-clamped");
  tarjeta.querySelector(".board-read-more")?.remove();
  const acciones = tarjeta.querySelector(".board-card-actions");
  if (acciones && !acciones.children.length) acciones.remove();
  detalleContenido.replaceChildren(tarjeta);
  document.title = (txt(anuncio.titulo) || "Anuncio") + " · A Mesa Puesta";
}

function configurarCategorias() {
  const uniques = new Map();
  for (const a of publicables) {
    const key = tipoCanonico(a.tipo);
    if (!uniques.has(key)) uniques.set(key, tipoInfo(a.tipo).nombre);
  }
  const options = [...uniques.entries()].sort((a, b) => a[1].localeCompare(b[1], "es"));
  typeFilter.replaceChildren(crear("option", "", "Todas"));
  typeFilter.firstElementChild.value = "";
  for (const [value, name] of options) {
    const option = crear("option", "", name);
    option.value = value;
    typeFilter.append(option);
  }
}

async function cargar() {
  try {
    const response = await fetch(SUPABASE_URL + "/functions/v1/listados-cofradia?consulta=listar_anuncios_tablon_v2", {method: "POST", headers: {apikey: SUPABASE_PUBLISHABLE_KEY, "x-cofrade-token": localStorage.getItem("amp_cofrade_token") || "", "Content-Type": "application/json"}, body: "{}", cache: "no-store"});
    if (!response.ok) throw new Error("No se pudieron obtener los anuncios (" + response.status + ")");
    const json = await response.json();
    if (!Array.isArray(json)) throw new Error("Formato de anuncios no válido");
    const instante = ahoraMadrid();
    publicables = json.filter(a => disponibleParaTablon(a, instante));
    if (anuncioSeleccionado) renderizarDetalle();
    else { configurarCategorias(); renderizar(); }
  } catch (err) {
    if (anuncioSeleccionado) {
      mostrarMensaje(detalleContenido, "No se pudo cargar este anuncio. Inténtalo de nuevo más tarde.", true);
      console.error("Detalle del anuncio:", err);
      return;
    }
    countLabel.textContent = "Anuncios no disponibles";
    featuredSection.hidden = true;
    listSection.hidden = false;
    historySection.hidden = true;
    mostrarMensaje(listGrid, "No se han podido cargar los anuncios. Prueba a actualizar la página.", true);
    console.error("Tablón:", err);
  }
}

input.addEventListener("input", renderizar);
typeFilter.addEventListener("change", renderizar);
highlightFilter.addEventListener("change", renderizar);
clearButton.addEventListener("click", () => {
  input.value = "";
  typeFilter.value = "";
  highlightFilter.value = "todos";
  renderizar();
  input.focus();
});

cargar();
