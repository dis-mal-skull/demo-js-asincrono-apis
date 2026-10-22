/**
 * http.js · capa fina sobre fetch con timeout, errores legibles y métricas.
 * Todas las peticiones devuelven el tiempo transcurrido en milisegundos.
 */

export const DEFAULT_TIMEOUT = 20000;

/** Error HTTP enriquecido con estado, URL y tiempo. */
export class HttpError extends Error {
  constructor(message, { status = 0, url = "", cause = null, elapsed = 0 } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "HttpError";
    this.status = status;
    this.url = url;
    this.elapsed = elapsed;
  }
}

function byteLength(text) {
  try {
    return new TextEncoder().encode(text).length;
  } catch {
    return text.length;
  }
}

function linkAbort(controller, externalSignal) {
  if (!externalSignal) return () => {};
  if (externalSignal.aborted) {
    controller.abort(externalSignal.reason);
    return () => {};
  }
  const abort = () => controller.abort(externalSignal.reason);
  externalSignal.addEventListener("abort", abort, { once: true });
  return () => externalSignal.removeEventListener("abort", abort);
}

/**
 * Petición de texto con timeout y AbortController.
 * @returns {Promise<{text: string, status: number, ok: boolean, statusText: string, contentType: string, url: string, elapsed: number, size: number, headers: Headers}>}
 */
export async function requestText(url, options = {}) {
  const { timeout = DEFAULT_TIMEOUT, signal: externalSignal, ...fetchOptions } = options;
  const controller = new AbortController();
  const unlink = linkAbort(controller, externalSignal);
  let timedOut = false;
  const timer = timeout > 0 ? setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeout) : 0;

  const started = performance.now();
  try {
    const response = await fetch(url, { ...fetchOptions, signal: controller.signal });
    const text = await response.text();
    const elapsed = Math.round(performance.now() - started);
    const contentType = response.headers.get("content-type") || "";

    if (!response.ok) {
      throw new HttpError(`El servidor respondió ${response.status} ${response.statusText || ""}`.trim(), {
        status: response.status,
        url: response.url || String(url),
        elapsed,
      });
    }

    return {
      text,
      status: response.status,
      ok: response.ok,
      statusText: response.statusText || "",
      contentType,
      url: response.url || String(url),
      elapsed,
      size: byteLength(text),
      headers: response.headers,
    };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    const elapsed = Math.round(performance.now() - started);
    if (timedOut) {
      throw new HttpError(`La solicitud superó el límite de ${Math.round(timeout / 1000)} s.`, {
        status: 0,
        url: String(url),
        cause: error,
        elapsed,
      });
    }
    if (error?.name === "AbortError") {
      throw new HttpError("La solicitud fue cancelada.", {
        status: 0,
        url: String(url),
        cause: error,
        elapsed,
      });
    }
    throw new HttpError("No fue posible completar la conexión con el servidor.", {
      status: 0,
      url: String(url),
      cause: error,
      elapsed,
    });
  } finally {
    if (timer) clearTimeout(timer);
    unlink();
  }
}

/** Petición JSON: valida response.ok, parsea y reporta tamaño/tiempo. */
export async function requestJSON(url, options = {}) {
  const { text, ...meta } = await requestText(url, options);

  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (error) {
    throw new HttpError("La respuesta no contiene JSON válido.", {
      status: meta.status,
      url: meta.url,
      cause: error,
      elapsed: meta.elapsed,
    });
  }

  return { data, ...meta };
}

/** Alias expresivo de requestJSON. */
export const fetchJSON = requestJSON;

/** Alias expresivo de requestText. */
export const fetchText = requestText;

/**
 * Construye una URL con parámetros, resolviendo rutas relativas contra la página.
 * @param {string} base
 * @param {Record<string, string|number|boolean|null|undefined>} params
 */
export function buildURL(base, params = {}) {
  const url = new URL(String(base), window.location.href);
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

/** Traduce errores técnicos a mensajes claros en español. */
export function describeError(error) {
  if (!error) return "Ocurrió un error inesperado.";

  if (error instanceof HttpError) {
    if (!error.status) {
      if (/cancelada/i.test(error.message)) return "La solicitud fue cancelada antes de terminar.";
      if (/límite/i.test(error.message)) return error.message;
      return "No pudimos conectar con el servidor. Revisa tu conexión o desactiva bloqueadores de red.";
    }
    if (error.status === 401 || error.status === 403) {
      return `El servidor rechazó la petición (${error.status}). Puede requerir autenticación o estar bloqueada por CORS.`;
    }
    if (error.status === 404) {
      return "El recurso solicitado no existe (404). Verifica la URL o el identificador.";
    }
    if (error.status === 429) {
      return "Se agotó la cuota temporal de la API (429). Espera un momento y vuelve a intentarlo.";
    }
    if (error.status >= 500) {
      return `La API falló temporalmente (${error.status}). Es un problema del servidor, no de tu código.`;
    }
    return `La petición respondió con error ${error.status}.`;
  }

  if (error.name === "AbortError") return "La solicitud tardó demasiado y fue cancelada.";
  if (error instanceof TypeError) return "No pudimos conectar. Revisa tu red, CORS o la URL del recurso.";
  return error.message || "Ocurrió un error inesperado.";
}
