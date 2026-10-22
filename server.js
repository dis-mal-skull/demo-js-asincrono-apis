#!/usr/bin/env node
/**
 * server.js · servidor estático sin dependencias para el Módulo A.
 * Node.js 18+ · sirve el sitio y emula POST /test.php.
 */

"use strict";

const http = require("node:http");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { URL } = require("node:url");

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 5500;
const HOST = process.env.HOST || "127.0.0.1";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".csv": "text/csv; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".map": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

const SEPARATOR = "=".repeat(54);
const THIN = "-".repeat(54);

function send(res, status, body, type = "text/plain; charset=utf-8", extra = {}) {
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(String(body), "utf8");
  res.writeHead(status, {
    "Content-Type": type,
    "Content-Length": payload.length,
    ...SECURITY_HEADERS,
    ...extra,
  });
  res.end(payload);
}

function page(title, message) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · Módulo A</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 2rem;
    font-family: Manrope, system-ui, sans-serif; background: #f4f7fb; color: #33445c; }
  main { width: min(560px, 100%); padding: 2.5rem; border: 1px solid #dfe7f0; border-radius: 24px;
    background: #fff; box-shadow: 0 24px 60px rgba(14,27,44,.08); }
  .mark { display: grid; place-items: center; width: 46px; height: 46px; border-radius: 12px;
    background: linear-gradient(135deg,#14a58a,#0b6f5f); color: #fff; font-family: monospace; font-weight: 700; }
  h1 { margin: 1.2rem 0 .5rem; color: #0e1b2c; font-size: 1.6rem; letter-spacing: -.03em; }
  p { line-height: 1.7; margin: 0 0 .8rem; }
  code { font-family: monospace; padding: .15em .4em; border-radius: 5px; background: #eef4f9; color: #064e43; }
  a { display: inline-block; margin-top: 1rem; padding: .65rem 1rem; border-radius: 10px;
    background: #0f8f78; color: #fff; text-decoration: none; font-weight: 700; font-size: .9rem; }
</style>
</head>
<body>
<main>
  <div class="mark" aria-hidden="true">{ }</div>
  <h1>${title}</h1>
  <p>${message}</p>
  <a href="/">Volver a la portada</a>
</main>
</body>
</html>`;
}

/* ---------- Utilidades de test.php ---------- */

function clean(value, limit = 400) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if (typeof value.name === "string") {
      return `${value.name} (archivo, ${value.size || 0} bytes)`.slice(0, limit);
    }
    value = JSON.stringify(value);
  }
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function isNumeric(value) {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "string") return false;
  const normalized = value.trim().replace(",", ".");
  return normalized !== "" && Number.isFinite(Number(normalized));
}

function toNumber(value) {
  return Number(String(value).trim().replace(",", "."));
}

function normalizeFields(source) {
  const fields = {};
  if (!source || typeof source !== "object") return fields;
  for (const [key, value] of Object.entries(source)) {
    if (Array.isArray(value)) fields[key] = value.map((item) => clean(item)).join(", ");
    else fields[key] = clean(value);
  }
  return fields;
}

function buildResponse({ fields, method, contentType }) {
  const now = new Date();
  const stamp = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(now)
    .replace(",", "");

  const lines = [
    SEPARATOR,
    "        RESPUESTA DEL SERVIDOR",
    SEPARATOR,
    `Fecha:        ${stamp}`,
    `Método:       ${method}`,
    `Content-Type: ${contentType || "no enviado"}`,
    THIN,
  ];

  const hasNum1 = isNumeric(fields.num1);
  const hasNum2 = isNumeric(fields.num2);

  if (hasNum1 && hasNum2) {
    const a = toNumber(fields.num1);
    const b = toNumber(fields.num2);
    lines.push(
      "OPERACIONES MATEMÁTICAS",
      `num1:         ${a}`,
      `num2:         ${b}`,
      `Suma:         ${a + b}`,
      `Resta:        ${a - b}`,
      `Producto:     ${a * b}`,
      `División:     ${b === 0 ? "no definida (división por cero)" : (a / b).toFixed(4)}`,
      THIN,
    );
  } else if (fields.num1 !== undefined || fields.num2 !== undefined) {
    lines.push(
      "OPERACIONES MATEMÁTICAS",
      "Se requieren num1 y num2 con valores numéricos válidos.",
      THIN,
    );
  }

  const formKeys = ["nombre", "correo", "mensaje"].filter((key) => fields[key]);
  if (formKeys.length) {
    lines.push("DATOS DEL FORMULARIO");
    if (fields.nombre) lines.push(`Nombre:       ${fields.nombre}`);
    if (fields.correo) lines.push(`Correo:       ${fields.correo}`);
    if (fields.mensaje) lines.push(`Mensaje:      ${fields.mensaje}`);
    lines.push(THIN);
  }

  const otherKeys = Object.keys(fields).filter(
    (key) => !["num1", "num2", "nombre", "correo", "mensaje"].includes(key),
  );
  if (otherKeys.length) {
    lines.push("OTROS CAMPOS RECIBIDOS");
    for (const key of otherKeys) lines.push(`${key}: ${fields[key]}`);
    lines.push(THIN);
  }

  if (!fields.num1 && !fields.num2 && !formKeys.length && !otherKeys.length) {
    lines.push(
      "No se recibieron campos.",
      "Campos aceptados: num1, num2, nombre, correo, mensaje.",
      THIN,
    );
  }

  lines.push(
    `Registros recibidos: ${Object.keys(fields).length}`,
    "Fin de la respuesta. ¡El servidor está funcionando!",
    SEPARATOR,
    "",
  );

  return lines.join("\n");
}

async function parseBody(req) {
  const contentType = (req.headers["content-type"] || "").toLowerCase();
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024) throw new Error("El cuerpo supera el límite de 1 MB.");
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return { fields: {}, contentType };

  try {
    if (contentType.includes("application/json")) {
      const parsed = JSON.parse(raw);
      return { fields: normalizeFields(parsed), contentType };
    }

    if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      const request = new Request("http://localhost/test.php", {
        method: "POST",
        headers: { "content-type": req.headers["content-type"] },
        body: raw,
      });
      const data = await request.formData();
      const fields = {};
      for (const [key, value] of data.entries()) fields[key] = clean(value);
      return { fields, contentType };
    }
  } catch (error) {
    return { fields: { error_parseo: clean(error.message) }, contentType, parseError: true };
  }

  return { fields: { cuerpo: clean(raw) }, contentType };
}

async function handleTest(req, res) {
  const contentType = req.headers["content-type"] || "";

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204, SECURITY_HEADERS);
    res.end();
    return;
  }

  if (req.method === "GET") {
    const text = [
      SEPARATOR,
      "        RESPUESTA DEL SERVIDOR",
      SEPARATOR,
      "Esta ruta responde en texto plano y está pensada para POST.",
      "Envíala con FormData desde los ejemplos 02 y 05.",
      "Campos aceptados: num1, num2, nombre, correo, mensaje.",
      THIN,
      "Ejemplo con curl:",
      "curl -X POST http://localhost:5500/test.php -F num1=8 -F num2=4",
      SEPARATOR,
      "",
    ].join("\n");

    send(res, 200, text, "text/plain; charset=utf-8", {
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    });
    return;
  }

  if (req.method !== "POST") {
    send(res, 405, "Método no permitido. Usa GET o POST.", "text/plain; charset=utf-8", {
      Allow: "GET, POST, OPTIONS",
    });
    return;
  }

  try {
    const { fields } = await parseBody(req);
    const text = buildResponse({ fields, method: req.method, contentType });
    send(res, 200, text, "text/plain; charset=utf-8", {
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    });
  } catch (error) {
    send(res, 500, `Error procesando la solicitud: ${error.message}`, "text/plain; charset=utf-8");
  }
}

/* ---------- Archivos estáticos ---------- */

async function serveStatic(req, res, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    send(res, 400, page("Solicitud inválida", "La ruta contiene caracteres no válidos."), "text/html; charset=utf-8");
    return;
  }

  if (decoded.includes("\0")) {
    send(res, 400, page("Solicitud inválida", "La ruta contiene caracteres no válidos."), "text/html; charset=utf-8");
    return;
  }

  if (decoded.toLowerCase().endsWith(".php") && decoded !== "/test.php") {
    send(
      res,
      403,
      page(
        "Los archivos PHP no se sirven como texto",
        "Para ejecutar <code>test.php</code> con PHP usa <code>php -S localhost:5500</code>. Con este servidor Node, la ruta <code>/test.php</code> ya está implementada de forma nativa.",
      ),
      "text/html; charset=utf-8",
    );
    return;
  }

  const target = path.resolve(ROOT, `.${decoded}`);
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) {
    send(res, 403, page("Acceso denegado", "La ruta solicitada está fuera del proyecto."), "text/html; charset=utf-8");
    return;
  }

  let filePath = target;
  let stats;
  try {
    stats = await fsp.stat(filePath);
    if (stats.isDirectory()) {
      if (!decoded.endsWith("/")) {
        res.writeHead(301, { Location: `${decoded}/`, ...SECURITY_HEADERS });
        res.end();
        return;
      }
      filePath = path.join(filePath, "index.html");
      stats = await fsp.stat(filePath);
    }
  } catch {
    send(
      res,
      404,
      page("Página no encontrada", `No existe <code>${pathname.replace(/</g, "&lt;")}</code> en este proyecto. Revisa la URL o vuelve a la portada.`),
      "text/html; charset=utf-8",
    );
    return;
  }

  if (!stats.isFile()) {
    send(res, 404, page("Página no encontrada", "La ruta no corresponde a un archivo."), "text/html; charset=utf-8");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";

  if (req.method === "HEAD") {
    res.writeHead(200, {
      "Content-Type": type,
      "Content-Length": stats.size,
      "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600",
      ...SECURITY_HEADERS,
    });
    res.end();
    return;
  }

  res.writeHead(200, {
    "Content-Type": type,
    "Content-Length": stats.size,
    "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600",
    ...SECURITY_HEADERS,
  });

  const stream = fs.createReadStream(filePath);
  stream.on("error", () => {
    if (!res.headersSent) send(res, 500, page("Error interno", "No fue posible leer el archivo."), "text/html; charset=utf-8");
    else res.destroy();
  });
  stream.pipe(res);
}

/* ---------- Servidor ---------- */

const server = http.createServer(async (req, res) => {
  let pathname = "/";
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    pathname = url.pathname;
  } catch {
    send(res, 400, "Solicitud inválida.", "text/plain; charset=utf-8");
    return;
  }

  if (pathname === "/test.php") {
    await handleTest(req, res);
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    send(res, 405, "Método no permitido. Este servidor solo acepta GET y HEAD (y POST en /test.php).", "text/plain; charset=utf-8", {
      Allow: "GET, HEAD",
    });
    return;
  }

  try {
    await serveStatic(req, res, pathname === "/" ? "/index.html" : pathname);
  } catch (error) {
    console.error("Error inesperado:", error);
    if (!res.headersSent) {
      send(res, 500, page("Error interno", "Ocurrió un error inesperado en el servidor."), "text/html; charset=utf-8");
    } else {
      res.destroy();
    }
  }
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`\n  El puerto ${PORT} ya está en uso.`);
    console.error(`  Prueba con otro puerto:  PORT=5501 npm start\n`);
    process.exit(1);
  }
  if (error.code === "EACCES") {
    console.error(`\n  No hay permisos para escuchar en ${HOST}:${PORT}.`);
    console.error(`  Prueba con:  PORT=8080 npm start\n`);
    process.exit(1);
  }
  throw error;
});

server.listen(PORT, HOST, () => {
  console.log("");
  console.log("  Módulo A · JavaScript asíncrono y APIs");
  console.log(`  Sitio disponible en  http://localhost:${PORT}`);
  console.log(`  Endpoint de prueba  http://localhost:${PORT}/test.php`);
  console.log(`  Sirviendo           ${ROOT}`);
  console.log("");
  console.log("  Detén el servidor con Ctrl+C");
  console.log("");
});
