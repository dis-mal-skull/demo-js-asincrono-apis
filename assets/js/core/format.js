/**
 * format.js · formato local es-CO con Intl y caché de formateadores.
 * Ante valores inválidos devuelve el guion largo "—".
 */

const LOCALE = "es-CO";
const EMPTY = "—";

const numberCache = new Map();
const dateCache = new Map();
const relativeCache = new Map();

function numberFormatter(options) {
  const key = JSON.stringify(options);
  if (!numberCache.has(key)) numberCache.set(key, new Intl.NumberFormat(LOCALE, options));
  return numberCache.get(key);
}

function dateFormatter(options) {
  const key = JSON.stringify(options);
  if (!dateCache.has(key)) dateCache.set(key, new Intl.DateTimeFormat(LOCALE, options));
  return dateCache.get(key);
}

/** true para números finitos o cadenas numéricas no vacías. */
export function isNumber(value) {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string" && value.trim() !== "") return Number.isFinite(Number(value));
  return false;
}

/**
 * Moneda local. Usa más decimales para valores menores que 1.
 * @param {number|string} value
 * @param {string} currency ISO 4217 (USD, COP, EUR…)
 */
export function formatCurrency(value, currency = "USD", options = {}) {
  if (!isNumber(value)) return EMPTY;
  const amount = Number(value);
  const abs = Math.abs(amount);
  let digits = 2;
  if (abs > 0 && abs < 1) digits = 6;
  else if (currency === "COP" || currency === "CLP" || currency === "JPY") digits = 0;

  const formatter = numberFormatter({
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: Math.min(digits, 2),
    maximumFractionDigits: digits,
    ...options,
  });

  try {
    return formatter.format(amount);
  } catch {
    return `${currency} ${formatNumber(amount, { maximumFractionDigits: digits })}`;
  }
}

/** Moneda compacta: US$ 1,7 B. */
export function formatCompactCurrency(value, currency = "USD", options = {}) {
  if (!isNumber(value)) return EMPTY;
  try {
    return numberFormatter({
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      notation: "compact",
      maximumFractionDigits: 2,
      ...options,
    }).format(Number(value));
  } catch {
    return formatCompact(value);
  }
}

/** Número con separadores locales. */
export function formatNumber(value, options = {}) {
  if (!isNumber(value)) return EMPTY;
  return numberFormatter({ maximumFractionDigits: 2, ...options }).format(Number(value));
}

/** Número compacto: 12,4 M. */
export function formatCompact(value, options = {}) {
  if (!isNumber(value)) return EMPTY;
  return numberFormatter({ notation: "compact", maximumFractionDigits: 2, ...options }).format(Number(value));
}

/** Porcentaje ya expresado en base 100: 2.345 → "+2,35 %". */
export function formatPercent(value, { signed = true, digits = 2 } = {}) {
  if (!isNumber(value)) return EMPTY;
  return numberFormatter({
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    signDisplay: signed ? "always" : "auto",
  }).format(Number(value) / 100);
}

/** Convierte a Date válido; las fechas ISO sin hora se interpretan como locales. */
export function toDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (dateOnly) {
      const date = new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
      return Number.isNaN(date.getTime()) ? null : date;
    }
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

/** 22 oct 2026 */
export function formatDate(value) {
  const date = toDate(value);
  if (!date) return EMPTY;
  return dateFormatter({ day: "2-digit", month: "short", year: "numeric" }).format(date);
}

/** 22 de octubre de 2026 */
export function formatDateLong(value) {
  const date = toDate(value);
  if (!date) return EMPTY;
  return dateFormatter({ day: "numeric", month: "long", year: "numeric" }).format(date);
}

/** 22/10/26 */
export function formatDateShort(value) {
  const date = toDate(value);
  if (!date) return EMPTY;
  return dateFormatter({ day: "2-digit", month: "2-digit", year: "2-digit" }).format(date);
}

/** 22 oct 2026, 14:05 */
export function formatDateTime(value) {
  const date = toDate(value);
  if (!date) return EMPTY;
  return dateFormatter({
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** 20:05:09 */
export function formatTime(value) {
  const date = toDate(value);
  if (!date) return EMPTY;
  return dateFormatter({ hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(date);
}

const RELATIVE_UNITS = [
  ["year", 31536000000],
  ["month", 2592000000],
  ["day", 86400000],
  ["hour", 3600000],
  ["minute", 60000],
  ["second", 1000],
];

/** "hace 5 minutos", "en 2 días". */
export function formatRelative(value, base = Date.now()) {
  const date = toDate(value);
  if (!date) return EMPTY;
  const diff = date.getTime() - Number(base);
  const abs = Math.abs(diff);

  if (!relativeCache.has(LOCALE)) {
    relativeCache.set(LOCALE, new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" }));
  }
  const rtf = relativeCache.get(LOCALE);

  for (const [unit, ms] of RELATIVE_UNITS) {
    if (abs >= ms || unit === "second") {
      return rtf.format(Math.round(diff / ms), unit);
    }
  }
  return "ahora";
}

/** Clave local YYYY-MM-DD, útil para deduplicar registros. */
export function dateKey(value) {
  const date = toDate(value);
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Recorta texto largo sin cortar palabras cuando es posible. */
export function truncate(value, max = 80, suffix = "…") {
  const text = String(value ?? "").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, Math.max(0, max - suffix.length));
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}${suffix}`;
}
