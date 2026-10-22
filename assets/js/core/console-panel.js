/**
 * console-panel.js · consola visual con hora es-CO, tipos y espejo en la consola real.
 */

import { el } from "./dom.js";
import { formatTime } from "./format.js";

const TAGS = {
  log: "log",
  info: "info",
  success: "ok",
  warn: "warn",
  error: "error",
  debug: "debug",
};

const MAX_DEPTH = 2;

function quote(text) {
  return JSON.stringify(text);
}

/** Serializa valores de consola a texto legible (profundidad máxima 2). */
export function serialize(value, depth = 0, seen = new WeakSet()) {
  if (value === null) return "null";
  if (value === undefined) return "undefined";

  const type = typeof value;
  if (type === "string") return depth === 0 ? value : quote(value);
  if (type === "number" || type === "bigint" || type === "boolean") return String(value);
  if (type === "symbol") return value.toString();
  if (type === "function") return `ƒ ${value.name || "anónima"}()`;

  if (value instanceof Error) {
    return `${value.name}: ${value.message}`;
  }

  if (value instanceof Date) return value.toISOString();

  if (typeof Node !== "undefined" && value instanceof Node) {
    if (value.nodeType === 1) {
      const tag = value.tagName.toLowerCase();
      const id = value.id ? `#${value.id}` : "";
      const cls = value.classList?.length ? `.${Array.from(value.classList).join(".")}` : "";
      return `<${tag}${id}${cls}>`;
    }
    return `[Nodo ${value.nodeName}]`;
  }

  if (seen.has(value)) return "[Circular]";
  if (depth >= MAX_DEPTH) {
    if (Array.isArray(value)) return `[… ${value.length} elementos]`;
    return "{…}";
  }

  seen.add(value);

  if (Array.isArray(value)) {
    const items = value.slice(0, 12).map((item) => serialize(item, depth + 1, seen));
    if (value.length > 12) items.push(`… ${value.length - 12} más`);
    return `[${items.join(", ")}]`;
  }

  if (value instanceof Map) {
    return `Map(${value.size}) { ${Array.from(value.entries())
      .slice(0, 8)
      .map(([k, v]) => `${serialize(k, depth + 1, seen)} => ${serialize(v, depth + 1, seen)}`)
      .join(", ")} }`;
  }

  if (value instanceof Set) {
    return `Set(${value.size}) { ${Array.from(value.values())
      .slice(0, 8)
      .map((v) => serialize(v, depth + 1, seen))
      .join(", ")} }`;
  }

  const entries = Object.entries(value).slice(0, 14);
  const body = entries
    .map(([key, val]) => `${key}: ${serialize(val, depth + 1, seen)}`)
    .join(", ");
  const extra = Object.keys(value).length > entries.length ? ", …" : "";
  seen.delete(value);
  return `{ ${body}${extra} }`;
}

function resolveRoot(root) {
  if (typeof root === "string") return document.querySelector(root);
  return root || null;
}

export class ConsolePanel {
  /**
   * @param {Element|string} root elemento que contiene [data-console-log] y [data-console-clear]
   * @param {{mirror?: boolean, maxLines?: number}} [options]
   */
  constructor(root, { mirror = true, maxLines = 300 } = {}) {
    this.root = resolveRoot(root);
    this.mirror = mirror;
    this.maxLines = maxLines;
    this.count = 0;

    if (!this.root) {
      this.logEl = null;
      this.clearEl = null;
      return;
    }

    this.logEl = this.root.querySelector("[data-console-log]");
    this.clearEl = this.root.querySelector("[data-console-clear]");
    this.countEl = this.root.querySelector("[data-console-count]");

    if (this.logEl) {
      this.placeholder =
        this.logEl.querySelector(".console-empty") ||
        el("div", { className: "console-empty", text: "La consola está lista. Ejecuta una acción para ver la salida." });
      if (!this.placeholder.isConnected) this.logEl.append(this.placeholder);
    }

    this.clearEl?.addEventListener("click", () => this.clear());
  }

  line(type, args) {
    if (!this.logEl) return;

    const nearBottom =
      this.logEl.scrollHeight - this.logEl.scrollTop - this.logEl.clientHeight < 48;

    this.placeholder?.remove();

    const message = args.map((arg) => serialize(arg)).join(" ");
    const row = el("div", {
      className: `console-line console-line--${type}`,
      dataset: { type },
    }, [
      el("span", { className: "console-line__time", text: formatTime(new Date()) }),
      el("span", { className: "console-line__tag", text: TAGS[type] || type }),
      el("span", { className: "console-line__msg", text: message }),
    ]);

    this.logEl.append(row);
    this.count += 1;

    while (this.logEl.querySelectorAll(".console-line").length > this.maxLines) {
      this.logEl.querySelector(".console-line")?.remove();
    }

    if (this.countEl) this.countEl.textContent = String(this.count);
    if (nearBottom) this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  log(...args) {
    this.line("log", args);
    if (this.mirror) console.log("[demo]", ...args);
    return this;
  }

  info(...args) {
    this.line("info", args);
    if (this.mirror) console.info("[demo]", ...args);
    return this;
  }

  success(...args) {
    this.line("success", args);
    if (this.mirror) console.log("%c[demo] ✔", "color:#0e8a5f", ...args);
    return this;
  }

  warn(...args) {
    this.line("warn", args);
    if (this.mirror) console.warn("[demo]", ...args);
    return this;
  }

  error(...args) {
    this.line("error", args);
    if (this.mirror) console.error("[demo]", ...args);
    return this;
  }

  debug(...args) {
    this.line("debug", args);
    if (this.mirror) console.debug("[demo]", ...args);
    return this;
  }

  clear() {
    if (!this.logEl) return;
    this.logEl.querySelectorAll(".console-line").forEach((node) => node.remove());
    this.count = 0;
    if (this.countEl) this.countEl.textContent = "0";
    if (this.placeholder && !this.placeholder.isConnected) this.logEl.append(this.placeholder);
  }
}

/** Crea una consola visual a partir de un contenedor. */
export function createConsole(root, options = {}) {
  return new ConsolePanel(root, options);
}
