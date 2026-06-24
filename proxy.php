<?php
// === CONFIG ===
define('INWORLD_API_KEY', 'Q3FqNzBEWHVqNFREQ2IyZ3dSbG5yLWxwRlRGVnBFQkQ6b21IY3hsVThCeFlpZE5lWVVtZllRRA==');
define('INWORLD_VOICE',   'Clive');
define('INWORLD_MODEL',   'inworld-tts-1.5-mini');
define('CHUNK_MAX',       1600); // Inworld limit is 2000, stay safe
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

// === DEBUG MODE (remove after fix) ===
if (isset($_GET['debug'])) {
    $payload = json_encode([
        'text'         => 'Hello.',
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
    curl_close($ch);
    echo json_encode(['http_code' => $httpCode, 'raw' => substr($raw, 0, 2000)]);
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

// === SPLIT TEXT INTO CHUNKS ≤ CHUNK_MAX chars ===
function splitChunks(string $text, int $max): array {
    if (strlen($text) <= $max) return [$text];

    $chunks = [];
    while (strlen($text) > $max) {
        $slice = substr($text, 0, $max);

        // Prefer to break at sentence boundary
        $pos = strrpos($slice, '. ');
        if ($pos === false) {
            // Fall back to word boundary
            $pos = strrpos($slice, ' ');
        }
        if ($pos === false) {
            $pos = $max;
        }

        $chunks[] = rtrim(substr($text, 0, $pos + 1));
        $text     = ltrim(substr($text, $pos + 1));
    }

    if ($text !== '') $chunks[] = $text;

    return $chunks;
}

// === CALL INWORLD FOR ONE CHUNK ===
function callInworld(string $text): array {
    $payload = json_encode([
        'text'          => $text,
        'voice_id'      => INWORLD_VOICE,
        'audio_config'  => ['audio_encoding' => 'MP3', 'speaking_rate' => 0.9],
        'temperature'   => 1,
        'model_id'      => INWORLD_MODEL,
        'timestampType' => 'WORD',
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
        return ['error' => true, 'code' => $httpCode, 'detail' => $raw, 'curl' => $curlErr];
    }

    $audioBinary = '';
    $timestamps  = [];

    $json = json_decode($raw, true);
    $chunks = [];
    if ($json) {
        $chunks = isset($json['result']) ? [$json] : (array) $json;
    } else {
        // Fallback: parse line-by-line SSE
        foreach (explode("\n", $raw) as $line) {
            $line = trim($line);
            if (!$line || $line === 'data: [DONE]') continue;
            if (str_starts_with($line, 'data: ')) $line = substr($line, 6);
            $chunk = json_decode($line, true);
            if ($chunk) $chunks[] = $chunk;
        }
    }

    foreach ($chunks as $chunk) {
        $result = $chunk['result'] ?? $chunk;

        if (!empty($result['audioContent'])) {
            $audioBinary .= base64_decode($result['audioContent']);
        }

        // Parse word timestamps: timestampInfo.wordAlignment (parallel arrays)
        $alignment = $result['timestampInfo']['wordAlignment'] ?? null;
        if ($alignment && !empty($alignment['words'])) {
            $wordTokens = $alignment['words'];
            $startTimes = $alignment['wordStartTimeSeconds'] ?? [];
            $endTimes   = $alignment['wordEndTimeSeconds']   ?? [];
            foreach ($wordTokens as $i => $word) {
                if (!preg_match('/\w/', $word)) continue; // skip whitespace/punctuation-only tokens
                $timestamps[] = [
                    'word'     => $word,
                    'start_ms' => (int) round(($startTimes[$i] ?? 0) * 1000),
                    'end_ms'   => (int) round(($endTimes[$i]   ?? 0) * 1000),
                ];
            }
        }
    }

    return ['audio' => $audioBinary, 'timestamps' => $timestamps];
}

// === DEBUG MODE (remove after fix) ===
if (isset($_GET['debug'])) {
    $payload = json_encode([
        'text'         => 'Hello.',
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
    curl_close($ch);
    // Return first 2000 chars of raw response so we can see the format
    echo json_encode(['http_code' => $httpCode, 'raw' => substr($raw, 0, 2000)]);
    exit;
}

// === PROCESS CHUNKS & MERGE ===
$chunks      = splitChunks($text, CHUNK_MAX);
$audioBinary = '';
$timestamps  = [];
$timeOffset  = 0; // ms — shifts each chunk's timestamps to absolute position

foreach ($chunks as $chunk) {
    $result = callInworld($chunk);

    if (!empty($result['error'])) {
        http_response_code(502);
        echo json_encode([
            'error'  => 'Inworld API error',
            'code'   => $result['code'],
            'detail' => $result['detail'],
            'curl'   => $result['curl'],
        ]);
        exit;
    }

    $audioBinary .= $result['audio'];

    $chunkWords    = $result['timestamps'];
    $chunkDuration = 0;

    foreach ($chunkWords as $w) {
        // Normalize field names (start_ms / startMs / start)
        $startMs = $w['start_ms'] ?? $w['startMs'] ?? $w['start'] ?? 0;
        $endMs   = $w['end_ms']   ?? $w['endMs']   ?? $w['end']   ?? 0;

        $w['start_ms'] = $startMs + $timeOffset;
        $w['end_ms']   = $endMs   + $timeOffset;

        $timestamps[]  = $w;
        $chunkDuration = max($chunkDuration, $endMs);
    }

    // Offset for next chunk = end of this chunk + 200ms pause
    $timeOffset += $chunkDuration + 200;
}

// === SAVE & RETURN ===
$response = json_encode([
    'audio'      => base64_encode($audioBinary),
    'timestamps' => $timestamps,
]);

file_put_contents($cacheFile, $response);
echo $response;
