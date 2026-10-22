/**
 * promesas.js · ciclo de vida de una promesa con número aleatorio.
 * Criterio: 0–9 par → resolve; impar → reject.
 */

import { el, qs } from "../core/dom.js";
import { createConsole } from "../core/console-panel.js";
import { initUI, setBusy } from "../core/ui.js";

initUI();

const consola = createConsole("[data-console]");
const stateEl = qs("[data-state]");
const meter = qs("[data-meter]");
const progressEl = qs("[data-progress]");
const result = qs("[data-result]");
const numberEl = qs("[data-number]");
const titleEl = qs("[data-result-title]");
const messageEl = qs("[data-result-msg]");
const durationEl = qs("[data-duration]");
const runBtn = qs("[data-run]");
const runFiveBtn = qs("[data-run-five]");
const clearHistoryBtn = qs("[data-clear-history]");
const historyEl = qs("[data-history]");
const historyCount = qs("[data-history-count]");

let busy = false;
let ejecuciones = 0;

function setEstado(state, label) {
  stateEl.dataset.state = state;
  stateEl.textContent = label;
}

function iniciarBarra() {
  meter.classList.remove("progress__bar--run", "progress__bar--ok", "progress__bar--err");
  meter.style.width = "0%";
  progressEl.setAttribute("aria-valuenow", "0");
  void meter.offsetWidth;
  meter.classList.add("progress__bar--run");
}

function terminarBarra(exito) {
  meter.style.width = "100%";
  meter.classList.remove("progress__bar--run");
  meter.classList.add(exito ? "progress__bar--ok" : "progress__bar--err");
  progressEl.setAttribute("aria-valuenow", "100");
}

function crearHistorial(numero, exito, duracion) {
  historyEl.querySelector("[data-history-empty]")?.remove();

  const item = el("li", { className: `history-item history-item--${exito ? "ok" : "err"}` }, [
    el("span", { className: "history-item__num", "aria-hidden": "true", text: String(numero) }),
    el("span", {
      text: exito ? "Resuelta · número par" : "Rechazada · número impar",
    }),
    el("span", { className: "history-item__meta", text: `${duracion} ms` }),
  ]);

  historyEl.prepend(item);
  ejecuciones += 1;
  historyCount.textContent = `${ejecuciones} ${ejecuciones === 1 ? "ejecución" : "ejecuciones"}`;
}

function vaciarHistorial() {
  ejecuciones = 0;
  historyCount.textContent = "0 ejecuciones";
  historyEl.replaceChildren(
    el("li", { className: "history-item", dataset: { historyEmpty: "1" } }, [
      el("span", { className: "history-item__num", "aria-hidden": "true", text: "—" }),
      el("span", { className: "muted small", text: "Todavía no hay ejecuciones." }),
    ]),
  );
}

function lanzarPromesa() {
  const numero = Math.floor(Math.random() * 10);
  const inicio = performance.now();

  setEstado("pendiente", "Pendiente");
  result.dataset.tone = "";
  numberEl.textContent = String(numero);
  titleEl.textContent = "Promesa pendiente…";
  messageEl.textContent = "El temporizador de 1,2 s simula una operación asíncrona.";
  durationEl.textContent = "Duración —";
  iniciarBarra();

  consola.info(`new Promise(...) · número generado: ${numero}`);
  consola.log(numero % 2 === 0 ? "Es par → se llamará resolve()" : "Es impar → se llamará reject()");

  return new Promise((resolve) => {
    const promesa = new Promise((resolver, rechazar) => {
      setTimeout(() => {
        if (numero % 2 === 0) resolver({ numero, tipo: "par" });
        else rechazar(new Error(`El número ${numero} es impar`));
      }, 1200);
    });

    promesa
      .then((datos) => {
        const duracion = Math.round(performance.now() - inicio);
        setEstado("resuelta", "Resuelta");
        result.dataset.tone = "ok";
        titleEl.textContent = "Promesa resuelta";
        messageEl.textContent = `El número ${datos.numero} es par. El valor llegó al then.`;
        durationEl.textContent = `Duración ${duracion} ms`;
        terminarBarra(true);
        crearHistorial(datos.numero, true, duracion);
        consola.success("then →", datos);
        consola.info("Estado final: fulfilled (resuelta)");
      })
      .catch((error) => {
        const duracion = Math.round(performance.now() - inicio);
        setEstado("rechazada", "Rechazada");
        result.dataset.tone = "err";
        titleEl.textContent = "Promesa rechazada";
        messageEl.textContent = error.message;
        durationEl.textContent = `Duración ${duracion} ms`;
        terminarBarra(false);
        crearHistorial(numero, false, duracion);
        consola.error("catch →", error.message);
        consola.info("Estado final: rejected (rechazada)");
      })
      .finally(() => {
        consola.debug("finally → la promesa terminó, con éxito o sin él.");
        resolve();
      });
  });
}

async function ejecutarUna() {
  if (busy) return;
  busy = true;
  setBusy(runBtn, true, "Lanzando…");
  runFiveBtn.disabled = true;
  consola.info("--- Nueva ejecución ---");

  try {
    await lanzarPromesa();
  } finally {
    busy = false;
    setBusy(runBtn, false);
    runFiveBtn.disabled = false;
  }
}

async function ejecutarCinco() {
  if (busy) return;
  busy = true;
  runBtn.disabled = true;
  setBusy(runFiveBtn, true, "Serie en curso…");
  consola.info("--- Cinco promesas en serie (await una tras otra) ---");

  try {
    for (let i = 0; i < 5; i += 1) {
      consola.debug(`Serie · ejecución ${i + 1} de 5`);
      await lanzarPromesa();
    }
    consola.success("Serie completada. Cada promesa esperó a la anterior.");
  } finally {
    busy = false;
    runBtn.disabled = false;
    setBusy(runFiveBtn, false);
  }
}

runBtn.addEventListener("click", ejecutarUna);
runFiveBtn.addEventListener("click", ejecutarCinco);

clearHistoryBtn.addEventListener("click", () => {
  vaciarHistorial();
  consola.info("Historial de ejecuciones limpiado.");
});

consola.info("Criterio: números pares → resolve(); impares → reject().");
consola.log("Pulsa «Lanzar promesa» para comenzar.");
