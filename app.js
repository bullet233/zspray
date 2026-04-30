// ─── State ───
let calTankMode = 15, mixTankMode = 15;
let mixProdId = 0;
let calibrationResult = null; // { galPer1k, tank, coverageSqFt }
const STORE = 'zspray_v4';
const PRESET_STORE = 'zspray_presets_v1';

// Default presets seeded on first use
const DEFAULT_PRESETS = [
  { name: 'T-Zone SE', rate: 1.5, unit: 'oz_per_k', form: 'L' },
  { name: 'Celsius WG', rate: 0.085, unit: 'oz_per_k', form: 'DF' },
  { name: 'Prodiamine 65 WDG', rate: 0.183, unit: 'oz_per_k', form: 'DF' },
  { name: 'Talstar P', rate: 1, unit: 'oz_per_k', form: 'L' },
  { name: 'Trimec Classic', rate: 1.5, unit: 'oz_per_k', form: 'L' },
  { name: 'Dismiss NXT', rate: 0.2, unit: 'oz_per_k', form: 'L' },
  { name: 'Non-ionic Surfactant', rate: 0.25, unit: 'oz_per_gal', form: 'SURF' },
  { name: 'MSO (Methylated Seed Oil)', rate: 0.5, unit: 'oz_per_gal', form: 'SURF' },
];

let presets = [];

// ─── Presets ───
function loadPresets() {
  try {
    const raw = localStorage.getItem(PRESET_STORE);
    if (raw) {
      presets = JSON.parse(raw);
    } else {
      presets = [...DEFAULT_PRESETS];
      savePresets();
    }
  } catch (e) {
    presets = [...DEFAULT_PRESETS];
  }
  renderPresetDropdown();
}

function savePresets() {
  try { localStorage.setItem(PRESET_STORE, JSON.stringify(presets)); } catch (e) {}
}

function renderPresetDropdown() {
  const sel = document.getElementById('preset-select');
  const val = sel.value;
  sel.innerHTML = '<option value="">— Select a saved product —</option>';
  const formLabels = { WP: 'Powder', DF: 'Dry Flow.', L: 'Liquid', EC: 'Emulsif.', SURF: 'Surfactant' };
  presets.forEach((p, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    const unitLabel = p.unit === 'oz_per_k' ? 'oz/1k' : 'oz/gal';
    opt.textContent = p.name + '  (' + p.rate + ' ' + unitLabel + ', ' + formLabels[p.form] + ')';
    sel.appendChild(opt);
  });
  if (val) sel.value = val;
}

function addFromPreset() {
  const sel = document.getElementById('preset-select');
  const idx = parseInt(sel.value);
  if (isNaN(idx) || !presets[idx]) return;
  const p = presets[idx];
  addMixProduct(p.name, p.rate, p.unit, p.form);
  sel.value = '';
}

function togglePresetManager() {
  const mgr = document.getElementById('preset-manager');
  const showing = mgr.style.display !== 'none';
  mgr.style.display = showing ? 'none' : 'block';
  if (!showing) renderPresetList();
}

function renderPresetList() {
  const list = document.getElementById('preset-list');
  const formLabels = { WP: 'Wettable Powder', DF: 'Dry Flowable', L: 'Liquid / SC', EC: 'Emulsifiable', SURF: 'Surfactant' };
  if (presets.length === 0) {
    list.innerHTML = '<div style="font-size:13px;color:#94a3b8;padding:8px 0">No saved products yet.</div>';
    return;
  }
  list.innerHTML = presets.map((p, i) => {
    const unitLabel = p.unit === 'oz_per_k' ? 'oz/1k' : 'oz/gal';
    return '<div class="preset-item">' +
      '<span class="pi-name">' + p.name + '</span>' +
      '<span class="pi-detail">' + p.rate + ' ' + unitLabel + ' · ' + formLabels[p.form] + '</span>' +
      '<button class="pi-del" onclick="deletePreset(' + i + ')" title="Delete">✕</button>' +
      '</div>';
  }).join('');
}

function deletePreset(idx) {
  presets.splice(idx, 1);
  savePresets();
  renderPresetDropdown();
  renderPresetList();
}

function saveNewPreset() {
  const name = document.getElementById('new-preset-name').value.trim();
  if (!name) { document.getElementById('new-preset-name').focus(); return; }
  const rate = parseFloat(document.getElementById('new-preset-rate').value) || 1;
  const unit = document.getElementById('new-preset-unit').value;
  const form = document.getElementById('new-preset-form').value;
  presets.push({ name, rate, unit, form });
  savePresets();
  renderPresetDropdown();
  renderPresetList();
  // Clear form
  document.getElementById('new-preset-name').value = '';
  document.getElementById('new-preset-rate').value = '1';
  document.getElementById('new-preset-unit').value = 'oz_per_k';
  document.getElementById('new-preset-form').value = 'L';
}

// ─── Tabs ───
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === tab));
  if (tab === 'mix') syncMixFromCal();
  saveState();
}

// ─── Calibration Tank ───
function setCalTank(v) {
  calTankMode = v;
  ['10','15','20','c'].forEach(k => {
    document.getElementById('ct-' + k).classList.toggle('active',
      (v === 10 && k === '10') || (v === 15 && k === '15') || (v === 20 && k === '20') || (v === 'c' && k === 'c'));
  });
  document.getElementById('cal-custom-wrap').style.display = v === 'c' ? 'flex' : 'none';
  calcCal();
}
function getCalTank() { return calTankMode === 'c' ? (parseFloat(document.getElementById('calCustomTank').value) || 15) : calTankMode; }

// ─── Nozzles ───
function updateNozzles() {
  const n = parseInt(document.getElementById('nozzleCount').value);
  const c = document.getElementById('nozzle-inputs');
  const ex = [...c.querySelectorAll('input')].map(i => i.value);
  c.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const inp = document.createElement('input');
    inp.type = 'number'; inp.min = '0'; inp.step = '0.5';
    inp.value = ex[i] || '43'; inp.placeholder = 'N' + (i + 1);
    inp.oninput = calcCal;
    c.appendChild(inp);
  }
  calcCal();
}

// ─── Calibration Calc ───
function calcCal() {
  const n = parseInt(document.getElementById('nozzleCount').value);
  const spacing = parseFloat(document.getElementById('spacing').value) || 20;
  const distFt = parseFloat(document.getElementById('distFt').value) || 150;
  const timeSec = parseFloat(document.getElementById('timeSec').value) || 34;
  const target = parseFloat(document.getElementById('target').value) || 1;
  const tank = getCalTank();

  // Swath
  const swathIn = n * spacing;
  const swathFt = swathIn / 12;
  const passDistFt = Math.round(1000 / swathFt);
  document.getElementById('swath-line').textContent = 'Effective swath: ' + swathFt.toFixed(2) + ' ft (' + swathIn + ' in)';
  document.getElementById('swath-detail').textContent = n + ' nozzles × ' + spacing + '″ = ' + swathIn + '″ | ½ spacing (' + Math.round(spacing / 2) + '″) each outer edge for 50% overlap';
  document.getElementById('r-swath').textContent = swathFt.toFixed(2);
  document.getElementById('pass-dist').textContent = passDistFt;
  document.getElementById('catch-sec').textContent = timeSec;

  // Speed
  const mph = (distFt / timeSec) * 0.6818;
  document.getElementById('r-speed').textContent = mph.toFixed(2);
  document.getElementById('speed-display').textContent = 'Calculated speed: ' + mph.toFixed(2) + ' MPH  (' + distFt + ' ft ÷ ' + timeSec + ' sec × 0.6818)';

  // Catch
  const inputs = [...document.getElementById('nozzle-inputs').querySelectorAll('input')];
  const ozVals = inputs.map(i => parseFloat(i.value) || 0);
  const totalOz = ozVals.reduce((a, b) => a + b, 0);
  document.getElementById('r-oz').textContent = totalOz.toFixed(1);
  document.getElementById('total-caught').textContent = 'Total: ' + ozVals.map((v, i) => 'N' + (i + 1) + ': ' + v + ' oz').join(' + ') + ' = ' + totalOz.toFixed(1) + ' oz';
  const maxOz = Math.max(...ozVals), minOz = Math.min(...ozVals);
  document.getElementById('warn-uneven').style.display = (maxOz > 0 && (maxOz - minOz) / maxOz > 0.15) ? 'block' : 'none';

  // Scale to 1,000 sq ft
  const scaleFactor = passDistFt / distFt;
  const scaledOz = totalOz * scaleFactor;
  const galPer1k = scaledOz / 128;

  // Derived
  const galDiffPer1k = galPer1k - target;
  const pctDiff = ((galPer1k - target) / target) * 100;
  const coverageSqFt = galPer1k > 0 ? Math.round((tank / galPer1k) * 1000) : 0;
  const targetCovSqFt = Math.round((tank / target) * 1000);
  const covDiff = coverageSqFt - targetCovSqFt;
  const targetSpeedMph = galPer1k > 0 ? (mph * galPer1k / target) : mph;

  document.getElementById('r-gal').textContent = galPer1k.toFixed(3);
  document.getElementById('r-cov').textContent = coverageSqFt.toLocaleString();

  // Store for mix tab
  calibrationResult = { galPer1k, tank, coverageSqFt };

  // Status banner
  const banner = document.getElementById('status-banner');
  const sTitle = document.getElementById('s-title');
  const sBody = document.getElementById('s-body');
  const sGrid = document.getElementById('s-grid');
  banner.style.display = 'block';

  const ap = Math.abs(pctDiff).toFixed(1);
  const agd = Math.abs(galDiffPer1k).toFixed(3);
  const aod = Math.abs(galDiffPer1k * 128).toFixed(1);
  const extraGalPerTank = Math.abs(galDiffPer1k) * (Math.min(coverageSqFt, targetCovSqFt) / 1000);

  if (Math.abs(pctDiff) <= 5) {
    banner.className = 'status-banner good';
    sTitle.textContent = '✓ On target — within 5%';
    sBody.innerHTML = 'Your spray output is dialed in. Tank covers <strong>' + coverageSqFt.toLocaleString() + ' sq ft</strong>.';
    sGrid.innerHTML =
      di('Actual output', galPer1k.toFixed(3), 'gal / 1,000 sq ft', true) +
      di('Target output', target.toFixed(2), 'gal / 1,000 sq ft') +
      di('Tank size', tank + ' gal', 'filled to top') +
      di('Tank covers', coverageSqFt.toLocaleString(), 'sq ft');
  } else if (pctDiff > 5) {
    banner.className = 'status-banner over';
    sTitle.textContent = '▲ Over-applying by ' + ap + '%';
    sBody.innerHTML = 'Applying <strong>' + agd + ' extra gal</strong> (' + aod + ' oz) per 1,000 sq ft — wasting ~<strong>' + extraGalPerTank.toFixed(1) + ' gal</strong> per tank.<br><strong>Fix:</strong> drive faster or reduce pressure. Target speed: <strong>' + targetSpeedMph.toFixed(2) + ' MPH</strong>.';
    sGrid.innerHTML =
      di('Actual output', galPer1k.toFixed(3), 'gal / 1,000 sq ft', true) +
      di('Target output', target.toFixed(2), 'gal / 1,000 sq ft') +
      di('Extra water / 1k', agd + ' gal', '(' + aod + ' oz) over target', true) +
      di('% over target', '+' + ap + '%', 'above label rate') +
      di('Actual coverage', coverageSqFt.toLocaleString(), 'sq ft per tank') +
      di('Target coverage', targetCovSqFt.toLocaleString(), 'sq ft per tank') +
      di('Coverage lost', Math.abs(covDiff).toLocaleString(), 'sq ft less than expected') +
      di('Wasted carrier', extraGalPerTank.toFixed(1) + ' gal', 'per tank') +
      di('Target speed', targetSpeedMph.toFixed(2) + ' MPH', 'to hit ' + target + ' gal/k');
  } else {
    banner.className = 'status-banner under';
    sTitle.textContent = '▼ Under-applying by ' + ap + '%';
    sBody.innerHTML = 'Applying <strong>' + agd + ' gal less</strong> (' + aod + ' oz short) per 1,000 sq ft — product may not perform as expected.<br><strong>Fix:</strong> slow down or increase pressure. Target speed: <strong>' + targetSpeedMph.toFixed(2) + ' MPH</strong>.';
    sGrid.innerHTML =
      di('Actual output', galPer1k.toFixed(3), 'gal / 1,000 sq ft', true) +
      di('Target output', target.toFixed(2), 'gal / 1,000 sq ft') +
      di('Short water / 1k', agd + ' gal', '(' + aod + ' oz) under target', true) +
      di('% under target', '-' + ap + '%', 'below label rate') +
      di('Actual coverage', coverageSqFt.toLocaleString(), 'sq ft per tank') +
      di('Target coverage', targetCovSqFt.toLocaleString(), 'sq ft per tank') +
      di('Extra coverage', Math.abs(covDiff).toLocaleString(), 'sq ft more (diluted)') +
      di('Target speed', targetSpeedMph.toFixed(2) + ' MPH', 'to hit ' + target + ' gal/k');
  }

  // Formula
  const scaleNote = Math.abs(scaleFactor - 1) > 0.01
    ? '\nScaled  = ' + totalOz.toFixed(1) + ' oz × ' + scaleFactor.toFixed(3) + ' = ' + scaledOz.toFixed(1) + ' oz  (adjusted to exactly 1,000 sqft)' : '';
  document.getElementById('formula').textContent =
    'Speed       = (' + distFt + ' ft ÷ ' + timeSec + ' sec) × 0.6818 = ' + mph.toFixed(2) + ' MPH\n' +
    'Pass / 1k   = 1,000 ÷ ' + swathFt.toFixed(2) + ' ft swath = ' + passDistFt + ' ft\n' +
    'Caught      = ' + ozVals.map((v, i) => 'N' + (i + 1) + ':' + v).join(' + ') + ' = ' + totalOz.toFixed(1) + ' oz' + scaleNote + '\n' +
    'Gal / 1,000 = ' + scaledOz.toFixed(1) + ' oz ÷ 128 = ' + galPer1k.toFixed(3) + ' gal/k\n' +
    'vs Target   = ' + (galDiffPer1k >= 0 ? '+' : '') + galDiffPer1k.toFixed(3) + ' gal/k  (' + (pctDiff >= 0 ? '+' : '') + pctDiff.toFixed(1) + '%)';

  saveState();
}

function di(lbl, val, unit, hl) {
  return '<div class="di' + (hl ? ' hl' : '') + '"><div class="di-lbl">' + lbl + '</div><div class="di-val">' + val + '</div><div class="di-unit">' + unit + '</div></div>';
}

// ─── Mix Tab ───
function syncMixFromCal() {
  const badge = document.getElementById('sync-badge');
  if (calibrationResult) {
    const rateInput = document.getElementById('mixRate');
    const currentRate = parseFloat(rateInput.value);
    // Only auto-fill if user hasn't manually changed it or it matches old cal
    if (!rateInput.dataset.manual) {
      rateInput.value = calibrationResult.galPer1k.toFixed(3);
      // Also sync tank
      setMixTank(calibrationResult.tank);
    }
    badge.className = 'sync-badge synced';
    badge.innerHTML = '<span class="sync-dot"></span> Synced from calibration';
  } else {
    badge.className = 'sync-badge manual';
    badge.innerHTML = '<span class="sync-dot"></span> Manual entry';
  }
  calcMix();
}

function onMixRateChange() {
  document.getElementById('mixRate').dataset.manual = '1';
  document.getElementById('sync-badge').className = 'sync-badge manual';
  document.getElementById('sync-badge').innerHTML = '<span class="sync-dot"></span> Manual entry';
  calcMix();
}

function setMixTank(v) {
  // Handle numeric vs 'c'
  if (typeof v === 'number' || (typeof v === 'string' && v !== 'c')) {
    v = parseInt(v);
  }
  mixTankMode = v;
  ['10','15','20','c'].forEach(k => {
    document.getElementById('mt-' + k).classList.toggle('active',
      (v === 10 && k === '10') || (v === 15 && k === '15') || (v === 20 && k === '20') || (v === 'c' && k === 'c'));
  });
  document.getElementById('mix-custom-wrap').style.display = v === 'c' ? 'flex' : 'none';
  calcMix();
}
function getMixTank() { return mixTankMode === 'c' ? (parseFloat(document.getElementById('mixCustomTank').value) || 15) : mixTankMode; }

function addMixProduct(name, rate, unit, form) {
  const id = 'mp' + (mixProdId++);
  const div = document.createElement('div');
  div.className = 'prod-row'; div.id = id;
  div.innerHTML =
    '<input type="text" class="pname" placeholder="Product name" value="' + (name || '') + '" oninput="calcMix()">' +
    '<input type="number" class="prate" min="0" step="0.25" value="' + (rate !== undefined ? rate : 1) + '" oninput="calcMix()">' +
    '<select class="punit" onchange="calcMix()">' +
      '<option value="oz_per_k"' + (unit === 'oz_per_k' || !unit ? ' selected' : '') + '>oz / 1,000 sqft</option>' +
      '<option value="oz_per_gal"' + (unit === 'oz_per_gal' ? ' selected' : '') + '>oz / gal</option>' +
    '</select>' +
    '<select class="pform" onchange="calcMix()" title="Formulation type — controls mixing order">' +
      '<option value="WP"' + (form === 'WP' ? ' selected' : '') + '>Wettable Powder</option>' +
      '<option value="DF"' + (form === 'DF' ? ' selected' : '') + '>Dry Flowable</option>' +
      '<option value="L"' + (form === 'L' || !form ? ' selected' : '') + '>Liquid / SC</option>' +
      '<option value="EC"' + (form === 'EC' ? ' selected' : '') + '>Emulsifiable</option>' +
      '<option value="SURF"' + (form === 'SURF' ? ' selected' : '') + '>Surfactant / Adj</option>' +
    '</select>' +
    '<button class="btn-x" onclick="removeMixProduct(\'' + id + '\')" title="Remove">×</button>';
  document.getElementById('mix-products').appendChild(div);
  calcMix();
}

function removeMixProduct(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
  calcMix();
}

function getMixProducts() {
  const rows = document.querySelectorAll('#mix-products .prod-row');
  const list = [];
  rows.forEach(r => {
    const name = r.querySelector('.pname').value.trim() || 'Product';
    const rate = parseFloat(r.querySelector('.prate').value) || 0;
    const unit = r.querySelector('.punit').value;
    const form = r.querySelector('.pform').value;
    if (rate > 0) list.push({ name, rate, unit, form });
  });
  return list;
}

function calcMix() {
  const rate = parseFloat(document.getElementById('mixRate').value) || 1;
  const tank = getMixTank();
  const products = getMixProducts();
  const coverageSqFt = rate > 0 ? Math.round((tank / rate) * 1000) : 0;

  document.getElementById('mix-cov').textContent = coverageSqFt.toLocaleString() + ' sq ft';
  document.getElementById('mix-tank-info').textContent = tank + ' gal tank at ' + rate + ' gal/1k = ' + coverageSqFt.toLocaleString() + ' sq ft coverage';

  // Calculate product amounts
  let prodDetails = [];
  let totalProdOz = 0;
  products.forEach(p => {
    let actual = 0;
    if (p.unit === 'oz_per_k') {
      actual = (coverageSqFt / 1000) * p.rate;
    } else {
      actual = tank * p.rate;
    }
    actual = Math.round(actual * 10) / 10;
    totalProdOz += actual;
    prodDetails.push({ name: p.name, rate: p.rate, unit: p.unit, form: p.form, actual });
  });

  // Results grid
  document.getElementById('mix-r-rate').textContent = rate.toFixed(3);
  document.getElementById('mix-r-tank').textContent = tank;
  document.getElementById('mix-r-cov').textContent = coverageSqFt.toLocaleString();
  document.getElementById('mix-r-prod').textContent = totalProdOz > 0 ? totalProdOz.toFixed(1) : '—';

  // Mixing instructions
  const mixPanel = document.getElementById('mix-panel');
  const mixResultsCard = document.getElementById('mix-results-card');
  if (prodDetails.length > 0) {
    mixPanel.style.display = 'block';
    if (mixResultsCard) mixResultsCard.style.display = 'block';
    const formOrder = ['WP', 'DF', 'L', 'EC', 'SURF'];
    const formNames = { WP: 'Wettable Powder', DF: 'Dry Flowable', L: 'Liquid / Suspension', EC: 'Emulsifiable Concentrate', SURF: 'Surfactant / Adjuvant' };
    const fullList = products.map((p, i) => ({ ...p, actual: prodDetails[i].actual }));

    const liquidProds = fullList.filter(p => p.form === 'L' || p.form === 'EC' || p.form === 'SURF');
    const dryProds = fullList.filter(p => p.form === 'WP' || p.form === 'DF');
    const totalLiquidOz = liquidProds.reduce((a, p) => a + p.actual, 0);
    const totalLiquidGal = totalLiquidOz / 128;
    const initialFillGal = Math.max(tank * 0.5, tank - totalLiquidGal - 1);

    let summary = '<strong>Final tank volume:</strong> ' + tank + ' gal &nbsp;|&nbsp; <strong>Total product:</strong> ' + totalProdOz.toFixed(1) + ' oz (' + totalLiquidGal.toFixed(2) + ' gal liquid)<br>';
    summary += '<strong>Initial water fill:</strong> ~' + initialFillGal.toFixed(0) + ' gal &nbsp;|&nbsp; then add products &nbsp;|&nbsp; <strong>Top off to ' + tank + ' gal</strong>';
    document.getElementById('mix-summary').innerHTML = summary;

    let steps = '', stepNum = 1;
    steps += '<div class="mix-step"><div class="mix-step-num">' + (stepNum++) + '</div><div class="mix-step-text">Fill tank to <strong>' + initialFillGal.toFixed(0) + ' gallons</strong> with clean water.</div></div>';
    steps += '<div class="mix-step"><div class="mix-step-num">' + (stepNum++) + '</div><div class="mix-step-text"><strong>Start agitation</strong> — keep it running for the entire mixing process.</div></div>';

    formOrder.forEach(f => {
      const prods = fullList.filter(p => p.form === f);
      if (prods.length === 0) return;
      const prodList = prods.map(p => '<strong>' + p.actual + ' oz</strong> ' + p.name).join(', ');
      let note = '';
      if (f === 'WP') note = ' Pre-mix with water in a bucket to make a slurry, then add slowly while agitating.';
      else if (f === 'DF') note = ' Add slowly while agitating; let dissolve fully before next product.';
      else if (f === 'L') note = ' Pour in slowly while agitating.';
      else if (f === 'EC') note = ' Pour in slowly — these can foam.';
      else if (f === 'SURF') note = ' Add LAST to prevent excessive foaming.';
      steps += '<div class="mix-step"><div class="mix-step-num">' + (stepNum++) + '</div><div class="mix-step-text">Add <em>' + formNames[f] + '</em>: ' + prodList + '.' + note + '</div></div>';
    });

    steps += '<div class="mix-step"><div class="mix-step-num">' + (stepNum++) + '</div><div class="mix-step-text">Top off with water to exactly <strong>' + tank + ' gallons</strong>.</div></div>';
    steps += '<div class="mix-step"><div class="mix-step-num">' + (stepNum++) + '</div><div class="mix-step-text">Continue agitating for 2-3 minutes before spraying. Keep agitation on while spraying.</div></div>';
    document.getElementById('mix-steps').innerHTML = steps;

    // Product summary cards
    let prodHTML = '';
    prodDetails.forEach(p => {
      const rateLabel = p.rate + ' ' + (p.unit === 'oz_per_k' ? 'oz/1k' : 'oz/gal');
      prodHTML += di(p.name, p.actual + ' oz', rateLabel);
    });
    document.getElementById('mix-prod-grid').innerHTML =
      di('Total product', totalProdOz.toFixed(1) + ' oz', 'into ' + tank + ' gal water', true) + prodHTML;

    // Warnings
    const warnEl = document.getElementById('mix-warning');
    let warnings = [];
    const productPct = (totalProdOz / (tank * 128)) * 100;
    if (productPct > 10) warnings.push('⚠ Products make up ' + productPct.toFixed(1) + '% of tank volume — high concentration may cause mixing issues.');
    if (dryProds.length > 0 && liquidProds.some(p => p.form === 'EC')) warnings.push('⚠ Wettable/dry powders + emulsifiables in same tank — check label for compatibility, do a jar test first.');
    if (initialFillGal < tank * 0.4) warnings.push('⚠ Heavy product load — consider pre-mixing dry products in a separate bucket.');
    if (warnings.length > 0) { warnEl.innerHTML = warnings.join('<br>'); warnEl.classList.add('show'); }
    else { warnEl.classList.remove('show'); }
  } else {
    mixPanel.style.display = 'none';
    if (mixResultsCard) mixResultsCard.style.display = 'none';
    document.getElementById('mix-prod-grid').innerHTML = '';
  }
  saveState();
}

// ─── Persistence ───
function saveState() {
  try {
    const nozInputs = [...document.getElementById('nozzle-inputs').querySelectorAll('input')];
    const mixRows = [...document.querySelectorAll('#mix-products .prod-row')];
    const data = {
      activeTab: document.querySelector('.tab-btn.active')?.dataset.tab || 'cal',
      nozzleCount: document.getElementById('nozzleCount').value,
      spacing: document.getElementById('spacing').value,
      distFt: document.getElementById('distFt').value,
      timeSec: document.getElementById('timeSec').value,
      nozzleOz: nozInputs.map(i => i.value),
      target: document.getElementById('target').value,
      calTankMode,
      calCustomTank: document.getElementById('calCustomTank').value,
      mixRate: document.getElementById('mixRate').value,
      mixRateManual: document.getElementById('mixRate').dataset.manual || '',
      mixTankMode,
      mixCustomTank: document.getElementById('mixCustomTank').value,
      mixProducts: mixRows.map(r => ({
        name: r.querySelector('.pname').value,
        rate: r.querySelector('.prate').value,
        unit: r.querySelector('.punit').value,
        form: r.querySelector('.pform').value
      }))
    };
    localStorage.setItem(STORE, JSON.stringify(data));
  } catch (e) { /* silently fail */ }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return false;
    const d = JSON.parse(raw);

    if (d.nozzleCount) document.getElementById('nozzleCount').value = d.nozzleCount;
    if (d.spacing) document.getElementById('spacing').value = d.spacing;
    if (d.distFt) document.getElementById('distFt').value = d.distFt;
    if (d.timeSec) document.getElementById('timeSec').value = d.timeSec;
    if (d.target) document.getElementById('target').value = d.target;
    if (d.calCustomTank) document.getElementById('calCustomTank').value = d.calCustomTank;
    if (d.mixRate) document.getElementById('mixRate').value = d.mixRate;
    if (d.mixRateManual) document.getElementById('mixRate').dataset.manual = d.mixRateManual;
    if (d.mixCustomTank) document.getElementById('mixCustomTank').value = d.mixCustomTank;

    // Build nozzle inputs then set values
    updateNozzles();
    if (d.nozzleOz) {
      const inputs = [...document.getElementById('nozzle-inputs').querySelectorAll('input')];
      d.nozzleOz.forEach((v, i) => { if (inputs[i]) inputs[i].value = v; });
    }

    // Set cal tank mode
    if (d.calTankMode !== undefined) setCalTank(d.calTankMode === 'c' ? 'c' : parseInt(d.calTankMode));

    // Mix products
    if (d.mixProducts && d.mixProducts.length > 0) {
      d.mixProducts.forEach(p => addMixProduct(p.name, p.rate, p.unit, p.form));
    } else {
      addMixProduct('', 1, 'oz_per_k', 'L');
    }

    // Set mix tank mode
    if (d.mixTankMode !== undefined) setMixTank(d.mixTankMode === 'c' ? 'c' : parseInt(d.mixTankMode));

    // Restore active tab
    if (d.activeTab) switchTab(d.activeTab);

    return true;
  } catch (e) { return false; }
}

// ─── Init ───
function init() {
  loadPresets();
  const loaded = loadState();
  if (!loaded) {
    updateNozzles();
    addMixProduct('', 1, 'oz_per_k', 'L');
    calcCal();
    calcMix();
  } else {
    calcCal();
    calcMix();
  }
}
init();
