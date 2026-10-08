// Vista de PRUEBAS de encuestas Supabase. No sustituye al sistema oficial Google.
// Solo vota el usuario Auth vinculado a su propio cofrade. Sin selector de nombres.
import { SUPABASE_URL as SUPA_URL, SUPABASE_PUBLISHABLE_KEY as KEY } from './config.js';
const API = SUPA_URL.replace(/\/$/,'');
const SESSION_KEY = 'amp_cofradia_votante_sesion_v1';
let session = null;
let identity = null;

function apiHeaders(token){
  return {apikey:KEY,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})};
}
async function readJson(response){
  const data=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(
    String(data?.message||data?.error_description||data?.msg||data?.error||'Error de conexión (HTTP '+response.status+')')
  );
  return data;
}
function saveSession(data){
  if(!data?.access_token||!data?.refresh_token)throw new Error('Sesión inválida.');
  session={access_token:data.access_token,refresh_token:data.refresh_token,
    expires_at:Date.now()+(Number(data.expires_in)||3600)*1000,email:String(data.user?.email||session?.email||'')};
  sessionStorage.setItem(SESSION_KEY,JSON.stringify(session));
}
function clearSession(){
  session=null;identity=null;sessionStorage.removeItem(SESSION_KEY);
}
async function refreshSession(){
  if(!session?.refresh_token)throw new Error('Tu sesión ha caducado.');
  const response=await fetch(API+'/auth/v1/token?grant_type=refresh_token',{
    method:'POST',headers:apiHeaders(),body:JSON.stringify({refresh_token:session.refresh_token})});
  saveSession(await readJson(response));
}
async function rpc(name,params={},requiresLogin=false){
  if(requiresLogin&&!session?.access_token)throw new Error('Inicia sesión para votar.');
  if(requiresLogin&&Date.now()>(session.expires_at||0)-60000)await refreshSession();
  const request=()=>fetch(API+'/rest/v1/rpc/'+name,{
    method:'POST',headers:apiHeaders(requiresLogin?session.access_token:null),
    body:JSON.stringify(params),cache:'no-store'
  });
  let response=await request();
  if(response.status===401&&requiresLogin){await refreshSession();response=await request();}
  return readJson(response);
}
function authFeedback(message,error=false){
  const box=document.getElementById('polls-auth-feedback');
  box.textContent=message;box.hidden=!message;
  box.className='polls-auth-feedback'+(error?' is-error':'');
}
function renderAuth(){
  const form=document.getElementById('polls-auth-form');
  const user=document.getElementById('polls-auth-user');
  form.hidden=!!session;
  user.hidden=!session;
  if(session){
    document.getElementById('polls-auth-name').textContent=identity?.vinculado
      ?identity.nombre:'Cuenta sin cofrade vinculado';
    document.getElementById('polls-auth-email-label').textContent=session.email;
  }
}
async function loadIdentity(){
  identity=session?await rpc('mi_identidad_encuestas_cofradia',{},true):null;
  renderAuth();
  if(session&&!identity?.vinculado){
    authFeedback('La cuenta existe, pero aún no está vinculada a un cofrade activo. Solicita al administrador que confirme la vinculación.',true);
  }else authFeedback('');
}
async function authLogin(event){
  event.preventDefault();
  const button=document.getElementById('polls-auth-login');
  button.disabled=true;
  authFeedback('');
  try{
    const response=await fetch(API+'/auth/v1/token?grant_type=password',{
      method:'POST',headers:apiHeaders(),body:JSON.stringify({
        email:document.getElementById('polls-auth-email').value.trim(),
        password:document.getElementById('polls-auth-password').value
      })
    });
    saveSession(await readJson(response));
    document.getElementById('polls-auth-password').value='';
    await loadIdentity();
    await loadPolls({silent:true});
  }catch(error){
    clearSession();renderAuth();
    authFeedback('No se pudo acceder: '+error.message,true);
  }finally{button.disabled=false;}
}
function authLogout(){
  const token=session?.access_token;
  clearSession();renderAuth();authFeedback('Sesión cerrada.');
  if(token)fetch(API+'/auth/v1/logout',{method:'POST',headers:apiHeaders(token)}).catch(()=>{});
  render();
}
function bootAuth(){
  try{session=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null');}catch{session=null;}
  if(!session?.access_token||!session?.refresh_token){clearSession();renderAuth();return;}
  renderAuth();
  loadIdentity().then(()=>loadPolls({silent:true})).catch(error=>{
    clearSession();renderAuth();authFeedback('La sesión ha caducado: '+error.message,true);
  });
}
document.getElementById('polls-auth-form').addEventListener('submit',authLogin);
document.getElementById('polls-auth-logout').addEventListener('click',authLogout);


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
    id: asString(option?.id),
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
  const form=el('div','polls-vote-form');
  const user=identity?.vinculado?identity:null;
  if(!session){
    form.append(el('p','polls-privacy-note','Para participar en esta votación debes entrar con tu cuenta personal en el apartado «Identificación personal», situado arriba.'));
    return form;
  }
  if(!user){
    form.append(el('p','polls-privacy-note','Tu cuenta todavía no está vinculada a un cofrade activo. El administrador debe confirmar tu identidad antes de votar.'));
    return form;
  }
  if((identity.votadas||[]).includes(poll.id)){
    form.append(el('p','polls-vote-status ok','✓ Ya has participado en esta encuesta. No se puede votar dos veces.'));
    return form;
  }
  if(poll.votersMode==='cofrades'&&!['cofrade','cofrade fundador'].includes(String(user.categoria||'').toLowerCase())){
    form.append(el('p','polls-privacy-note','Esta votación está reservada a cofrades y fundadores.'));
    return form;
  }
  form.append(el('h4','',poll.maxChoices===1?'Elige tu opción':'Elige hasta '+poll.maxChoices+' opciones'));
  form.append(el('p','polls-vote-identity','Votas como: '+user.nombre));
  const choices=el('div','polls-vote-options');
  const selected=new Set(),buttons=[];
  const button=el('button','polls-vote-submit','Registrar mi voto →');
  button.type='button';button.disabled=true;
  const status=el('p','polls-vote-status');
  status.setAttribute('role','status');status.hidden=true;
  const note=el('p','polls-vote-note',typeExplanation(poll.type)+' Tu identidad se comprueba en el servidor y no se puede votar en nombre de otro cofrade.');
  let sending=false;
  function update(){
    button.disabled=sending||!selected.size;
    buttons.forEach(b=>{b.disabled=sending;});
  }
  poll.options.forEach((option,index)=>{
    const choice=el('button','polls-choice');choice.type='button';
    choice.setAttribute('aria-pressed','false');
    choice.append(el('span','polls-choice-mark','✓'),el('span','',option.name));
    choice.addEventListener('click',()=>{
      if(sending)return;
      status.hidden=true;
      if(selected.has(index))selected.delete(index);
      else if(poll.maxChoices===1){selected.clear();selected.add(index);}
      else if(selected.size>=poll.maxChoices){
        status.className='polls-vote-status error';
        status.textContent='Solo puedes elegir hasta '+poll.maxChoices+' opciones.';
        status.hidden=false;return;
      }else selected.add(index);
      buttons.forEach((b,i)=>{
        b.classList.toggle('is-selected',selected.has(i));
        b.setAttribute('aria-pressed',String(selected.has(i)));
      });
      update();
    });
    buttons.push(choice);choices.append(choice);
  });
  if(!poll.options.length)choices.append(el('p','polls-privacy-note','Sin opciones configuradas.'));
  button.addEventListener('click',async()=>{
    if(sending||!selected.size)return;
    const chosen=[...selected].sort((a,b)=>a-b).map(i=>poll.options[i]);
    if(chosen.some(o=>!o.id)){
      status.textContent='Las opciones no tienen identificadores válidos.';
      status.className='polls-vote-status error';status.hidden=false;return;
    }
    const confirmacion='¿Confirmas tu voto como '+user.nombre+' por '+chosen.map(o=>o.name).join(' / ')+'?\n\nEsta acción es irreversible.';
    if(!window.confirm(confirmacion))return;
    sending=true;button.textContent='Registrando voto…';update();status.hidden=true;
    try{
      await rpc('votar_encuesta_cofradia',{p_id:poll.id,p_opciones:chosen.map(o=>o.id)},true);
    }catch(error){
      status.textContent='No se pudo registrar: '+error.message;
      status.className='polls-vote-status error';status.hidden=false;
      sending=false;button.textContent='Registrar mi voto →';update();return;
    }
    // El servidor ya confirmó el voto; un fallo posterior de recarga no lo invalida.
    openPollId=poll.id;
    showFeedback('Voto registrado en el entorno de pruebas de Supabase. No se ha modificado la encuesta oficial de Google.','ok');
    button.textContent='Voto registrado';button.disabled=true;
    try{await loadIdentity();await loadPolls({silent:true,keepFeedback:true});}
    catch{
      status.textContent='Tu voto está registrado. Actualiza para ver los datos recientes.';
      status.className='polls-vote-status ok';status.hidden=false;
    }
  });
  form.append(choices,button,note,status);
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
    const data = await rpc('listar_encuestas_cofradia');
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
bootAuth();
