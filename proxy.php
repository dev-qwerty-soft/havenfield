<?php
// === CONFIG ===
define('INWORLD_API_KEY', 'Q3FqNzBEWHVqNFREQ2IyZ3dSbG5yLWxwRlRGVnBFQkQ6b21IY3hsVThCeFlpZE5lWVVtZllRRA==');
define('INWORLD_VOICE',   'Clive');
define('INWORLD_MODEL',   'inworld-tts-1.5-mini');
define('CACHE_DIR',       __DIR__ . '/tts-cache/');
define('ALLOWED_ORIGIN',  'https://dev-qwerty-soft.github.io');

// === CORS ===
header('Access-Control-Allow-Origin: '  . ALLOWED_ORIGIN);
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// === INPUT ===
$body = json_decode(file_get_contents('php://input'), true);
$text = trim($body['text'] ?? '');

if (!$text) {
    http_response_code(400);
    echo json_encode(['error' => 'No text provided']);
    exit;
}

// === CACHE CHECK ===
if (!is_dir(CACHE_DIR)) {
    mkdir(CACHE_DIR, 0755, true);
}

$cacheKey  = md5($text . INWORLD_VOICE . INWORLD_MODEL);
$cacheFile = CACHE_DIR . $cacheKey . '.json';

if (file_exists($cacheFile)) {
    echo file_get_contents($cacheFile);
    exit;
}

// === INWORLD API ===
$payload = json_encode([
    'text'         => $text,
    'voice_id'     => INWORLD_VOICE,
    'audio_config' => ['audio_encoding' => 'MP3', 'speaking_rate' => 0.9],
    'temperature'  => 1,
    'model_id'     => INWORLD_MODEL,
]);

$ch = curl_init('https://api.inworld.ai/tts/v1/voice:stream');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $payload,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 30,
    CURLOPT_HTTPHEADER     => [
        'Authorization: Basic ' . INWORLD_API_KEY,
        'Content-Type: application/json',
    ],
]);

$raw      = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr  = curl_error($ch);
curl_close($ch);

if ($curlErr || $httpCode !== 200) {
    http_response_code(502);
    echo json_encode([
        'error'  => 'Inworld API error',
        'code'   => $httpCode,
        'detail' => $raw,
        'curl'   => $curlErr,
    ]);
    exit;
}

// === PARSE STREAMING RESPONSE (JSON lines / SSE) ===
$audioBinary = '';
$timestamps  = [];

foreach (explode("\n", $raw) as $line) {
    $line = trim($line);
    if (!$line || $line === 'data: [DONE]') continue;

    // Strip SSE prefix if present
    if (str_starts_with($line, 'data: ')) {
        $line = substr($line, 6);
    }

    $chunk = json_decode($line, true);
    if (!$chunk) continue;

    // Inworld may wrap in "result" key
    $result = $chunk['result'] ?? $chunk;

    if (!empty($result['audio_content'])) {
        $audioBinary .= base64_decode($result['audio_content']);
    }

    // Collect word timestamps from any known key paths
    $words = $result['alignment']['words']
          ?? $result['timestamps']['words']
          ?? $result['words']
          ?? [];

    foreach ($words as $w) {
        $timestamps[] = $w;
    }
}

// === SAVE & RETURN ===
$response = json_encode([
    'audio'      => base64_encode($audioBinary),
    'timestamps' => $timestamps,
]);

file_put_contents($cacheFile, $response);
echo $response;
