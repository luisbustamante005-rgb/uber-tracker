/* ══════════════════════════════════════════
   UBER TRACKER · app.js
   Google Sheets ← Apps Script API
   ══════════════════════════════════════════ */

// ── CONFIG (stored in localStorage) ──────────────────────────────────────────
const CFG_KEY = 'ubertracker_cfg';
function loadCfg() {
  try { return JSON.parse(localStorage.getItem(CFG_KEY) || '{}'); } catch { return {}; }
}
function saveCfg(o) { localStorage.setItem(CFG_KEY, JSON.stringify(o)); }

// ── STATE ─────────────────────────────────────────────────────────────────────
let cfg = loadCfg();
let DATA = { viajes: [], gastos: [] };
let currentTab = 'dashboard';

// ── FONDOS DISTRIBUCIÓN (%) ───────────────────────────────────────────────────
const FONDOS_PCT = {
  Viaje:       0.30,
  Mantención:  0.20,
  Universidad: 0.15,
  Emergencia:  0.15,
  Peajes:      0.10,
  Casa:        0.10,
};

// ── UTILS ─────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const fmt  = n => '$' + Math.round(n || 0).toLocaleString('es-CL');
const fmtH = min => {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};
const today = () => {
  const d = new Date();
  return d.toISOString().split('T')[0];
};
const monthOf = d => d ? String(d).substring(0, 7) : '';
const currMonth = () => monthOf(today());

function showToast(msg, type = 'ok', ms = 2800) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(() => { t.className = 'toast'; }, ms);
}

function setSyncBar(msg, cls = '') {
  const b = $('syncBar');
  b.textContent = msg;
  b.className = 'sync-bar ' + cls;
}

// ── TABS ─────────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    currentTab = btn.dataset.tab;
    $('tab-' + currentTab).classList.add('active');
    if (currentTab === 'historial') renderHistorial();
  });
});

// ── CONFIG MODAL ─────────────────────────────────────────────────────────────
$('btnConfig').addEventListener('click', () => {
  $('cfgScriptUrl').value = cfg.scriptUrl || '';
  $('cfgName').value = cfg.name || '';
  $('configModal').classList.add('open');
});
$('closeConfig').addEventListener('click', () => $('configModal').classList.remove('open'));

$('showGuide').addEventListener('click', e => {
  e.preventDefault();
  const g = $('guideBox');
  g.style.display = g.style.display === 'none' ? 'block' : 'none';
});

$('btnSaveConfig').addEventListener('click', () => {
  const url  = $('cfgScriptUrl').value.trim();
  const name = $('cfgName').value.trim();
  if (!url) { showToast('Pega la URL del Apps Script', 'err'); return; }
  cfg = { scriptUrl: url, name: name || 'Luis' };
  saveCfg(cfg);
  $('configModal').classList.remove('open');
  showToast('Configuracion guardada', 'ok');
  loadData();
});

// ── API ───────────────────────────────────────────────────────────────────────
async function apiGet() {
  if (!cfg.scriptUrl) return null;
  const url = cfg.scriptUrl + '?action=getAll';
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

async function apiPost(payload) {
  if (!cfg.scriptUrl) throw new Error('Sin configurar');
  const res = await fetch(cfg.scriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

// ── NORMALIZAR datos de Sheets ────────────────────────────────────────────────
function normalizeRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    const key = k.charAt(0).toLowerCase() + k.slice(1);
    out[key] = (v === '' || v === null || v === undefined) ? v
      : (!isNaN(v) && v !== '') ? Number(v) : v;
  }
  if (out.fecha && typeof out.fecha === 'string' && out.fecha.includes('T')) {
    out.fecha = out.fecha.split('T')[0];
  }
  return out;
}

// ── CARGAR DATOS desde Sheets ─────────────────────────────────────────────────
async function loadData() {
  if (!cfg.scriptUrl) {
    setSyncBar('Sin configurar — ve a configuracion');
    return;
  }
  setSyncBar('Sincronizando...');
  try {
    const data = await apiGet();
    if (data && data.viajes) {
      DATA.viajes = (data.viajes || []).map(normalizeRow);
      DATA.gastos  = (data.gastos  || []).map(normalizeRow);
    }
    const now = new Date();
    setSyncBar('Sincronizado ' + now.toLocaleTimeString('es-CL', {hour:'2-digit',minute:'2-digit'}), 'ok');
    renderDashboard();
    renderFuelStats();
    if (currentTab === 'historial') renderHistorial();
  } catch(e) {
    setSyncBar('Error al conectar con Google Sheets', 'error');
    showToast('Error: ' + e.message, 'err');
  }
}

// ── FECHA DEFAULTS ────────────────────────────────────────────────────────────
function initDateDefaults() {
  $('vFecha').value = today();
  $('gFecha').value = today();
  $('todayDate').textContent = new Date().toLocaleDateString('es-CL', {weekday:'short', day:'numeric', month:'short'});
}

// ── CALCULAR HORAS ────────────────────────────────────────────────────────────
function calcViajePreview() {
  const ini   = $('vHoraInicio').value;
  const fin   = $('vHoraFin').value;
  const ing   = parseFloat($('vIngresos').value) || 0;
  const prop  = parseFloat($('vPropinas').value) || 0;
  const total = ing + prop;

  if (ini && fin) {
    const [ih, im] = ini.split(':').map(Number);
    const [fh, fm] = fin.split(':').map(Number);
    let mins = (fh * 60 + fm) - (ih * 60 + im);
    if (mins < 0) mins += 24 * 60;
    const hrs = mins / 60;
    $('calcHoras').textContent    = fmtH(mins);
    $('calcPorHora').textContent  = hrs > 0 ? fmt(total / hrs) : '-';
  } else {
    $('calcHoras').textContent    = '-';
    $('calcPorHora').textContent  = '-';
  }
  $('calcTotal').textContent = total > 0 ? fmt(total) : '-';

  if (total > 0) {
    const dp = $('distPreview');
    dp.innerHTML = '';
    for (const [fond, pct] of Object.entries(FONDOS_PCT)) {
      const amt = total * pct;
      const row = document.createElement('div');
      row.className = 'dist-row';
      row.innerHTML = `<span>${fond} (${Math.round(pct*100)}%)</span><strong>${fmt(amt)}</strong>`;
      dp.appendChild(row);
    }
  }
}

['vHoraInicio','vHoraFin','vIngresos','vPropinas'].forEach(id => {
  $(id).addEventListener('input', calcViajePreview);
});

// ── GUARDAR VIAJE ─────────────────────────────────────────────────────────────
$('btnGuardarViaje').addEventListener('click', async () => {
  const fecha    = $('vFecha').value;
  const ini      = $('vHoraInicio').value;
  const fin      = $('vHoraFin').value;
  const cantidad = parseInt($('vCantidad').value) || 0;
  const ingresos = parseFloat($('vIngresos').value) || 0;
  const propinas = parseFloat($('vPropinas').value) || 0;
  const peajes   = parseFloat($('vPeajes').value) || 0;
  const turno    = $('vTurno').value;
  const notas    = $('vNotas').value.trim();

  if (!fecha || !ini || !fin || ingresos <= 0) {
    $('vFeedback').textContent = 'Completa fecha, horario e ingresos';
    $('vFeedback').className = 'form-feedback err';
    return;
  }

  const [ih, im] = ini.split(':').map(Number);
  const [fh, fm] = fin.split(':').map(Number);
  let mins = (fh * 60 + fm) - (ih * 60 + im);
  if (mins < 0) mins += 24 * 60;
  const horas = Math.round(mins / 60 * 100) / 100;
  const total = ingresos + propinas;

  const row = {
    type: 'viaje',
    fecha, horaInicio: ini, horaFin: fin,
    horas, cantidadViajes: cantidad,
    ingresos, propinas, peajes, turno,
    total, notas,
    timestamp: new Date().toISOString()
  };

  $('btnViajeText').style.display = 'none';
  $('vSpinner').style.display = 'inline';

  try {
    if (cfg.scriptUrl) {
      await apiPost(row);
    }
    DATA.viajes.push(row);
    $('vFeedback').textContent = 'Viaje guardado';
    $('vFeedback').className = 'form-feedback ok';
    showToast('Viaje guardado correctamente', 'ok');
    $('vHoraInicio').value = '';
    $('vHoraFin').value = '';
    $('vCantidad').value = '';
    $('vIngresos').value = '';
    $('vPropinas').value = '';
    $('vPeajes').value = '';
    $('vNotas').value = '';
    calcViajePreview();
    renderDashboard();
  } catch(e) {
    $('vFeedback').textContent = 'Error: ' + e.message;
    $('vFeedback').className = 'form-feedback err';
  } finally {
    $('btnViajeText').style.display = 'inline';
    $('vSpinner').style.display = 'none';
  }
});

// ── GUARDAR GASTO ─────────────────────────────────────────────────────────────
$('gCategoria').addEventListener('change', () => {
  $('gLitrosGroup').style.display = $('gCategoria').value === 'Bencina' ? 'block' : 'none';
});

$('btnGuardarGasto').addEventListener('click', async () => {
  const fecha     = $('gFecha').value;
  const categoria = $('gCategoria').value;
  const monto     = parseFloat($('gMonto').value) || 0;
  const litros    = parseFloat($('gLitros').value) || 0;
  const fondo     = $('gFondo').value;
  const notas     = $('gNotas').value.trim();

  if (!fecha || monto <= 0) {
    $('gFeedback').textContent = 'Completa fecha y monto';
    $('gFeedback').className = 'form-feedback err';
    return;
  }

  const row = {
    type: 'gasto',
    fecha, categoria, monto, litros, fondo, notas,
    timestamp: new Date().toISOString()
  };

  $('btnGastoText').style.display = 'none';
  $('gSpinner').style.display = 'inline';

  try {
    if (cfg.scriptUrl) {
      await apiPost(row);
    }
    DATA.gastos.push(row);
    $('gFeedback').textContent = 'Gasto guardado';
    $('gFeedback').className = 'form-feedback ok';
    showToast('Gasto guardado correctamente', 'ok');
    $('gMonto').value = '';
    $('gLitros').value = '';
    $('gNotas').value = '';
    renderDashboard();
    renderFuelStats();
  } catch(e) {
    $('gFeedback').textContent = 'Error: ' + e.message;
    $('gFeedback').className = 'form-feedback err';
  } finally {
    $('btnGastoText').style.display = 'inline';
    $('gSpinner').style.display = 'none';
  }
});

// ── RENDER DASHBOARD ──────────────────────────────────────────────────────────
function renderDashboard() {
  const mes = currMonth();
  const viajes = DATA.viajes.filter(v => monthOf(v.fecha) === mes);
  const gastos  = DATA.gastos.filter(g => monthOf(g.fecha) === mes);

  const totalBruto  = viajes.reduce((s, v) => s + (v.total || 0), 0);
  const totalGasto  = gastos.reduce((s, g) => s + (g.monto || 0), 0);
  const totalNeto   = totalBruto - totalGasto;
  const totalHoras  = viajes.reduce((s, v) => s + (v.horas || 0), 0);
  const porHora     = totalHoras > 0 ? totalNeto / totalHoras : 0;
  const numViajes   = viajes.reduce((s, v) => s + (v.cantidadViajes || 1), 0);

  $('kpiIngresos').textContent      = fmt(totalBruto);
  $('kpiIngresosTrips').textContent  = numViajes + ' viajes';
  $('kpiNeto').textContent           = fmt(totalNeto);
  $('kpiNetoDelta').textContent      = '-' + fmt(totalGasto) + ' gastos';
  $('kpiPorHora').textContent        = fmt(porHora);
  $('kpiPorHoraHoras').textContent   = totalHoras.toFixed(1) + ' hrs conducidas';
  $('kpiGastos').textContent         = fmt(totalGasto);

  for (const [fond, pct] of Object.entries(FONDOS_PCT)) {
    const card = document.querySelector(`.fund-card[data-fund="${fond}"]`);
    if (!card) continue;
    const amt = totalBruto * pct;
    card.querySelector('.fund-amount').textContent = fmt(amt);
    const maxFond = totalBruto * Math.max(...Object.values(FONDOS_PCT));
    card.querySelector('.fund-fill').style.width = maxFond > 0 ? Math.round(amt / maxFond * 100) + '%' : '0%';
  }

  const todayStr = today();
  const vHoy = DATA.viajes.filter(v => v.fecha === todayStr);
  const ingHoy   = vHoy.reduce((s, v) => s + (v.total || 0), 0);
  const hrsHoy   = vHoy.reduce((s, v) => s + (v.horas || 0), 0);
  const tripsHoy = vHoy.reduce((s, v) => s + (v.cantidadViajes || 1), 0);

  $('tdViajes').textContent   = vHoy.length ? tripsHoy : '-';
  $('tdIngresos').textContent = vHoy.length ? fmt(ingHoy) : '-';
  $('tdHoras').textContent    = vHoy.length ? hrsHoy.toFixed(1) + 'h' : '-';
  $('tdPorHora').textContent  = (vHoy.length && hrsHoy > 0) ? fmt(ingHoy / hrsHoy) : '-';
}

// ── RENDER FUEL STATS ─────────────────────────────────────────────────────────
function renderFuelStats() {
  const mes = currMonth();
  const bencinas = DATA.gastos.filter(g => g.fecha && monthOf(g.fecha) === mes && g.categoria === 'Bencina');
  const total    = bencinas.reduce((s, g) => s + (g.monto  || 0), 0);
  const litros   = bencinas.reduce((s, g) => s + (g.litros || 0), 0);
  const porLitro = litros > 0 ? total / litros : 0;
  const ingTotal = DATA.viajes.filter(v => monthOf(v.fecha) === mes).reduce((s, v) => s + (v.total || 0), 0);
  const pct      = ingTotal > 0 ? Math.round(total / ingTotal * 100) : 0;

  $('fuelTotal').textContent    = fmt(total);
  $('fuelLitros').textContent   = litros.toFixed(1) + ' L';
  $('fuelPorLitro').textContent = porLitro > 0 ? fmt(porLitro) : '$0';
  $('fuelPct').textContent      = pct + '%';
}

// ── RENDER HISTORIAL ──────────────────────────────────────────────────────────
function renderHistorial() {
  const tipo = $('histTipo').value;
  const mes  = $('histMes').value || currMonth();
  const list = $('historialList');

  const items = tipo === 'viajes'
    ? DATA.viajes.filter(v => !mes || monthOf(v.fecha) === mes)
        .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
    : DATA.gastos.filter(g => !mes || monthOf(g.fecha) === mes)
        .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));

  if (items.length === 0) {
    list.innerHTML = '<div class="empty-state">Sin registros para este periodo</div>';
    return;
  }

  list.innerHTML = items.map(item => {
    if (tipo === 'viajes') {
      const ph = item.horas > 0 ? fmt(item.total / item.horas) : '-';
      return `
        <div class="hist-item">
          <div class="hist-icon">${item.turno === 'Manana' || item.turno === 'Mañana' ? '🌅' : item.turno === 'Noche' ? '🌙' : '☀️'}</div>
          <div class="hist-info">
            <div class="hist-main">${formatFecha(item.fecha)} · ${item.horaInicio || ''} - ${item.horaFin || ''}</div>
            <div class="hist-meta">${item.cantidadViajes || '?'} viajes · ${Number(item.horas||0).toFixed(1)}h · ${ph}/hr · ${item.turno || ''}</div>
          </div>
          <div class="hist-amount income">${fmt(item.total)}</div>
        </div>`;
    } else {
      return `
        <div class="hist-item">
          <div class="hist-icon">${categoryIcon(item.categoria)}</div>
          <div class="hist-info">
            <div class="hist-main">${item.categoria} · ${formatFecha(item.fecha)}</div>
            <div class="hist-meta">Fondo: ${item.fondo || '-'}${item.litros ? ' · ' + item.litros + ' L' : ''}${item.notas ? ' · ' + item.notas : ''}</div>
          </div>
          <div class="hist-amount expense">-${fmt(item.monto)}</div>
        </div>`;
    }
  }).join('');
}

function formatFecha(f) {
  if (!f) return '?';
  const s = String(f);
  if (s.includes('-')) {
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
  }
  return s;
}

function categoryIcon(c) {
  return { Bencina:'⛽', Peaje:'🛣', 'Mantención':'🔧', Lavado:'🚿', Seguro:'🛡', TAG:'📡', 'Revisión Técnica':'🔍', Otro:'📦' }[c] || '📦';
}

$('histTipo').addEventListener('change', renderHistorial);
$('histMes').addEventListener('change', renderHistorial);

function populateHistMes() {
  const sel = $('histMes');
  const d = new Date();
  for (let i = 0; i < 6; i++) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const opt = document.createElement('option');
    opt.value = `${y}-${m}`;
    opt.textContent = new Date(y, d.getMonth(), 1).toLocaleDateString('es-CL', {month:'long', year:'numeric'});
    if (i > 0) sel.appendChild(opt);
    d.setMonth(d.getMonth() - 1);
  }
}

// ── REFRESH ───────────────────────────────────────────────────────────────────
$('btnRefresh').addEventListener('click', () => {
  loadData();
  showToast('Actualizando...');
});

// ── INIT ──────────────────────────────────────────────────────────────────────
initDateDefaults();
populateHistMes();
calcViajePreview();
renderDashboard();
renderFuelStats();
$('gLitrosGroup').style.display = 'none';

if (cfg.scriptUrl) {
  loadData();
} else {
  setSyncBar('Sin configurar — ve a configuracion');
}
