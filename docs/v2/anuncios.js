// Tablón V2: mantiene el mismo origen de anuncios que la web actual.
// Hasta disponer de la administración, Google Sheets sigue actualizando ../anuncios.json.
// Solo se muestran avisos visibles, ya publicados y no caducados.
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

function publicable(a, today) {
  if (!a || typeof a !== "object" || !esVerdadero(a.visible)) return false;
  const inicio = fecha(a.fechaPublicacion);
  const fin = fecha(a.fechaFin);
  if (inicio && inicio > today) return false;
  if (fin && fin < today) return false;
  return true;
}

function destacadoActivo(a, today) {
  if (!esVerdadero(a.destacado)) return false;
  const inicio = fecha(a.fecha);
  if (!inicio) return false;
  const n = Number.parseInt(a.dias_destacado ?? a["dias destacado"] ?? "", 10);
  const dias = Number.isFinite(n) && n > 0 ? n : 15;
  const transcurridos = Math.round((diaUtc(today) - diaUtc(inicio)) / 86400000);
  return transcurridos >= 0 && transcurridos <= dias;
}

function ordenar(lista, today) {
  return [...lista].sort((a, b) => {
    const urgA = tipoCanonico(a.tipo) === "urgente" ? 1 : 0;
    const urgB = tipoCanonico(b.tipo) === "urgente" ? 1 : 0;
    if (urgA !== urgB) return urgB - urgA;
    const destA = destacadoActivo(a, today) ? 1 : 0;
    const destB = destacadoActivo(b, today) ? 1 : 0;
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

function crearAnuncio(a, destacado) {
  const article = crear("article", "board-card" + (destacado ? " board-card-featured" : ""));
  if (tipoCanonico(a.tipo) === "urgente") article.classList.add("board-card-urgent");

  const heading = crear("div", "board-card-head");
  const chips = crear("div", "board-card-labels");
  const info = tipoInfo(a.tipo);
  chips.append(crear("span", "board-category", info.icono + " " + info.nombre));
  if (destacado) chips.append(crear("span", "board-featured-tag", "Destacado"));
  heading.append(chips);
  const title = crear("h3", "board-card-title", txt(a.titulo) || "Sin título");
  heading.append(title);

  const meta = crear("div", "board-card-meta");
  const pub = fechaTexto(a.fechaPublicacion || a.fecha);
  const evento = fechaTexto(a.fechaEvento);
  if (pub) meta.append(crear("span", "", "Publicado: " + pub));
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
    const link = crear("a", "board-external", "Abrir enlace ↗");
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
  const query = normalizar(input.value);
  const type = typeFilter.value;
  const onlyFeatured = highlightFilter.value === "destacados";
  const filtered = ordenar(publicables.filter(a => {
    if (type && tipoCanonico(a.tipo) !== type) return false;
    if (onlyFeatured && !destacadoActivo(a, today)) return false;
    if (query) {
      const hay = normalizar([a.titulo, a.texto, a.autor, a.tipo, tipoInfo(a.tipo).nombre].join(" "));
      if (!hay.includes(query)) return false;
    }
    return true;
  }), today);

  const filtrando = Boolean(query || type || onlyFeatured);
  countLabel.textContent = filtrando
    ? filtered.length + " de " + publicables.length + " anuncios"
    : publicables.length + (publicables.length === 1 ? " anuncio disponible" : " anuncios disponibles");

  const destacados = filtrando ? [] : filtered.filter(a => destacadoActivo(a, today));
  const normales = filtrando ? filtered : filtered.filter(a => !destacadoActivo(a, today));

  featuredSection.hidden = destacados.length === 0;
  featuredGrid.replaceChildren(...destacados.map(a => crearAnuncio(a, true)));
  listSection.hidden = normales.length === 0 && destacados.length > 0 && !filtrando;
  listHeading.textContent = filtrando ? "Resultados" : "Últimos anuncios";

  if (!normales.length) {
    if (!listSection.hidden) {
      mostrarMensaje(listGrid, filtrando
        ? "No hay anuncios que coincidan con los filtros seleccionados."
        : "No hay anuncios publicados en este momento.");
    } else {
      listGrid.replaceChildren();
    }
  } else {
    listGrid.replaceChildren(...normales.map(a => crearAnuncio(a, destacadoActivo(a, today))));
  }
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
    const response = await fetch("../anuncios.json?v=" + Date.now(), {cache: "no-store"});
    if (!response.ok) throw new Error("No se pudieron obtener los anuncios (" + response.status + ")");
    const json = await response.json();
    if (!Array.isArray(json.anuncios)) throw new Error("Formato de anuncios no válido");
    const today = hoyLocal();
    publicables = json.anuncios.filter(a => publicable(a, today));
    configurarCategorias();
    renderizar();
  } catch (err) {
    countLabel.textContent = "Anuncios no disponibles";
    featuredSection.hidden = true;
    listSection.hidden = false;
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
