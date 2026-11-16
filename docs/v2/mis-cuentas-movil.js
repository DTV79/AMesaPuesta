/* Presentación móvil de Mis cuentas. Lee los datos ya calculados por la página;
   no hace llamadas a la base de datos ni modifica los cálculos contables. */
(()=>{
  "use strict";
  const main=document.querySelector(".cuotas-wrap");
  const nav=document.querySelector(".cuotas-mobile-tabs");
  if(!main||!nav)return;
  const breakpoint=window.matchMedia("(max-width:600px)");
  const buttons=[...nav.querySelectorAll("[data-cuentas-tab]")];
  const panels=[...main.querySelectorAll("[data-cuentas-panel]")];
  const historial=document.getElementById("cuotas-historial");
  let selected="resumen";
  function applyTab(scroll){
    const mobile=breakpoint.matches;
    main.classList.toggle("cuentas-tabs-activas",mobile);
    for(const b of buttons){
      const active=b.dataset.cuentasTab===selected;
      b.setAttribute("aria-selected",String(active));
      b.tabIndex=active?0:-1;
    }
    for(const panel of panels){
      const active=panel.dataset.cuentasPanel===selected;
      panel.classList.toggle("cuentas-tab-activo",active);
      // Los paneles existentes pueden estar ocultos hasta que se complete la carga.
      panel.inert=mobile&&!active;
      if(mobile&&!active)panel.setAttribute("aria-hidden","true");
      else panel.removeAttribute("aria-hidden");
    }
    if(scroll&&mobile)nav.scrollIntoView({behavior:"smooth",block:"start"});
  }
  for(let i=0;i<buttons.length;i++){
    buttons[i].addEventListener("click",()=>{
      selected=buttons[i].dataset.cuentasTab;
      applyTab(true);
    });
    buttons[i].addEventListener("keydown",event=>{
      if(!breakpoint.matches)return;
      if(event.key!=="ArrowLeft"&&event.key!=="ArrowRight")return;
      event.preventDefault();
      const step=event.key==="ArrowRight"?1:-1;
      const next=buttons[(i+step+buttons.length)%buttons.length];
      selected=next.dataset.cuentasTab;
      applyTab(false);
      next.focus();
    });
  }
  function onBreakpoint(){
    if(historial)historial.open=!breakpoint.matches;
    applyTab(false);
  }
  if(typeof breakpoint.addEventListener==="function")breakpoint.addEventListener("change",onBreakpoint);
  else breakpoint.addListener(onBreakpoint);
  onBreakpoint();

  const e=(tag,cls,label)=>{
    const node=document.createElement(tag);
    if(cls)node.className=cls;
    if(label!=null)node.textContent=String(label);
    return node;
  };
  function row(label,value){
    const line=e("div");
    line.append(e("span","",label),e("strong","",value||"—"));
    return line;
  }
  function entry(title,subtitle,amount,details){
    const card=e("details","cuotas-movil-registro");
    const summary=e("summary");
    const titleBlock=e("span");
    titleBlock.append(e("span","cuotas-movil-titulo",title),e("small","cuotas-movil-subtitulo",subtitle));
    summary.append(titleBlock,e("strong","cuotas-movil-importe",amount));
    card.append(summary);
    const content=e("div","cuotas-movil-detalle");
    for(const [label,value] of details)content.append(row(label,value));
    card.append(content);
    return card;
  }
  const pending=document.getElementById("cuotas-pendiente");
  const pendingCopy=document.getElementById("cuotas-mobile-pendiente-val");
  if(pending&&pendingCopy){
    const update=()=>pendingCopy.textContent=pending.textContent;
    new MutationObserver(update).observe(pending,{childList:true,characterData:true,subtree:true});
    update();
  }
  const loadStatus=document.getElementById("cuotas-estado");
  if(loadStatus){
    const update=()=>loadStatus.classList.toggle("cuotas-estado-ok",loadStatus.textContent.startsWith("Resumen actualizado"));
    new MutationObserver(update).observe(loadStatus,{childList:true,characterData:true,subtree:true});
    update();
  }
  function watchRows(source,callback){
    if(!source)return;
    let scheduled=false;
    const schedule=()=>{
      if(scheduled)return;
      scheduled=true;
      requestAnimationFrame(()=>{scheduled=false;callback()});
    };
    new MutationObserver(schedule).observe(source,{childList:true,subtree:true,characterData:true});
    schedule();
  }
  const historialBody=document.getElementById("cuotas-movimientos");
  const historialMobile=document.getElementById("cuotas-movimientos-movil");
  const historyCount=document.getElementById("cuotas-historial-cantidad");
  watchRows(historialBody,()=>{
    if(!historialMobile)return;
    historialMobile.replaceChildren();
    const data=[...historialBody.querySelectorAll("tr")].map(r=>[...r.querySelectorAll("td")].map(x=>x.textContent.trim()));
    const valid=data.filter(v=>v.length===5);
    if(historyCount)historyCount.textContent=valid.length?"("+valid.length+")":"";
    if(!valid.length){
      historialMobile.append(e("p","cuotas-movil-nota",data[0]?.[0]||"Sin aportaciones registradas."));
      return;
    }
    for(const v of valid){
      const [year,date,concept,method,amount]=v;
      historialMobile.append(entry(concept,date,amount,[["Ejercicio",year],["Fecha",date],["Forma de pago",method]]));
    }
  });
  const gastosBody=document.getElementById("gastos-personales-body");
  const gastosMobile=document.getElementById("gastos-personales-movil");
  watchRows(gastosBody,()=>{
    if(!gastosMobile)return;
    gastosMobile.replaceChildren();
    const trs=[...gastosBody.querySelectorAll("tr")];
    let total=0;
    for(const tr of trs){
      const cells=[...tr.querySelectorAll("td")];
      if(cells.length!==5)continue;
      const name=cells[0].querySelector("strong")?.textContent.trim()||"Restaurante";
      const hints=[...cells[0].querySelectorAll("small")].map(x=>x.textContent.trim());
      const [date,breakdown]=hints;
      const card=entry(name,date||"Comida",cells[4].textContent.trim(),[
        ["Asistió",cells[1].textContent.trim()],
        ["Gasto comida",cells[2].textContent.trim()],
        ["Otros gastos",cells[3].textContent.trim()],
        ["Total",cells[4].textContent.trim()]
      ]);
      if(breakdown)card.querySelector(".cuotas-movil-detalle").append(e("p","",breakdown));
      gastosMobile.append(card);
      total++;
    }
    if(!total){
      gastosMobile.append(e("p","cuotas-movil-nota",gastosBody.textContent.trim()||"Cargando gastos…"));
    }
  });
})();