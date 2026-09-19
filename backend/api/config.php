<?php
// ── Configuración de base de datos ────────────────────────────────────────
// Reemplaza estos valores con los de tu Hostinger hPanel → MySQL
define('DB_HOST', 'localhost');
define('DB_NAME', 'u228070604_nk2bd');
define('DB_USER', 'u228070604_nk2admin');
define('DB_PASS', 'TU_PASSWORD_MYSQL');  // contraseña configurada en hPanel
define('DB_CHARSET', 'utf8mb4');

// ── JWT ───────────────────────────────────────────────────────────────────
// Genera una clave segura: openssl rand -hex 32
define('JWT_SECRET', 'CAMBIA_ESTE_SECRETO_POR_UNO_ALEATORIO_LARGO');
define('JWT_EXP', 28800); // 8 horas en segundos

// ── CORS ─────────────────────────────────────────────────────────────────
// Dominio donde está el frontend en producción
define('ALLOWED_ORIGIN', 'https://nuevokennedy2.online');

// ── Zona horaria ──────────────────────────────────────────────────────────
define('APP_TZ', 'America/Bogota');
date_default_timezone_set(APP_TZ);
