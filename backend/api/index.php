<?php
require_once __DIR__ . '/config.php';

// ── CORS ──────────────────────────────────────────────────────────────────
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin === ALLOWED_ORIGIN || (defined('APP_ENV') && APP_ENV === 'dev')) {
    header('Access-Control-Allow-Origin: ' . ($origin ?: ALLOWED_ORIGIN));
} else {
    header('Access-Control-Allow-Origin: ' . ALLOWED_ORIGIN);
}
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

// ── DB ────────────────────────────────────────────────────────────────────
function db(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
    return $pdo;
}

// ── JWT ───────────────────────────────────────────────────────────────────
function b64url(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function jwt_create(array $payload): string {
    $header  = b64url(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $payload = b64url(json_encode($payload));
    $sig     = b64url(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
    return "$header.$payload.$sig";
}

function jwt_verify(string $token): ?array {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    [$header, $payload, $sig] = $parts;
    $expected = b64url(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
    if (!hash_equals($expected, $sig)) return null;
    $data = json_decode(base64_decode(strtr($payload, '-_', '+/')), true);
    if (!$data || $data['exp'] < time()) return null;
    return $data;
}

function auth_required(): array {
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/^Bearer\s+(.+)$/i', $h, $m)) {
        json_error('Token requerido', 401);
    }
    $payload = jwt_verify($m[1]);
    if (!$payload) json_error('Token inválido o expirado', 401);
    return $payload;
}

function admin_required(): array {
    $p = auth_required();
    if ($p['rol'] !== 'admin') json_error('Acceso denegado', 403);
    return $p;
}

// ── Helpers ───────────────────────────────────────────────────────────────
function json_ok(mixed $data): never {
    echo json_encode(['ok' => true, 'data' => $data], JSON_UNESCAPED_UNICODE);
    exit;
}

function json_error(string $msg, int $code = 400): never {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

function body(): array {
    return json_decode(file_get_contents('php://input'), true) ?? [];
}

// ── Router ────────────────────────────────────────────────────────────────
$method = $_SERVER['REQUEST_METHOD'];
$uri    = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$uri    = preg_replace('#^/api#', '', $uri);   // strip /api prefix
$uri    = rtrim($uri, '/') ?: '/';

try {
    match (true) {
        // Auth
        $uri === '/auth/login'  && $method === 'POST' => route_login(),
        $uri === '/auth/me'     && $method === 'GET'  => route_me(),

        // Habitantes
        $uri === '/habitantes'  && $method === 'GET'    => route_get_habitantes(),
        $uri === '/habitantes'  && $method === 'POST'   => route_save_habitante(),
        $uri === '/habitantes'  && $method === 'DELETE' => route_delete_habitante(),
        $uri === '/habitantes/auth' && $method === 'POST' => route_residente_auth(),
        $uri === '/habitantes/data' && $method === 'GET'  => route_residente_data(),

        // Personal
        $uri === '/personal'    && $method === 'GET' => route_get_personal(),

        // Ingresos
        $uri === '/ingresos'    && $method === 'GET'    => route_get_ingresos(),
        $uri === '/ingresos'    && $method === 'POST'   => route_save_ingreso(),
        $uri === '/ingresos'    && $method === 'PUT'    => route_update_ingreso(),
        $uri === '/ingresos'    && $method === 'DELETE' => route_delete_ingreso(),
        $uri === '/ingresos/next-recibo' && $method === 'GET' => route_next_recibo(),

        // Salidas
        $uri === '/salidas'     && $method === 'GET'    => route_get_salidas(),
        $uri === '/salidas'     && $method === 'POST'   => route_save_salida(),
        $uri === '/salidas'     && $method === 'PUT'    => route_update_salida(),
        $uri === '/salidas'     && $method === 'DELETE' => route_delete_salida(),
        $uri === '/salidas/next-registro' && $method === 'GET' => route_next_registro(),

        // Abonos
        $uri === '/abonos'      && $method === 'GET'  => route_get_abonos(),
        $uri === '/abonos'      && $method === 'POST' => route_save_abono(),

        // Totales
        $uri === '/totales'     && $method === 'GET' => route_totales(),

        default => json_error('Ruta no encontrada', 404),
    };
} catch (PDOException $e) {
    json_error('Error de base de datos: ' . $e->getMessage(), 500);
} catch (Throwable $e) {
    json_error('Error interno: ' . $e->getMessage(), 500);
}

// ═══════════════════════════════════════════════════════════════════════════
// RUTAS — AUTH
// ═══════════════════════════════════════════════════════════════════════════

function route_login(): never {
    $b = body();
    $username = trim($b['username'] ?? '');
    $password = $b['password'] ?? '';

    if (!$username || !$password) json_error('Usuario y contraseña requeridos');

    $stmt = db()->prepare('SELECT id, username, password, rol FROM usuarios WHERE username = ? AND activo = 1');
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password'])) {
        json_error('Credenciales incorrectas', 401);
    }

    $payload = [
        'sub' => $user['id'],
        'username' => $user['username'],
        'rol'  => $user['rol'],
        'iat'  => time(),
        'exp'  => time() + JWT_EXP,
    ];
    json_ok(['token' => jwt_create($payload), 'rol' => $user['rol'], 'username' => $user['username']]);
}

function route_me(): never {
    $p = auth_required();
    json_ok(['username' => $p['username'], 'rol' => $p['rol']]);
}

// ═══════════════════════════════════════════════════════════════════════════
// RUTAS — HABITANTES
// ═══════════════════════════════════════════════════════════════════════════

function route_get_habitantes(): never {
    auth_required();
    $rows = db()->query('SELECT interior, nombre, (pin IS NOT NULL AND pin != "") AS hasPin FROM habitantes ORDER BY interior ASC')->fetchAll();
    json_ok($rows);
}

function route_save_habitante(): never {
    admin_required();
    $b       = body();
    $interior = trim($b['interior'] ?? '');
    $nombre   = trim($b['nombre']   ?? '');
    $pin      = trim($b['pin']      ?? '');
    $modo     = $b['modo']     ?? 'add';
    $oldInt   = trim($b['oldInterior'] ?? '');

    if (!$interior || !$nombre) json_error('Interior y nombre requeridos');

    $pdo = db();

    // Verificar duplicado
    $chk = $pdo->prepare('SELECT interior FROM habitantes WHERE interior = ?');
    $chk->execute([$interior]);
    if ($chk->fetch() && ($modo === 'add' || $interior !== $oldInt)) {
        json_error('El interior ' . $interior . ' ya está registrado');
    }

    if ($modo === 'add') {
        $pinHash = $pin ? password_hash($pin, PASSWORD_BCRYPT) : null;
        $pdo->prepare('INSERT INTO habitantes (interior, nombre, pin) VALUES (?, ?, ?)')->execute([$interior, $nombre, $pinHash]);
    } else {
        if ($pin) {
            $pdo->prepare('UPDATE habitantes SET interior=?, nombre=?, pin=? WHERE interior=?')
                ->execute([$interior, $nombre, password_hash($pin, PASSWORD_BCRYPT), $oldInt]);
        } else {
            $pdo->prepare('UPDATE habitantes SET interior=?, nombre=? WHERE interior=?')
                ->execute([$interior, $nombre, $oldInt]);
        }
    }
    json_ok(['mensaje' => 'Residente ' . $interior . ' ' . ($modo === 'add' ? 'agregado' : 'modificado') . ' correctamente']);
}

function route_delete_habitante(): never {
    admin_required();
    $b = body();
    $interior = trim($b['interior'] ?? '');
    if (!$interior) json_error('Interior requerido');
    $stmt = db()->prepare('DELETE FROM habitantes WHERE interior = ?');
    $stmt->execute([$interior]);
    if ($stmt->rowCount() === 0) json_error('Interior no encontrado');
    json_ok(['mensaje' => 'Interior ' . $interior . ' eliminado']);
}

function route_residente_auth(): never {
    $b        = body();
    $interior = strtoupper(trim($b['interior'] ?? ''));
    $pin      = $b['pin'] ?? '';

    if (!$interior || !$pin) json_error('Interior y PIN requeridos');

    $stmt = db()->prepare('SELECT interior, nombre, pin FROM habitantes WHERE UPPER(interior) = ?');
    $stmt->execute([$interior]);
    $row = $stmt->fetch();

    if (!$row) json_error('Interior ' . $interior . ' no encontrado');
    if (!$row['pin']) json_error('Este interior no tiene PIN asignado. Contacta al administrador');

    // Soporte de PINs migrados en texto plano (primer login los hashea)
    $pdo = db();
    if (!str_starts_with($row['pin'], '$2y$')) {
        // PIN en texto plano heredado del Excel
        if ($row['pin'] !== $pin) json_error('PIN incorrecto');
        // Hashear ahora
        $pdo->prepare('UPDATE habitantes SET pin=? WHERE interior=?')
            ->execute([password_hash($pin, PASSWORD_BCRYPT), $row['interior']]);
    } else {
        if (!password_verify($pin, $row['pin'])) json_error('PIN incorrecto');
    }

    $payload = [
        'sub'      => $row['interior'],
        'interior' => $row['interior'],
        'nombre'   => $row['nombre'],
        'rol'      => 'residente',
        'iat'      => time(),
        'exp'      => time() + JWT_EXP,
    ];
    json_ok(['token' => jwt_create($payload), 'interior' => $row['interior'], 'nombre' => $row['nombre']]);
}

function route_residente_data(): never {
    $p        = auth_required();
    $interior = strtoupper(trim($_GET['interior'] ?? $p['interior'] ?? ''));
    if (!$interior) json_error('Interior requerido');

    // Solo el propio residente o un admin puede ver los datos
    if ($p['rol'] === 'residente' && strtoupper($p['interior']) !== $interior) {
        json_error('Acceso denegado', 403);
    }

    $stmt = db()->prepare(
        'SELECT factura,fecha,interior,nombre,cod_admin,administrador,cod_concepto,concepto,
                vlr_admon,vlr_vehiculo,mes_pago,cantidad,total,observacion
         FROM bd_ingresos WHERE UPPER(interior)=? ORDER BY fecha DESC'
    );
    $stmt->execute([$interior]);
    json_ok($stmt->fetchAll());
}

// ═══════════════════════════════════════════════════════════════════════════
// RUTAS — PERSONAL
// ═══════════════════════════════════════════════════════════════════════════

function route_get_personal(): never {
    auth_required();
    json_ok(db()->query('SELECT id, nombre, cargo FROM personal ORDER BY id')->fetchAll());
}

// ═══════════════════════════════════════════════════════════════════════════
// RUTAS — INGRESOS
// ═══════════════════════════════════════════════════════════════════════════

function route_get_ingresos(): never {
    auth_required();
    json_ok(db()->query(
        'SELECT id,factura,fecha,interior,nombre,cod_admin,administrador,
                cod_concepto,concepto,vlr_admon,vlr_vehiculo,mes_pago,cantidad,total,observacion
         FROM bd_ingresos ORDER BY fecha DESC, factura DESC'
    )->fetchAll());
}

function route_save_ingreso(): never {
    admin_required();
    $b = body();
    $chk = db()->prepare('SELECT id FROM bd_ingresos WHERE factura = ?');
    $chk->execute([(int)$b['factura']]);
    if ($chk->fetch()) json_error('El número de recibo ' . (int)$b['factura'] . ' ya existe. Verifica o ajusta el N° Recibo.');
    db()->prepare(
        'INSERT INTO bd_ingresos (factura,fecha,interior,nombre,cod_admin,administrador,
         cod_concepto,concepto,vlr_admon,vlr_vehiculo,mes_pago,cantidad,total,observacion)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
    )->execute([
        $b['factura'], $b['fecha'], $b['interior'], $b['nombre'],
        $b['cod_admin'] ?: null, $b['administrador'] ?? '',
        $b['cod_concepto'], $b['concepto'],
        (float)($b['vlr_admon']    ?? 0),
        (float)($b['vlr_vehiculo'] ?? 0),
        $b['mes_pago'],
        (int)($b['cantidad'] ?? 1),
        (float)($b['total'] ?? 0),
        $b['observacion'] ?? '',
    ]);
    json_ok(['mensaje' => 'Ingreso guardado correctamente']);
}

function route_update_ingreso(): never {
    admin_required();
    $b = body();
    if (!isset($b['id'])) json_error('ID requerido');
    db()->prepare(
        'UPDATE bd_ingresos SET factura=?,fecha=?,interior=?,nombre=?,cod_admin=?,administrador=?,
         cod_concepto=?,concepto=?,vlr_admon=?,vlr_vehiculo=?,mes_pago=?,cantidad=?,total=?,observacion=?
         WHERE id=?'
    )->execute([
        $b['factura'], $b['fecha'], $b['interior'], $b['nombre'],
        $b['cod_admin'] ?: null, $b['administrador'] ?? '',
        $b['cod_concepto'], $b['concepto'],
        (float)($b['vlr_admon']    ?? 0),
        (float)($b['vlr_vehiculo'] ?? 0),
        $b['mes_pago'],
        (int)($b['cantidad'] ?? 1),
        (float)($b['total'] ?? 0),
        $b['observacion'] ?? '',
        (int)$b['id'],
    ]);
    json_ok(['mensaje' => 'Ingreso actualizado correctamente']);
}

function route_delete_ingreso(): never {
    admin_required();
    $b = body();
    if (!isset($b['id'])) json_error('ID requerido');
    db()->prepare('DELETE FROM bd_ingresos WHERE id=?')->execute([(int)$b['id']]);
    json_ok(['mensaje' => 'Ingreso eliminado correctamente']);
}

function route_next_recibo(): never {
    auth_required();
    $row = db()->query('SELECT MAX(factura) AS max_f FROM bd_ingresos')->fetch();
    json_ok(['next' => ($row['max_f'] ?? 10814) + 1]);
}

// ═══════════════════════════════════════════════════════════════════════════
// RUTAS — SALIDAS
// ═══════════════════════════════════════════════════════════════════════════

function route_get_salidas(): never {
    auth_required();
    json_ok(db()->query(
        'SELECT id,cod_registro,fecha,cod_admin,administrador,
                cod_concepto,concepto,vlr_total,abono,saldo,observacion
         FROM bd_salidas ORDER BY fecha DESC'
    )->fetchAll());
}

function route_save_salida(): never {
    admin_required();
    $b      = body();
    $total  = (float)($b['vlr_total'] ?? 0);
    $abono  = (float)($b['abono']     ?? 0);
    db()->prepare(
        'INSERT INTO bd_salidas (cod_registro,fecha,cod_admin,administrador,
         cod_concepto,concepto,vlr_total,abono,saldo,observacion)
         VALUES (?,?,?,?,?,?,?,?,?,?)'
    )->execute([
        $b['cod_registro'], $b['fecha'],
        $b['cod_admin'] ?: null, $b['administrador'] ?? '',
        $b['cod_concepto'], $b['concepto'],
        $total, $abono, $total - $abono,
        $b['observacion'] ?? '',
    ]);
    json_ok(['mensaje' => 'Salida guardada correctamente']);
}

function route_update_salida(): never {
    admin_required();
    $b     = body();
    if (!isset($b['id'])) json_error('ID requerido');
    $total = (float)($b['vlr_total'] ?? 0);
    $abono = (float)($b['abono']     ?? 0);
    db()->prepare(
        'UPDATE bd_salidas SET cod_registro=?,fecha=?,cod_admin=?,administrador=?,
         cod_concepto=?,concepto=?,vlr_total=?,abono=?,saldo=?,observacion=?
         WHERE id=?'
    )->execute([
        $b['cod_registro'], $b['fecha'],
        $b['cod_admin'] ?: null, $b['administrador'] ?? '',
        $b['cod_concepto'], $b['concepto'],
        $total, $abono, $total - $abono,
        $b['observacion'] ?? '',
        (int)$b['id'],
    ]);
    json_ok(['mensaje' => 'Salida actualizada correctamente']);
}

function route_delete_salida(): never {
    admin_required();
    $b = body();
    if (!isset($b['id'])) json_error('ID requerido');
    db()->prepare('DELETE FROM bd_salidas WHERE id=?')->execute([(int)$b['id']]);
    json_ok(['mensaje' => 'Salida eliminada correctamente']);
}

function route_next_registro(): never {
    auth_required();
    $row = db()->query("SELECT MAX(CAST(REPLACE(cod_registro,'NK-','') AS UNSIGNED)) AS max_n FROM bd_salidas WHERE cod_registro LIKE 'NK-%'")->fetch();
    $n   = ($row['max_n'] ?? 37) + 1;
    json_ok(['next' => 'NK-' . $n]);
}

// ═══════════════════════════════════════════════════════════════════════════
// RUTAS — ABONOS
// ═══════════════════════════════════════════════════════════════════════════

function route_get_abonos(): never {
    auth_required();
    $cod  = $_GET['cod_registro'] ?? '';
    if ($cod) {
        $stmt = db()->prepare('SELECT * FROM bd_abonos WHERE cod_registro=? ORDER BY fecha DESC');
        $stmt->execute([$cod]);
    } else {
        $stmt = db()->query('SELECT * FROM bd_abonos ORDER BY fecha DESC');
    }
    json_ok($stmt->fetchAll());
}

function route_save_abono(): never {
    admin_required();
    $b   = body();
    $cod = trim($b['cod_registro'] ?? '');
    if (!$cod) json_error('cod_registro requerido');

    $pdo = db();

    // Leer salida correspondiente
    $stmt = $pdo->prepare('SELECT id, vlr_total, abono FROM bd_salidas WHERE cod_registro=?');
    $stmt->execute([$cod]);
    $salida = $stmt->fetch();
    if (!$salida) json_error('No se encontró el registro "' . $cod . '" en salidas');

    $vlrTotal       = (float)$salida['vlr_total'];
    $abonoActual    = (float)$salida['abono'];
    $nuevoAbono     = (float)($b['vlr_abono'] ?? 0);
    $totalAbonado   = $abonoActual + $nuevoAbono;
    $nuevoSaldo     = max(0, $vlrTotal - $totalAbonado);

    // Actualizar salida
    $pdo->prepare('UPDATE bd_salidas SET abono=?, saldo=? WHERE id=?')
        ->execute([$totalAbonado, $nuevoSaldo, $salida['id']]);

    // Registrar abono
    $pdo->prepare(
        'INSERT INTO bd_abonos (cod_registro,fecha,administrador,concepto,vlr_total_obra,vlr_abono,saldo,observacion)
         VALUES (?,?,?,?,?,?,?,?)'
    )->execute([
        $cod, $b['fecha'], $b['administrador'] ?? '',
        $b['concepto'] ?? '', $vlrTotal, $nuevoAbono, $nuevoSaldo,
        $b['observacion'] ?? '',
    ]);

    json_ok(['mensaje' => 'Abono registrado. Saldo pendiente: ' . number_format($nuevoSaldo, 0, ',', '.')]);
}

// ═══════════════════════════════════════════════════════════════════════════
// RUTAS — TOTALES
// ═══════════════════════════════════════════════════════════════════════════

function route_totales(): never {
    auth_required();
    $BASE_INGRESOS = 3637452.26;

    $ing = db()->query('SELECT COALESCE(SUM(total),0) AS t FROM bd_ingresos')->fetch()['t'];
    $sal = db()->query('SELECT COALESCE(SUM(vlr_total),0) AS t, COALESCE(SUM(saldo),0) AS s FROM bd_salidas')->fetch();

    json_ok([
        'base'          => $BASE_INGRESOS,
        'totalIngresos' => (float)$ing,
        'totalSalidas'  => (float)$sal['t'],
        'saldo'         => $BASE_INGRESOS + (float)$ing - (float)$sal['s'],
    ]);
}
