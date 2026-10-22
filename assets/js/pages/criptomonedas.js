/**
 * criptomonedas.js · CoinGecko + conversión COP + sparklines SVG.
 * Estrategia: caché 60 s, token de carga y respaldo local.
 */

import { debounce, el, on, qs, qsa } from "../core/dom.js";
import {
  formatCompact,
  formatCompactCurrency,
  formatCurrency,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatTime,
} from "../core/format.js";
import { buildURL, describeError, fetchJSON, requestJSON } from "../core/http.js";
import { createConsole } from "../core/console-panel.js";
import { detailList, openModal } from "../core/modal.js";
import { emptyState, hideBanner, initUI, setBusy, showBanner, toast } from "../core/ui.js";

initUI();

const ENDPOINT = "https://api.coingecko.com/api/v3/coins/markets";
const RATE_URL = "https://open.er-api.com/v6/latest/USD";
const CACHE_MS = 60000;
const PER_PAGE = 50;

const consola = createConsole("[data-console]");
const banner = qs("[data-banner]");
const cardsEl = qs("[data-cards]");
const tableWrap = qs("[data-table-wrap]");
const tableBody = qs("[data-table-body]");
const emptyEl = qs("[data-empty]");
const searchInput = qs("[data-search]");
const currencySelect = qs("[data-currency]");
const orderSelect = qs("[data-order]");
const refreshBtn = qs("[data-refresh]");
const statusEl = qs("[data-status]");
const originChip = qs("[data-origin]");
const updatedChip = qs("[data-updated]");
const rateChip = qs("[data-rate]");
const viewButtons = qsa("[data-view]");

const statCap = qs("[data-stat-cap]");
const statCapHint = qs("[data-stat-cap-hint]");
const statVolume = qs("[data-stat-volume]");
const statDominance = qs("[data-stat-dominance]");
const statCount = qs("[data-stat-count]");
const statOrigin = qs("[data-stat-origin]");

const state = {
  moneda: "usd",
  orden: "market_cap",
  vista: "cards",
  query: "",
  data: [],
  rate: null,
  origin: "",
  updated: 0,
};

const cache = new Map();
const rateCache = { value: 0, time: 0 };
let loadToken = 0;
let gradientId = 0;

const SVG_NS = "http://www.w3.org/2000/svg";

/* ---------- Utilidades ---------- */

function setStatus(text, tone = "") {
  statusEl.textContent = text;
  statusEl.classList.remove("is-ok", "is-error", "is-busy");
  if (tone) statusEl.classList.add(tone);
}

function monedaActual() {
  return state.moneda.toUpperCase();
}

function factor() {
  return state.moneda === "cop" && state.rate ? state.rate : 1;
}

function valor(value) {
  return Number(value) * factor();
}

function downsample(prices, max = 46) {
  const clean = (prices || []).filter((price) => Number.isFinite(Number(price))).map(Number);
  if (clean.length <= max) return clean;
  const step = (clean.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, index) => clean[Math.round(index * step)]);
}

function svg(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

function crearSparkline(prices, change, { width = 300, height = 46 } = {}) {
  const chart = svg("svg", {
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: "none",
    class: "coin-spark",
    "aria-hidden": "true",
    focusable: "false",
  });

  const puntos = downsample(prices);
  if (puntos.length < 2) return chart;

  const min = Math.min(...puntos);
  const max = Math.max(...puntos);
  const range = max - min || 1;
  const pad = 3;
  const x = (index) => pad + (index / (puntos.length - 1)) * (width - pad * 2);
  const y = (value) => height - pad - ((value - min) / range) * (height - pad * 2);

  const line = puntos
    .map((value, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(value).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${(width - pad).toFixed(1)},${height} L${pad},${height} Z`;

  const positive = Number(change) >= 0;
  const color = positive ? "#0f8f78" : "#d64545";
  const id = `spark-grad-${++gradientId}`;

  const defs = svg("defs");
  const gradient = svg("linearGradient", { id, x1: 0, y1: 0, x2: 0, y2: 1 });
  gradient.append(
    svg("stop", { offset: "0%", "stop-color": color, "stop-opacity": "0.24" }),
    svg("stop", { offset: "100%", "stop-color": color, "stop-opacity": "0" }),
  );
  defs.append(gradient);

  chart.append(
    defs,
    svg("path", { d: area, fill: `url(#${id})`, stroke: "none" }),
    svg("path", {
      d: line,
      fill: "none",
      stroke: color,
      "stroke-width": width > 200 ? 1.8 : 1.5,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    }),
    svg("circle", {
      cx: x(puntos.length - 1).toFixed(1),
      cy: y(puntos[puntos.length - 1]).toFixed(1),
      r: width > 200 ? 2.4 : 2,
      fill: color,
    }),
  );

  return chart;
}

function crearLogo(coin, size = 34) {
  const img = el("img", {
    className: "coin-logo",
    src: coin.image,
    alt: "",
    loading: "lazy",
    width: size,
    height: size,
  });

  img.addEventListener(
    "error",
    () => {
      const fallback = el("span", {
        className: "coin-logo-fallback",
        "aria-hidden": "true",
        text: (coin.symbol || "?").slice(0, 4).toUpperCase(),
        style: { width: `${size}px`, height: `${size}px` },
      });
      img.replaceWith(fallback);
    },
    { once: true },
  );

  return img;
}

function changeBadge(change) {
  const value = Number(change);
  const tone = !Number.isFinite(value) ? "flat" : value > 0 ? "up" : value < 0 ? "down" : "flat";
  return el("span", {
    className: `coin-change coin-change--${tone}`,
    text: formatPercent(change),
  });
}

function etiquetaOrigen() {
  if (state.origin === "api") return "API en vivo";
  if (state.origin === "cache") return "Caché 60 s";
  if (state.origin === "respaldo") return "Respaldo local";
  return "—";
}

/* ---------- Render ---------- */

function actualizarStats() {
  const totalCap = state.data.reduce((sum, coin) => sum + Number(coin.market_cap || 0), 0);
  const totalVolume = state.data.reduce((sum, coin) => sum + Number(coin.total_volume || 0), 0);
  const btc = state.data.find((coin) => coin.id === "bitcoin");
  const dominance = btc && totalCap ? (Number(btc.market_cap) / totalCap) * 100 : null;
  const currency = monedaActual();

  statCap.textContent = formatCompactCurrency(valor(totalCap), currency);
  statCapHint.textContent = currency === "COP" ? "Convertido con la tasa actual" : `Capitalización en ${currency}`;
  statVolume.textContent = formatCompactCurrency(valor(totalVolume), currency);
  statDominance.textContent = formatPercent(dominance, { signed: false, digits: 1 });
  statCount.textContent = formatNumber(state.data.length, { maximumFractionDigits: 0 });
  statOrigin.textContent = etiquetaOrigen();
}

function renderTarjetas(lista) {
  cardsEl.replaceChildren(
    ...lista.map((coin) => {
      const card = el(
        "article",
        {
          className: "coin-card",
          tabindex: "0",
          role: "button",
          "aria-label": `Ver detalle de ${coin.name}`,
          dataset: { id: coin.id },
        },
        [
          el("div", { className: "coin-card__head" }, [
            crearLogo(coin),
            el("div", { className: "coin-name" }, [
              el("strong", { text: coin.name }),
              el("span", { text: coin.symbol }),
            ]),
            el("span", { className: "coin-rank", text: `#${coin.market_cap_rank ?? "—"}` }),
          ]),
          el("div", { className: "coin-price", text: formatCurrency(valor(coin.current_price), monedaActual()) }),
          el("div", {}, [changeBadge(coin.price_change_percentage_24h)]),
          crearSparkline(coin.sparkline_in_7d?.price, coin.price_change_percentage_24h),
          el("div", { className: "coin-metrics" }, [
            el("span", {}, [
              "Cap.",
              el("strong", { text: formatCompactCurrency(valor(coin.market_cap), monedaActual()) }),
            ]),
            el("span", {}, [
              "Vol. 24 h",
              el("strong", { text: formatCompactCurrency(valor(coin.total_volume), monedaActual()) }),
            ]),
          ]),
        ],
      );

      const abrir = () => abrirDetalle(coin);
      on(card, "click", abrir);
      on(card, "keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        abrir();
      });

      return card;
    }),
  );
}

function renderTabla(lista) {
  tableBody.replaceChildren(
    ...lista.map((coin) => {
      const detailBtn = el("button", {
        type: "button",
        className: "btn btn--outline btn--sm",
        text: "Ver",
        "aria-label": `Ver detalle de ${coin.name}`,
        onClick: () => abrirDetalle(coin),
      });

      const spark = crearSparkline(coin.sparkline_in_7d?.price, coin.price_change_percentage_24h, {
        width: 100,
        height: 30,
      });
      spark.style.height = "30px";

      const row = el("tr", { className: "is-clickable" }, [
        el("td", { className: "num", text: String(coin.market_cap_rank ?? "—") }),
        el("td", {}, [
          el("div", { className: "coin-table-logo" }, [
            crearLogo(coin, 24),
            el("div", {}, [
              el("div", { text: coin.name }),
              el("small", { text: coin.symbol }),
            ]),
          ]),
        ]),
        el("td", { className: "num", text: formatCurrency(valor(coin.current_price), monedaActual()) }),
        el("td", { className: "num" }, [changeBadge(coin.price_change_percentage_24h)]),
        el("td", {
          className: "num",
          text: formatCompactCurrency(valor(coin.market_cap), monedaActual()),
        }),
        el("td", {
          className: "num",
          text: formatCompactCurrency(valor(coin.total_volume), monedaActual()),
        }),
        el("td", {}, [spark]),
        el("td", { className: "actions" }, [detailBtn]),
      ]);

      on(row, "click", (event) => {
        if (event.target.closest("button")) return;
        abrirDetalle(coin);
      });

      return row;
    }),
  );
}

function render() {
  if (!state.data.length) {
    cardsEl.hidden = true;
    tableWrap.hidden = true;
    emptyEl.hidden = false;
    return;
  }

  if (state.moneda === "cop" && !state.rate) {
    state.moneda = "usd";
    currencySelect.value = "usd";
  }

  actualizarStats();

  const query = state.query.trim().toLowerCase();
  let lista = state.data.filter(
    (coin) => !query || coin.name.toLowerCase().includes(query) || coin.symbol.toLowerCase().includes(query),
  );

  lista = [...lista].sort((a, b) => {
    switch (state.orden) {
      case "price":
        return Number(b.current_price) - Number(a.current_price);
      case "gain":
        return Number(b.price_change_percentage_24h ?? -Infinity) - Number(a.price_change_percentage_24h ?? -Infinity);
      case "loss":
        return Number(a.price_change_percentage_24h ?? Infinity) - Number(b.price_change_percentage_24h ?? Infinity);
      case "rank":
        return Number(a.market_cap_rank ?? 9999) - Number(b.market_cap_rank ?? 9999);
      default:
        return Number(b.market_cap) - Number(a.market_cap);
    }
  });

  if (state.vista === "cards") renderTarjetas(lista);
  else renderTabla(lista);

  const sinResultados = lista.length === 0;
  emptyEl.hidden = !sinResultados;
  cardsEl.hidden = sinResultados || state.vista !== "cards";
  tableWrap.hidden = sinResultados || state.vista !== "table";
  cardsEl.setAttribute("aria-busy", "false");

  if (sinResultados) {
    emptyEl.replaceChildren(
      emptyState({
        icon: "∅",
        title: "Sin coincidencias",
        message: `No encontramos monedas para “${state.query}”. Prueba con otro nombre o símbolo.`,
        action: {
          label: "Limpiar búsqueda",
          onClick: () => {
            searchInput.value = "";
            state.query = "";
            render();
          },
        },
      }),
    );
  }

  originChip.textContent = `Origen: ${etiquetaOrigen()}`;
  updatedChip.textContent = state.updated ? `Actualizado ${formatTime(state.updated)}` : "Actualizado —";
  rateChip.hidden = !(state.moneda === "cop" && state.rate);
  if (state.moneda === "cop" && state.rate) {
    rateChip.textContent = `1 USD = ${formatNumber(state.rate, { maximumFractionDigits: 2 })} COP · open.er-api.com`;
  }
}

function renderSkeleton() {
  emptyEl.hidden = true;

  if (state.vista === "table") {
    cardsEl.hidden = true;
    tableWrap.hidden = false;
    tableBody.replaceChildren(
      ...Array.from({ length: 6 }, () =>
        el("tr", {}, [
          el("td", { colspan: "8" }, [
            el("div", { className: "skeleton", style: { height: "34px" } }),
          ]),
        ]),
      ),
    );
    return;
  }

  tableWrap.hidden = true;
  cardsEl.hidden = false;
  cardsEl.setAttribute("aria-busy", "true");
  cardsEl.replaceChildren(
    ...Array.from({ length: 6 }, () =>
      el("div", { className: "coin-skeleton" }, [
        el("div", { className: "skeleton", style: { height: "34px", width: "62%" } }),
        el("div", { className: "skeleton", style: { height: "26px", width: "45%" } }),
        el("div", { className: "skeleton", style: { height: "46px" } }),
        el("div", { className: "skeleton", style: { height: "18px" } }),
      ]),
    ),
  );
}

/* ---------- Modal ---------- */

function abrirDetalle(coin) {
  const currency = monedaActual();
  const change = Number(coin.price_change_percentage_24h);

  const head = el("div", { className: "coin-modal-head" }, [
    crearLogo(coin, 48),
    el("div", {}, [
      el("strong", { text: coin.name }),
      el("div", { className: "muted small", text: `${coin.symbol.toUpperCase()} · Ranking #${coin.market_cap_rank ?? "—"}` }),
    ]),
    el("div", { className: "coin-modal-price" }, [
      el("strong", { text: formatCurrency(valor(coin.current_price), currency) }),
      el("span", {
        className: Number.isFinite(change) ? (change >= 0 ? "text-success" : "text-danger") : "muted",
        text: `${formatPercent(change)} · 24 h`,
      }),
    ]),
  ]);

  const spark = crearSparkline(coin.sparkline_in_7d?.price, change, { width: 600, height: 120 });
  spark.classList.add("coin-modal-spark");
  spark.removeAttribute("aria-hidden");
  spark.setAttribute("role", "img");
  spark.setAttribute(
    "aria-label",
    `Tendencia de ${coin.name} en los últimos siete días: ${formatPercent(change)} en 24 horas.`,
  );

  const items = [
    ["Capitalización", formatCompactCurrency(valor(coin.market_cap), currency)],
    ["Volumen 24 h", formatCompactCurrency(valor(coin.total_volume), currency)],
    ["Rango 24 h", `${formatCurrency(valor(coin.low_24h), currency)} – ${formatCurrency(valor(coin.high_24h), currency)}`],
    ["Suministro circulante", formatCompact(coin.circulating_supply)],
    ["Suministro máximo", coin.max_supply ? formatCompact(coin.max_supply) : "Sin límite definido"],
    ["Máximo histórico", formatCurrency(valor(coin.ath), currency)],
    ["Desde el ATH", formatPercent(coin.ath_change_percentage)],
    ["Última actualización", formatDateTime(coin.last_updated)],
  ];

  if (state.moneda === "cop" && state.rate) {
    items.push(["Tasa usada", `1 USD = ${formatNumber(state.rate, { maximumFractionDigits: 2 })} COP (open.er-api.com)`]);
  } else {
    items.push(["Moneda", currency === "EUR" ? "Euro (cotización nativa de CoinGecko)" : "Dólar estadounidense"]);
  }

  const content = el("div", {}, [
    head,
    spark,
    detailList(items.map(([label, value]) => ({ label, value }))),
  ]);

  const footer = el("a", {
    className: "btn btn--primary btn--sm",
    href: `https://www.coingecko.com/es/monedas/${coin.id}`,
    target: "_blank",
    rel: "noopener noreferrer",
    text: "Ver en CoinGecko ↗",
  });

  openModal({
    title: coin.name,
    subtitle: `Detalle de ${coin.symbol.toUpperCase()} · fuente CoinGecko`,
    content,
    footer,
    size: "lg",
  });

  consola.info(`Detalle abierto: ${coin.name} (${coin.symbol.toUpperCase()})`);
}

/* ---------- Carga de datos ---------- */

async function asegurarTasa(token, force = false) {
  if (!force && rateCache.value && Date.now() - rateCache.time < CACHE_MS) {
    state.rate = rateCache.value;
    return true;
  }

  try {
    const { data, elapsed, status } = await requestJSON(RATE_URL, { timeout: 15000 });
    const rate = Number(data?.rates?.COP);
    if (!rate) throw new Error("La respuesta no incluye la tasa COP.");

    state.rate = rate;
    rateCache.value = rate;
    rateCache.time = Date.now();
    consola.success(`Tasa USD → COP: ${formatNumber(rate, { maximumFractionDigits: 2 })} · HTTP ${status} · ${elapsed} ms`);
    return true;
  } catch (error) {
    if (token !== loadToken) return false;
    state.rate = null;
    consola.error("No se pudo obtener la tasa COP:", describeError(error));
    showBanner(banner, {
      type: "warning",
      title: "No pudimos obtener la tasa COP",
      message: `${describeError(error)} La vista vuelve a USD para no mostrar valores incorrectos.`,
    });
    toast("Sin tasa COP disponible. Se muestra USD.", "warning", 5000);
    return false;
  }
}

async function cargarRespaldo(token) {
  try {
    const { data, elapsed, size } = await fetchJSON("../data/criptomonedas.json", { timeout: 15000 });
    if (token !== loadToken) return;
    if (!Array.isArray(data) || !data.length) throw new Error("El respaldo no contiene monedas.");

    state.data = data;
    state.origin = "respaldo";
    state.updated = Date.now();
    state.rate = null;
    state.moneda = "usd";
    currencySelect.value = "usd";
    render();

    showBanner(banner, {
      type: "warning",
      title: "Mostrando respaldo local",
      message: `CoinGecko no respondió. Se cargaron ${data.length} monedas desde data/criptomonedas.json en USD.`,
    });

    consola.warn(`Respaldo local cargado · ${data.length} monedas · ${elapsed} ms · ${Math.round(size / 1024)} KB`);
    consola.info("Moneda forzada a USD para evitar mezclar tasas.");
    setStatus("Datos de respaldo", "is-error");
    toast("CoinGecko no respondió. Usando datos de respaldo en USD.", "warning", 5200);
  } catch (error) {
    if (token !== loadToken) return;
    cardsEl.hidden = true;
    tableWrap.hidden = true;
    emptyEl.hidden = false;
    emptyEl.replaceChildren(
      emptyState({
        icon: "!",
        title: "Sin datos disponibles",
        message: describeError(error),
        action: { label: "Reintentar", onClick: () => cargar({ force: true }) },
      }),
    );
    setStatus("Sin datos", "is-error");
    consola.error("Tampoco se pudo cargar el respaldo:", describeError(error));
  }
}

async function cargar({ force = false } = {}) {
  const token = ++loadToken;
  const base = state.moneda === "cop" ? "usd" : state.moneda;
  const cached = cache.get(base);

  if (!force && cached && Date.now() - cached.time < CACHE_MS) {
    state.data = cached.data;
    state.updated = cached.time;
    state.origin = "cache";
    state.meta = cached.meta;
    hideBanner(banner);

    if (state.moneda === "cop") {
      const ok = await asegurarTasa(token, false);
      if (token !== loadToken) return;
      if (!ok) {
        state.moneda = "usd";
        currencySelect.value = "usd";
      }
    }

    render();
    setStatus("Datos desde caché", "is-ok");
    consola.info(`Caché en memoria · ${base.toUpperCase()} · ${Math.round((Date.now() - cached.time) / 1000)} s de antigüedad`);
    return;
  }

  renderSkeleton();
  setStatus("Consultando CoinGecko…", "is-busy");
  hideBanner(banner);
  setBusy(refreshBtn, true, "Actualizando…");

  const url = buildURL(ENDPOINT, {
    vs_currency: base,
    order: "market_cap_desc",
    per_page: PER_PAGE,
    page: 1,
    sparkline: true,
    price_change_percentage: "24h",
  });

  consola.info(`GET ${url}`);

  try {
    const { data, status, elapsed, size } = await requestJSON(url, { timeout: 20000 });
    if (token !== loadToken) return;
    if (!Array.isArray(data)) throw new Error("La API no devolvió un arreglo de monedas.");

    cache.set(base, { data, time: Date.now(), meta: { status, elapsed, size } });
    state.data = data;
    state.origin = "api";
    state.updated = Date.now();
    state.meta = { status, elapsed, size };

    if (state.moneda === "cop") {
      const ok = await asegurarTasa(token, force);
      if (token !== loadToken) return;
      if (!ok) {
        state.moneda = "usd";
        currencySelect.value = "usd";
      }
    }

    render();
    setStatus("Datos actualizados", "is-ok");
    consola.success(`HTTP ${status} · ${elapsed} ms · ${data.length} monedas · ${Math.round(size / 1024)} KB`);
    consola.info(`Origen: API en vivo · moneda base ${base.toUpperCase()}`);
  } catch (error) {
    if (token !== loadToken) return;
    consola.error("CoinGecko:", describeError(error));
    showBanner(banner, {
      type: "danger",
      title: "CoinGecko no respondió",
      message: `${describeError(error)} Intentando cargar el respaldo local…`,
    });
    await cargarRespaldo(token);
  } finally {
    if (token === loadToken) {
      setBusy(refreshBtn, false);
      cardsEl.setAttribute("aria-busy", "false");
    }
  }
}

/* ---------- Eventos ---------- */

on(
  searchInput,
  "input",
  debounce(() => {
    state.query = searchInput.value;
    render();
  }, 220),
);

on(currencySelect, "change", () => {
  const nueva = currencySelect.value;
  if (nueva === state.moneda) return;
  state.moneda = nueva;
  consola.info(`Moneda de cotización: ${nueva.toUpperCase()}`);
  cargar();
});

on(orderSelect, "change", () => {
  state.orden = orderSelect.value;
  render();
  consola.info(`Orden aplicado: ${orderSelect.selectedOptions[0]?.textContent || state.orden}`);
});

viewButtons.forEach((button) => {
  on(button, "click", () => {
    state.vista = button.dataset.view;
    viewButtons.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    render();
  });
});

on(refreshBtn, "click", () => {
  consola.info("Actualización manual solicitada.");
  cargar({ force: true });
});

consola.info("Panel de criptomonedas listo. Consultando CoinGecko…");
cargar();
