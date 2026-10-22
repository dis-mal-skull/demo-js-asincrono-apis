/**
 * asincronia.js · demo del event loop, callbacks y callback hell.
 */

import { el, on, qs, qsa, wait } from "../core/dom.js";
import { createConsole } from "../core/console-panel.js";
import { initUI } from "../core/ui.js";

initUI();

const consola = createConsole("[data-console]");
const timeline = qs("[data-timeline]");
const flow = qs("[data-flow]");
const pyramid = qs("[data-pyramid]");
const nota = qs("[data-nota]");
const etiquetaEscenario = qs("[data-escenario-nombre]");
const status = qs("[data-status]");
const runBtn = qs("[data-run]");
const resetBtn = qs("[data-reset]");
const scenarioBtns = qsa("[data-escenario]");

const NOMBRES = {
  orden: "Orden síncrono vs. asíncrono",
  cadena: "Callbacks encadenados con estado",
  hell: "Callback hell simulado",
};

const NOTAS = {
  orden:
    "El <code>setTimeout</code> de 0 ms no se ejecuta de inmediato: entra a la cola de macrotareas y espera a que la pila y las microtareas terminen.",
  cadena:
    "Cada callback recibe el resultado del anterior. Funciona, pero el estado vive dentro de las funciones y el flujo se lee de afuera hacia adentro.",
  hell:
    "El anidamiento resuelve el problema, pero cuesta leerlo, reutilizarlo y manejar errores. Las promesas llegaron para aplanar esta pirámide.",
};

let escenario = "orden";
let running = false;
let token = 0;

function setStatus(text, state = "") {
  status.textContent = text;
  status.classList.remove("is-ok", "is-error", "is-busy");
  if (state) status.classList.add(state);
}

function resetTimeline() {
  timeline.replaceChildren(
    el("li", {
      className: "timeline__empty",
      text: "La línea de tiempo aparecerá aquí al ejecutar la demo.",
    }),
  );
}

function addStep({ label, detail = "", type = "sync" }, time = 0) {
  timeline.querySelector(".timeline__empty")?.remove();
  timeline.append(
    el("li", { className: `timeline__item timeline__item--${type}` }, [
      el("div", { className: "timeline__label" }, [
        label,
        detail ? el("small", { text: detail }) : null,
      ]),
      el("span", { className: "timeline__time", text: `+${Math.round(time)} ms` }),
    ]),
  );
}

function resetFlow() {
  qsa("[data-flow-node]").forEach((node) => node.classList.remove("is-active", "is-done"));
}

function setNode(name, state) {
  const node = qs(`[data-flow-node="${name}"]`);
  if (!node) return;
  node.classList.remove("is-active", "is-done");
  if (state === "active") node.classList.add("is-active");
  if (state === "done") node.classList.add("is-done");
}

function setRunningUI(state) {
  running = state;
  runBtn.disabled = state;
  scenarioBtns.forEach((button) => {
    button.disabled = state;
  });
}

/* ---------- Datos simulados ---------- */

function fakeGetUser(callback) {
  return setTimeout(() => callback({ id: 1, nombre: "Ana", rol: "instructora" }), 380);
}

function fakeGetPosts(usuarioId, callback) {
  return setTimeout(
    () =>
      callback([
        { id: 10, titulo: "Entendiendo el event loop" },
        { id: 11, titulo: "Promesas en la práctica" },
      ]),
    460,
  );
}

function fakeGetComments(publicacionId, callback) {
  return setTimeout(
    () =>
      callback([
        { id: 100, autor: "Carlos", texto: "Muy claro el ejemplo." },
        { id: 101, autor: "Laura", texto: "¿Y las microtareas?" },
      ]),
    420,
  );
}

/* ---------- Escenario 1 · orden ---------- */

async function ejecutarOrden(current) {
  const inicio = performance.now();
  const tiempo = () => performance.now() - inicio;

  consola.info("Escenario 1 · orden de ejecución");

  addStep({ label: "1 · inicio síncrono", detail: "console.log", type: "sync" }, 0);
  consola.log("1 · inicio síncrono");

  setTimeout(() => {
    if (current !== token) return;
    addStep({ label: "5 · setTimeout(0)", detail: "macrotarea", type: "async" }, tiempo());
    consola.warn("5 · setTimeout(0) · macrotarea");
  }, 0);

  setTimeout(() => {
    if (current !== token) return;
    addStep({ label: "6 · setTimeout(600)", detail: "temporizador", type: "async" }, tiempo());
    consola.success("6 · temporizador de 600 ms");
  }, 600);

  // Las microtareas se ejecutan antes que la próxima macrotarea.
  Promise.resolve().then(() => {
    if (current !== token) return;
    addStep({ label: "4 · microtarea", detail: "Promise.then", type: "micro" }, tiempo());
    consola.info("4 · microtarea · Promise.then");
  });

  addStep({ label: "2 · segundo console.log", detail: "síncrono", type: "sync" }, tiempo());
  consola.log("2 · segundo console.log");

  addStep({ label: "3 · fin del bloque síncrono", detail: "la pila queda libre", type: "sync" }, tiempo());
  consola.log("3 · fin del bloque síncrono");

  await wait(720);
  if (current !== token) return;

  addStep({ label: "7 · colas vacías", detail: "la demo termina", type: "sync" }, tiempo());
  consola.success("Orden observado: 1 → 2 → 3 → microtarea → setTimeout(0) → setTimeout(600)");
  setStatus("Demo completada", "is-ok");
}

/* ---------- Escenario 2 · callbacks encadenados ---------- */

function ejecutarCadena(current) {
  const inicio = performance.now();
  const tiempo = () => performance.now() - inicio;

  return new Promise((resolve) => {
    consola.info("Escenario 2 · callbacks encadenados");
    setNode("usuario", "active");
    addStep({ label: "Petición de usuario", detail: "fakeGetUser()", type: "async" }, 0);
    consola.log("→ solicitando usuario…");

    fakeGetUser((usuario) => {
      if (current !== token) return resolve();
      setNode("usuario", "done");
      addStep({ label: "Usuario recibido", detail: `${usuario.nombre} · ${usuario.rol}`, type: "async" }, tiempo());
      consola.success(`Usuario recibido: ${usuario.nombre} (${usuario.rol})`);

      setNode("publicaciones", "active");
      addStep({ label: "Petición de publicaciones", detail: `usuario.id = ${usuario.id}`, type: "async" }, tiempo());
      consola.log("→ solicitando publicaciones…");

      fakeGetPosts(usuario.id, (publicaciones) => {
        if (current !== token) return resolve();
        setNode("publicaciones", "done");
        addStep(
          { label: "Publicaciones recibidas", detail: `${publicaciones.length} resultados`, type: "async" },
          tiempo(),
        );
        consola.success(`Publicaciones recibidas: ${publicaciones.length}`);

        setNode("comentarios", "active");
        addStep(
          { label: "Petición de comentarios", detail: `publicacion.id = ${publicaciones[0].id}`, type: "async" },
          tiempo(),
        );
        consola.log("→ solicitando comentarios…");

        fakeGetComments(publicaciones[0].id, (comentarios) => {
          if (current !== token) return resolve();
          setNode("comentarios", "done");
          addStep(
            { label: "Comentarios recibidos", detail: `${comentarios.length} respuestas`, type: "async" },
            tiempo(),
          );
          consola.success(`Comentarios recibidos: ${comentarios.length}`);
          consola.info("Cadena terminada con estado compartido entre callbacks.");
          setStatus("Demo completada", "is-ok");
          resolve();
        });
      });
    });
  });
}

/* ---------- Escenario 3 · callback hell ---------- */

function ejecutarHell(current) {
  const inicio = performance.now();
  const tiempo = () => performance.now() - inicio;

  return new Promise((resolve) => {
    consola.warn("Escenario 3 · callback hell (pirámide de la perdición)");
    setNode("usuario", "active");
    addStep({ label: "Nivel 1 · usuario", detail: "fakeGetUser()", type: "async" }, 0);

    fakeGetUser((usuario) => {
      if (current !== token) return resolve();
      setNode("usuario", "done");
      setNode("publicaciones", "active");
      consola.log("  nivel 1 · usuario:", usuario.nombre);
      addStep({ label: "Nivel 2 · publicaciones", detail: "dentro del primer callback", type: "async" }, tiempo());

      fakeGetPosts(usuario.id, (publicaciones) => {
        if (current !== token) return resolve();
        setNode("publicaciones", "done");
        setNode("comentarios", "active");
        consola.log("    nivel 2 · publicaciones:", publicaciones.length);
        addStep(
          { label: "Nivel 3 · comentarios", detail: "dentro del segundo callback", type: "async" },
          tiempo(),
        );

        fakeGetComments(publicaciones[0].id, (comentarios) => {
          if (current !== token) return resolve();
          setNode("comentarios", "done");
          consola.log("      nivel 3 · comentarios:", comentarios.length);
          addStep(
            { label: "Fin del anidamiento", detail: "3 niveles y 3 callbacks", type: "async" },
            tiempo(),
          );
          consola.warn("Funciona, pero cada nuevo paso agrega otra capa de anidación.");
          consola.info("Solución moderna: async/await con try/catch.");
          setStatus("Demo completada", "is-ok");
          resolve();
        });
      });
    });
  });
}

/* ---------- Controladores ---------- */

async function ejecutar() {
  if (running) return;
  token += 1;
  const current = token;

  setRunningUI(true);
  setStatus("Ejecutando…", "is-busy");
  resetTimeline();
  resetFlow();
  consola.clear();

  try {
    if (escenario === "orden") await ejecutarOrden(current);
    else if (escenario === "cadena") await ejecutarCadena(current);
    else await ejecutarHell(current);
  } catch (error) {
    consola.error("Ocurrió un error en la demo:", error);
    setStatus("Error en la demo", "is-error");
  } finally {
    if (current === token) {
      setRunningUI(false);
      if (status.textContent === "Ejecutando…") setStatus("Demo completada", "is-ok");
    }
  }
}

function reiniciar(silencioso = false) {
  token += 1;
  setRunningUI(false);
  resetTimeline();
  resetFlow();
  consola.clear();
  setStatus("Listo para ejecutar");
  if (!silencioso) consola.info("Demo reiniciada.");
}

on(runBtn, "click", ejecutar);
on(resetBtn, "click", () => reiniciar());

scenarioBtns.forEach((button) => {
  on(button, "click", () => {
    if (running) return;
    escenario = button.dataset.escenario;
    scenarioBtns.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    etiquetaEscenario.textContent = NOMBRES[escenario];
    nota.innerHTML = NOTAS[escenario];
    flow.hidden = escenario === "orden";
    pyramid.hidden = escenario !== "hell";
    reiniciar(true);
    consola.info(`Escenario seleccionado: ${NOMBRES[escenario]}`);
  });
});

resetTimeline();
consola.info("Consola lista. Elige un escenario y pulsa «Ejecutar demo».");
