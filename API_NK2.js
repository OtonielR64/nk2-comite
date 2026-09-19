const BASE_INGRESOS = 3637452.26;

function doGet(e) { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  const action = e.parameter.action;
  let result;
  try {
    if      (action === 'getHabitantes')   result = getHabitantes();
    else if (action === 'getPersonal')     result = getPersonal();
    else if (action === 'saveIngreso')     result = saveIngreso(e.parameter);
    else if (action === 'saveSalida')      result = saveSalida(e.parameter);
    else if (action === 'getNextRecibo')   result = getNextRecibo();
    else if (action === 'getNextRegistro') result = getNextRegistro();
    else if (action === 'getTotales')          result = getTotales();
    else if (action === 'getIngresos')         result = getIngresos();
    else if (action === 'getSalidas')          result = getSalidas();
    else if (action === 'updateIngreso')       result = updateIngreso(e.parameter);
    else if (action === 'updateSalida')        result = updateSalida(e.parameter);
    else if (action === 'deleteRow')           result = deleteRow(e.parameter);
    else if (action === 'regularizarMonedas')  result = regularizarMonedas();
    else if (action === 'getAbonos')           result = getAbonos(e.parameter);
    else if (action === 'saveAbono')           result = saveAbono(e.parameter);
    else if (action === 'saveHabitante')       result = saveHabitante(e.parameter);
    else if (action === 'deleteHabitante')     result = deleteHabitante(e.parameter);
    else if (action === 'getResidenteAuth')    result = getResidenteAuth(e.parameter);
    else if (action === 'getResidenteData')    result = getResidenteData(e.parameter);
    else result = { error: 'Acción no reconocida' };
  } catch(err) {
    result = { error: err.message };
  }
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function getHabitantes() {
  const data = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('HABITANTES').getDataRange().getValues();
  // Columnas: A=Interior, B=Nombre, C=PIN
  // hasPin: indica si el residente tiene PIN asignado (no expone el PIN)
  return data.slice(1)
    .filter(r => String(r[0]).trim())
    .map(r => ({
      int:    String(r[0]),
      nombre: r[1],
      hasPin: !!String(r[2] || '').trim()
    }));
}

// ─── Guardar residente: agrega (modo='add') o modifica (modo='edit') ───
// Columnas HABITANTES: A=Interior, B=Nombre, C=PIN
function saveHabitante(p) {
  const ss      = SpreadsheetApp.getActiveSpreadsheet();
  const sheet   = ss.getSheetByName('HABITANTES');
  const interior = String(p.interior).trim();
  const nombre   = String(p.nombre).trim();
  const pin      = String(p.pin || '').trim();
  const modo     = p.modo; // 'add' | 'edit'
  const oldInt   = String(p.oldInterior || '').trim();

  // Buscar duplicados (excluye la fila que se está editando)
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const intFila = String(data[i][0]).trim();
    if (intFila === interior && (modo === 'add' || intFila !== oldInt)) {
      return { ok: false, error: 'El interior ' + interior + ' ya está registrado.' };
    }
  }

  if (modo === 'add') {
    sheet.appendRow([interior, nombre, pin]);
  } else {
    let filaEncontrada = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === oldInt) { filaEncontrada = i + 1; break; }
    }
    if (filaEncontrada < 0) return { ok: false, error: 'Registro no encontrado.' };
    sheet.getRange(filaEncontrada, 1).setValue(interior);
    sheet.getRange(filaEncontrada, 2).setValue(nombre);
    // Actualiza PIN solo si se envió uno nuevo; deja el existente si viene vacío
    if (pin) sheet.getRange(filaEncontrada, 3).setValue(pin);
  }

  // Ordenar por columna A (Interior) ascendente — incluir col C (PIN)
  const lastRow = sheet.getLastRow();
  if (lastRow > 2) {
    sheet.getRange(2, 1, lastRow - 1, 3).sort({ column: 1, ascending: true });
  }

  return { ok: true, mensaje: modo === 'add'
    ? 'Residente ' + interior + ' agregado correctamente.'
    : 'Residente ' + interior + ' modificado correctamente.' };
}

// ─── Autenticación de residente: verifica Interior + PIN ───────────────
function getResidenteAuth(p) {
  const sheet   = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('HABITANTES');
  const data    = sheet.getDataRange().getValues();
  const interior = String(p.interior || '').trim().toUpperCase();
  const pin      = String(p.pin || '').trim();

  if (!interior || !pin)
    return { ok: false, error: 'Interior y PIN son requeridos.' };

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toUpperCase() === interior) {
      const pinGuardado = String(data[i][2] || '').trim();
      if (!pinGuardado)
        return { ok: false, error: 'Este interior no tiene PIN asignado. Contacta al administrador.' };
      if (pinGuardado === pin)
        return { ok: true, interior: String(data[i][0]).trim(), nombre: String(data[i][1]) };
      else
        return { ok: false, error: 'PIN incorrecto.' };
    }
  }
  return { ok: false, error: 'Interior ' + interior + ' no encontrado.' };
}

// ─── Datos del residente: historial de pagos filtrado por interior ──────
// Aplica la misma normalización de columnas que getIngresos()
// para manejar registros en formato antiguo (sin cod_admin/administrador)
function getResidenteData(p) {
  const interior = String(p.interior || '').trim().toUpperCase();
  if (!interior) return { error: 'Interior requerido.' };

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Nombre del residente
  const habSheet = ss.getSheetByName('HABITANTES');
  const habData  = habSheet.getDataRange().getValues();
  let nombre = '';
  for (let i = 1; i < habData.length; i++) {
    if (String(habData[i][0]).trim().toUpperCase() === interior) {
      nombre = String(habData[i][1]);
      break;
    }
  }

  // Ingresos — leer 15 cols para cubrir formato antiguo de 15 columnas
  const sheet   = ss.getSheetByName('BD_INGRESOS');
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { ok: true, interior, nombre, ingresos: [] };

  const esFecha = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

  const ingresos = sheet.getRange(2, 1, lastRow - 1, 15).getValues()
    .filter(r => r[0] !== '')
    .map(r => {
      // 1. Convertir fechas a ISO
      r = r.map(c => c instanceof Date
        ? Utilities.formatDate(c, 'America/Bogota', 'yyyy-MM-dd') : c);

      // 2. Formato 15 cols: col B = clave_compuesta (no es fecha) → quitar
      if (!esFecha(r[1])) r.splice(1, 1);

      // 3. Formato antiguo sin cod_admin: r[4]=cod_concepto(11-20) directo
      //    Nuevo: r[4]=cod_admin, r[6]=cod_concepto
      const codPos4 = parseInt(r[4]);
      const codPos6 = parseInt(r[6]);
      const r6esConcepto = codPos6 >= 11 && codPos6 <= 20
        && String(r[6]).trim() === String(codPos6);
      if (codPos4 >= 11 && codPos4 <= 20 && !r6esConcepto) {
        r.splice(4, 0, '', ''); // insertar cod_admin y administrador vacíos
      }

      return r.slice(0, 14);
    })
    // Filtrar por interior DESPUÉS de normalizar (r[2] = interior en ambos formatos)
    .filter(r => String(r[2]).trim().toUpperCase() === interior);

  return { ok: true, interior, nombre, ingresos };
}

// ─── Eliminar residente por Interior ───────────────────────────────────
function deleteHabitante(p) {
  const sheet   = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('HABITANTES');
  const interior = String(p.interior).trim();
  const data    = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === interior) {
      sheet.deleteRow(i + 1);
      return { ok: true, mensaje: 'Interior ' + interior + ' eliminado correctamente.' };
    }
  }
  return { ok: false, error: 'Interior ' + interior + ' no encontrado.' };
}

function getPersonal() {
  const data = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('PERSONAL').getDataRange().getValues();
  return data.slice(1).filter(r => r[0]).map(r => ({ id: r[0], nombre: r[1], cargo: r[2] }));
}

function getNextRecibo() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('BD_INGRESOS');
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { next: 10815 };
  const vals = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const nums = vals.map(r => parseInt(r[0])).filter(n => !isNaN(n));
  return { next: nums.length ? Math.max(...nums) + 1 : 10815 };
}

function getNextRegistro() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('BD_SALIDAS');
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { next: 'NK-38' };
  const vals = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const nums = vals
    .map(r => parseInt(String(r[0]).replace('NK-', '')))
    .filter(n => !isNaN(n));
  return { next: nums.length ? 'NK-' + (Math.max(...nums) + 1) : 'NK-38' };
}

function getTotales() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const ing = ss.getSheetByName('BD_INGRESOS');
  const lastIng = ing.getLastRow();
  let totalIngresos = 0;
  if (lastIng > 1) {
    const totCol = ing.getRange(2, 13, lastIng - 1, 1).getValues();
    totCol.forEach(r => { totalIngresos += parseFloat(r[0]) || 0; });
  }

  const sal = ss.getSheetByName('BD_SALIDAS');
  const lastSal = sal.getLastRow();
  let totalSalidas = 0;
  let totalSaldoSalidas = 0;
  if (lastSal > 1) {
    const colG = sal.getRange(2, 7, lastSal - 1, 1).getValues();
    colG.forEach(r => { totalSalidas += parseFloat(r[0]) || 0; });
    const colI = sal.getRange(2, 9, lastSal - 1, 1).getValues();
    colI.forEach(r => { totalSaldoSalidas += parseFloat(r[0]) || 0; });
  }

  const saldo = BASE_INGRESOS + totalIngresos - totalSaldoSalidas;
  return { base: BASE_INGRESOS, totalIngresos, totalSalidas, saldo };
}

function saveIngreso(p) {
  invalidarCache_();
  SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('BD_INGRESOS').appendRow([
      p.factura, p.fecha, p.interior, p.nombre,
      p.cod_admin, p.administrador, p.cod_concepto, p.concepto,
      parseFloat(p.vlr_admon)||0, parseFloat(p.vlr_vehiculo)||0,
      p.mes_pago, parseInt(p.cantidad)||1,
      parseFloat(p.total)||0, p.observacion
    ]);
  return { ok: true, mensaje: 'Ingreso guardado correctamente' };
}

function saveSalida(p) {
  invalidarCache_();
  const total = parseFloat(p.vlr_total)||0;
  const abono = parseFloat(p.abono)||0;
  SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('BD_SALIDAS').appendRow([
      p.cod_registro, p.fecha, p.cod_admin, p.administrador,
      p.cod_concepto, p.concepto,
      total, abono, total - abono, p.observacion
    ]);
  return { ok: true, mensaje: 'Salida guardada correctamente' };
}

// ══════════ CACHÉ ══════════
function invalidarCache_() {
  CacheService.getScriptCache().removeAll(['nk2_ingresos', 'nk2_salidas']);
}

// ══════════ CONSULTAS ══════════
function getIngresos() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('nk2_ingresos');
  if (cached) { try { return JSON.parse(cached); } catch(e) {} }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('BD_INGRESOS');
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  const rows = sheet.getRange(2, 1, lastRow - 1, 15).getValues();
  const result = [];
  for (let i = 0; i < rows.length; i++) {
    let r = rows[i];
    if (r[0] === '') continue;
    const sheetRow = i + 2;
    r = r.map(c => c instanceof Date ? Utilities.formatDate(c, 'America/Bogota', 'yyyy-MM-dd') : c);
    const esFecha = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
    if (!esFecha(r[1])) { r.splice(1, 1); }
    const codPos4 = parseInt(r[4]);
    const codPos6 = parseInt(r[6]);
    const r6esCodigoConcepto = codPos6 >= 11 && codPos6 <= 20
      && String(r[6]).trim() === String(codPos6);
    if (codPos4 >= 11 && codPos4 <= 20 && !r6esCodigoConcepto) {
      r.splice(4, 0, '', '');
    }
    const normalized = r.slice(0, 14);
    normalized[14] = sheetRow;
    result.push(normalized);
  }
  try { cache.put('nk2_ingresos', JSON.stringify(result), 60); } catch(e) {}
  return result;
}

function getSalidas() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('nk2_salidas');
  if (cached) { try { return JSON.parse(cached); } catch(e) {} }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('BD_SALIDAS');
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  const rows = sheet.getRange(2, 1, lastRow - 1, 10).getValues();
  const result = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r[0] === '') continue;
    const normalized = r.map(c => c instanceof Date ? Utilities.formatDate(c, 'America/Bogota', 'yyyy-MM-dd') : c);
    normalized[10] = i + 2;
    result.push(normalized);
  }
  try { cache.put('nk2_salidas', JSON.stringify(result), 60); } catch(e) {}
  return result;
}

function updateIngreso(p) {
  invalidarCache_();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('BD_INGRESOS');
  const row = parseInt(p.rowIndex);
  const values = [
    p.factura, p.fecha, p.interior, p.nombre,
    p.cod_admin||'', p.administrador||'', p.cod_concepto, p.concepto,
    parseFloat(p.vlr_admon)||0, parseFloat(p.vlr_vehiculo)||0,
    p.mes_pago, parseInt(p.cantidad)||1,
    parseFloat(p.total)||0, p.observacion
  ];
  sheet.getRange(row, 1, 1, values.length).setValues([values]);
  return { ok: true, mensaje: 'Ingreso actualizado correctamente' };
}

function updateSalida(p) {
  invalidarCache_();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('BD_SALIDAS');
  const row = parseInt(p.rowIndex);
  const total = parseFloat(p.vlr_total)||0;
  const abono = parseFloat(p.abono)||0;
  const values = [
    p.cod_registro, p.fecha, p.cod_admin||'', p.administrador,
    p.cod_concepto, p.concepto,
    total, abono, total - abono, p.observacion
  ];
  sheet.getRange(row, 1, 1, values.length).setValues([values]);
  return { ok: true, mensaje: 'Salida actualizada correctamente' };
}

function deleteRow(p) {
  invalidarCache_();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(p.sheet);
  if (!sheet) return { ok: false, error: 'Hoja no encontrada: ' + p.sheet };
  const rowIndex = parseInt(p.rowIndex);
  const lastRow = sheet.getLastRow();
  if (isNaN(rowIndex) || rowIndex < 2 || rowIndex > lastRow) {
    return { ok: false, error: 'Fila inválida: ' + p.rowIndex + ' (rango 2-' + lastRow + ')' };
  }
  sheet.deleteRow(rowIndex);
  return { ok: true, mensaje: 'Registro eliminado correctamente' };
}

// ══════════════════════════════════════════════════════════════
//  REGULARIZACIÓN DE CAMPOS MONEDA
//  Convierte todos los valores monetarios a número puro y
//  aplica formato #,##0 para que las entradas futuras sean
//  consistentes.
//
//  BD_INGRESOS → columnas I (9), J (10), M (13)  [1-based]
//  BD_SALIDAS  → columnas G (7), H (8),  I (9)   [1-based]
//
//  Puedes ejecutar esta función directamente desde el editor
//  de Apps Script (botón ▶ Run) o llamarla vía API con
//  action=regularizarMonedas
// ══════════════════════════════════════════════════════════════

function toNum_(v) {
  if (typeof v === 'number') return v;
  var s = String(v).replace(/[\s$]/g, '').trim();
  if (!s) return 0;
  // Formato colombiano: "95.000" o "95.000,50"
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s))
    return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
  // Punto como decimal o número plano
  return parseFloat(s.replace(',', '.')) || 0;
}

function regularizarMonedas() {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var fmt  = '#,##0';
  var filas, rng, vals, i;

  // ── BD_INGRESOS ──────────────────────────────────────────────
  var shI = ss.getSheetByName('BD_INGRESOS');
  if (shI && shI.getLastRow() > 1) {
    filas = shI.getLastRow() - 1;
    [9, 10, 13].forEach(function(col) {           // I, J, M
      rng  = shI.getRange(2, col, filas, 1);
      vals = rng.getValues();
      for (i = 0; i < vals.length; i++) vals[i][0] = toNum_(vals[i][0]);
      rng.setValues(vals);
      rng.setNumberFormat(fmt);
    });
  }

  // ── BD_SALIDAS ───────────────────────────────────────────────
  var shS = ss.getSheetByName('BD_SALIDAS');
  if (shS && shS.getLastRow() > 1) {
    filas = shS.getLastRow() - 1;
    [7, 8, 9].forEach(function(col) {             // G, H, I
      rng  = shS.getRange(2, col, filas, 1);
      vals = rng.getValues();
      for (i = 0; i < vals.length; i++) vals[i][0] = toNum_(vals[i][0]);
      rng.setValues(vals);
      rng.setNumberFormat(fmt);
    });
  }

  return { ok: true, mensaje: 'Monedas regularizadas: BD_INGRESOS (I, J, M) y BD_SALIDAS (G, H, I).' };
}

// ══════════════════════════════════════════════════════════════
//  ABONOS
//  Hoja requerida: BD_ABONOS
//  Columnas: A=cod_registro | B=fecha | C=administrador |
//            D=concepto | E=vlr_total_obra | F=vlr_abono |
//            G=saldo | H=observacion
// ══════════════════════════════════════════════════════════════

function getAbonos(p) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('BD_ABONOS');
  if (!sheet || sheet.getLastRow() <= 1) return [];

  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues();
  var cod  = p && p.cod_registro ? String(p.cod_registro).trim().toLowerCase() : '';
  return data
    .filter(function(r) {
      if (!cod) return r[0] !== '';  // sin filtro → todos los registros
      return String(r[0]).trim().toLowerCase() === cod;
    })
    .map(function(r) {
      return r.map(function(c) {
        return c instanceof Date
          ? Utilities.formatDate(c, 'America/Bogota', 'yyyy-MM-dd')
          : c;
      });
    });
}

function saveAbono(p) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Buscar la fila en BD_SALIDAS que corresponde al cod_registro
  var shSal   = ss.getSheetByName('BD_SALIDAS');
  var lastSal = shSal.getLastRow();
  var rowSal  = -1;

  if (lastSal > 1) {
    var codCol = shSal.getRange(2, 1, lastSal - 1, 1).getValues();
    for (var i = 0; i < codCol.length; i++) {
      if (String(codCol[i][0]).trim().toLowerCase() === String(p.cod_registro).trim().toLowerCase()) {
        rowSal = i + 2; // fila real en la hoja (1-indexed + encabezado)
        break;
      }
    }
  }

  if (rowSal === -1) {
    return { error: 'No se encontró el registro "' + p.cod_registro + '" en BD_SALIDAS.' };
  }

  // 2. Leer total y abono acumulado actual de BD_SALIDAS (cols G=7, H=8, I=9)
  var vlrTotal      = parseFloat(shSal.getRange(rowSal, 7).getValue()) || 0;
  var abonadoActual = parseFloat(shSal.getRange(rowSal, 8).getValue()) || 0;
  var nuevoAbono    = parseFloat(p.vlr_abono) || 0;

  var nuevoAbonadoTotal = abonadoActual + nuevoAbono;
  var nuevoSaldo        = Math.max(0, vlrTotal - nuevoAbonadoTotal);

  // 3. Actualizar BD_SALIDAS: cols H (abono acum.) e I (saldo)
  shSal.getRange(rowSal, 8).setValue(nuevoAbonadoTotal);
  shSal.getRange(rowSal, 9).setValue(nuevoSaldo);

  // 4. Registrar en BD_ABONOS (crear hoja si no existe)
  var shAb = ss.getSheetByName('BD_ABONOS');
  if (!shAb) {
    shAb = ss.insertSheet('BD_ABONOS');
    shAb.appendRow(['cod_registro','fecha','administrador','concepto',
                    'vlr_total_obra','vlr_abono','saldo','observacion']);
  }

  shAb.appendRow([
    p.cod_registro,
    p.fecha,
    p.administrador,
    p.concepto,
    vlrTotal,
    nuevoAbono,
    nuevoSaldo,
    p.observacion
  ]);

  return {
    ok:     true,
    mensaje: 'Abono de ' + nuevoAbono.toLocaleString() + ' registrado. Saldo pendiente: ' + nuevoSaldo.toLocaleString() + '.'
  };
}
