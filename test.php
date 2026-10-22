<?php
/**
 * test.php · endpoint de práctica del Módulo A.
 * Equivalente funcional a la ruta POST /test.php del servidor Node.
 * Requiere PHP 8+ · ejecutar con: php -S localhost:5500
 */

declare(strict_types=1);

date_default_timezone_set('America/Bogota');

header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: no-store');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('X-Content-Type-Options: nosniff');

$SEPARATOR = str_repeat('=', 54);
$THIN = str_repeat('-', 54);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($method === 'GET') {
    echo implode("\n", [
        $SEPARATOR,
        '        RESPUESTA DEL SERVIDOR',
        $SEPARATOR,
        'Esta ruta responde en texto plano y está pensada para POST.',
        'Envíala con FormData desde los ejemplos 02 y 05.',
        'Campos aceptados: num1, num2, nombre, correo, mensaje.',
        $THIN,
        'Ejemplo con curl:',
        'curl -X POST http://localhost:5500/test.php -F num1=8 -F num2=4',
        $SEPARATOR,
        '',
    ]);
    exit;
}

if ($method !== 'POST') {
    http_response_code(405);
    header('Allow: GET, POST, OPTIONS');
    echo 'Método no permitido. Usa GET o POST.';
    exit;
}

/** Limpia texto: elimina etiquetas, compacta espacios y limita a 400 caracteres. */
function cleanValue(mixed $value, int $limit = 400): string
{
    if (is_array($value)) {
        if (isset($value['name']) && isset($value['size']) && is_string($value['name'])) {
            return mb_substr($value['name'] . ' (archivo, ' . (int) $value['size'] . ' bytes)', 0, $limit);
        }
        $value = json_encode($value, JSON_UNESCAPED_UNICODE);
    } elseif (is_object($value)) {
        $value = json_encode($value, JSON_UNESCAPED_UNICODE);
    }

    $text = strip_tags((string) $value);
    $text = preg_replace('/\s+/u', ' ', $text) ?? '';
    return mb_substr(trim($text), 0, $limit);
}

$contentType = $_SERVER['CONTENT_TYPE'] ?? $_SERVER['HTTP_CONTENT_TYPE'] ?? '';
$fields = [];

if (stripos($contentType, 'application/json') !== false) {
    $raw = file_get_contents('php://input') ?: '';
    $decoded = json_decode($raw, true);
    if (is_array($decoded)) {
        foreach ($decoded as $key => $value) {
            $fields[(string) $key] = cleanValue($value);
        }
    } elseif ($raw !== '') {
        $fields['error_parseo'] = 'El cuerpo no contiene JSON válido.';
    }
} else {
    foreach ($_POST as $key => $value) {
        if (is_array($value) && isset($value['tmp_name'])) {
            $fields[(string) $key] = cleanValue($value);
        } elseif (is_array($value)) {
            $fields[(string) $key] = implode(', ', array_map(static fn ($item) => cleanValue($item), $value));
        } else {
            $fields[(string) $key] = cleanValue($value);
        }
    }
}

function isNumericValue(string $value): bool
{
    $normalized = str_replace(',', '.', trim($value));
    return $normalized !== '' && is_numeric($normalized);
}

function toNumber(string $value): float
{
    return (float) str_replace(',', '.', trim($value));
}

$lines = [
    $SEPARATOR,
    '        RESPUESTA DEL SERVIDOR',
    $SEPARATOR,
    'Fecha:        ' . date('Y-m-d H:i:s'),
    'Método:       ' . $method,
    'Content-Type: ' . ($contentType !== '' ? $contentType : 'no enviado'),
    $THIN,
];

$hasNum1 = isset($fields['num1']) && isNumericValue($fields['num1']);
$hasNum2 = isset($fields['num2']) && isNumericValue($fields['num2']);

if ($hasNum1 && $hasNum2) {
    $a = toNumber($fields['num1']);
    $b = toNumber($fields['num2']);
    $division = $b == 0.0 ? 'no definida (división por cero)' : number_format($a / $b, 4, '.', '');

    $lines[] = 'OPERACIONES MATEMÁTICAS';
    $lines[] = 'num1:         ' . $a;
    $lines[] = 'num2:         ' . $b;
    $lines[] = 'Suma:         ' . ($a + $b);
    $lines[] = 'Resta:        ' . ($a - $b);
    $lines[] = 'Producto:     ' . ($a * $b);
    $lines[] = 'División:     ' . $division;
    $lines[] = $THIN;
} elseif (isset($fields['num1']) || isset($fields['num2'])) {
    $lines[] = 'OPERACIONES MATEMÁTICAS';
    $lines[] = 'Se requieren num1 y num2 con valores numéricos válidos.';
    $lines[] = $THIN;
}

$formKeys = array_values(array_filter(['nombre', 'correo', 'mensaje'], static fn ($key) => !empty($fields[$key])));

if ($formKeys !== []) {
    $lines[] = 'DATOS DEL FORMULARIO';
    if (!empty($fields['nombre'])) {
        $lines[] = 'Nombre:       ' . $fields['nombre'];
    }
    if (!empty($fields['correo'])) {
        $lines[] = 'Correo:       ' . $fields['correo'];
    }
    if (!empty($fields['mensaje'])) {
        $lines[] = 'Mensaje:      ' . $fields['mensaje'];
    }
    $lines[] = $THIN;
}

$otherKeys = array_values(array_diff(array_keys($fields), ['num1', 'num2', 'nombre', 'correo', 'mensaje']));

if ($otherKeys !== []) {
    $lines[] = 'OTROS CAMPOS RECIBIDOS';
    foreach ($otherKeys as $key) {
        $lines[] = $key . ': ' . $fields[$key];
    }
    $lines[] = $THIN;
}

if (!$hasNum1 && !$hasNum2 && $formKeys === [] && $otherKeys === []) {
    $lines[] = 'No se recibieron campos.';
    $lines[] = 'Campos aceptados: num1, num2, nombre, correo, mensaje.';
    $lines[] = $THIN;
}

$lines[] = 'Registros recibidos: ' . count($fields);
$lines[] = 'Fin de la respuesta. ¡El servidor está funcionando!';
$lines[] = $SEPARATOR;
$lines[] = '';

echo implode("\n", $lines);
