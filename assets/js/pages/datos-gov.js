/**
 * datos-gov.js · TRM desde datos.gov.co (Socrata) con gráfica SVG propia.
 * Dataset activo: 32sa-8pi3 · caché 60 s · respaldo local.
 */

import { clamp, el, on, qs, qsa } from "../core/dom.js";
import { formatDate, formatDateLong, formatDateShort, formatNumber, formatPercent, toDate } from "../core/format.js";
import { buildURL, describeError, fetchJSON, requestJSON } from "../core/http.js";
import { createConsole } from "../core/console-panel.js";
import { detailList, openModal } from "../core/modal.js";
import { emptyState, hideBanner, initUI, setBusy, showBanner, toast } from "../core/ui.js";

initUI();

const ENDPOINT = "https://www.datos.gov.co/resource/32sa-8pi3.json";
const LIMIT = 800;
const CACHE_MS = 60000;
const SVG_NS = "http://www.w3.org/2000/svg";
const CHART = { width: 860, height: 320, top: 24, right: 24, bottom: 46, left: 70 };

const consola = createConsole("[data-console]");
const banner = qs("[data-banner]");
const chart = qs("[data-chart]");
const chartWrap = qs("[data-chart-wrap]");
const tooltip = qs("[data-tooltip]");
const tooltipValue = qs("[data-tooltip-value]");
const tooltipDate = qs("[data-tooltip-date]");
const trmValue = qs("[data-trm-value]");
const trmDate = qs("[data-trm-date]");
const trmDelta = qs("[data-trm-delta]");
const trmPrev = qs("[data-trm-prev]");
const trmPrevDate = qs("[data-trm-prev-date]");
const trmRange = qs("[data-trm-range]");
const statMax = qs("[data-stat-max]");
const statMaxDate = qs("[data-stat-max-date]");
const statMin = qs("[data-stat-min]");
const statMinDate = qs("[data-stat-min-date]");
const statAvg = qs("[data-stat-avg]");
const statCount = qs("[data-stat-count]");
const statOrigin = qs("[data-stat-origin]");
const statusEl = qs("[data-status]");
const refreshBtn = qs("[data-refresh]");
const downloadBtn = qs("[data-download]");
const periodBtns = qsa("[data-periodo]");
const tableBody = qs("[data-table-body]");
const tableCount = qs("[data-table-count]");
const chartRange = qs("[data-chart-range]");
const chartCount = qs("[data-chart-count]");

const state = {
  periodo: 90,
  all: [],
  data: [],
  origin: "",
  updated: 0,
  meta: null,
};

let cache = null;
let loadToken = 0;
let chartGeom = null;
let chartHover = null;
let keyboardIndex = -1;

/* ---------- Utilidades ---------- */

function setStatus(text, tone = "") {
  statusEl.textContent = text;
  statusEl.classList.remove("is-ok", "is-error", "is-busy");
  if (tone) statusEl.classList.add(tone);
}

function svgNode(tag, attrs = {}, text = "") {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  if (text) node.textContent = text;
  return node;
}

function etiquetaOrigen() {
  if (state.origin === "api") return "API en vivo";
  if (state.origin === "cache") return "Caché 60 s";
  if (state.origin === "respaldo") return "Respaldo local";
  return "—";
}

function normalizar(rows) {
  const porFecha = new Map();

  for (const row of rows || []) {
    const fecha = String(row.vigenciadesde || "").slice(0, 10);
    const valor = Number(row.valor);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !Number.isFinite(valor)) continue;
    porFecha.set(fecha, { fecha, valor, unidad: row.unidad || "COP" });
  }

  return Array.from(porFecha.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

function formatoValor(value) {
  return formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatoDelta(value) {
  return formatNumber(value, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: "always",
  });
}

/* ---------- Render ---------- */

function renderFeature() {
  const latest = state.data.at(-1);
  const previous = state.data.at(-2);

  if (!latest) return;

  trmValue.textContent = formatoValor(latest.valor);
  trmDate.textContent = `Vigente desde ${formatDateLong(latest.fecha)}`;
  trmPrev.textContent = previous ? `${formatoValor(previous.valor)} COP` : "—";
  trmPrevDate.textContent = previous ? formatDate(previous.fecha) : "Sin registro anterior";
  trmRange.textContent = `Período · ${formatDate(state.data[0].fecha)} — ${formatDate(latest.fecha)}`;

  if (!previous) {
    trmDelta.className = "trm-delta";
    trmDelta.textContent = "Variación —";
    return;
  }

  const diff = latest.valor - previous.valor;
  const pct = previous.valor ? (diff / previous.valor) * 100 : null;
  trmDelta.className = `trm-delta ${diff >= 0 ? "trm-delta--up" : "trm-delta--down"}`;
  trmDelta.textContent = `${diff >= 0 ? "▲" : "▼"} ${formatoDelta(diff)} COP (${formatPercent(pct)}) vs. anterior`;
}

function renderStats() {
  if (!state.data.length) return;

  const max = state.data.reduce((best, item) => (item.valor > best.valor ? item : best), state.data[0]);
  const min = state.data.reduce((best, item) => (item.valor < best.valor ? item : best), state.data[0]);
  const avg = state.data.reduce((sum, item) => sum + item.valor, 0) / state.data.length;

  statMax.textContent = formatoValor(max.valor);
  statMaxDate.textContent = formatDate(max.fecha);
  statMin.textContent = formatoValor(min.valor);
  statMinDate.textContent = formatDate(min.fecha);
  statAvg.textContent = formatoValor(avg);
  statCount.textContent = formatNumber(state.data.length, { maximumFractionDigits: 0 });
  statOrigin.textContent = etiquetaOrigen();
}

function renderChart() {
  const data = state.data;

  if (!data.length) {
    chart.replaceChildren(
      svgNode("text", {
        x: CHART.width / 2,
        y: CHART.height / 2,
        "text-anchor": "middle",
        fill: "#8493a8",
        "font-size": "13",
        "font-family": "Manrope, sans-serif",
      }, "Sin datos para graficar"),
    );
    chartGeom = null;
    return;
  }

  const plotW = CHART.width - CHART.left - CHART.right;
  const plotH = CHART.height - CHART.top - CHART.bottom;
  const values = data.map((item) => item.valor);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const span = rawMax - rawMin || 1;
  const yMin = rawMin - span * 0.08;
  const yMax = rawMax + span * 0.08;

  const xOf = (index) =>
    CHART.left + (data.length === 1 ? plotW / 2 : (index / (data.length - 1)) * plotW);
  const yOf = (value) => CHART.top + (1 - (value - yMin) / (yMax - yMin)) * plotH;

  const points = data.map((item, index) => ({ x: xOf(index), y: yOf(item.valor), item }));
  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const area = `${line} L${points.at(-1).x.toFixed(1)},${CHART.top + plotH} L${points[0].x.toFixed(1)},${CHART.top + plotH} Z`;

  const defs = svgNode("defs");
  const gradient = svgNode("linearGradient", { id: "trm-area-grad", x1: 0, y1: 0, x2: 0, y2: 1 });
  gradient.append(
    svgNode("stop", { offset: "0%", "stop-color": "#0f8f78", "stop-opacity": "0.26" }),
    svgNode("stop", { offset: "100%", "stop-color": "#0f8f78", "stop-opacity": "0" }),
  );
  defs.append(gradient);

  const grid = svgNode("g", { "aria-hidden": "true" });
  const decimalDigits = span < 20 ? 2 : span < 200 ? 1 : 0;

  for (let i = 0; i < 5; i += 1) {
    const value = yMax - (i / 4) * (yMax - yMin);
    const y = CHART.top + (i / 4) * plotH;
    grid.append(
      svgNode("line", {
        x1: CHART.left,
        y1: y,
        x2: CHART.width - CHART.right,
        y2: y,
        stroke: i === 4 ? "#c9d5e3" : "#e6edf5",
        "stroke-width": 1,
      }),
      svgNode(
        "text",
        {
          x: CHART.left - 12,
          y: y + 4,
          "text-anchor": "end",
          fill: "#8493a8",
          "font-size": "10.5",
          "font-family": "JetBrains Mono, monospace",
        },
        formatNumber(value, { maximumFractionDigits: decimalDigits }),
      ),
    );
  }

  const labelIndexes = [...new Set([0, Math.floor((data.length - 1) / 2), data.length - 1])];
  labelIndexes.forEach((index, position) => {
    grid.append(
      svgNode(
        "text",
        {
          x: xOf(index),
          y: CHART.height - 16,
          "text-anchor": position === 0 ? "start" : position === labelIndexes.length - 1 ? "end" : "middle",
          fill: "#8493a8",
          "font-size": "10.5",
          "font-family": "JetBrains Mono, monospace",
        },
        formatDateShort(data[index].fecha),
      ),
    );
  });

  const areaPath = svgNode("path", { d: area, fill: "url(#trm-area-grad)", stroke: "none" });
  const linePath = svgNode("path", {
    d: line,
    fill: "none",
    stroke: "#0f8f78",
    "stroke-width": "2.2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });

  const dots = svgNode("g", { "aria-hidden": "true" });
  const dotStep = data.length <= 90 ? 1 : Math.ceil(data.length / 90);

  points.forEach((point, index) => {
    if (index % dotStep !== 0 && index !== points.length - 1) return;
    dots.append(
      svgNode("circle", {
        cx: point.x,
        cy: point.y,
        r: data.length <= 90 ? 2.2 : 1.6,
        fill: "#fff",
        stroke: "#0f8f78",
        "stroke-width": 1.4,
      }),
    );
  });

  const hoverLine = svgNode("line", {
    y1: CHART.top,
    y2: CHART.top + plotH,
    stroke: "#c9d5e3",
    "stroke-width": 1,
    "stroke-dasharray": "4 4",
  });
  const hoverDot = svgNode("circle", {
    r: 5,
    fill: "#f0a11a",
    stroke: "#fff",
    "stroke-width": 2,
  });
  const hoverGroup = svgNode("g", { opacity: 0, "aria-hidden": "true" });
  hoverGroup.append(hoverLine, hoverDot);

  chart.replaceChildren(defs, grid, areaPath, linePath, dots, hoverGroup);

  chartGeom = { points, plotW, plotH, width: CHART.width, height: CHART.height, left: CHART.left, top: CHART.top };
  chartHover = { group: hoverGroup, line: hoverLine, dot: hoverDot };

  const first = data[0];
  const last = data.at(-1);
  chart.setAttribute(
    "aria-label",
    `Gráfica de la TRM entre ${formatDateLong(first.fecha)} y ${formatDateLong(last.fecha)}. Mínimo ${formatoValor(rawMin)} y máximo ${formatoValor(rawMax)} pesos colombianos. Usa las flechas izquierda y derecha para recorrer los registros.`,
  );
}

function renderTable() {
  if (!state.data.length) {
    tableBody.replaceChildren(
      el("tr", {}, [el("td", { colspan: "5", className: "muted", text: "No hay registros para mostrar." })]),
    );
    tableCount.textContent = "0 registros";
    return;
  }

  const positions = new Map(state.data.map((item, index) => [item.fecha, index]));
  const rows = [...state.data].reverse();

  tableBody.replaceChildren(
    ...rows.map((item) => {
      const index = positions.get(item.fecha);
      const previous = index > 0 ? state.data[index - 1] : null;
      const diff = previous ? item.valor - previous.valor : null;
      const pct = previous && previous.valor ? (diff / previous.valor) * 100 : null;
      const tone = diff === null ? "muted" : diff > 0 ? "text-success" : diff < 0 ? "text-danger" : "muted";

      const viewBtn = el("button", {
        type: "button",
        className: "btn btn--outline btn--sm",
        text: "Ver",
        "aria-label": `Ver detalle de la TRM del ${formatDate(item.fecha)}`,
        onClick: () => abrirDetalle(item, previous),
      });

      return el("tr", {}, [
        el("td", { text: formatDate(item.fecha) }),
        el("td", { className: "num", text: formatoValor(item.valor) }),
        el("td", { className: `num ${tone}`, text: diff === null ? "—" : formatoDelta(diff) }),
        el("td", { className: `num ${tone}`, text: pct === null ? "—" : formatPercent(pct) }),
        el("td", { className: "actions" }, [viewBtn]),
      ]);
    }),
  );

  tableCount.textContent = `${state.data.length} ${state.data.length === 1 ? "registro" : "registros"}`;
}

function render() {
  if (!state.data.length) {
    renderEmpty();
    return;
  }

  renderFeature();
  renderStats();
  renderChart();
  renderTable();

  downloadBtn.disabled = false;
  chartRange.textContent = `${formatDate(state.data[0].fecha)} — ${formatDate(state.data.at(-1).fecha)}`;
  chartCount.textContent = `${state.data.length} puntos`;
}

function renderEmpty() {
  chart.replaceChildren(
    svgNode(
      "text",
      {
        x: CHART.width / 2,
        y: CHART.height / 2,
        "text-anchor": "middle",
        fill: "#8493a8",
        "font-size": "13",
        "font-family": "Manrope, sans-serif",
      },
      "Sin datos disponibles",
    ),
  );
  chartGeom = null;
  tableBody.replaceChildren(
    el("tr", {}, [el("td", { colspan: "5", className: "muted", text: "No hay registros para mostrar." })]),
  );
  tableCount.textContent = "0 registros";
  chartRange.textContent = "Sin datos";
  chartCount.textContent = "—";
  downloadBtn.disabled = true;
}

/* ---------- Tooltip de la gráfica ---------- */

function posicionarTooltip(index) {
  if (!chartGeom || !chartGeom.points[index]) return;

  const point = chartGeom.points[index];
  const rect = chart.getBoundingClientRect();
  const left = (point.x / chartGeom.width) * rect.width;
  const top = (point.y / chartGeom.height) * rect.height;

  tooltip.style.left = `${clamp(left, 76, Math.max(76, rect.width - 76))}px`;
  tooltip.style.top = `${Math.max(52, top)}px`;
  tooltip.classList.add("is-visible");
  tooltipValue.textContent = `$ ${formatoValor(point.item.valor)} COP`;
  tooltipDate.textContent = formatDateLong(point.item.fecha);

  if (chartHover) {
    chartHover.group.setAttribute("opacity", "1");
    chartHover.line.setAttribute("x1", point.x);
    chartHover.line.setAttribute("x2", point.x);
    chartHover.dot.setAttribute("cx", point.x);
    chartHover.dot.setAttribute("cy", point.y);
  }

  chart.setAttribute(
    "aria-label",
    `TRM del ${formatDateLong(point.item.fecha)}: ${formatoValor(point.item.valor)} pesos colombianos.`,
  );
}

function ocultarTooltip() {
  if (!chartGeom) return;
  tooltip.classList.remove("is-visible");
  chartHover?.group.setAttribute("opacity", "0");
  const first = state.data[0];
  const last = state.data.at(-1);
  if (first && last) {
    chart.setAttribute(
      "aria-label",
      `Gráfica de la TRM entre ${formatDateLong(first.fecha)} y ${formatDateLong(last.fecha)}. Usa las flechas izquierda y derecha para recorrer los registros.`,
    );
  }
}

on(chart, "pointermove", (event) => {
  if (!chartGeom) return;
  const rect = chart.getBoundingClientRect();
  const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
  const x = ratio * chartGeom.width;
  const relative = clamp((x - chartGeom.left) / chartGeom.plotW, 0, 1);
  const index = Math.round(relative * (chartGeom.points.length - 1));
  keyboardIndex = index;
  posicionarTooltip(index);
});

on(chart, "pointerleave", ocultarTooltip);
on(chart, "blur", ocultarTooltip);

on(chart, "keydown", (event) => {
  if (!chartGeom?.points.length) return;
  const total = chartGeom.points.length;

  if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
    event.preventDefault();
    if (keyboardIndex < 0) keyboardIndex = total - 1;
    keyboardIndex = clamp(keyboardIndex + (event.key === "ArrowRight" ? 1 : -1), 0, total - 1);
    posicionarTooltip(keyboardIndex);
  }

  if (event.key === "Home" || event.key === "End") {
    event.preventDefault();
    keyboardIndex = event.key === "Home" ? 0 : total - 1;
    posicionarTooltip(keyboardIndex);
  }
});

on(window, "resize", ocultarTooltip);

/* ---------- Modal de registro ---------- */

function abrirDetalle(item, previous) {
  const diff = previous ? item.valor - previous.valor : null;
  const pct = previous && previous.valor ? (diff / previous.valor) * 100 : null;

  const content = detailList([
    { label: "Fecha de vigencia", value: formatDateLong(item.fecha) },
    { label: "Valor", value: `$ ${formatoValor(item.valor)} COP` },
    { label: "Unidad", value: item.unidad || "COP" },
    {
      label: "Variación absoluta",
      value: diff === null ? "Sin registro anterior" : `${formatoDelta(diff)} COP`,
    },
    {
      label: "Variación porcentual",
      value: pct === null ? "Sin registro anterior" : formatPercent(pct),
    },
    {
      label: "Registro anterior",
      value: previous ? `${formatDateLong(previous.fecha)} · $ ${formatoValor(previous.valor)} COP` : "—",
    },
  ]);

  openModal({
    title: `TRM del ${formatDate(item.fecha)}`,
    subtitle: "Detalle del registro y su comparación inmediata",
    content,
    size: "sm",
  });

  consola.info(`Detalle abierto · ${item.fecha} · ${formatoValor(item.valor)} COP`);
}

/* ---------- Datos ---------- */

function aplicarPeriodo() {
  if (!state.all.length) {
    state.data = [];
    renderEmpty();
    return;
  }

  const latest = toDate(state.all.at(-1).fecha);
  const cutoff = new Date(latest);
  cutoff.setDate(cutoff.getDate() - state.periodo);

  const filtrados = state.all.filter((item) => {
    const date = toDate(item.fecha);
    return date && date >= cutoff;
  });

  state.data = filtrados.length ? filtrados : state.all;
  render();
  setStatus(`${state.data.length} registros · ${state.periodo} días`, "is-ok");

  const first = state.data[0];
  const last = state.data.at(-1);
  consola.info(`Período ${state.periodo} días · ${first.fecha} → ${last.fecha} · ${state.data.length} registros`);
}

async function cargarRespaldo(token) {
  try {
    const { data, elapsed } = await fetchJSON("../data/trm.json", { timeout: 15000 });
    if (token !== loadToken) return;

    const all = normalizar(data);
    if (!all.length) throw new Error("El respaldo no contiene registros válidos.");

    state.all = all;
    state.origin = "respaldo";
    state.updated = Date.now();
    mostrarBannerRespaldo(data.length);
    aplicarPeriodo();
    setStatus("Datos de respaldo", "is-error");

    consola.warn(`Respaldo local cargado · ${all.length} registros · ${elapsed} ms`);
    consola.info("Origen: data/trm.json (misma forma que Socrata).");
    toast("datos.gov.co no respondió. Usando el respaldo local.", "warning", 5200);
  } catch (error) {
    if (token !== loadToken) return;
    state.all = [];
    state.data = [];
    renderEmpty();
    setStatus("Sin datos", "is-error");
    showBanner(banner, {
      type: "danger",
      title: "No fue posible cargar la TRM",
      message: describeError(error),
    });
    emptyElFallback(error);
    consola.error("Tampoco se pudo cargar el respaldo:", describeError(error));
  }
}

function mostrarBannerRespaldo(cantidad) {
  showBanner(banner, {
    type: "warning",
    title: "Mostrando respaldo local",
    message: `La API de datos.gov.co no respondió. Se cargaron ${cantidad} registros desde data/trm.json.`,
  });
}

function emptyElFallback(error) {
  tableBody.replaceChildren(
    el("tr", {}, [
      el("td", { colspan: "5" }, [
        emptyState({
          icon: "!",
          title: "Sin registros",
          message: describeError(error),
          action: { label: "Reintentar", onClick: () => cargar({ force: true }) },
        }),
      ]),
    ]),
  );
}

async function cargar({ force = false } = {}) {
  const token = ++loadToken;

  if (!force && cache && Date.now() - cache.time < CACHE_MS) {
    state.all = cache.data;
    state.origin = "cache";
    state.updated = cache.time;
    hideBanner(banner);
    aplicarPeriodo();
    consola.info(`Caché en memoria · ${Math.round((Date.now() - cache.time) / 1000)} s de antigüedad`);
    return;
  }

  setStatus("Consultando datos.gov.co…", "is-busy");
  setBusy(refreshBtn, true, "Actualizando…");
  hideBanner(banner);

  tableBody.replaceChildren(
    ...Array.from({ length: 5 }, () =>
      el("tr", {}, [
        el("td", { colspan: "5" }, [el("div", { className: "skeleton", style: { height: "32px" } })]),
      ]),
    ),
  );

  const url = buildURL(ENDPOINT, { $order: "vigenciadesde DESC", $limit: LIMIT });
  consola.info(`GET ${url}`);

  try {
    const { data, status, elapsed, size } = await requestJSON(url, { timeout: 20000 });
    if (token !== loadToken) return;
    if (!Array.isArray(data)) throw new Error("Socrata no devolvió un arreglo de registros.");

    const all = normalizar(data);
    if (!all.length) throw new Error("La API no devolvió registros válidos.");

    cache = { data: all, time: Date.now() };
    state.all = all;
    state.origin = "api";
    state.updated = Date.now();
    state.meta = { status, elapsed, size };

    aplicarPeriodo();
    setStatus("Datos actualizados", "is-ok");
    consola.success(`HTTP ${status} · ${elapsed} ms · ${all.length} registros únicos · ${Math.round(size / 1024)} KB`);
    consola.info("Origen: datos.gov.co · dataset 32sa-8pi3");
  } catch (error) {
    if (token !== loadToken) return;
    consola.error("Socrata:", describeError(error));
    showBanner(banner, {
      type: "danger",
      title: "datos.gov.co no respondió",
      message: `${describeError(error)} Intentando cargar el respaldo local…`,
    });
    await cargarRespaldo(token);
  } finally {
    if (token === loadToken) setBusy(refreshBtn, false);
  }
}

/* ---------- CSV ---------- */

function descargarCSV() {
  if (!state.data.length) {
    toast("Todavía no hay registros para exportar.", "warning");
    return;
  }

  const lines = [["fecha_vigencia", "valor", "unidad"]];
  for (const item of state.data) {
    lines.push([item.fecha, item.valor.toFixed(2), item.unidad || "COP"]);
  }

  const csv = `\uFEFF${lines.map((line) => line.join(",")).join("\r\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const today = new Date().toISOString().slice(0, 10);
  anchor.href = objectUrl;
  anchor.download = `trm-${state.periodo}d-${today}.csv`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);

  toast(`CSV descargado · ${state.data.length} registros.`, "success");
  consola.success(`CSV generado con ${state.data.length} registros y BOM UTF-8.`);
}

/* ---------- Eventos ---------- */

periodBtns.forEach((button) => {
  on(button, "click", () => {
    state.periodo = Number(button.dataset.periodo);
    periodBtns.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    if (state.all.length) aplicarPeriodo();
    else consola.info(`Período seleccionado: ${state.periodo} días (esperando datos).`);
  });
});

on(refreshBtn, "click", () => {
  consola.info("Actualización manual solicitada.");
  cargar({ force: true });
});

on(downloadBtn, "click", descargarCSV);

consola.info("Panel de TRM listo. Consultando datos.gov.co…");
cargar();
