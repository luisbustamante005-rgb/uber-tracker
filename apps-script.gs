/**
 * ══════════════════════════════════════════════════════
 *  UBER TRACKER — Google Apps Script Backend
 *  Archivo: apps-script.gs
 *
 *  INSTRUCCIONES:
 *  1. Abre tu Google Sheet "UberTracker"
 *  2. Extensiones → Apps Script
 *  3. Borra el contenido y pega este código
 *  4. Implementar → Nueva implementación
 *     - Tipo: Aplicación web
 *     - Ejecutar como: Yo
 *     - Acceso: Cualquier persona
 *  5. Copia la URL y pégala en la app (⚙ Configuración)
 * ══════════════════════════════════════════════════════
 */

const SHEET_VIAJES = 'Viajes';
const SHEET_GASTOS = 'Gastos';

// ── Cabeceras ──────────────────────────────────────────
const HEADERS_VIAJES = [
  'Fecha', 'HoraInicio', 'HoraFin', 'Horas',
  'CantidadViajes', 'Ingresos', 'Propinas', 'Peajes',
  'Turno', 'Total', 'Notas', 'Timestamp'
];
const HEADERS_GASTOS = [
  'Fecha', 'Categoria', 'Monto', 'Litros',
  'Fondo', 'Notas', 'Timestamp'
];

// ── GET: leer todos los datos ──────────────────────────
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    initSheets(ss);

    const viajes = readSheet(ss, SHEET_VIAJES);
    const gastos  = readSheet(ss, SHEET_GASTOS);

    const result = { viajes, gastos, ok: true };
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── POST: escribir un registro ─────────────────────────
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    initSheets(ss);

    const tipo = payload.type || payload.action || '';
    if (tipo === 'viaje') {
      appendViaje(ss, payload);
    } else if (tipo === 'gasto') {
      appendGasto(ss, payload);
    } else if (tipo === 'delete') {
      deleteRow(ss, payload.sheet, payload.rowIndex);
    } else {
      throw new Error('Tipo desconocido: ' + tipo);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── Inicializar hojas si no existen ───────────────────
function initSheets(ss) {
  let shV = ss.getSheetByName(SHEET_VIAJES);
  if (!shV) {
    shV = ss.insertSheet(SHEET_VIAJES);
    shV.appendRow(HEADERS_VIAJES);
    shV.getRange(1, 1, 1, HEADERS_VIAJES.length).setFontWeight('bold');
    shV.setFrozenRows(1);
  }
  let shG = ss.getSheetByName(SHEET_GASTOS);
  if (!shG) {
    shG = ss.insertSheet(SHEET_GASTOS);
    shG.appendRow(HEADERS_GASTOS);
    shG.getRange(1, 1, 1, HEADERS_GASTOS.length).setFontWeight('bold');
    shG.setFrozenRows(1);
  }
}

// ── Agregar viaje ──────────────────────────────────────
function appendViaje(ss, d) {
  const sh = ss.getSheetByName(SHEET_VIAJES);
  sh.appendRow([
    d.fecha,
    d.horaInicio   || '',
    d.horaFin      || '',
    d.horas        || 0,
    d.cantidadViajes || 0,
    d.ingresos     || 0,
    d.propinas     || 0,
    d.peajes       || 0,
    d.turno        || '',
    d.total        || 0,
    d.notas        || '',
    d.timestamp    || new Date().toISOString()
  ]);
}

// ── Agregar gasto ──────────────────────────────────────
function appendGasto(ss, d) {
  const sh = ss.getSheetByName(SHEET_GASTOS);
  sh.appendRow([
    d.fecha,
    d.categoria    || '',
    d.monto        || 0,
    d.litros       || 0,
    d.fondo        || '',
    d.notas        || '',
    d.timestamp    || new Date().toISOString()
  ]);
}

// ── Eliminar fila por numero de fila ──────────────────
function deleteRow(ss, sheetName, rowIndex) {
  const sh = ss.getSheetByName(sheetName === 'viajes' ? SHEET_VIAJES : SHEET_GASTOS);
  if (!sh) throw new Error('Hoja no encontrada: ' + sheetName);
  const maxRow = sh.getLastRow();
  if (rowIndex < 2 || rowIndex > maxRow) throw new Error('Fila fuera de rango: ' + rowIndex);
  sh.deleteRow(rowIndex);
  SpreadsheetApp.flush();
}

// ── Leer hoja como array de objetos ───────────────────
function readSheet(ss, sheetName) {
  const sh = ss.getSheetByName(sheetName);
  if (!sh) return [];
  const data = sh.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      // Normalizar clave a camelCase simple
      const key = h.charAt(0).toLowerCase() + h.slice(1);
      obj[key] = row[i];
    });
    return obj;
  });
}
