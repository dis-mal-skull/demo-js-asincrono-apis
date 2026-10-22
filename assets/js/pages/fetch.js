/**
 * fetch.js · consumo de JSONPlaceholder con métricas, JSON y error simulado.
 */

import { el, on, qs } from "../core/dom.js";
import { formatNumber } from "../core/format.js";
import { describeError, fetchJSON, HttpError } from "../core/http.js";
import { createConsole } from "../core/console-panel.js";
import { emptyState, initUI, setBusy } from "../core/ui.js";

initUI();

const USER_URL = "https://jsonplaceholder.typicode.com/users/1";
const ERROR_URL = "https://jsonplaceholder.typicode.com/users/9999";

const consola = createConsole("[data-console]");
const profile = qs("[data-profile]");
const jsonView = qs("[data-json]");
const statusEl = qs("[data-status]");
const urlChip = qs("[data-url]");
const httpChip = qs("[data-http]");
const timeChip = qs("[data-time]");
const sizeChip = qs("[data-size]");
const okChip = qs("[data-ok]");
const loadBtn = qs("[data-load]");
const failBtn = qs("[data-fail]");

let busy = false;
let controller = null;

function setStatus(text, tone = "") {
  statusEl.textContent = text;
  statusEl.classList.remove("is-ok", "is-error", "is-busy");
  if (tone) statusEl.classList.add(tone);
}

function resetChips() {
  urlChip.textContent = "URL —";
  httpChip.textContent = "HTTP —";
  timeChip.textContent = "Tiempo —";
  sizeChip.textContent = "Tamaño —";
  okChip.textContent = "response.ok —";
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  return `${formatNumber(bytes / 1024, { maximumFractionDigits: 1 })} KB`;
}

function renderSkeleton() {
  profile.setAttribute("aria-busy", "true");
  profile.replaceChildren(
    el("div", { className: "stack" }, [
      el("div", { className: "skeleton", style: { height: "96px" } }),
      el("div", { className: "skeleton", style: { height: "64px" } }),
      el("div", { className: "skeleton", style: { height: "64px", opacity: "0.7" } }),
    ]),
  );
}

function item(label, value) {
  return el("div", { className: "profile-item" }, [
    el("span", { text: label }),
    el("strong", { text: value || "—", title: value || "" }),
  ]);
}

function renderProfile(user) {
  const initials = String(user.name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  const links = el("div", { className: "profile-card__links" }, [
    el("a", {
      href: `mailto:${user.email}`,
      text: user.email,
    }),
    el("a", {
      href: `https://${user.website}`,
      text: user.website,
      target: "_blank",
      rel: "noopener noreferrer",
    }),
  ]);

  const card = el("article", { className: "profile-card" }, [
    el("span", { className: "avatar", "aria-hidden": "true", text: initials }),
    el("div", {}, [
      el("h3", { text: user.name || "Sin nombre" }),
      el("p", { text: `@${user.username || "usuario"} · ${user.company?.name || "Sin empresa"}` }),
      links,
    ]),
  ]);

  const facts = el("div", { className: "profile-grid" }, [
    item("Ciudad", user.address?.city),
    item("Empresa", user.company?.name),
    item("Teléfono", user.phone),
    item("Sitio web", user.website),
    item("Correo", user.email),
    item("ID", String(user.id ?? "—")),
  ]);

  profile.replaceChildren(card, facts);
  profile.setAttribute("aria-busy", "false");
}

function renderError(title, message, actionLabel = "Reintentar") {
  profile.setAttribute("aria-busy", "false");
  profile.replaceChildren(
    emptyState({
      icon: "!",
      title,
      message,
      action: { label: actionLabel, onClick: () => cargar(USER_URL) },
    }),
  );
}

async function cargar(url = USER_URL, { simulado = false } = {}) {
  if (busy) return;
  busy = true;
  setBusy(loadBtn, true, "Cargando…");
  failBtn.disabled = true;
  resetChips();
  renderSkeleton();
  setStatus("Consultando la API…", "is-busy");
  consola.info(`${simulado ? "Simulación" : "Petición"} · GET ${url}`);

  controller?.abort();
  controller = new AbortController();
  const started = performance.now();

  try {
    const { data, status, elapsed, size, contentType, url: finalUrl } = await fetchJSON(url, {
      timeout: 15000,
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    urlChip.textContent = `${new URL(finalUrl).hostname}${new URL(finalUrl).pathname}`;
    httpChip.textContent = `HTTP ${status}`;
    timeChip.textContent = `${elapsed} ms`;
    sizeChip.textContent = formatBytes(size);
    okChip.textContent = "response.ok = true";

    renderProfile(data);
    jsonView.textContent = JSON.stringify(data, null, 2);
    setStatus(`HTTP ${status} · perfil cargado`, "is-ok");

    consola.success(`HTTP ${status} en ${elapsed} ms · ${formatBytes(size)}`);
    consola.info(`Content-Type: ${contentType.split(";")[0] || "—"}`);
    consola.log("response.ok:", true);
    consola.log("JSON parseado:", data);
  } catch (error) {
    const elapsed = Number(error?.elapsed) || Math.round(performance.now() - started);
    const status = error instanceof HttpError ? error.status : 0;

    httpChip.textContent = status ? `HTTP ${status}` : "HTTP —";
    timeChip.textContent = `${elapsed} ms`;
    okChip.textContent = status ? "response.ok = false" : "response.ok —";
    jsonView.textContent = "La petición no produjo un JSON válido.";

    if (status === 404) {
      setStatus("HTTP 404 · recurso no encontrado", "is-error");
      renderError(
        "El usuario 9999 no existe",
        "La promesa de fetch se resolvió, pero response.ok era false. Por eso validamos el estado antes de leer el cuerpo.",
        "Volver al usuario 1",
      );
      consola.warn(`HTTP 404 · response.ok = false · ${elapsed} ms`);
      consola.info("fetch no lanza error por 404: la validación es responsabilidad del código.");
    } else {
      setStatus("Error de red", "is-error");
      renderError("No pudimos cargar el perfil", describeError(error));
      consola.error(describeError(error));
      consola.info("Revisa la conexión, CORS o el bloqueo de la API por el navegador.");
    }
  } finally {
    busy = false;
    setBusy(loadBtn, false);
    failBtn.disabled = false;
    profile.setAttribute("aria-busy", "false");
  }
}

on(loadBtn, "click", () => cargar(USER_URL));
on(failBtn, "click", () => {
  consola.info("Simulación manual: solicitando /users/9999…");
  cargar(ERROR_URL, { simulado: true });
});

on(window, "beforeunload", () => controller?.abort());

consola.info("Listo. La demo consulta JSONPlaceholder con timeout de 15 s.");
