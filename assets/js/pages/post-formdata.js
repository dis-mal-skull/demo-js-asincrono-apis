/**
 * post-formdata.js · POST con fetch + FormData y respuesta en texto plano.
 */

import { on, qs } from "../core/dom.js";
import { describeError, requestText } from "../core/http.js";
import { createConsole } from "../core/console-panel.js";
import { initUI, setBusy, toast } from "../core/ui.js";

initUI();

const form = qs("[data-form]");
const output = qs("[data-output]");
const statusEl = qs("[data-status]");
const httpChip = qs("[data-http]");
const timeChip = qs("[data-time]");
const typeChip = qs("[data-type]");
const submitBtn = qs("[data-submit]");
const counter = qs("[data-counter]");
const consola = createConsole("[data-console]");

let busy = false;

const REGLAS = {
  nombre: (valor) => (valor.trim().length >= 2 ? "" : "Escribe al menos 2 caracteres."),
  correo: (valor) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim()) ? "" : "Escribe un correo válido, por ejemplo ana@example.com.",
  mensaje: (valor) => (valor.trim().length >= 5 ? "" : "Cuenta un poco más: mínimo 5 caracteres."),
};

function setStatus(text, tone = "") {
  statusEl.textContent = text;
  statusEl.classList.remove("is-ok", "is-error", "is-busy");
  if (tone) statusEl.classList.add(tone);
}

function mostrarError(name, message) {
  const paragraph = qs(`[data-error="${name}"]`);
  const input = form.elements[name];
  if (paragraph) {
    paragraph.hidden = !message;
    paragraph.textContent = message || "";
  }
  if (input) {
    if (message) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  }
}

function actualizarContador() {
  const length = form.elements.mensaje.value.length;
  counter.textContent = `${length} / 400`;
}

function validar() {
  const errores = [];
  for (const [name, regla] of Object.entries(REGLAS)) {
    const message = regla(form.elements[name].value);
    mostrarError(name, message);
    if (message) errores.push(name);
  }
  return errores;
}

function resetChips() {
  httpChip.textContent = "HTTP —";
  timeChip.textContent = "Tiempo —";
  typeChip.textContent = "Content-Type —";
}

function limpiarSalida() {
  output.textContent = "La respuesta del servidor aparecerá aquí.";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;

  const errores = validar();
  if (errores.length) {
    setStatus("Revisa los campos marcados", "is-error");
    consola.warn("Formulario inválido:", errores);
    form.elements[errores[0]]?.focus();
    return;
  }

  busy = true;
  setBusy(submitBtn, true, "Enviando…");
  resetChips();
  limpiarSalida();
  setStatus("Enviando formulario…", "is-busy");
  consola.info("--- Nuevo envío ---");

  const datos = new FormData(form);
  const url = new URL("../test.php", window.location.href).href;
  consola.info(`POST ${url}`);
  consola.log("Campos enviados:", Object.fromEntries(datos.entries()));

  try {
    const { text, status, elapsed, contentType } = await requestText(url, {
      method: "POST",
      body: datos,
      timeout: 20000,
    });

    httpChip.textContent = `HTTP ${status}`;
    timeChip.textContent = `${elapsed} ms`;
    typeChip.textContent = (contentType || "—").split(";")[0];
    output.textContent = text || "(respuesta vacía)";
    setStatus(`HTTP ${status} · respuesta recibida`, "is-ok");

    consola.success(`HTTP ${status} en ${elapsed} ms`);
    consola.info("Content-Type:", contentType || "no informado");
    consola.log("Respuesta:", text.slice(0, 240));
  } catch (error) {
    httpChip.textContent = error.status ? `HTTP ${error.status}` : "HTTP —";
    timeChip.textContent = error.elapsed ? `${error.elapsed} ms` : "—";
    output.textContent = `No fue posible completar el envío.\n\n${describeError(error)}`;
    setStatus("Error al enviar", "is-error");
    consola.error(describeError(error));
    consola.info("Comprueba que el servidor esté activo en http://localhost:5500.");
  } finally {
    busy = false;
    setBusy(submitBtn, false);
  }
});

Object.keys(REGLAS).forEach((name) => {
  on(form.elements[name], "input", () => {
    if (form.elements[name].getAttribute("aria-invalid") === "true") {
      mostrarError(name, REGLAS[name](form.elements[name].value));
    }
    if (name === "mensaje") actualizarContador();
  });
});

on(form, "reset", () => {
  Object.keys(REGLAS).forEach((name) => mostrarError(name, ""));
  resetChips();
  limpiarSalida();
  setStatus("Listo para enviar");
  actualizarContador();
  consola.clear();
  consola.info("Formulario limpiado.");
});

on(qs("[data-ejemplo]"), "click", () => {
  form.elements.nombre.value = "Ana Gómez";
  form.elements.correo.value = "ana@example.com";
  form.elements.mensaje.value = "Quiero practicar fetch con FormData y revisar la respuesta del servidor.";
  Object.keys(REGLAS).forEach((name) => mostrarError(name, ""));
  actualizarContador();
  toast("Datos de ejemplo cargados.", "success", 2400);
  form.elements.mensaje.focus();
});

actualizarContador();
consola.info("Formulario listo. El servidor limpia etiquetas y limita cada campo a 400 caracteres.");
