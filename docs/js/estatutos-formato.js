// Formato común del texto de los Estatutos (web pública y vista previa de administración).
// Los subapartados (4.1., 4.2., etc.) siguen perteneciendo a un único artículo.
const escapar = valor => String(valor ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
}[c]));

export function formatearContenidoEstatutos(texto = "") {
  const partes = [];
  const lista = [];
  const parrafo = [];
  const vaciarLista = () => {
    if (lista.length) {
      partes.push('<ul class="estatutos-lista">' + lista.map(t => "<li>" + escapar(t) + "</li>").join("") + "</ul>");
      lista.length = 0;
    }
  };
  const vaciarParrafo = () => {
    if (parrafo.length) {
      partes.push('<p class="estatutos-parrafo">' + parrafo.map(escapar).join(" ") + "</p>");
      parrafo.length = 0;
    }
  };
  for (const linea of String(texto ?? "").replace(/\r\n?/g, "\n").split("\n")) {
    const t = linea.trim();
    if (!t) { vaciarParrafo(); vaciarLista(); continue; }
    const apartado = /^(\d+)\.(\d+)\.\s+(.+)$/.exec(t);
    if (apartado) {
      vaciarParrafo(); vaciarLista();
      partes.push('<h4 class="estatutos-apartado"><span class="estatutos-apartado-numero">' +
        escapar(apartado[1] + "." + apartado[2] + ".") + "</span> " + escapar(apartado[3]) + "</h4>");
      continue;
    }
    const letra = /^([A-Z])\)\s+(.+)$/.exec(t);
    if (letra) {
      vaciarParrafo(); vaciarLista();
      partes.push('<h5 class="estatutos-subapartado">' + escapar(letra[1] + ") " + letra[2]) + "</h5>");
      continue;
    }
    if (/^[•‣-]\s+/.test(t)) {
      vaciarParrafo();
      lista.push(t.replace(/^[•‣-]\s+/, ""));
      continue;
    }
    vaciarLista();
    parrafo.push(t);
  }
  vaciarParrafo(); vaciarLista();
  return partes.join("");
}
