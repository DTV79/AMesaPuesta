// Encuestas V2. Conserva el contrato GET/POST del Google Apps Script actual.
// La futura administración en Supabase sustituirá este origen sin perder votos ni histórico.
const API_URL = "https://script.google.com/macros/s/AKfycbzPxPPBYBhzWRJSEm5TRHEJnW2cnxGSauLZnrUZ4UKQPwS8IP5_9I5CJWoD6JfiTQjA/exec";

const activeRoot = document.getElementById("polls-active");
const recentRoot = document.getElementById("polls-recent");
const historyRoot = document.getElementById("polls-history");
const feedback = document.getElementById("polls-feedback");
const refreshButton = document.getElementById("polls-refresh");
const historyButton = document.getElementById("polls-history-toggle");
const historySummary = document.getElementById("polls-history-summary");
let polls = [];
let cofrades = [];
let historyExpanded = false;
let openPollId = "";
let loading = false;

function el(tag, className = "", text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = String(text);
  return element;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asString(value) {
  return String(value ?? "").trim();
}

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function dateFrom(value) {
  const raw = asString(value);
  if (!raw) return null;
  const dayOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  const minute = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/.exec(raw);
  let date;
  if (dayOnly) {
    date = new Date(+dayOnly[1], +dayOnly[2] - 1, +dayOnly[3], 23, 59, 59);
  } else if (minute) {
    date = new Date(+minute[1], +minute[2] - 1, +minute[3], +minute[4], +minute[5]);
  } else {
    date = new Date(raw);
  }
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value, withTime = false) {
  const date = dateFrom(value);
  if (!date) return asString(value);
  const explicitTime = withTime || /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}$/.test(asString(value));
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit", month: "short", year: "numeric",
    ...(explicitTime ? {hour: "2-digit", minute: "2-digit"} : {})
  }).format(date).replace(/\./g, "");
}

function normalizePoll(value) {
  const options = asArray(value?.options).map(option => ({
    name: asString(option?.name),
    votes: asNumber(option?.votes),
    voters: asArray(option?.voters).map(asString)
  }));
  const rawMax = asNumber(value?.maxChoices || value?.max_choices, 1);
  return {
    id: asString(value?.id),
    title: asString(value?.title) || "Encuesta sin título",
    description: asString(value?.description),
    type: ["publica", "secreta", "participacion"].includes(value?.type) ? value.type : "secreta",
    status: value?.status === "cerrada" ? "cerrada" : "abierta",
    closedByDate: value?.closedByDate === true,
    closedByParticipation: value?.closedByParticipation === true,
    closes: asString(value?.closes),
    closedAt: asString(value?.closedAt),
    isRecentlyClosed: value?.isRecentlyClosed === true,
    countdownText: asString(value?.countdownText),
    showResults: value?.showResults !== false,
    showWinner: value?.showWinner !== false,
    maxChoices: Math.max(1, Math.floor(rawMax)),
    totalVotes: asNumber(value?.totalVotes, options.reduce((sum, option) => sum + option.votes, 0)),
    votedMembers: asArray(value?.votedMembers).map(asString),
    eligibleVotersCount: asNumber(value?.eligibleVotersCount),
    votedEligibleCount: asNumber(value?.votedEligibleCount),
    votersMode: value?.votersMode === "cofrades" ? "cofrades" : "todos",
    options,
    winner: value?.winner?.name ? {name: asString(value.winner.name), votes: asNumber(value.winner.votes)} : null,
    isTie: value?.isTie === true,
    winners: asArray(value?.winners).map(w => ({name: asString(w?.name), votes: asNumber(w?.votes)}))
  };
}

function normalizeCofrade(value) {
  return {id: asString(value?.id), nombre: asString(value?.nombre || value?.id), rango: asString(value?.rango || "cofrade").toLowerCase()};
}

function typeLabel(type) {
  return {publica: "Pública", secreta: "Secreta", participacion: "Participación visible"}[type] || "Secreta";
}

function typeIcon(type) {
  return {publica: "👁", secreta: "🔒", participacion: "✓"}[type] || "🔒";
}

function typeExplanation(type) {
  return {
    publica: "Los resultados y quién ha votado cada opción son visibles durante la votación.",
    secreta: "Mientras esté abierta, no se muestran resultados ni identidades. Al cerrar, solo se muestran resultados agregados.",
    participacion: "Se muestra quién ha participado, pero no su elección. Los resultados aparecen al cerrar."
  }[type] || "";
}

function percent(votes, poll) {
  const denominator = poll.votedEligibleCount > 0 ? poll.votedEligibleCount : poll.totalVotes;
  return denominator > 0 ? Math.max(0, Math.min(100, Math.round(100 * votes / denominator))) : 0;
}

function eligibleMembers(poll) {
  const allowed = poll.votersMode === "cofrades"
    ? cofrades.filter(c => ["cofrade", "cofrade fundador"].includes(c.rango))
    : cofrades;
  if (poll.type === "secreta") return allowed.map(c => ({...c, voted: false}));
  const voted = new Set(poll.votedMembers.map(name => name.toLocaleLowerCase("es").trim()));
  return allowed.map(c => ({
    ...c,
    voted: voted.has(c.id.toLocaleLowerCase("es")) || voted.has(c.nombre.toLocaleLowerCase("es"))
  }));
}

function sortClosed(items) {
  const stamp = p => dateFrom(p.closedAt)?.getTime() || dateFrom(p.closes)?.getTime() || 0;
  return [...items].sort((a, b) => stamp(b) - stamp(a));
}

function showFeedback(message, kind = "ok") {
  feedback.hidden = false;
  feedback.className = "polls-feedback " + kind;
  feedback.textContent = message;
}

function clearFeedback() {
  feedback.hidden = true;
  feedback.textContent = "";
}

function statusTag(text, className = "") {
  return el("span", "polls-tag " + className, text);
}

function metaRow(poll) {
  const row = el("div", "polls-card-tags");
  row.append(
    statusTag(poll.status === "abierta" ? "● Abierta" : "✓ Cerrada", poll.status === "abierta" ? "is-open" : "is-closed"),
    statusTag(typeIcon(poll.type) + " " + typeLabel(poll.type), "is-type")
  );
  if (poll.closes) row.append(statusTag((poll.status === "abierta" ? "Hasta " : "Cierre ") + formatDate(poll.closes)));
  if (poll.maxChoices > 1) row.append(statusTag("Hasta " + poll.maxChoices + " opciones"));
  else row.append(statusTag("1 opción"));
  row.append(statusTag(poll.votersMode === "cofrades" ? "Solo cofrades" : "Todos los miembros"));
  return row;
}

function participation(poll) {
  if (poll.eligibleVotersCount <= 0) return null;
  const wrap = el("div", "polls-participation");
  const row = el("div", "polls-participation-head");
  row.append(el("span", "", "Participación"), el("strong", "", poll.votedEligibleCount + " de " + poll.eligibleVotersCount));
  const bar = el("div", "polls-participation-track");
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-label", "Participación de la encuesta");
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", String(poll.eligibleVotersCount));
  bar.setAttribute("aria-valuenow", String(Math.min(poll.eligibleVotersCount, Math.max(0, poll.votedEligibleCount))));
  const fill = el("span");
  fill.style.width = Math.max(0, Math.min(100, Math.round(100 * poll.votedEligibleCount / poll.eligibleVotersCount))) + "%";
  bar.append(fill);
  wrap.append(row, bar);
  return wrap;
}

function renderWinner(poll) {
  if (!poll.showResults || !poll.showWinner || !poll.winner) return null;
  if (poll.status === "abierta" && poll.type !== "publica") return null;
  const winner = el("div", "polls-winner");
  winner.append(el("span", "polls-winner-icon", "🏆"));
  const text = el("div");
  text.append(
    el("small", "", poll.isTie ? (poll.status === "abierta" ? "Empate provisional" : "Empate final") : (poll.status === "abierta" ? "Va ganando" : "Opción ganadora")),
    el("strong", "", poll.isTie && poll.winners.length ? poll.winners.map(w => w.name).join(" · ") : poll.winner.name),
    el("span", "", poll.winner.votes + (poll.winner.votes === 1 ? " voto" : " votos"))
  );
  winner.append(text);
  return winner;
}

function renderResults(poll) {
  const wrap = el("section", "polls-results");
  wrap.append(el("h4", "", poll.status === "abierta" ? "Resultado provisional" : "Resultado final"));
  const canShow = poll.showResults && (poll.status === "cerrada" || poll.type === "publica");
  if (!canShow) {
    wrap.append(el("p", "polls-privacy-note",
      !poll.showResults ? "Los resultados no están disponibles para esta encuesta."
      : poll.type === "secreta" ? "🔒 El resultado permanecerá oculto hasta que se cierre la encuesta."
      : "El resultado se mostrará cuando finalice la encuesta."));
    return wrap;
  }
  if (!poll.options.length) {
    wrap.append(el("p", "polls-privacy-note", "Esta encuesta no tiene opciones registradas."));
    return wrap;
  }
  for (const option of poll.options) {
    const line = el("div", "polls-result");
    const labels = el("div", "polls-result-head");
    labels.append(el("span", "", option.name), el("strong", "", option.votes + (option.votes === 1 ? " voto" : " votos") + " · " + percent(option.votes, poll) + "%"));
    const track = el("div", "polls-result-track");
    const fill = el("span");
    fill.style.width = percent(option.votes, poll) + "%";
    track.append(fill);
    line.append(labels, track);
    wrap.append(line);
  }
  const winner = renderWinner(poll);
  if (winner) wrap.append(winner);
  return wrap;
}

function renderVoters(poll) {
  if (poll.type === "secreta") return null;
  if (poll.type === "publica" && !poll.showResults) return null;
  const wrap = el("section", "polls-voters");
  wrap.append(el("h4", "", poll.type === "publica" ? "Quién votó cada opción" : "Cofrades que han participado"));
  if (poll.type === "participacion") {
    const chips = el("div", "polls-voter-chips");
    if (!poll.votedMembers.length) chips.append(el("span", "polls-empty-voters", "Aún no hay participantes"));
    for (const name of poll.votedMembers) chips.append(el("span", "polls-voter-chip", name));
    wrap.append(chips);
  } else {
    for (const option of poll.options) {
      const group = el("div", "polls-voter-group");
      group.append(el("strong", "", option.name));
      const chips = el("div", "polls-voter-chips");
      if (!option.voters.length) chips.append(el("span", "polls-empty-voters", "Sin votos todavía"));
      for (const name of option.voters) chips.append(el("span", "polls-voter-chip", name));
      group.append(chips);
      wrap.append(group);
    }
  }
  return wrap;
}

function renderVoteForm(poll, card) {
  const form = el("div", "polls-vote-form");
  const title = el("h4", "", poll.maxChoices === 1 ? "Elige tu opción" : "Elige hasta " + poll.maxChoices + " opciones");
  const optionWrap = el("div", "polls-vote-options");
  const selected = new Set();
  const buttons = [];
  const members = eligibleMembers(poll);

  const voterLabel = el("label", "polls-voter-label", "Quién vota");
  const select = el("select", "polls-voter-select");
  select.setAttribute("aria-label", "Selecciona tu nombre");
  const placeholder = el("option", "", "Selecciona tu nombre");
  placeholder.value = "";
  select.append(placeholder);
  for (const member of members) {
    const opt = el("option", "", member.nombre + (member.voted ? " — ya votó" : ""));
    opt.value = member.id;
    opt.disabled = member.voted;
    select.append(opt);
  }
  if (!members.length) {
    const none = el("option", "", "No hay cofrades disponibles");
    none.value = "";
    none.disabled = true;
    select.append(none);
  }
  voterLabel.append(select);

  const button = el("button", "polls-vote-submit", "Registrar mi voto →");
  button.type = "button";
  button.disabled = true;
  const note = el("p", "polls-vote-note", typeExplanation(poll.type));
  const status = el("p", "polls-vote-status");
  status.setAttribute("role", "status");
  status.hidden = true;
  let sending = false;

  function updateButton() {
    button.disabled = sending || !select.value || selected.size === 0;
    for (const option of buttons) option.disabled = sending;
    select.disabled = sending;
  }

  poll.options.forEach((option, index) => {
    const choice = el("button", "polls-choice");
    choice.type = "button";
    choice.setAttribute("aria-pressed", "false");
    choice.append(el("span", "polls-choice-mark", "✓"), el("span", "", option.name));
    choice.addEventListener("click", () => {
      if (sending) return;
      status.hidden = true;
      if (selected.has(index)) selected.delete(index);
      else {
        if (poll.maxChoices === 1) selected.clear();
        else if (selected.size >= poll.maxChoices) {
          status.className = "polls-vote-status error";
          status.textContent = "Solo puedes elegir hasta " + poll.maxChoices + " opciones.";
          status.hidden = false;
          return;
        }
        selected.add(index);
      }
      buttons.forEach((b, i) => {
        b.classList.toggle("is-selected", selected.has(i));
        b.setAttribute("aria-pressed", String(selected.has(i)));
      });
      updateButton();
    });
    buttons.push(choice);
    optionWrap.append(choice);
  });
  if (!poll.options.length) optionWrap.append(el("p", "polls-privacy-note", "Esta encuesta no tiene opciones configuradas."));
  select.addEventListener("change", () => {
    status.hidden = true;
    updateButton();
  });

  button.addEventListener("click", async () => {
    if (sending || !select.value || selected.size === 0) return;
    const member = members.find(m => m.id === select.value);
    if (!member) return;
    const payload = {
      pollId: poll.id,
      cofrade: member.id,
      cofradeNombre: member.nombre,
      options: [...selected].sort((a, b) => a - b).map(i => poll.options[i].name)
    };
    sending = true;
    button.textContent = "Registrando voto…";
    updateButton();
    status.hidden = true;
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {"Content-Type": "text/plain;charset=utf-8"},
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error("No se pudo conectar con el servicio de votaciones.");
      const data = await response.json();
      if (!data?.ok) throw new Error(asString(data?.error) || "No se pudo registrar el voto.");
    } catch (error) {
      status.className = "polls-vote-status error";
      status.textContent = error.message || "No se pudo registrar el voto. Inténtalo de nuevo.";
      status.hidden = false;
      sending = false;
      button.textContent = "Registrar mi voto →";
      updateButton();
      return;
    }
    // El servidor ya ha aceptado el voto. Un error de recarga no debe invitar a votar otra vez.
    openPollId = poll.id;
    showFeedback("Tu voto se ha registrado correctamente. Gracias por participar.", "ok");
    button.textContent = "Voto registrado";
    button.disabled = true;
    const refreshed = await loadPolls({silent: true, keepFeedback: true});
    if (!refreshed) {
      status.className = "polls-vote-status ok";
      status.textContent = "Voto registrado. Actualiza la página para consultar los datos recientes.";
      status.hidden = false;
    }
  });

  form.append(title, optionWrap, voterLabel, button, note, status);
  return form;
}

function renderPoll(poll, scope) {
  const card = el("article", "polls-card " + (poll.status === "abierta" ? "is-active" : "is-finished"));
  card.dataset.pollId = poll.id;
  const head = el("div", "polls-card-head");
  head.append(metaRow(poll), el("h3", "polls-card-title", poll.title));
  if (poll.description) head.append(el("p", "polls-card-description", poll.description));
  const sub = el("div", "polls-card-sub");
  if (poll.countdownText && poll.status === "abierta") sub.append(el("span", "polls-countdown", "⏳ " + poll.countdownText));
  if (poll.status === "cerrada" && poll.closedAt) sub.append(el("span", "", "Cerrada el " + formatDate(poll.closedAt, true)));
  const participationBar = participation(poll);
  if (participationBar) head.append(participationBar);
  if (sub.childNodes.length) head.append(sub);
  card.append(head);

  const details = el("details", "polls-card-details");
  const summary = el("summary", "polls-card-toggle");
  summary.append(el("span", "", poll.status === "abierta" ? "Participar en la encuesta" : scope === "recent" ? "Ver resultado final" : "Ver resultados"), el("span", "polls-toggle-arrow", "⌄"));
  const content = el("div", "polls-card-content");
  if (poll.status === "abierta") {
    content.append(renderVoteForm(poll, card));
  } else {
    const reason = poll.closedByDate ? "El plazo de votación ha finalizado."
      : poll.closedByParticipation ? "Ya han participado todos los cofrades que podían votar."
      : "Esta encuesta está cerrada y ya no admite nuevos votos.";
    content.append(el("p", "polls-closed-reason", reason));
  }
  content.append(renderResults(poll));
  const voters = renderVoters(poll);
  if (voters) content.append(voters);
  details.append(summary, content);
  details.addEventListener("toggle", () => {
    if (!details.open) {
      if (scope === "active" && openPollId === poll.id) openPollId = "";
      return;
    }
    for (const other of card.parentElement?.querySelectorAll(".polls-card-details[open]") || []) {
      if (other !== details) other.open = false;
    }
    if (scope === "active") openPollId = poll.id;
  });
  if (scope === "active" && poll.id === openPollId) details.open = true;
  card.append(details);
  return card;
}

function emptyState(title, subtitle) {
  const wrap = el("div", "polls-empty");
  wrap.append(el("span", "polls-empty-icon", "🗳️"), el("strong", "", title), el("p", "", subtitle));
  return wrap;
}

function render() {
  const active = polls.filter(p => p.status === "abierta");
  const recent = sortClosed(polls.filter(p => p.status === "cerrada" && p.isRecentlyClosed));
  const history = sortClosed(polls.filter(p => p.status === "cerrada" && !p.isRecentlyClosed));
  document.getElementById("polls-count-active").textContent = String(active.length);
  document.getElementById("polls-count-recent").textContent = String(recent.length);
  document.getElementById("polls-count-history").textContent = String(history.length);

  activeRoot.replaceChildren(...(active.length
    ? active.map(p => renderPoll(p, "active"))
    : [emptyState("No hay encuestas abiertas", "Cuando se convoque una nueva votación aparecerá aquí.")]));
  recentRoot.replaceChildren(...(recent.length
    ? recent.map(p => renderPoll(p, "recent"))
    : [emptyState("Sin cierres recientes", "Las encuestas recién finalizadas aparecerán aquí durante cinco días.")]));
  historySummary.textContent = history.length
    ? history.length + (history.length === 1 ? " encuesta cerrada" : " encuestas cerradas")
    : "Todavía no hay encuestas en el histórico";
  historyRoot.hidden = !historyExpanded;
  historyButton.setAttribute("aria-expanded", String(historyExpanded));
  historyButton.firstChild.textContent = historyExpanded ? "Ocultar histórico " : "Mostrar histórico ";
  historyRoot.replaceChildren(...(historyExpanded
    ? (history.length ? history.map(p => renderPoll(p, "history")) : [emptyState("El histórico está vacío", "Aquí quedarán guardadas las decisiones de la cofradía.")])
    : []));
}

async function loadPolls({silent = false, keepFeedback = false} = {}) {
  if (loading) return false;
  loading = true;
  refreshButton.disabled = true;
  refreshButton.textContent = "Actualizando…";
  if (!keepFeedback) clearFeedback();
  if (!silent) {
    activeRoot.replaceChildren(el("div", "message", "Cargando las votaciones…"));
    recentRoot.replaceChildren(el("div", "message", "Cargando resultados…"));
  }
  try {
    const response = await fetch(API_URL, {method: "GET", cache: "no-store"});
    if (!response.ok) throw new Error("El servicio de encuestas no responde.");
    const data = await response.json();
    if (!Array.isArray(data?.polls)) throw new Error("No se ha recibido una lista válida de encuestas.");
    cofrades = asArray(data.cofrades).map(normalizeCofrade).filter(c => c.id);
    polls = data.polls.map(normalizePoll).filter(p => p.id);
    render();
    return true;
  } catch (error) {
    if (!silent || !polls.length) {
      activeRoot.replaceChildren(emptyState("No se pudieron cargar las encuestas", "Comprueba tu conexión e inténtalo con el botón Actualizar."));
      recentRoot.replaceChildren();
      historyRoot.replaceChildren();
      document.getElementById("polls-count-active").textContent = "—";
      document.getElementById("polls-count-recent").textContent = "—";
      document.getElementById("polls-count-history").textContent = "—";
    }
    if (!keepFeedback) showFeedback("No se han podido actualizar las encuestas. Prueba de nuevo en unos instantes.", "error");
    console.error("Encuestas:", error);
    return false;
  } finally {
    loading = false;
    refreshButton.disabled = false;
    refreshButton.textContent = "↻ Actualizar";
  }
}

refreshButton.addEventListener("click", () => loadPolls({silent: true}));
historyButton.addEventListener("click", () => {
  historyExpanded = !historyExpanded;
  render();
});
loadPolls();
