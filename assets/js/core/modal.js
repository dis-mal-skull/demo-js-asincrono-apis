/**
 * modal.js · modal accesible sobre <dialog> nativo.
 */

import { el } from "./dom.js";

let modalId = 0;

const CLOSE_ICON = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>`;

/**
 * Abre un modal y lo elimina del DOM al cerrarse.
 *
 * @param {Object} options
 * @param {string} options.title
 * @param {string} [options.subtitle]
 * @param {Node|string} [options.content]
 * @param {Node|string} [options.footer]
 * @param {"sm"|"md"|"lg"} [options.size]
 * @returns {{dialog: HTMLDialogElement, close: () => void}}
 */
export function openModal({ title, subtitle = "", content = "", footer = "", size = "md" } = {}) {
  const id = `modal-title-${++modalId}`;
  const dialog = el("dialog", {
    className: `modal${size === "lg" ? " modal--lg" : size === "sm" ? " modal--sm" : ""}`,
    "aria-labelledby": id,
  });

  const closeButton = el("button", {
    type: "button",
    className: "icon-btn modal__close",
    "aria-label": "Cerrar ventana",
    html: CLOSE_ICON,
  });

  const body = el("div", { className: "modal__body" });
  if (content instanceof Node) body.append(content);
  else if (content) body.textContent = String(content);

  const head = el("div", { className: "modal__head" }, [
    el("div", {}, [
      el("h2", { id, text: title || "Detalle" }),
      subtitle ? el("p", { text: subtitle }) : null,
    ]),
    closeButton,
  ]);

  dialog.append(head);
  if (content) dialog.append(body);

  if (footer) {
    const foot = el("div", { className: "modal__foot" });
    if (footer instanceof Node) foot.append(footer);
    else foot.textContent = String(footer);
    dialog.append(foot);
  }

  document.body.append(dialog);
  document.body.classList.add("has-modal");

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    dialog.close();
  };

  closeButton.addEventListener("click", close);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });
  dialog.addEventListener("close", () => {
    document.body.classList.remove("has-modal");
    dialog.remove();
  });

  dialog.showModal();
  closeButton.focus();

  return { dialog, close };
}

/**
 * Construye una lista de definiciones etiqueta/valor.
 * @param {Array<{label: string, value: Node|string}|[string, Node|string]>} items
 */
export function detailList(items = []) {
  const dl = el("dl", { className: "detail-list" });

  for (const item of items) {
    const label = Array.isArray(item) ? item[0] : item.label;
    const value = Array.isArray(item) ? item[1] : item.value;
    const dd = el("dd");
    if (value instanceof Node) dd.append(value);
    else dd.textContent = value === null || value === undefined || value === "" ? "—" : String(value);

    dl.append(el("div", {}, [el("dt", { text: label }), dd]));
  }

  return dl;
}
