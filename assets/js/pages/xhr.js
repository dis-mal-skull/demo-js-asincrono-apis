/**
 * xhr.js · demo de XMLHttpRequest + FormData contra ../test.php.
 */

import { on, qs, qsa } from "../core/dom.js";
import { isNumber } from "../core/format.js";
import { createConsole } from "../core/console-panel.js";
import { initUI, setBusy } from "../core/ui.js";

initUI();

const form = qs("[data-form]");
const output = qs("[data-output]");
const errorText = qs("[data-error]");
const statusEl = qs("[data-status]");
const httpChip = qs("[data-http]");
const timeChip = qs("[data-time]");
const typeChip = qs("[data-type]");
const submitBtn = qs("[data-submit]");
const steps = qsa("[data-step]");
const consola = createConsole("[data-console]");

const READY_STATES = {
  0: "UNSENT",
  1: "OPENED",
  2: "HEADERS_RECEIVED",
  3: "LOADING",
  4: "DONE",
};

let activeXhr = null;
let lastState = 0;

function setStatus(text, tone = "") {
  statusEl.textContent = text;
  statusEl.classList.remove("is-ok", "is-error", "is-busy");
  if (tone) statusEl.classList.add(tone);
}

function resetStepper() {
  steps.forEach((step) => step.classList.remove("is-active", "is-done", "is-error"));
}

function markStep(value) {
  steps.forEach((step) => {
    const current = Number(step.dataset.step);
    step.classList.toggle("is-done", current < value);
    step.classList.toggle("is-active", current === value);
  });
}

function finishStepper(ok) {
  steps.forEach((step) => {
    step.classList.remove("is-active");
    if (ok) step.classList.add("is-done");
    else step.classList.add("is-error");
  });
}

function resetChips() {
  httpChip.textContent = "HTTP —";
  timeChip.textContent = "Tiempo —";
  typeChip.textContent = "Content-Type —";
}

function resetOutput() {
  output.textContent = "La respuesta del servidor aparecerá aquí.";
}

function validate() {
  const num1 = form.elements.num1.value.trim();
  const num2 = form.elements.num2.value.trim();

  if (!isNumber(num1) || !isNumber(num2)) {
    errorText.hidden = false;
    errorText.textContent = "Escribe dos números válidos antes de enviar.";
    form.elements.num1.setAttribute("aria-invalid", String(!isNumber(num1)));
    form.elements.num2.setAttribute("aria-invalid", String(!isNumber(num2)));
    return null;
  }

  errorText.hidden = true;
  form.elements.num1.removeAttribute("aria-invalid");
  form.elements.num2.removeAttribute("aria-invalid");
  return { num1, num2 };
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const values = validate();
  if (!values) {
    setStatus("Revisa los datos", "is-error");
    consola.warn("Formulario inválido: num1 y num2 deben ser numéricos.");
    return;
  }

  if (activeXhr) {
    activeXhr.abort();
    activeXhr = null;
  }

  resetStepper();
  resetChips();
  resetOutput();
  setStatus("Enviando petición…", "is-busy");
  setBusy(submitBtn, true, "Enviando…");
  consola.clear();
  lastState = 0;

  const xhr = new XMLHttpRequest();
  activeXhr = xhr;
  const started = performance.now();
  const url = new URL("../test.php", window.location.href).href;

  xhr.open("POST", url, true);
  xhr.timeout = 20000;
  xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");

  xhr.onreadystatechange = () => {
    if (xhr.readyState === lastState) return;
    lastState = xhr.readyState;

    const label = READY_STATES[xhr.readyState] || `Estado ${xhr.readyState}`;
    consola.log(`readyState ${xhr.readyState} · ${label}`);

    if (xhr.readyState >= 1 && xhr.readyState <= 4) markStep(xhr.readyState);
    if (xhr.readyState === 2) {
      const type = xhr.getResponseHeader("content-type") || "sin content-type";
      consola.info("Cabeceras recibidas ·", type);
    }
  };

  xhr.onload = () => {
    const elapsed = Math.round(performance.now() - started);
    const type = xhr.getResponseHeader("content-type") || "—";

    httpChip.textContent = `HTTP ${xhr.status}`;
    timeChip.textContent = `${elapsed} ms`;
    typeChip.textContent = type.split(";")[0];
    output.textContent = xhr.responseText || "(respuesta vacía)";

    const ok = xhr.status >= 200 && xhr.status < 300;
    finishStepper(ok);

    if (ok) {
      setStatus(`HTTP ${xhr.status} · respuesta recibida`, "is-ok");
      consola.success(`HTTP ${xhr.status} en ${elapsed} ms`);
      consola.info(`Content-Type: ${type}`);
    } else {
      setStatus(`HTTP ${xhr.status} · revisa la respuesta`, "is-error");
      consola.error(`El servidor respondió ${xhr.status}`);
    }

    consola.log("Respuesta en texto plano:", (xhr.responseText || "").slice(0, 180));
    consola.info(`Petición completada en ${elapsed} ms · ${url}`);
    setBusy(submitBtn, false);
    activeXhr = null;
  };

  xhr.onerror = () => {
    const elapsed = Math.round(performance.now() - started);
    finishStepper(false);
    setStatus("Error de red", "is-error");
    timeChip.textContent = `${elapsed} ms`;
    output.textContent =
      "No fue posible conectar con el servidor.\n\nVerifica que estés ejecutando npm start (o php -S localhost:5500) y que la página se haya abierto desde http://localhost:5500.";
    consola.error("Error de red al contactar ../test.php");
    consola.info("Sugerencia: no uses file://; arranca el servidor local.");
    setBusy(submitBtn, false);
    activeXhr = null;
  };

  xhr.ontimeout = () => {
    finishStepper(false);
    setStatus("Tiempo agotado", "is-error");
    output.textContent = "La petición superó el límite de 20 segundos.";
    consola.error("Timeout: la petición tardó más de 20 s.");
    setBusy(submitBtn, false);
    activeXhr = null;
  };

  xhr.onabort = () => {
    setStatus("Petición cancelada");
    consola.warn("Petición cancelada por el usuario.");
    setBusy(submitBtn, false);
    activeXhr = null;
  };

  const datos = new FormData(form);
  consola.info(`POST ${url}`);
  consola.log("FormData:", Array.from(datos.entries()));

  xhr.send(datos);
});

on(form, "reset", () => {
  if (activeXhr) {
    activeXhr.abort();
    activeXhr = null;
  }
  setBusy(submitBtn, false);
  resetStepper();
  resetChips();
  resetOutput();
  errorText.hidden = true;
  setStatus("Listo para enviar");
  consola.clear();
  consola.info("Formulario reiniciado.");
});

on(window, "beforeunload", () => {
  activeXhr?.abort();
});
