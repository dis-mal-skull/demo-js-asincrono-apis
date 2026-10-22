/**
 * dom.js · utilidades de selección, creación y eventos.
 * Sin dependencias. Todas las funciones son exportables y tolerantes a fallos.
 */

/** Atajo de querySelector. */
export const qs = (selector, root = document) => root.querySelector(selector);

/** Atajo de querySelectorAll que devuelve un array real. */
export const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

/**
 * Suscribe un listener y devuelve la función para desuscribirlo.
 * @returns {() => void}
 */
export function on(target, type, listener, options) {
  if (!target || typeof target.addEventListener !== "function") return () => {};
  target.addEventListener(type, listener, options);
  return () => target.removeEventListener(type, listener, options);
}

/**
 * Crea un nodo con atributos declarativos.
 *
 * @param {string} tag
 * @param {Object} [attrs] className, dataset, style, text, html, on*, aria-* y atributos HTML.
 * @param {Node|string|Array<Node|string>} [children]
 * @returns {HTMLElement}
 *
 * @example
 * el("button", { className: "btn btn--primary", onClick: guardar }, "Guardar");
 */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;

    if (key === "className" || key === "class") {
      node.className = Array.isArray(value) ? value.filter(Boolean).join(" ") : String(value);
      continue;
    }

    if (key === "dataset") {
      for (const [dataKey, dataValue] of Object.entries(value)) {
        if (dataValue !== null && dataValue !== undefined) node.dataset[dataKey] = String(dataValue);
      }
      continue;
    }

    if (key === "style" && typeof value === "object") {
      Object.assign(node.style, value);
      continue;
    }

    if (key === "text") {
      node.textContent = String(value);
      continue;
    }

    if (key === "html") {
      node.innerHTML = String(value);
      continue;
    }

    if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
      continue;
    }

    if (key === "value") {
      node.value = value;
      continue;
    }

    if (value === true) {
      node.setAttribute(key, "");
      continue;
    }

    node.setAttribute(key, String(value));
  }

  const list = Array.isArray(children) ? children : [children];
  for (const child of list.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }

  return node;
}

/** Escapa texto para interpolarlo con seguridad dentro de HTML. */
export function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return map[char];
  });
}

/**
 * Retrasa la ejecución hasta que dejen de llegar llamadas.
 * La función devuelta incluye .cancel().
 */
export function debounce(fn, wait = 250) {
  let timer = 0;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

/** Formatea una duración en milisegundos como "12 min 04 s". */
export function formatMinutes(ms) {
  const totalSeconds = Math.max(0, Number(ms) || 0) / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  if (!minutes) return `${seconds} s`;
  return `${minutes} min ${String(seconds).padStart(2, "0")} s`;
}

/** Limita un número al rango [min, max]. */
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

/** Espera prometida. */
export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Respeta la preferencia de movimiento reducido del sistema. */
export function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}
