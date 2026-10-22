/**
 * paises.js · explorador de los 250 países del snapshot REST Countries v3.1.
 */

import { el, on, qs } from "../core/dom.js";
import { formatNumber, formatTime } from "../core/format.js";
import { describeError, fetchJSON } from "../core/http.js";
import { createConsole } from "../core/console-panel.js";
import { emptyState, initUI } from "../core/ui.js";

initUI();

const REGIONES = {
  Africa: "África",
  Americas: "América",
  Asia: "Asia",
  Europe: "Europa",
  Oceania: "Oceanía",
  Antarctic: "Antártida",
};

const SUBREGIONES = {
  "South America": "Sudamérica",
  "North America": "Norteamérica",
  "Central America": "Centroamérica",
  Caribbean: "Caribe",
  "Western Europe": "Europa Occidental",
  "Eastern Europe": "Europa Oriental",
  "Northern Europe": "Europa del Norte",
  "Southern Europe": "Europa del Sur",
  "Western Asia": "Asia Occidental",
  "Eastern Asia": "Asia Oriental",
  "South-Eastern Asia": "Sudeste Asiático",
  "Southern Asia": "Asia del Sur",
  "Central Asia": "Asia Central",
  "Northern Africa": "África del Norte",
  "Western Africa": "África Occidental",
  "Eastern Africa": "África Oriental",
  "Middle Africa": "África Central",
  "Southern Africa": "África Meridional",
  "Australia and New Zealand": "Australia y Nueva Zelanda",
  Melanesia: "Melanesia",
  Micronesia: "Micronesia",
  Polynesia: "Polinesia",
  Antarctica: "Antártida",
};

const CONTINENTES = {
  "South America": "Sudamérica",
  "North America": "Norteamérica",
  Europe: "Europa",
  Asia: "Asia",
  Africa: "África",
  Oceania: "Oceanía",
  Antarctica: "Antártida",
};

let displayIdiomas;
let displayMonedas;

try {
  displayIdiomas = new Intl.DisplayNames("es", { type: "language" });
  displayMonedas = new Intl.DisplayNames("es", { type: "currency" });
} catch {
  displayIdiomas = null;
  displayMonedas = null;
}

const consola = createConsole("[data-console]");
const select = qs("[data-select]");
const regionSelect = qs("[data-region]");
const randomBtn = qs("[data-random]");
const detail = qs("[data-detail]");
const statusEl = qs("[data-status]");
const historyEl = qs("[data-history]");
const countEl = qs("[data-count]");
const clearBtn = qs("[data-clear]");

let paises = [];
let filtrados = [];
const consultados = new Map();

function setStatus(text, tone = "") {
  statusEl.textContent = text;
  statusEl.classList.remove("is-ok", "is-error");
  if (tone) statusEl.classList.add(tone);
}

function nombrePais(pais) {
  return pais.translations?.spa?.common || pais.name.common;
}

function nombreOficial(pais) {
  return pais.translations?.spa?.official || pais.name.official || "";
}

function poblarSelect(lista) {
  const ordenados = [...lista].sort((a, b) => nombrePais(a).localeCompare(nombrePais(b), "es"));

  select.replaceChildren(
    el("option", { value: "", text: `Selecciona un país (${ordenados.length})` }),
    ...ordenados.map((pais) =>
      el("option", {
        value: pais.cca3,
        text: nombrePais(pais),
      }),
    ),
  );
  select.disabled = lista.length === 0;
}

function crearBandera(pais) {
  const box = el("div", { className: "flag-box" });
  const alt = `Bandera de ${nombrePais(pais)}`;
  const img = el("img", {
    src: pais.flags?.png || `https://flagcdn.com/w320/${String(pais.cca2).toLowerCase()}.png`,
    alt,
    loading: "lazy",
    width: "320",
    height: "213",
  });

  img.addEventListener(
    "error",
    () => {
      const emoji = el("span", {
        className: "flag-emoji",
        role: "img",
        "aria-label": alt,
        text: pais.flag || "🏳️",
      });
      box.replaceChildren(emoji);
      consola.warn(`No se pudo cargar la bandera de ${nombrePais(pais)}; se usa el emoji ${pais.flag || ""}.`);
    },
    { once: true },
  );

  box.append(img);
  return box;
}

function fact(label, value) {
  return el("div", { className: "fact" }, [
    el("dt", { text: label }),
    el("dd", { text: value || "—" }),
  ]);
}

function monedas(pais) {
  const entries = Object.entries(pais.currencies || {});
  if (!entries.length) return "—";
  return entries
    .map(([code, currency]) => {
      const nombre = displayMonedas?.of(code) || currency.name || code;
      return `${nombre} (${currency.symbol || ""} ${code})`.replace(/\s+/g, " ").trim();
    })
    .join(" · ");
}

function idiomas(pais) {
  const entries = Object.entries(pais.languages || {});
  if (!entries.length) return "—";
  return entries
    .map(([code, nombre]) => {
      const traducido = displayIdiomas?.of(code) || nombre;
      return traducido.charAt(0).toUpperCase() + traducido.slice(1);
    })
    .join(", ");
}

function zonas(pais) {
  const list = pais.timezones || [];
  if (!list.length) return "—";
  const visibles = list.slice(0, 3).join(", ");
  return list.length > 3 ? `${visibles} +${list.length - 3}` : visibles;
}

function mostrarPais(pais, { registrar = true } = {}) {
  const nombre = nombrePais(pais);
  const oficialCrudo = nombreOficial(pais);
  const oficial = oficialCrudo && oficialCrudo !== nombre ? oficialCrudo : "";

  const info = el("div", { className: "stack" }, [
    el("div", {}, [
      el("h2", { className: "country-name" }, [
        pais.flag ? el("span", { "aria-hidden": "true", text: pais.flag }) : null,
        nombre,
        el("span", { className: "badge badge--green", text: REGIONES[pais.region] || pais.region || "—" }),
      ]),
      oficial ? el("p", { className: "country-native", text: oficial }) : null,
    ]),
    el("div", { className: "chip-row" }, [
      el("span", { className: "chip chip--green", text: pais.cca3 }),
      pais.subregion ? el("span", { className: "chip", text: SUBREGIONES[pais.subregion] || pais.subregion }) : null,
      el("span", { className: "chip", text: `${(pais.timezones || []).length} zona(s) horaria(s)` }),
    ]),
    el("div", { className: "facts-grid" }, [
      fact("Capital", (pais.capital || []).join(", ")),
      fact("Población", formatNumber(pais.population, { maximumFractionDigits: 0 })),
      fact("Área", `${formatNumber(pais.area, { maximumFractionDigits: 0 })} km²`),
      fact("Moneda", monedas(pais)),
      fact("Idiomas", idiomas(pais)),
      fact("Zonas horarias", zonas(pais)),
      fact("Código ISO", `${pais.cca2} / ${pais.cca3}${pais.ccn3 ? ` / ${pais.ccn3}` : ""}`),
      fact(
        "Continente",
        (pais.continents || []).map((continente) => CONTINENTES[continente] || continente).join(", "),
      ),
    ]),
    el("div", { className: "chip-row" }, [
      pais.maps?.googleMaps
        ? el("a", {
            className: "chip chip--green",
            href: pais.maps.googleMaps,
            target: "_blank",
            rel: "noopener noreferrer",
            text: "Google Maps ↗",
          })
        : null,
      pais.maps?.openStreetMaps
        ? el("a", {
            className: "chip",
            href: pais.maps.openStreetMaps,
            target: "_blank",
            rel: "noopener noreferrer",
            text: "OpenStreetMap ↗",
          })
        : null,
    ]),
  ]);

  detail.replaceChildren(el("div", { className: "country-layout" }, [crearBandera(pais), info]));
  select.value = pais.cca3;
  setStatus(`${nombre} · ${REGIONES[pais.region] || pais.region}`, "is-ok");

  consola.success(`País consultado: ${nombre} (${pais.cca3})`);
  consola.log("Registro crudo:", {
    cca3: pais.cca3,
    capital: pais.capital,
    population: pais.population,
    currencies: pais.currencies,
    languages: pais.languages,
  });

  if (registrar) registrarConsulta(pais);
}

function registrarConsulta(pais) {
  consultados.delete(pais.cca3);
  consultados.set(pais.cca3, { pais, hora: new Date() });
  renderHistorial();
}

function renderHistorial() {
  const registros = Array.from(consultados.values()).reverse();
  countEl.textContent = `${registros.length} ${registros.length === 1 ? "país" : "países"}`;

  if (!registros.length) {
    historyEl.replaceChildren(
      el("tr", { dataset: { historyEmpty: "1" } }, [
        el("td", { colspan: "6", className: "muted", text: "Aún no has consultado ningún país." }),
      ]),
    );
    return;
  }

  historyEl.replaceChildren(
    ...registros.map(({ pais, hora }) => {
      const flag = el("img", {
        className: "flag-mini",
        src: pais.flags?.png,
        alt: "",
        loading: "lazy",
        width: "24",
        height: "16",
      });
      flag.addEventListener("error", () => flag.remove(), { once: true });

      return el("tr", {}, [
        el("td", {}, [flag, " ", el("strong", { text: nombrePais(pais) })]),
        el("td", { text: REGIONES[pais.region] || pais.region || "—" }),
        el("td", { className: "num", text: formatNumber(pais.population, { maximumFractionDigits: 0 }) }),
        el("td", { className: "num", text: `${formatNumber(pais.area, { maximumFractionDigits: 0 })} km²` }),
        el("td", {}, [el("code", { text: pais.cca3 })]),
        el("td", { className: "mono small", text: formatTime(hora) }),
      ]);
    }),
  );
}

function filtrarPorRegion() {
  const region = regionSelect.value;
  filtrados = region ? paises.filter((pais) => pais.region === region) : paises;
  poblarSelect(filtrados);
  setStatus(
    region
      ? `${filtrados.length} países en ${REGIONES[region] || region}`
      : `${paises.length} países disponibles`,
    "is-ok",
  );
  consola.info(
    region
      ? `Filtro aplicado: ${REGIONES[region] || region} (${filtrados.length} resultados)`
      : `Filtro retirado · ${paises.length} países`,
  );
}

function cargarPaises() {
  setStatus("Cargando datos…");
  consola.info("GET ../data/paises.json");
  detail.replaceChildren(
    el("div", { className: "stack" }, [
      el("div", { className: "skeleton", style: { height: "190px" } }),
      el("div", { className: "skeleton", style: { height: "80px", opacity: "0.7" } }),
    ]),
  );

  fetchJSON("../data/paises.json", { timeout: 15000 })
    .then(({ data, elapsed, size }) => {
      if (!Array.isArray(data)) throw new Error("El archivo no contiene un arreglo de países.");
      paises = data;
      filtrados = data;
      poblarSelect(filtrados);
      regionSelect.disabled = false;
      randomBtn.disabled = false;
      setStatus(`${paises.length} países cargados`, "is-ok");
      consola.success(`JSON local cargado: ${paises.length} países en ${elapsed} ms (${Math.round(size / 1024)} KB).`);
      consola.info("Origen: respaldo local con la forma de REST Countries v3.1.");
      detail.replaceChildren(
        emptyState({
          icon: "◎",
          title: "Elige un país",
          message: "Selecciona uno en la lista, filtra por región o pulsa «Aleatorio» para empezar.",
        }),
      );
    })
    .catch((error) => {
      setStatus("Error al cargar los datos", "is-error");
      consola.error("No se pudo cargar paises.json:", describeError(error));
      detail.replaceChildren(
        emptyState({
          icon: "!",
          title: "No fue posible cargar los países",
          message: describeError(error),
          action: { label: "Reintentar", onClick: cargarPaises },
        }),
      );
    });
}

on(select, "change", () => {
  const pais = paises.find((item) => item.cca3 === select.value);
  if (pais) mostrarPais(pais);
});

on(regionSelect, "change", filtrarPorRegion);

on(randomBtn, "click", () => {
  const lista = filtrados.length ? filtrados : paises;
  if (!lista.length) return;
  const pais = lista[Math.floor(Math.random() * lista.length)];
  mostrarPais(pais);
  consola.info("Selección aleatoria dentro del filtro actual.");
});

on(clearBtn, "click", () => {
  consultados.clear();
  renderHistorial();
  consola.info("Tabla de países consultados limpiada.");
});

on(window, "keydown", (event) => {
  if (event.key.toLowerCase() !== "r" || event.ctrlKey || event.metaKey || event.altKey) return;
  const tag = document.activeElement?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
  if (paises.length) randomBtn.click();
});

renderHistorial();
cargarPaises();
