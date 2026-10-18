/* Diálogos propios de Administración — sustituyen alert, confirm y prompt nativos. */
(() => {
  "use strict";
  const pendientes = [];
  let ocupado = false;
  let estilosCargados = false;

  const css = `
    .amp-ui-dialog{box-sizing:border-box;border:1px solid #e2d4cb;border-radius:20px;padding:0;width:min(440px,calc(100vw - 32px));max-width:calc(100vw - 32px);max-height:calc(100dvh - 32px);overflow:auto;background:#fffdfb;color:#27211f;box-shadow:0 24px 85px #271a1970;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
    .amp-ui-dialog::backdrop{background:rgba(27,21,20,.57);-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px)}
    .amp-ui-dialog-inner{padding:25px 25px 22px}
    .amp-ui-dialog-head{display:flex;align-items:center;gap:12px;margin-bottom:12px}
    .amp-ui-dialog-icon{display:grid;place-items:center;flex:none;width:40px;height:40px;border-radius:13px;background:#f8e9e5;color:#8c2632;font-size:20px}
    .amp-ui-dialog-title{font:700 22px/1.25 Georgia,serif;color:#57212b;margin:0}
    .amp-ui-dialog-text{margin:10px 0 20px;font-size:15px;line-height:1.55;color:#514540;white-space:pre-wrap;overflow-wrap:anywhere}
    .amp-ui-dialog-input{display:block;width:100%;min-width:0;font:inherit;font-size:16px;color:#29211d;border:1px solid #d8c8bb;border-radius:11px;padding:12px 13px;background:#fff;margin:-4px 0 20px;outline-offset:2px}
    .amp-ui-dialog-input:focus-visible{outline:2px solid #8b2938}
    .amp-ui-dialog-actions{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap}
    .amp-ui-dialog-actions button{border:1px solid #ddcfc4;border-radius:11px;min-height:43px;padding:10px 18px;font-size:14px;font-weight:750;cursor:pointer;font-family:inherit}
    .amp-ui-dialog-cancel{background:#f5f0eb;color:#514741}
    .amp-ui-dialog-confirm{background:#872432;color:#fff;border-color:#872432!important}
    .amp-ui-dialog-confirm.danger{background:#a32c35;border-color:#a32c35!important}
    .amp-ui-dialog-actions button:focus-visible{outline:3px solid #d6ad8f;outline-offset:2px}
    @media(max-width:480px){.amp-ui-dialog-inner{padding:21px 19px 19px}.amp-ui-dialog-title{font-size:20px}.amp-ui-dialog-actions button{flex:1}.amp-ui-dialog-text{font-size:14px}}
    @media(prefers-reduced-motion:reduce){.amp-ui-dialog::backdrop{-webkit-backdrop-filter:none;backdrop-filter:none}}
  `;

  async function preparar() {
    if (document.readyState === "loading") {
      await new Promise(resolve => document.addEventListener("DOMContentLoaded", resolve, {once:true}));
    }
    if (!estilosCargados) {
      const style = document.createElement("style");
      style.id = "amp-dialogos-estilos";
      style.textContent = css;
      document.head.appendChild(style);
      estilosCargados = true;
    }
  }

  function mostrar({tipo, mensaje, opciones = {}}) {
    return new Promise(resolve => {
      pendientes.push({tipo, mensaje:String(mensaje ?? ""), opciones, resolve});
      procesar();
    });
  }

  async function procesar() {
    if (ocupado || !pendientes.length) return;
    ocupado = true;
    await preparar();
    const job = pendientes.shift();
    const {tipo, mensaje, opciones, resolve} = job;
    const peligro = opciones.peligro ?? (tipo === "confirm" && /eliminar|borrar|dar de baja|anular|revocar/i.test(mensaje));
    const cancelarValor = tipo === "confirm" ? false : tipo === "prompt" ? null : undefined;

    const dialog = document.createElement("dialog");
    dialog.className = "amp-ui-dialog";
    dialog.setAttribute("aria-labelledby", "amp-ui-dialog-titulo");
    dialog.setAttribute("aria-describedby", "amp-ui-dialog-descripcion");

    const interior = document.createElement("div");
    interior.className = "amp-ui-dialog-inner";
    const cabecera = document.createElement("div");
    cabecera.className = "amp-ui-dialog-head";
    const icono = document.createElement("span");
    icono.className = "amp-ui-dialog-icon";
    icono.setAttribute("aria-hidden", "true");
    icono.textContent = tipo === "alert" ? "ⓘ" : tipo === "prompt" ? "✎" : "?";
    const titulo = document.createElement("h2");
    titulo.className = "amp-ui-dialog-title";
    titulo.id = "amp-ui-dialog-titulo";
    titulo.textContent = opciones.titulo || (tipo === "alert" ? "Aviso" : tipo === "prompt" ? "Introducir datos" : "Confirmar acción");
    cabecera.append(icono, titulo);

    const descripcion = document.createElement("p");
    descripcion.className = "amp-ui-dialog-text";
    descripcion.id = "amp-ui-dialog-descripcion";
    descripcion.textContent = mensaje;
    interior.append(cabecera, descripcion);

    let input = null;
    if (tipo === "prompt") {
      input = document.createElement("input");
      input.className = "amp-ui-dialog-input";
      input.type = opciones.tipoCampo === "date" ? "date" : "text";
      input.value = String(opciones.valorInicial ?? "");
      input.setAttribute("aria-label", opciones.etiqueta || mensaje);
      input.autocomplete = "off";
      if (opciones.obligatorio) input.required = true;
      interior.append(input);
    }

    const acciones = document.createElement("div");
    acciones.className = "amp-ui-dialog-actions";
    let cancel = null;
    if (tipo !== "alert") {
      cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "amp-ui-dialog-cancel";
      cancel.textContent = "Cancelar";
      acciones.append(cancel);
    }
    const accept = document.createElement("button");
    accept.type = "button";
    accept.className = "amp-ui-dialog-confirm" + (peligro ? " danger" : "");
    accept.textContent = opciones.aceptar || (tipo === "alert" ? "Aceptar" : tipo === "prompt" ? "Continuar" : "Confirmar");
    acciones.append(accept);
    interior.append(acciones);
    dialog.append(interior);
    document.body.append(dialog);

    let resuelto = false;
    function cerrar(valor) {
      if (resuelto) return;
      resuelto = true;
      if (dialog.open) dialog.close();
      dialog.remove();
      resolve(valor);
      ocupado = false;
      procesar();
    }
    dialog.addEventListener("cancel", ev => {ev.preventDefault();cerrar(cancelarValor);});
    dialog.addEventListener("click", ev => {if (ev.target === dialog) cerrar(cancelarValor);});
    if (cancel) cancel.addEventListener("click", () => cerrar(cancelarValor));
    accept.addEventListener("click", () => {
      if (input && !input.reportValidity()) return;
      cerrar(tipo === "confirm" ? true : tipo === "prompt" ? input.value : undefined);
    });
    input?.addEventListener("keydown", ev => {
      if (ev.key === "Enter") {ev.preventDefault();accept.click();}
    });
    dialog.showModal();
    (input || (cancel && peligro ? cancel : accept)).focus();
  }

  window.AMPDialog = Object.freeze({
    alert: (mensaje, opciones) => mostrar({tipo:"alert", mensaje, opciones}),
    confirm: (mensaje, opciones) => mostrar({tipo:"confirm", mensaje, opciones}),
    prompt: (mensaje, valorInicial = "", opciones = {}) =>
      mostrar({tipo:"prompt", mensaje, opciones:{...opciones, valorInicial}})
  });
})();
