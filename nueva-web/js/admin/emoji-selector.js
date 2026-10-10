import "https://cdn.jsdelivr.net/npm/emoji-picker-element@1.28.1/index.js";
export function conectarEmojis(boton,campo,contenedor){
 if(!boton||!campo||!contenedor)return;
 contenedor.classList.add("selector-emoji-completo");
 let inicio=campo.value.length,fin=inicio;
 const recordar=()=>{inicio=campo.selectionStart??campo.value.length;fin=campo.selectionEnd??inicio};
 campo.addEventListener("keyup",recordar);campo.addEventListener("click",recordar);campo.addEventListener("select",recordar);
 boton.addEventListener("mousedown",e=>e.preventDefault());
 boton.addEventListener("click",()=>{
  const abierto=contenedor.classList.contains("open")&&!contenedor.hidden;
  document.querySelectorAll(".selector-emoji-completo").forEach(c=>{c.classList.remove("open");c.hidden=true});
  if(abierto)return;
  if(!contenedor.querySelector("emoji-picker")){
   const picker=document.createElement("emoji-picker");picker.setAttribute("locale","es");
   picker.addEventListener("emoji-click",e=>{
    const emoji=e.detail.unicode;
    campo.value=campo.value.slice(0,inicio)+emoji+campo.value.slice(fin);
    inicio+=emoji.length;fin=inicio;
    campo.dispatchEvent(new Event("input",{bubbles:true}));
    campo.focus();campo.setSelectionRange(inicio,inicio);
    contenedor.classList.remove("open");contenedor.hidden=true;
   });contenedor.appendChild(picker);
  }
  contenedor.hidden=false;contenedor.classList.add("open");
 });
}
