/**
 * ui.js · inicialización global, portapapeles, toasts, banners y estados.
 */

import { el, qs, qsa, on } from "./dom.js";

const TOAST_ICONS = { success: "✓", error: "!", warning: "!", info: "i" };
const VALID_TOASTS = new Set(["success", "error", "warning", "info"]);

/* ---------- Portapapeles ---------- */

/** Copia texto con Clipboard API y fallback a execCommand. */
export async function copyText(text) {
  const value = String(text ?? "");
  if (!value) throw new Error("No hay contenido para copiar.");

  if (navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      /* continúa con el fallback */
    }
  }

  const area = document.createElement("textarea");
  area.value = value;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.top = "-9999px";
  area.style.opacity = "0";
  document.body.append(area);
  area.select();
  area.setSelectionRange(0, area.value.length);

  try {
    const ok = document.execCommand("copy");
    if (!ok) throw new Error("El navegador no permitió copiar.");
    return true;
  } finally {
    area.remove();
  }
}

function setupCopyButtons() {
  qsa("[data-copy], [data-copy-target], .copy-btn").forEach((button) => {
    if (button.dataset.copyReady === "1") return;
    button.dataset.copyReady = "1";

    on(button, "click", async () => {
      const targetSelector = button.dataset.copyTarget;
      const target = targetSelector ? qs(targetSelector) : null;
      const code = button.closest(".code-window, .terminal-card, .endpoint-box")?.querySelector("pre code, code");
      const text = button.dataset.copy || target?.textContent || code?.textContent || "";

      const original = button.innerHTML;
      try {
        await copyText(text);
        button.classList.add("is-copied");
        button.textContent = "¡Copiado!";
        toast("Contenido copiado al portapapeles.", "success", 2400);
        setTimeout(() => {
          button.classList.remove("is-copied");
          button.innerHTML = original;
        }, 1600);
      } catch (error) {
        toast(error.message || "No se pudo copiar el contenido.", "error");
      }
    });
  });
}

/* ---------- Toasts ---------- */

function ensureToastStack() {
  let stack = qs(".toast-stack");
  if (!stack) {
    stack = el("div", { className: "toast-stack", "aria-live": "polite", "aria-atomic": "false" });
    document.body.append(stack);
  }
  return stack;
}

/**
 * Muestra una notificación flotante.
 * @param {string} message
 * @param {"success"|"error"|"warning"|"info"} [type]
 * @param {number} [timeout] ms; 0 la mantiene hasta cerrarla
 */
export function toast(message, type = "info", timeout = 4200) {
  const variant = VALID_TOASTS.has(type) ? type : "info";
  const stack = ensureToastStack();

  const node = el("div", { className: `toast toast--${variant}`, role: variant === "error" ? "alert" : "status" }, [
    el("span", { className: "toast__icon", "aria-hidden": "true", text: TOAST_ICONS[variant] }),
    el("span", { className: "toast__message", text: message }),
  ]);

  const close = el("button", {
    type: "button",
    className: "toast__close",
    "aria-label": "Cerrar notificación",
    text: "×",
  });
  node.append(close);
  stack.append(node);

  let timer = 0;
  const dismiss = () => {
    clearTimeout(timer);
    node.remove();
  };
  close.addEventListener("click", dismiss);
  node.addEventListener("mouseenter", () => clearTimeout(timer));
  node.addEventListener("mouseleave", () => {
    if (timeout > 0) timer = setTimeout(dismiss, 1600);
  });
  if (timeout > 0) timer = setTimeout(dismiss, timeout);

  return node;
}

/* ---------- Estado de botones ---------- */

/** Bloquea un botón mostrando spinner sin perder su HTML original. */
export function setBusy(button, busy, label = "Procesando…") {
  if (!button) return;
  if (busy) {
    if (!button.dataset.busyHtml) button.dataset.busyHtml = button.innerHTML;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.replaceChildren(
      el("span", { className: "spinner", "aria-hidden": "true" }),
      el("span", { text: label }),
    );
  } else {
    button.disabled = false;
    button.removeAttribute("aria-busy");
    if (button.dataset.busyHtml) {
      button.innerHTML = button.dataset.busyHtml;
      delete button.dataset.busyHtml;
    }
  }
}

/* ---------- Banners ---------- */

const BANNER_ICONS = {
  warning: "!",
  info: "i",
  danger: "!",
  success: "✓",
};

/**
 * Muestra un banner de aviso dentro de un contenedor.
 * @param {Element|string} target
 * @param {{type?: string, title?: string, message?: string}|string} options
 */
export function showBanner(target, options = {}) {
  const node = typeof target === "string" ? qs(target) : target;
  if (!node) return;

  const config = typeof options === "string" ? { message: options } : options;
  const type = ["info", "danger", "success"].includes(config.type) ? config.type : "warning";
  node.className = `banner${type === "warning" ? "" : ` banner--${type}`}`;
  node.hidden = false;
  node.setAttribute("role", type === "danger" ? "alert" : "status");
  node.replaceChildren(
    el("span", { className: "banner__icon", "aria-hidden": "true", text: BANNER_ICONS[type] || "!" }),
    el("div", {}, [
      config.title ? el("strong", { text: config.title }) : null,
      config.message ? el("span", { text: config.message }) : null,
    ]),
  );
}

/** Oculta un banner. */
export function hideBanner(target) {
  const node = typeof target === "string" ? qs(target) : target;
  if (!node) return;
  node.hidden = true;
}

/* ---------- Texto y estados vacíos ---------- */

/** Escribe texto plano en un nodo o selector. */
export function setText(target, value) {
  const node = typeof target === "string" ? qs(target) : target;
  if (!node) return;
  node.textContent = value === null || value === undefined ? "" : String(value);
}

/**
 * Genera un estado vacío reutilizable.
 * @param {{icon?: string, title?: string, message?: string, action?: {label: string, onClick?: Function, href?: string}}} options
 */
export function emptyState({ icon = "∅", title = "Sin resultados", message = "", action = null } = {}) {
  const wrap = el("div", { className: "empty-state" }, [
    el("div", { className: "empty-state__icon", "aria-hidden": "true", text: icon }),
    el("h3", { text: title }),
    message ? el("p", { text: message }) : null,
  ]);

  if (action) {
    const button = action.href
      ? el("a", { className: "btn btn--outline btn--sm", href: action.href, text: action.label || "Ver más" })
      : el("button", {
          type: "button",
          className: "btn btn--outline btn--sm",
          text: action.label || "Reintentar",
          onClick: action.onClick || (() => {}),
        });
    wrap.append(button);
  }

  return wrap;
}

/* ---------- Navegación móvil ---------- */

function setupMobileNav() {
  const toggle = qs("[data-nav-toggle]");
  const nav = qs("#menu-principal");
  if (!toggle || !nav) return;

  const setOpen = (open) => {
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
  };

  on(toggle, "click", () => setOpen(!nav.classList.contains("is-open")));
  qsa("a", nav).forEach((link) => on(link, "click", () => setOpen(false)));
  on(document, "keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });
  on(document, "click", (event) => {
    if (!nav.classList.contains("is-open")) return;
    if (nav.contains(event.target) || toggle.contains(event.target)) return;
    setOpen(false);
  });
  on(window, "resize", () => {
    if (window.innerWidth > 960) setOpen(false);
  });
}

/* ---------- Inicialización ---------- */

/** Inicializa comportamiento común a todas las páginas. */
export function initUI() {
  const section = document.body.dataset.section;
  if (section) {
    qsa("[data-nav]").forEach((link) => {
      if (link.dataset.nav === section) link.setAttribute("aria-current", "page");
    });
  }

  setupMobileNav();
  setupCopyButtons();

  qsa('a[href^="http"]').forEach((link) => {
    try {
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }
    } catch {
      /* enlaces inválidos: se ignoran */
    }
  });

  qsa("[data-year]").forEach((node) => {
    node.textContent = String(new Date().getFullYear());
  });

  if (window.hljs?.highlightAll) {
    window.hljs.highlightAll();
  } else {
    window.addEventListener(
      "load",
      () => {
        window.hljs?.highlightAll?.();
      },
      { once: true },
    );
  }
}
