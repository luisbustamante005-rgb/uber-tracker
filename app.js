/* UBER TRACKER · app.js */

const CFG_KEY = 'ubertracker_cfg';
function loadCfg() { try { return JSON.parse(localStorage.getItem(CFG_KEY) || '{}'); } catch { return {}; } }
function saveCfg(o) { localStorage.setItem(CFG_KEY, JSON.stringify(o)); }

let cfg = loadCfg();
let DATA = { viajes: [], gastos: [] };
let currentTab = 'dashboard';

const FONDOS_PCT = { Viaje: 0.30, Mantención: 0.20, Universidad: 0.15, Emergencia: 0.15, Peajes: 0.10, Casa: 0.10 };
const META_DEFAULT = 720000;
const DIAS_DEFAULT = 20;
const META_DIARIA_TURNO = 18000;

const $ = id => document.getElementById(id);
const fmt = n => '$' + Math.round(n || 0).toLocaleString('es-CL');
const fmtH = min => { const h = Math.floor(min/60), m = Math.round(min%60); return h > 0 ? `${h}h ${m}m` : `${m}m`; };
const today = () => new Date().toISOString().split('T')[0];
const monthOf = d => d ? String(d).substring(0, 7) : '';
const currMonth = () => monthOf(today());

function showToast(msg, type='ok', ms=2800) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(() => { t.className = 'toast'; }, ms);
}
function setSyncBar(msg, cls='') {
  const b = $('syncBar');
  b.textContent = msg;
  b.className = 'sync-bar ' + cls;
}

// TABS
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

// CONFIG MODAL
$('btnConfig').addEventListener('click', () => {
  $('cfgScriptUrl').value = cfg.scriptUrl || '';
  $('cfgMeta').value = cfg.meta || META_DEFAULT;
  $('cfgDias').value = cfg.dias || DIAS_DEFAULT;
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
  const meta = parseInt($('cfgMeta').value) || META_DEFAULT;
  const dias = parseInt($('cfgDias').value) || DIAS_DEFAULT;
  if (!url) { showToast('Pega la URL del Apps Script', 'err'); return; }
  cfg = { scriptUrl: url, meta, dias };
  saveCfg(cfg);
  $('configModal').classList.remove('open');
  showToast('Configuracion guardada', 'ok');
  loadData();
});

// API
async function apiGet() {
  if (!cfg.scriptUrl) return null;
  const res = await fetch(cfg.scriptUrl + '?action=getAll');
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}
async function apiPost(payload) {
  if (!cfg.scriptUrl) throw new Error('Sin configurar');
  const res = await fetch(cfg.scriptUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}
async function deleteRecord(tipo, rowIndex) {
  const res = await fetch(cfg.scriptUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ type: 'delete', sheet: tipo, rowIndex }) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

// NORMALIZE
function normalizeRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    const key = k.charAt(0).toLowerCase() + k.slice(1);
    out[key] = (v === '' || v === null || v === undefined) ? v : (!isNaN(v) && v !== '') ? Number(v) : v;
  }
  if (out.fecha && typeof out.fecha === 'string' && out.fecha.includes('T')) out.fecha = out.fecha.split('T')[0];
  return out;
}

// LOAD DATA
async function loadData() {
  if (!cfg.scriptUrl) { setSyncBar('Sin configurar — ve a configuracion'); return; }
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

// DATE DEFAULTS
function initDateDefaults() {
  $('vFecha').value = today();
  $('gFecha').value = today();
  const d = new Date();
  $('dbHoyFecha').textContent = d.toLocaleDateString('es-CL', {weekday:'long', day:'numeric', month:'short'});
}

// DIAS HABILES RESTANTES en el mes
function diasHabilesRestantes() {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  let count = 0;
  for (let d = now.getDate(); d <= lastDay; d++) {
    const day = new Date(now.getFullYear(), now.getMonth(), d).getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

// RENDER DASHBOARD
function renderDashboard() {
  const mes = currMonth();
  const meta = cfg.meta || META_DEFAULT;
  const viajes = DATA.viajes.filter(v => monthOf(v.fecha) === mes);
  const gastos  = DATA.gastos.filter(g => monthOf(g.fecha) === mes);

  const totalBruto = viajes.reduce((s, v) => s + (v.total || 0), 0);
  const totalGasto = gastos.reduce((s, g) => s + (g.monto || 0), 0);
  const totalHoras = viajes.reduce((s, v) => s + (v.horas || 0), 0);
  const numViajes  = viajes.reduce((s, v) => s + (v.cantidadViajes || 1), 0);
  const pct = meta > 0 ? Math.min(Math.round(totalBruto / meta * 100), 100) : 0;
  const restante = Math.max(meta - totalBruto, 0);
  const diasR = diasHabilesRestantes();
  const necesario = diasR > 0 ? Math.round(restante / diasR) : 0;

  // Hero
  $('dbHeroIngreso').textContent = fmt(totalBruto);
  $('dbHeroMeta').textContent = fmt(meta);
  $('dbHeroPct').textContent = pct + '%';
  $('dbRestante').textContent = fmt(restante);
  $('dbDiasRestantes').textContent = diasR;
  $('dbNecesarioDia').textContent = fmt(necesario);

  const fill = $('dbProgressFill');
  fill.style.width = pct + '%';
  const pctEl = $('dbHeroPct');
  if (pct >= 80) { fill.className = 'progress-fill'; pctEl.className = 'hero-badge-pct'; }
  else if (pct >= 50) { fill.className = 'progress-fill warn'; pctEl.className = 'hero-badge-pct warn'; }
  else { fill.className = 'progress-fill bad'; pctEl.className = 'hero-badge-pct bad'; }

  // Hoy
  const todayStr = today();
  const metaDiaria = (cfg.dias || DIAS_DEFAULT) > 0 ? meta / (cfg.dias || DIAS_DEFAULT) : 36000;
  const vHoy = DATA.viajes.filter(v => v.fecha === todayStr);
  const gHoy = DATA.gastos.filter(g => g.fecha === todayStr);
  const ingHoy   = vHoy.reduce((s, v) => s + (v.total || 0), 0);
  const gastoHoy = gHoy.reduce((s, g) => s + (g.monto || 0), 0);
  const hrsHoy   = vHoy.reduce((s, v) => s + (v.horas || 0), 0);
  const tripsHoy = vHoy.reduce((s, v) => s + (v.cantidadViajes || 1), 0);
  const netoHoy  = ingHoy - gastoHoy;
  const porHoraHoy = hrsHoy > 0 ? ingHoy / hrsHoy : 0;
  const diffMeta = ingHoy - metaDiaria;
  const turnos = vHoy.length;

  if (vHoy.length) {
    $('dbHoyIngresos').textContent = fmt(ingHoy);
    const deltaEl = $('dbHoyDelta');
    if (diffMeta >= 0) { deltaEl.textContent = '+' + fmt(diffMeta) + ' sobre meta diaria'; deltaEl.className = 'turno-delta up'; }
    else { deltaEl.textContent = fmt(Math.abs(diffMeta)) + ' bajo meta diaria'; deltaEl.className = 'turno-delta down'; }
    $('dbHoyPorHora').textContent = fmt(porHoraHoy);
    $('dbHoyHoras').textContent   = hrsHoy.toFixed(1) + ' hrs conducidas';
    $('dbHoyViajes').textContent  = tripsHoy;
    $('dbHoyTurnos').textContent  = turnos + (turnos === 1 ? ' turno' : ' turnos');
    $('dbHoyNeto').textContent    = fmt(netoHoy);
    $('dbHoyGasto').textContent   = gastoHoy > 0 ? '-' + fmt(gastoHoy) + ' gastos' : 'sin gastos hoy';
  } else {
    ['dbHoyIngresos','dbHoyPorHora','dbHoyViajes','dbHoyNeto'].forEach(id => $(id).textContent = '–');
    $('dbHoyDelta').textContent  = 'Sin registros hoy';
    $('dbHoyDelta').className    = 'turno-delta';
    $('dbHoyHoras').textContent  = '';
    $('dbHoyTurnos').textContent = '';
    $('dbHoyGasto').textContent  = '';
  }

  // Chart semana
  renderWeekChart(metaDiaria);

  // Fondos
  const maxAmt = totalBruto * Math.max(...Object.values(FONDOS_PCT));
  document.querySelectorAll('.fondo-card').forEach(card => {
    const fond = card.dataset.fund;
    const pctF = FONDOS_PCT[fond] || 0;
    const amt  = totalBruto * pctF;
    card.querySelector('.fondo-amt').textContent = fmt(amt);
    card.querySelector('.fondo-fill').style.width = maxAmt > 0 ? Math.round(amt / maxAmt * 100) + '%' : '0%';
  });
}

// CHART SEMANA
function renderWeekChart(metaDiaria) {
  const container = $('chartBars');
  if (!container) return;
  const now = new Date();
  const dow = now.getDay(); // 0=dom
  const dias = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const todayStr = today();

  // Obtener los 7 días de esta semana (lun a dom)
  const weekDays = [];
  const startOffset = dow === 0 ? -6 : 1 - dow;
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + startOffset + i);
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    weekDays.push(`${y}-${m}-${day}`);
  }

  const maxVal = metaDiaria * 1.5;
  container.innerHTML = weekDays.map(dateStr => {
    const dayViajes = DATA.viajes.filter(v => v.fecha === dateStr);
    const ing = dayViajes.reduce((s, v) => s + (v.total || 0), 0);
    const heightPct = ing > 0 ? Math.min(Math.round(ing / maxVal * 100), 100) : 0;
    const isToday = dateStr === todayStr;
    const isFuture = dateStr > todayStr;
    const isGood = ing >= metaDiaria && !isToday;
    const barClass = isToday ? 'chart-bar today' : isGood ? 'chart-bar good' : 'chart-bar';
    const dayIdx = new Date(dateStr + 'T12:00:00').getDay();
    const dayLabel = dias[dayIdx];
    return `
      <div class="chart-bar-wrap">
        <div class="${barClass}" style="height:${isFuture ? 0 : Math.max(heightPct, ing > 0 ? 8 : 2)}%"></div>
        <div class="chart-day${isToday ? ' today' : ''}">${dayLabel}</div>
      </div>`;
  }).join('');
}

// CALC VIAJE
function calcViajePreview() {
  const ini  = $('vHoraInicio').value;
  const fin  = $('vHoraFin').value;
  const ing  = parseFloat($('vIngresos').value) || 0;
  const prop = parseFloat($('vPropinas').value) || 0;
  const km   = parseFloat($('vKm').value) || 0;
  const total = ing + prop;

  if (ini && fin) {
    const [ih,im] = ini.split(':').map(Number);
    const [fh,fm] = fin.split(':').map(Number);
    let mins = (fh*60+fm) - (ih*60+im);
    if (mins < 0) mins += 24*60;
    const hrs = mins / 60;
    $('calcHoras').textContent   = fmtH(mins);
    $('calcPorHora').textContent = hrs > 0 ? fmt(total/hrs) : '–';
  } else {
    $('calcHoras').textContent   = '–';
    $('calcPorHora').textContent = '–';
  }
  $('calcPorKm').textContent = (km > 0 && total > 0) ? fmt(total/km) : '–';
  $('calcTotal').textContent = total > 0 ? fmt(total) : '–';

  if (total > 0) {
    const dp = $('distPreview');
    dp.innerHTML = '';
    for (const [fond, pct] of Object.entries(FONDOS_PCT)) {
      const row = document.createElement('div');
      row.className = 'dist-row';
      row.innerHTML = `<span>${fond} (${Math.round(pct*100)}%)</span><strong>${fmt(total*pct)}</strong>`;
      dp.appendChild(row);
    }
  }
}
['vHoraInicio','vHoraFin','vIngresos','vPropinas','vKm'].forEach(id => $(id).addEventListener('input', calcViajePreview));

// GUARDAR VIAJE
$('btnGuardarViaje').addEventListener('click', async () => {
  const fecha    = $('vFecha').value;
  const ini      = $('vHoraInicio').value;
  const fin      = $('vHoraFin').value;
  const cantidad = parseInt($('vCantidad').value) || 0;
  const ingresos = parseFloat($('vIngresos').value) || 0;
  const propinas = parseFloat($('vPropinas').value) || 0;
  const peajes   = parseFloat($('vPeajes').value) || 0;
  const km       = parseFloat($('vKm').value) || 0;
  const turno    = $('vTurno').value;
  const notas    = $('vNotas').value.trim();

  if (!fecha || !ini || !fin || ingresos <= 0) {
    $('vFeedback').textContent = 'Completa fecha, horario e ingresos';
    $('vFeedback').className = 'form-feedback err';
    return;
  }
  const [ih,im] = ini.split(':').map(Number);
  const [fh,fm] = fin.split(':').map(Number);
  let mins = (fh*60+fm) - (ih*60+im);
  if (mins < 0) mins += 24*60;
  const horas = Math.round(mins/60*100)/100;
  const total = ingresos + propinas;

  const row = { type:'viaje', fecha, horaInicio:ini, horaFin:fin, horas, cantidadViajes:cantidad, ingresos, propinas, peajes, km, turno, total, notas, timestamp: new Date().toISOString() };

  $('btnViajeText').style.display = 'none';
  $('vSpinner').style.display = 'inline';
  try {
    if (cfg.scriptUrl) await apiPost(row);
    DATA.viajes.push(row);
    $('vFeedback').textContent = 'Viaje guardado';
    $('vFeedback').className = 'form-feedback ok';
    showToast('Viaje guardado', 'ok');
    ['vHoraInicio','vHoraFin','vCantidad','vIngresos','vPropinas','vPeajes','vKm','vNotas'].forEach(id => $(id).value = '');
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

// GASTO
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
  if (!fecha || monto <= 0) { $('gFeedback').textContent = 'Completa fecha y monto'; $('gFeedback').className = 'form-feedback err'; return; }
  const row = { type:'gasto', fecha, categoria, monto, litros, fondo, notas, timestamp: new Date().toISOString() };
  $('btnGastoText').style.display = 'none';
  $('gSpinner').style.display = 'inline';
  try {
    if (cfg.scriptUrl) await apiPost(row);
    DATA.gastos.push(row);
    $('gFeedback').textContent = 'Gasto guardado';
    $('gFeedback').className = 'form-feedback ok';
    showToast('Gasto guardado', 'ok');
    $('gMonto').value = ''; $('gLitros').value = ''; $('gNotas').value = '';
    renderDashboard(); renderFuelStats();
  } catch(e) {
    $('gFeedback').textContent = 'Error: ' + e.message;
    $('gFeedback').className = 'form-feedback err';
  } finally {
    $('btnGastoText').style.display = 'inline';
    $('gSpinner').style.display = 'none';
  }
});

// FUEL STATS
function renderFuelStats() {
  const mes = currMonth();
  const b = DATA.gastos.filter(g => g.fecha && monthOf(g.fecha) === mes && g.categoria === 'Bencina');
  const total  = b.reduce((s,g) => s+(g.monto||0), 0);
  const litros = b.reduce((s,g) => s+(g.litros||0), 0);
  const ingTotal = DATA.viajes.filter(v => monthOf(v.fecha)===mes).reduce((s,v) => s+(v.total||0), 0);
  $('fuelTotal').textContent    = fmt(total);
  $('fuelLitros').textContent   = litros.toFixed(1) + ' L';
  $('fuelPorLitro').textContent = litros > 0 ? fmt(total/litros) : '$0';
  $('fuelPct').textContent      = ingTotal > 0 ? Math.round(total/ingTotal*100)+'%' : '0%';
}

// HISTORIAL
function renderHistorial() {
  const tipo = $('histTipo').value;
  const mes  = $('histMes').value || currMonth();
  const list = $('historialList');
  const items = tipo === 'viajes'
    ? DATA.viajes.filter(v => !mes || monthOf(v.fecha)===mes).sort((a,b) => String(b.fecha).localeCompare(String(a.fecha)))
    : DATA.gastos.filter(g => !mes || monthOf(g.fecha)===mes).sort((a,b) => String(b.fecha).localeCompare(String(a.fecha)));

  if (items.length === 0) { list.innerHTML = '<div class="empty-state">Sin registros para este periodo</div>'; return; }

  // Guardar índices originales antes de filtrar
  const allItems = tipo === 'viajes' ? DATA.viajes : DATA.gastos;

  list.innerHTML = items.map((item) => {
    // Índice real en el array original (fila en Sheets = índice + 2, por header)
    const origIdx = allItems.indexOf(item);
    const rowIndex = origIdx + 2;
    if (tipo === 'viajes') {
      const ph = item.horas > 0 ? fmt(item.total/item.horas) : '–';
      const kmStr = item.km > 0 ? ` · ${item.km} km` : '';
      return `<div class="hist-item" data-row="${rowIndex}" data-orig="${origIdx}">
        <div class="hist-icon">${item.turno==='Mañana'||item.turno==='Manana'?'🌅':item.turno==='Noche'?'🌙':'☀️'}</div>
        <div class="hist-info">
          <div class="hist-main">${formatFecha(item.fecha)} · ${item.horaInicio||''} - ${item.horaFin||''}</div>
          <div class="hist-meta">${item.cantidadViajes||'?'} viajes · ${Number(item.horas||0).toFixed(1)}h · ${ph}/hr${kmStr}</div>
        </div>
        <div class="hist-right">
          <div class="hist-amount income">${fmt(item.total)}</div>
          <button class="btn-delete" data-row="${rowIndex}" data-orig="${origIdx}" data-tipo="viajes">🗑</button>
        </div></div>`;
    } else {
      return `<div class="hist-item" data-row="${rowIndex}" data-orig="${origIdx}">
        <div class="hist-icon">${categoryIcon(item.categoria)}</div>
        <div class="hist-info">
          <div class="hist-main">${item.categoria} · ${formatFecha(item.fecha)}</div>
          <div class="hist-meta">Fondo: ${item.fondo||'–'}${item.litros?' · '+item.litros+' L':''}${item.notas?' · '+item.notas:''}</div>
        </div>
        <div class="hist-right">
          <div class="hist-amount expense">-${fmt(item.monto)}</div>
          <button class="btn-delete" data-row="${rowIndex}" data-orig="${origIdx}" data-tipo="gastos">🗑</button>
        </div></div>`;
    }
  }).join('');

  list.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const rowIndex = parseInt(btn.dataset.row);
      const origIdx  = parseInt(btn.dataset.orig);
      const t2 = btn.dataset.tipo;
      if (!confirm('¿Eliminar este registro?')) return;
      btn.textContent = '⏳'; btn.disabled = true;
      try {
        console.log('Intentando borrar:', t2, 'fila:', rowIndex);
        if (cfg.scriptUrl) {
          const result = await deleteRecord(t2, rowIndex);
          console.log('Respuesta del script:', JSON.stringify(result));
        }
        if (t2 === 'viajes') DATA.viajes.splice(origIdx, 1);
        else DATA.gastos.splice(origIdx, 1);
        showToast('Registro eliminado', 'ok');
        renderHistorial(); renderDashboard(); renderFuelStats();
      } catch(e) {
        console.log('Error al borrar:', e.message);
        showToast('Error: ' + e.message, 'err');
        btn.textContent = '🗑'; btn.disabled = false;
      }
    });
  });
}

function formatFecha(f) {
  if (!f) return '?';
  const s = String(f);
  if (s.includes('-')) { const [y,m,d] = s.split('-'); return `${d}/${m}/${y}`; }
  return s;
}
function categoryIcon(c) {
  return {Bencina:'⛽',Peaje:'🛣','Mantención':'🔧',Lavado:'🚿',Seguro:'🛡',TAG:'📡','Revisión Técnica':'🔍',Otro:'📦'}[c]||'📦';
}

$('histTipo').addEventListener('change', renderHistorial);
$('histMes').addEventListener('change', renderHistorial);

function populateHistMes() {
  const sel = $('histMes');
  const d = new Date();
  for (let i = 0; i < 6; i++) {
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const opt = document.createElement('option');
    opt.value = `${y}-${m}`;
    opt.textContent = new Date(y, d.getMonth(), 1).toLocaleDateString('es-CL',{month:'long',year:'numeric'});
    if (i > 0) sel.appendChild(opt);
    d.setMonth(d.getMonth()-1);
  }
}

$('btnRefresh').addEventListener('click', () => { loadData(); showToast('Actualizando...'); });

// INIT
initDateDefaults();
populateHistMes();
calcViajePreview();
renderDashboard();
renderFuelStats();
$('gLitrosGroup').style.display = 'none';

if (cfg.scriptUrl) loadData();
else setSyncBar('Sin configurar — ve a configuracion');
