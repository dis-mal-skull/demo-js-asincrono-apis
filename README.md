# Módulo A · JavaScript asíncrono y consumo de APIs

Sitio educativo estático del **Módulo A · Procesamiento de datos** (SENA · ADSO). Reúne seis demos interactivas sobre asincronía y dos ejercicios completos con APIs reales, construidos con **HTML5, CSS3 y JavaScript ES2022 vanilla**: sin frameworks, sin bundler y sin dependencias de npm.

El objetivo es que el estudiante **vea el tiempo ocurriendo**: el orden del event loop, los estados de una petición, el ciclo de una promesa, el contrato de una respuesta HTTP y la diferencia entre datos en vivo y datos de respaldo.

---

## 1. Contenido

### Ejemplos guiados

| # | Página | Qué demuestra | Conceptos |
|---|--------|---------------|-----------|
| 01 | [`ejemplos/01-asincronia.html`](ejemplos/01-asincronia.html) | Orden real de ejecución con línea de tiempo, callbacks encadenados y callback hell | `setTimeout`, pila, microtareas, macrotareas, event loop |
| 02 | [`ejemplos/02-xhr.html`](ejemplos/02-xhr.html) | Calculadora remota con `XMLHttpRequest` y `FormData` | `readyState`, estado HTTP, `onerror`, `ontimeout` |
| 03 | [`ejemplos/03-promesas.html`](ejemplos/03-promesas.html) | Promesa con número aleatorio: pares resuelven, impares rechazan | `Promise`, `then`, `catch`, `finally`, estados |
| 04 | [`ejemplos/04-fetch.html`](ejemplos/04-fetch.html) | Perfil real desde JSONPlaceholder, metadatos y error 404 simulado | `fetch`, `response.ok`, JSON, `AbortController` |
| 05 | [`ejemplos/05-post-formdata.html`](ejemplos/05-post-formdata.html) | Formulario validado que envía `FormData` al servidor local | `POST`, multipart, `text/plain`, validación |
| 06 | [`ejemplos/06-paises.html`](ejemplos/06-paises.html) | Explorador de 250 países con el snapshot de REST Countries v3.1 | JSON local, filtros, `Intl`, banderas con respaldo |

### Ejercicios completos

| # | Página | API | Interfaz |
|---|--------|-----|----------|
| 01 | [`ejercicios/01-criptomonedas.html`](ejercicios/01-criptomonedas.html) | CoinGecko + open.er-api.com | Top 50, estadísticas, búsqueda, orden, USD/COP/EUR, tarjetas y tabla, sparklines SVG, modal, caché y respaldo |
| 02 | [`ejercicios/02-datos-gov-co.html`](ejercicios/02-datos-gov-co.html) | datos.gov.co (Socrata) | TRM vigente, períodos 30/90/365/500 días, gráfica SVG con tooltip, tabla, modal, CSV y respaldo |

La portada [`index.html`](index.html) funciona como ruta de aprendizaje y explica cómo ejecutar el proyecto.

---

## 2. Requisitos

- **Node.js 18 o superior** (recomendado), o **PHP 8 o superior** como alternativa.
- Un navegador moderno con soporte para módulos ES, `fetch`, `FormData` y `<dialog>`.
- Conexión a Internet **solo** para las APIs en vivo, Google Fonts, highlight.js y las banderas. Si una API falla, el sitio sigue funcionando con los datos de `data/`.

No hay que ejecutar `npm install`. El archivo `package.json` no declara dependencias.

---

## 3. Cómo ejecutar

### Opción A · Node.js (recomendada)

Desde la carpeta `01-demo`:

```bash
npm start
# o directamente:
node server.js
```

Abre <http://localhost:5500>.

Para usar otro puerto:

```bash
PORT=5501 npm start
```

También puedes cambiar el host:

```bash
HOST=0.0.0.0 PORT=5500 node server.js
```

### Opción B · PHP 8+

```bash
php -S localhost:5500
```

Abre <http://localhost:5500>. PHP ejecutará `test.php` de forma nativa. El resto del sitio son archivos estáticos.

### Opción C · Live Server de VS Code

Puedes abrir `index.html` con la extensión Live Server. **Limitación:** Live Server no ejecuta PHP; si navegas a `/test.php` descargará el código fuente. Por eso los ejemplos 02 y 05 solo completan su flujo con Node o PHP.

### ⚠️ No uses `file://`

Abrir los HTML con doble clic rompe la experiencia:

- Los módulos ES (`<script type="module">`) se bloquean por CORS.
- `fetch("../data/paises.json")` no puede leer archivos locales.
- Las peticiones a `../test.php` no tienen servidor.
- Las rutas relativas de los recursos pueden fallar.

Siempre usa `http://localhost:5500` (o el puerto elegido).

---

## 4. Estructura del proyecto

```text
01-demo/
├─ index.html                  Portada y ruta de aprendizaje
├─ README.md                   Este documento
├─ package.json                Scripts start/dev, sin dependencias
├─ server.js                   Servidor estático + POST /test.php (Node 18+)
├─ test.php                    Endpoint equivalente en PHP 8
├─ ejemplos/
│  ├─ 01-asincronia.html
│  ├─ 02-xhr.html
│  ├─ 03-promesas.html
│  ├─ 04-fetch.html
│  ├─ 05-post-formdata.html
│  └─ 06-paises.html
├─ ejercicios/
│  ├─ 01-criptomonedas.html
│  └─ 02-datos-gov-co.html
├─ assets/
│  ├─ favicon.svg
│  ├─ css/
│  │  ├─ base.css              Tokens, reset, tipografía, layout
│  │  ├─ components.css        Botones, tarjetas, consola, modal, tablas…
│  │  └─ pages.css             Portada, páginas interiores y gráficas
│  └─ js/
│     ├─ core/
│     │  ├─ dom.js             qs/qsa, on, el, escapeHTML, debounce…
│     │  ├─ format.js          Formato es-CO con Intl y caché
│     │  ├─ http.js            fetch con timeout, HttpError, métricas
│     │  ├─ console-panel.js   Consola visual con serialización
│     │  ├─ modal.js           Modal accesible sobre <dialog>
│     │  └─ ui.js              initUI, toasts, banners, setBusy, copiar
│     └─ pages/
│        ├─ home.js
│        ├─ asincronia.js
│        ├─ xhr.js
│        ├─ promesas.js
│        ├─ fetch.js
│        ├─ post-formdata.js
│        ├─ paises.js
│        ├─ criptomonedas.js
│        └─ datos-gov.js
└─ data/
   ├─ paises.json              250 países (forma REST Countries v3.1)
   ├─ criptomonedas.json        Top 50 en USD con sparkline
   └─ trm.json                 500 registros de TRM
```

---

## 5. APIs utilizadas

### CoinGecko

- **Endpoint:** `https://api.coingecko.com/api/v3/coins/markets`
- **Parámetros:** `vs_currency=usd`, `order=market_cap_desc`, `per_page=50`, `page=1`, `sparkline=true`, `price_change_percentage=24h`.
- **Particularidad:** CoinGecko **ya no acepta `cop`** como moneda de cotización. La aplicación consulta en USD y convierte con la tasa de `https://open.er-api.com/v6/latest/USD`. La tasa usada se muestra en la cabecera y en el modal.
- **Respaldo:** `data/criptomonedas.json` (top 50 en USD). Al usarlo se fuerza USD y se avisa con un banner.
- **Límites:** la API pública tiene cuota por minuto. La caché de 60 s evita peticiones innecesarias; si se agota la cuota (429), se carga el respaldo.

### datos.gov.co · TRM (Socrata)

- **Dataset activo:** `32sa-8pi3`
- **Endpoint:** `https://www.datos.gov.co/resource/32sa-8pi3.json`
- **Consulta:** `$order=vigenciadesde DESC&$limit=800`
- **Campos usados:** `valor`, `unidad`, `vigenciadesde`, `vigenciahasta`.
- **Particularidad:** el identificador `xdk5-pm3f` del material original está **retirado**. El ejercicio usa el dataset vigente y lo explica en pantalla.
- **Respaldo:** `data/trm.json` con 500 registros.

### JSONPlaceholder

- **Endpoint:** `https://jsonplaceholder.typicode.com/users/1`
- **Error simulado:** `/users/9999` devuelve 404 y permite explicar que `fetch` **no rechaza** por estado HTTP.
- **Timeout:** 15 s con `AbortController`.

### REST Countries v3.1 (retirada)

- **Endpoint histórico:** `https://restcountries.com/v3.1/all`
- La versión v3.1 fue retirada en 2026; hoy responde con un aviso de deprecación. El ejemplo 06 conserva el código original como referencia didáctica y usa un **snapshot local** de 250 países con la misma forma (`cca3`, `name.common`, `capital`, `population`, `area`, `flags`, `currencies`, `languages`, `timezones`, `maps`).
- **Banderas:** `https://flagcdn.com/w320/{cca2}.png` con respaldo al emoji si la imagen falla.

### Recursos de presentación

- **Google Fonts:** Manrope (400–800) y JetBrains Mono (400–600).
- **highlight.js 11.11.1** desde CDN, cargado con `defer` y aplicado con `window.hljs?.highlightAll?.()`.

---

## 6. Contrato de `test.php`

`test.php` (PHP) y `POST /test.php` (Node) comparten el mismo contrato: reciben `FormData`, JSON o `application/x-www-form-urlencoded`, limpian etiquetas HTML, limitan cada campo a **400 caracteres** y responden en **texto plano** con `Cache-Control: no-store` y CORS `*`.

### Campos aceptados

- `num1`, `num2`: si ambos son numéricos, se calculan suma, resta, producto y división (4 decimales; división por cero controlada).
- `nombre`, `correo`, `mensaje`: se muestran como resumen del formulario.
- Cualquier otro campo se lista en «Otros campos recibidos».

### Ejemplo de respuesta

```text
======================================================
        RESPUESTA DEL SERVIDOR
======================================================
Fecha:        2026-10-21 14:32:08
Método:       POST
Content-Type: multipart/form-data; boundary=…
------------------------------------------------------
OPERACIONES MATEMÁTICAS
num1:         8
num2:         4
Suma:         12
Resta:        4
Producto:     32
División:     2.0000
------------------------------------------------------
DATOS DEL FORMULARIO
Nombre:       Ana Gómez
Correo:       ana@example.com
Mensaje:      Quiero practicar fetch con FormData.
------------------------------------------------------
Registros recibidos: 5
Fin de la respuesta. ¡El servidor está funcionando!
======================================================
```

### Probar con curl

```bash
curl -X POST http://localhost:5500/test.php -F num1=8 -F num2=4
curl -X POST http://localhost:5500/test.php \
  -F nombre="Ana Gómez" \
  -F correo="ana@example.com" \
  -F mensaje="Hola desde curl"
curl http://localhost:5500/test.php
```

Un `GET` informativo explica cómo usar el endpoint. Otros métodos reciben `405`.

---

## 7. Decisiones de implementación

### Sin dependencias ni build

Todo se ejecuta tal como se escribe. Los módulos ES usan rutas relativas con extensión `.js`. El servidor Node usa solo módulos nativos (`http`, `fs`, `path`, `url`). No hay `node_modules` ni paso de compilación.

### Capas `core` y `pages`

- `core/` concentra utilidades reutilizables y testeables: DOM, formato, HTTP, consola, modal y UI.
- `pages/` contiene la lógica específica de cada página.
- Las páginas comparten estilos y estructura de header/footer, pero cada una declara su propio módulo.

### Consola visual

La clase `ConsolePanel` serializa strings, números, errores, nodos, funciones, arreglos y objetos (profundidad máxima 2), escribe la hora local, clasifica el mensaje y hace autoscroll **solo si el usuario está cerca del final**. Además, espeja la salida en la consola real del navegador.

### Formato local

`Intl.NumberFormat` y `Intl.DateTimeFormat` con locale `es-CO` se cachean por configuración. Los valores inválidos se muestran como `—`. Las fechas ISO sin hora se interpretan como locales para evitar el desfase de un día.

### Gráficas sin librerías

La sparkline de criptomonedas reduce la serie a ~46 puntos y construye `path` SVG de área y línea con color según la tendencia. La gráfica de TRM usa un `viewBox` de 860×320, cinco líneas de grilla, tres etiquetas X, área degradada, guía y tooltip; responde a puntero, touch y teclas `←` `→` `Home` `End`.

### Errores y resiliencia

- `http.js` envuelve `fetch` con `AbortController` (20 s por defecto), valida `response.ok`, parsea JSON y devuelve estado, tiempo y tamaño.
- Los mensajes de error se traducen a español (`describeError`).
- Criptomonedas y TRM tienen caché de 60 s, token de carga para descartar respuestas obsoletas y respaldo local.
- Las imágenes (logos y banderas) tienen reemplazo visual si fallan.

### Seguridad

- Los datos de API se insertan con `textContent` o nodos creados con `document.createElement`; no se usa `innerHTML` con datos sin escapar.
- `escapeHTML` está disponible en `core/dom.js` para los casos que lo requieran.
- El servidor bloquea *path traversal* comparando la ruta resuelta con `ROOT + path.sep`.
- Los archivos `.php` no se sirven como texto: Node implementa `/test.php` y rechaza el resto.
- No se usan `eval`, `document.write` ni dependencias de terceros en el código del sitio.

### Accesibilidad

- Un solo `<h1>` por página, landmarks semánticos y jerarquía de encabezados.
- Skip-link, foco visible, `aria-label` en navegación y botones icónicos.
- `aria-live` en consolas y zonas dinámicas; `aria-busy` durante cargas; `aria-pressed` en controles segmentados.
- Modal nativo `<dialog>` con `aria-labelledby`, cierre por botón, clic fuera y `Escape`.
- Tablas con `caption`, encabezados `th scope="col"` y scroll horizontal propio.
- Se respeta `prefers-reduced-motion`.

### Responsive

Probado en 360, 768, 1024 y 1440 px. En móvil la navegación se convierte en menú, las tarjetas pasan a una columna y las tablas mantienen scroll interno sin desbordar el `body`.

---

## 8. Cómo adaptarlo para clase

1. **Cambiar el número de monedas:** en `assets/js/pages/criptomonedas.js`, ajusta `PER_PAGE`. CoinGecko permite hasta 250 por página.
2. **Cambiar los períodos de la TRM:** edita los botones `[data-periodo]` en `ejercicios/02-datos-gov-co.html` y el estado inicial `periodo` en `datos-gov.js`.
3. **Añadir un país o corregir datos:** modifica `data/paises.json` manteniendo la forma de REST Countries v3.1.
4. **Reemplazar el respaldo de cripto o TRM:** conserva los campos usados por las páginas (`current_price`, `market_cap`, `sparkline_in_7d.price`, etc.).
5. **Agregar un ejemplo nuevo:** copia la estructura de una página de `ejemplos/`, crea su módulo en `pages/` y enlázala desde la portada y los pagers.
6. **Extender `test.php`:** añade validaciones en Node y PHP al mismo tiempo para mantener el contrato. Recuerda limpiar etiquetas y limitar la longitud.
7. **Practicar seguridad:** pide al estudiante enviar `<script>alert(1)</script>` en el mensaje y comprobar que la respuesta lo limpia y que la interfaz lo muestra como texto.
8. **Practicar errores:** activa el modo offline del navegador o bloquea los dominios de las APIs en DevTools para ver los respaldos y los banners.

---

## 9. Solución de problemas

| Síntoma | Causa probable | Solución |
|---------|----------------|----------|
| La página se ve sin estilos o los módulos no cargan | Se abrió con `file://` | Usa `npm start` o `php -S localhost:5500` |
| `EADDRINUSE` al arrancar | El puerto 5500 está ocupado | `PORT=5501 npm start` |
| «Los archivos PHP no se sirven como texto» | Se pidió un `.php` distinto de `/test.php` en Node | Usa `/test.php` o levanta PHP con `php -S` |
| Los ejemplos 02 y 05 muestran error de red | El servidor no está activo | Arranca Node o PHP y abre desde `localhost` |
| `/test.php` se descarga como archivo | Live Server no ejecuta PHP | Usa Node/PHP o el `/test.php` nativo de Node |
| Criptomonedas muestra un banner amarillo | Cuota, CORS o red de CoinGecko | Es el respaldo esperado; pulsa «Actualizar» más tarde |
| La tasa COP no aparece | `open.er-api.com` no respondió | La vista vuelve a USD automáticamente; reintenta después |
| La TRM muestra banner de respaldo | Socrata no respondió | Se cargan 500 registros locales; reintenta con «Actualizar» |
| Las banderas no cargan | flagcdn bloqueado o sin red | Se muestra el emoji del país como respaldo |
| Las fuentes se ven distintas | Google Fonts no cargó | El sitio usa `system-ui` como respaldo |
| El botón «Copiar» no funciona en `http://` remoto | Clipboard API requiere contexto seguro | Se usa el fallback con `execCommand`; en producción usa HTTPS |
| La gráfica no responde al puntero | Se está usando solo teclado o touch sin `pointermove` | Enfoca la gráfica y usa `←` `→`, o toca y arrastra |

---

## 10. Créditos y licencia

Material didáctico de **Procesamiento de datos · Módulo A**, SENA ADSO. Tipografías de Google Fonts; resaltado de sintaxis con highlight.js; datos de CoinGecko, datos.gov.co, JSONPlaceholder y flagcdn. Los datos de respaldo son snapshots con fines educativos.

Licencia **MIT**. Puedes copiar, adaptar y usar el proyecto en clase conservando la atribución.
