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
  renderXferPresetDropdown();
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
  renderXferPresetDropdown();
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
  renderXferPresetDropdown();
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
  if (tab === 'xfer') calcDilution();
  if (tab === 'gran') calcGranular();
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
    sTitle.textContent = '✅ You\'re good to spray';
    sBody.innerHTML = 'Your sprayer is putting out <strong>' + galPer1k.toFixed(3) + ' gal per 1,000 sq ft</strong> — that\'s within 5% of your <strong>' + target.toFixed(2) + '</strong> target. No changes needed.<br>One full tank will cover about <strong>' + coverageSqFt.toLocaleString() + ' sq ft</strong>.';
    sGrid.innerHTML =
      di('What you\'re putting down', galPer1k.toFixed(3) + ' gal', 'per 1,000 sq ft', true) +
      di('What you wanted', target.toFixed(2) + ' gal', 'per 1,000 sq ft') +
      di('Tank covers', coverageSqFt.toLocaleString() + ' sq ft', 'before refilling');
  } else if (pctDiff > 5) {
    banner.className = 'status-banner over';
    sTitle.textContent = '⚠️ Too much product — speed up';
    sBody.innerHTML = 'You\'re putting down <strong>' + ap + '% more</strong> than you should. That wastes about <strong>' + extraGalPerTank.toFixed(1) + ' gal</strong> per tank and you\'ll run out sooner.' +
      '<br><br><strong>👉 What to do:</strong> Drive faster — aim for about <strong>' + targetSpeedMph.toFixed(1) + ' MPH</strong> instead of your current ' + mph.toFixed(1) + ' MPH. Or turn down the pressure.';
    sGrid.innerHTML =
      di('You\'re putting down', galPer1k.toFixed(3) + ' gal', 'per 1,000 sq ft', true) +
      di('You should be at', target.toFixed(2) + ' gal', 'per 1,000 sq ft') +
      di('How far off', '+' + ap + '%', 'over target', true) +
      di('Drive this fast', targetSpeedMph.toFixed(1) + ' MPH', 'to fix it') +
      di('Tank covers', coverageSqFt.toLocaleString() + ' sq ft', 'should be ' + targetCovSqFt.toLocaleString());
  } else {
    banner.className = 'status-banner under';
    sTitle.textContent = '⚠️ Not enough product — slow down';
    sBody.innerHTML = 'You\'re putting down <strong>' + ap + '% less</strong> than you should. Products won\'t work as well because they\'re too diluted.' +
      '<br><br><strong>👉 What to do:</strong> Slow down — aim for about <strong>' + targetSpeedMph.toFixed(1) + ' MPH</strong> instead of your current ' + mph.toFixed(1) + ' MPH. Or turn up the pressure.';
    sGrid.innerHTML =
      di('You\'re putting down', galPer1k.toFixed(3) + ' gal', 'per 1,000 sq ft', true) +
      di('You should be at', target.toFixed(2) + ' gal', 'per 1,000 sq ft') +
      di('How far off', '-' + ap + '%', 'under target', true) +
      di('Drive this fast', targetSpeedMph.toFixed(1) + ' MPH', 'to fix it') +
      di('Tank covers', coverageSqFt.toLocaleString() + ' sq ft', 'should be ' + targetCovSqFt.toLocaleString());
  }

  // Formula (show the math for reference)
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
  // Auto-sync fill to full tank when tank size changes
  const fillInput = document.getElementById('mixFill');
  if (!fillInput.dataset.manual) {
    fillInput.value = getMixTank();
  }
  calcMix();
}
function getMixTank() { return mixTankMode === 'c' ? (parseFloat(document.getElementById('mixCustomTank').value) || 15) : mixTankMode; }
function getMixFill() { return parseFloat(document.getElementById('mixFill').value) || getMixTank(); }
function resetFillToFull() {
  const fillInput = document.getElementById('mixFill');
  fillInput.value = getMixTank();
  delete fillInput.dataset.manual;
  calcMix();
}

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
  const fill = getMixFill();
  const products = getMixProducts();
  const isPartial = fill < tank;
  const coverageSqFt = rate > 0 ? Math.round((fill / rate) * 1000) : 0;

  // Mark fill as manual if user changed it
  const fillInput = document.getElementById('mixFill');
  if (parseFloat(fillInput.value) !== tank && document.activeElement === fillInput) {
    fillInput.dataset.manual = '1';
  }

  // Partial fill info
  const fillInfo = document.getElementById('fill-info');
  if (isPartial) {
    fillInfo.style.display = 'block';
    fillInfo.className = 'fill-partial-note';
    fillInfo.textContent = '⚡ You\'re only filling ' + fill + ' of ' + tank + ' gallons (' + Math.round(fill/tank*100) + '%) — product amounts are adjusted for this smaller fill.';
  } else {
    fillInfo.style.display = 'none';
  }

  document.getElementById('mix-cov').textContent = 'This fill covers about ' + coverageSqFt.toLocaleString() + ' sq ft';
  document.getElementById('mix-tank-info').textContent = fill + ' gallons at ' + rate + ' gal/1k = about ' + coverageSqFt.toLocaleString() + ' sq ft of coverage';

  // Calculate product amounts based on fill, not full tank
  let prodDetails = [];
  let totalProdOz = 0;
  products.forEach(p => {
    let actual = 0;
    if (p.unit === 'oz_per_k') {
      actual = (coverageSqFt / 1000) * p.rate;
    } else {
      actual = fill * p.rate;
    }
    actual = Math.round(actual * 10) / 10;
    totalProdOz += actual;
    prodDetails.push({ name: p.name, rate: p.rate, unit: p.unit, form: p.form, actual });
  });

  // Results grid
  document.getElementById('mix-r-rate').textContent = rate.toFixed(3);
  document.getElementById('mix-r-fill').textContent = fill;
  document.getElementById('mix-r-cov').textContent = coverageSqFt.toLocaleString();
  document.getElementById('mix-r-prod').textContent = totalProdOz > 0 ? totalProdOz.toFixed(1) + ' oz' : '—';

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
    const initialFillGal = Math.max(fill * 0.5, fill - totalLiquidGal - 1);

    const partialLabel = isPartial ? ' (partial fill)' : '';
    let summary = 'You\'re mixing <strong>' + fill + ' gallons' + partialLabel + '</strong> total. ';
    summary += 'Start by filling the tank to about <strong>' + initialFillGal.toFixed(0) + ' gallons</strong> of water, ';
    summary += 'add your products (totaling ' + totalProdOz.toFixed(1) + ' oz), ';
    summary += 'then top off to <strong>' + fill + ' gallons</strong>.';
    document.getElementById('mix-summary').innerHTML = summary;

    let steps = '', stepNum = 1;
    steps += '<div class="mix-step"><div class="mix-step-num">' + (stepNum++) + '</div><div class="mix-step-text">Put about <strong>' + initialFillGal.toFixed(0) + ' gallons</strong> of clean water in the tank.</div></div>';
    steps += '<div class="mix-step"><div class="mix-step-num">' + (stepNum++) + '</div><div class="mix-step-text"><strong>Turn on the agitator</strong> and leave it running the whole time you\'re mixing.</div></div>';

    formOrder.forEach(f => {
      const prods = fullList.filter(p => p.form === f);
      if (prods.length === 0) return;
      const prodList = prods.map(p => '<strong>' + p.actual + ' oz</strong> of ' + p.name).join(', ');
      let note = '';
      if (f === 'WP') note = ' Mix it in a bucket with some water first to make a slurry, then pour it in slowly.';
      else if (f === 'DF') note = ' Pour it in slowly and let it dissolve completely before adding the next product.';
      else if (f === 'L') note = ' Pour in slowly while the agitator is running.';
      else if (f === 'EC') note = ' Pour in slowly — this type can foam up.';
      else if (f === 'SURF') note = ' Always add this one last so it doesn\'t foam up.';
      steps += '<div class="mix-step"><div class="mix-step-num">' + (stepNum++) + '</div><div class="mix-step-text">Put in ' + prodList + '.' + note + '</div></div>';
    });

    steps += '<div class="mix-step"><div class="mix-step-num">' + (stepNum++) + '</div><div class="mix-step-text">Fill the rest of the tank with water up to <strong>' + fill + ' gallons</strong> total.</div></div>';
    steps += '<div class="mix-step"><div class="mix-step-num">' + (stepNum++) + '</div><div class="mix-step-text">Let the agitator run for 2-3 more minutes, then you\'re ready to spray. Keep the agitator on while spraying.</div></div>';
    document.getElementById('mix-steps').innerHTML = steps;

    // Product summary cards
    let prodHTML = '';
    prodDetails.forEach(p => {
      const rateLabel = p.rate + ' ' + (p.unit === 'oz_per_k' ? 'oz per 1,000 sqft' : 'oz per gallon');
      prodHTML += di('Put in ' + p.name, p.actual + ' oz', rateLabel);
    });
    document.getElementById('mix-prod-grid').innerHTML =
      di('Total product to add', totalProdOz.toFixed(1) + ' oz', 'into ' + fill + ' gal of water', true) + prodHTML;

    // Warnings
    const warnEl = document.getElementById('mix-warning');
    let warnings = [];
    const productPct = (totalProdOz / (fill * 128)) * 100;
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

// ─── Transfer Tab Products ───
let xferProdId = 0;

function addXferProduct(name, rate, unit, form) {
  const id = 'xp' + (xferProdId++);
  const div = document.createElement('div');
  div.className = 'prod-row'; div.id = id;
  div.innerHTML =
    '<input type="text" class="pname" placeholder="Product name" value="' + (name || '') + '" oninput="calcDilution()">' +
    '<input type="number" class="prate" min="0" step="0.25" value="' + (rate !== undefined ? rate : 1) + '" oninput="calcDilution()">' +
    '<select class="punit" onchange="calcDilution()">' +
      '<option value="oz_per_k"' + (unit === 'oz_per_k' || !unit ? ' selected' : '') + '>oz / 1,000 sqft</option>' +
      '<option value="oz_per_gal"' + (unit === 'oz_per_gal' ? ' selected' : '') + '>oz / gal</option>' +
    '</select>' +
    '<select class="pform" onchange="calcDilution()" title="Formulation type">' +
      '<option value="WP"' + (form === 'WP' ? ' selected' : '') + '>Wettable Powder</option>' +
      '<option value="DF"' + (form === 'DF' ? ' selected' : '') + '>Dry Flowable</option>' +
      '<option value="L"' + (form === 'L' || !form ? ' selected' : '') + '>Liquid / SC</option>' +
      '<option value="EC"' + (form === 'EC' ? ' selected' : '') + '>Emulsifiable</option>' +
      '<option value="SURF"' + (form === 'SURF' ? ' selected' : '') + '>Surfactant / Adj</option>' +
    '</select>' +
    '<button class="btn-x" onclick="removeXferProduct(\'' + id + '\')" title="Remove">×</button>';
  document.getElementById('xfer-products').appendChild(div);
  calcDilution();
}

function removeXferProduct(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
  calcDilution();
}

function getXferProducts() {
  const rows = document.querySelectorAll('#xfer-products .prod-row');
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

function addXferFromPreset() {
  const sel = document.getElementById('xfer-preset-select');
  const idx = parseInt(sel.value);
  if (isNaN(idx) || !presets[idx]) return;
  const p = presets[idx];
  addXferProduct(p.name, p.rate, p.unit, p.form);
  sel.value = '';
}

function renderXferPresetDropdown() {
  const sel = document.getElementById('xfer-preset-select');
  sel.innerHTML = '<option value="">— Select a saved product —</option>';
  const formLabels = { WP: 'Powder', DF: 'Dry Flow.', L: 'Liquid', EC: 'Emulsif.', SURF: 'Surfactant' };
  presets.forEach((p, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    const unitLabel = p.unit === 'oz_per_k' ? 'oz/1k' : 'oz/gal';
    opt.textContent = p.name + '  (' + p.rate + ' ' + unitLabel + ', ' + formLabels[p.form] + ')';
    sel.appendChild(opt);
  });
}

// ─── Transfer Calculator ───
function calcDilution() {
  const sourceRate = parseFloat(document.getElementById('bp-source-rate').value) || 0.5;
  const targetRate = parseFloat(document.getElementById('bp-target-rate').value) || 1;
  const bpFill = parseFloat(document.getElementById('bp-fill').value) || 4;
  const srcName = document.getElementById('xfer-source-name').value.trim() || 'Source';
  const tgtName = document.getElementById('xfer-target-name').value.trim() || 'Target';

  const resultsEl = document.getElementById('bp-results');
  const gridEl = document.getElementById('bp-grid');
  const stepsEl = document.getElementById('bp-steps');

  if (sourceRate <= 0 || targetRate <= 0 || bpFill <= 0) {
    resultsEl.style.display = 'none';
    return;
  }

  const coverageSqFt = Math.round((bpFill / targetRate) * 1000);
  resultsEl.style.display = 'block';

  // Same rate — just pour straight
  if (Math.abs(sourceRate - targetRate) < 0.001) {
    gridEl.innerHTML =
      di('Take from ' + srcName, bpFill.toFixed(1) + ' gal', 'pour it straight in', true) +
      di('This will cover', coverageSqFt.toLocaleString() + ' sq ft', 'at ' + targetRate + ' gal/1k');
    stepsEl.innerHTML = '<div class="mix-step"><div class="mix-step-num">1</div><div class="mix-step-text">Just pour <strong>' + bpFill.toFixed(1) + ' gallons</strong> from the ' + srcName + ' right into the ' + tgtName + '. Both sprayers run the same rate so nothing needs to change.</div></div>';
    return;
  }

  // sourceRate < targetRate → Source is MORE concentrated → dilute with water
  if (sourceRate < targetRate) {
    const ratio = sourceRate / targetRate;
    const mixNeeded = bpFill * ratio;
    const waterToAdd = bpFill - mixNeeded;

    gridEl.innerHTML =
      di('Take from ' + srcName, mixNeeded.toFixed(1) + ' gal', 'of the mixed solution', true) +
      di('Add water', waterToAdd.toFixed(1) + ' gal', 'plain clean water', true) +
      di('Total in ' + tgtName, bpFill.toFixed(1) + ' gal', 'ready to spray') +
      di('This will cover', coverageSqFt.toLocaleString() + ' sq ft', 'at ' + targetRate + ' gal/1k');

    let steps = '';
    steps += '<div class="mix-step"><div class="mix-step-num">1</div><div class="mix-step-text">Take <strong>' + mixNeeded.toFixed(1) + ' gallons</strong> of the mixed solution out of the ' + srcName + '.</div></div>';
    steps += '<div class="mix-step"><div class="mix-step-num">2</div><div class="mix-step-text">Pour it into the ' + tgtName + '.</div></div>';
    steps += '<div class="mix-step"><div class="mix-step-num">3</div><div class="mix-step-text">Add <strong>' + waterToAdd.toFixed(1) + ' gallons</strong> of clean water so the ' + tgtName + ' has <strong>' + bpFill.toFixed(1) + ' gallons</strong> total.</div></div>';
    steps += '<div class="mix-step"><div class="mix-step-num">4</div><div class="mix-step-text">Shake or agitate to mix it up. You\'re good to spray — products are at the right strength for the ' + tgtName + '.</div></div>';
    stepsEl.innerHTML = steps;
    return;
  }

  // sourceRate > targetRate → Source is LESS concentrated → need to boost with extra product
  const products = getXferProducts();

  if (products.length === 0) {
    gridEl.innerHTML =
      di('⚠ Need your products', '—', 'Add them in Source Tank Contents above', true);
    stepsEl.innerHTML = '<div class="mix-step"><div class="mix-step-num">!</div><div class="mix-step-text">The ' + srcName + ' mix isn\'t strong enough for the ' + tgtName + '. I need to know what products are in the tank to tell you how much extra to add. Fill in the <strong>Source Tank Contents</strong> section above.</div></div>';
    return;
  }

  const coverageInMix = (bpFill / sourceRate) * 1000;
  const coverageNeeded = (bpFill / targetRate) * 1000;

  let boostDetails = [];
  let totalExtraOz = 0;
  products.forEach(p => {
    if (p.unit === 'oz_per_k') {
      const haveOz = (coverageInMix / 1000) * p.rate;
      const needOz = (coverageNeeded / 1000) * p.rate;
      const extraOz = Math.round((needOz - haveOz) * 10) / 10;
      if (extraOz > 0) {
        boostDetails.push({ name: p.name, extra: extraOz, rate: p.rate, unit: 'oz/1k' });
        totalExtraOz += extraOz;
      }
    }
  });

  let gridHTML =
    di('Take from ' + srcName, bpFill.toFixed(1) + ' gal', 'all of it goes in', true) +
    di('Add water', 'None', 'don\'t add any water') +
    di('This will cover', coverageSqFt.toLocaleString() + ' sq ft', 'at ' + targetRate + ' gal/1k');

  if (boostDetails.length > 0) {
    gridHTML += di('Extra product to add', totalExtraOz.toFixed(1) + ' oz total', 'to make it strong enough', true);
    boostDetails.forEach(b => {
      gridHTML += di('Add more ' + b.name, b.extra + ' oz', 'on top of what\'s already in there');
    });
  }
  gridEl.innerHTML = gridHTML;

  let steps = '';
  steps += '<div class="mix-step"><div class="mix-step-num">1</div><div class="mix-step-text">Take <strong>' + bpFill.toFixed(1) + ' gallons</strong> of the mixed solution from the ' + srcName + ' and pour it into the ' + tgtName + '.</div></div>';

  if (boostDetails.length > 0) {
    const prodList = boostDetails.map(b => '<strong>' + b.extra + ' oz</strong> of ' + b.name).join(', ');
    steps += '<div class="mix-step"><div class="mix-step-num">2</div><div class="mix-step-text">Now add extra product to the ' + tgtName + ': ' + prodList + '. This makes up for the ' + tgtName + ' needing a stronger mix.</div></div>';
    steps += '<div class="mix-step"><div class="mix-step-num">3</div><div class="mix-step-text">Shake or agitate the ' + tgtName + ' well so everything dissolves.</div></div>';
    steps += '<div class="mix-step"><div class="mix-step-num">4</div><div class="mix-step-text">You\'re good to spray. The ' + tgtName + ' is now at the right strength for <strong>' + targetRate + ' gal/1k</strong>.</div></div>';
  } else {
    steps += '<div class="mix-step"><div class="mix-step-num">2</div><div class="mix-step-text">No extra product needed. Your products are measured per gallon, so they\'re already at the right strength.</div></div>';
  }

  stepsEl.innerHTML = steps;
  saveState();
}

// ─── Granular Calculator ───
function calcGranular() {
  const name = document.getElementById('gran-name').value.trim() || 'Product';
  const rate = parseFloat(document.getElementById('gran-rate').value) || 0;
  const area = parseFloat(document.getElementById('gran-area').value) || 0;
  const bagSize = parseFloat(document.getElementById('gran-bag').value) || 50;
  const hopperCap = parseFloat(document.getElementById('gran-hopper').value) || 100;

  const resultsEl = document.getElementById('gran-results');
  const summaryEl = document.getElementById('gran-summary');
  const gridEl = document.getElementById('gran-grid');

  if (rate <= 0 || area <= 0) {
    resultsEl.style.display = 'none';
    return;
  }

  const lbsNeeded = (area / 1000) * rate;
  const bagsNeeded = lbsNeeded / bagSize;
  const fullBags = Math.floor(bagsNeeded);
  const partialBagLbs = Math.round((bagsNeeded - fullBags) * bagSize * 10) / 10;
  const hopperLoads = Math.ceil(lbsNeeded / hopperCap);
  const areaPerHopper = Math.round(hopperCap / rate * 1000);
  const lbsPerLoad = Math.min(lbsNeeded, hopperCap);

  resultsEl.style.display = 'block';

  // Plain English summary
  let summary = '';
  if (lbsNeeded <= hopperCap) {
    summary = 'Put <strong>' + lbsNeeded.toFixed(1) + ' lbs</strong> of ' + name + ' in the hopper. ';
    summary += 'That\'s enough to cover your <strong>' + area.toLocaleString() + ' sq ft</strong> in one load.';
  } else {
    summary = 'You need <strong>' + lbsNeeded.toFixed(1) + ' lbs</strong> of ' + name + ' total for <strong>' + area.toLocaleString() + ' sq ft</strong>. ';
    summary += 'That\'s <strong>' + hopperLoads + ' hopper loads</strong> — fill the hopper to <strong>' + hopperCap + ' lbs</strong> each time. ';
    summary += 'Each full hopper covers about <strong>' + areaPerHopper.toLocaleString() + ' sq ft</strong>.';
  }
  summaryEl.innerHTML = summary;

  // Results grid
  let gridHTML =
    di('Product to put down', lbsNeeded.toFixed(1) + ' lbs', 'of ' + name, true) +
    di('Area you\'re covering', area.toLocaleString() + ' sq ft', 'at ' + rate + ' lbs/1k') +
    di('Hopper loads', hopperLoads + '', hopperLoads === 1 ? 'just one fill' : hopperCap + ' lbs each');

  if (bagSize > 0) {
    if (fullBags > 0 && partialBagLbs > 0) {
      gridHTML += di('Bags needed', fullBags + ' full + ' + partialBagLbs + ' lbs', bagSize + ' lb bags');
    } else if (fullBags > 0) {
      gridHTML += di('Bags needed', fullBags + ' full', bagSize + ' lb bags');
    } else {
      gridHTML += di('From one bag', lbsNeeded.toFixed(1) + ' lbs', 'out of a ' + bagSize + ' lb bag');
    }
  }

  if (hopperLoads > 1) {
    const lastLoadLbs = Math.round((lbsNeeded - (hopperLoads - 1) * hopperCap) * 10) / 10;
    gridHTML += di('Last hopper load', lastLoadLbs + ' lbs', 'don\'t overfill');
  }

  gridEl.innerHTML = gridHTML;
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
      mixFill: document.getElementById('mixFill').value,
      mixFillManual: document.getElementById('mixFill').dataset.manual || '',
      mixProducts: mixRows.map(r => ({
        name: r.querySelector('.pname').value,
        rate: r.querySelector('.prate').value,
        unit: r.querySelector('.punit').value,
        form: r.querySelector('.pform').value
      })),
      // Transfer tab
      xferSourceName: document.getElementById('xfer-source-name').value,
      xferSourceRate: document.getElementById('bp-source-rate').value,
      xferTargetName: document.getElementById('xfer-target-name').value,
      xferTargetRate: document.getElementById('bp-target-rate').value,
      xferFill: document.getElementById('bp-fill').value,
      xferProducts: [...document.querySelectorAll('#xfer-products .prod-row')].map(r => ({
        name: r.querySelector('.pname').value,
        rate: r.querySelector('.prate').value,
        unit: r.querySelector('.punit').value,
        form: r.querySelector('.pform').value
      })),
      // Granular tab
      granName: document.getElementById('gran-name').value,
      granRate: document.getElementById('gran-rate').value,
      granArea: document.getElementById('gran-area').value,
      granBag: document.getElementById('gran-bag').value,
      granHopper: document.getElementById('gran-hopper').value
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
    if (d.mixFill) document.getElementById('mixFill').value = d.mixFill;
    if (d.mixFillManual) document.getElementById('mixFill').dataset.manual = d.mixFillManual;

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
    }

    // Set mix tank mode
    if (d.mixTankMode !== undefined) setMixTank(d.mixTankMode === 'c' ? 'c' : parseInt(d.mixTankMode));

    // Transfer tab
    if (d.xferSourceName) document.getElementById('xfer-source-name').value = d.xferSourceName;
    if (d.xferSourceRate) document.getElementById('bp-source-rate').value = d.xferSourceRate;
    if (d.xferTargetName) document.getElementById('xfer-target-name').value = d.xferTargetName;
    if (d.xferTargetRate) document.getElementById('bp-target-rate').value = d.xferTargetRate;
    if (d.xferFill) document.getElementById('bp-fill').value = d.xferFill;
    if (d.xferProducts && d.xferProducts.length > 0) {
      d.xferProducts.forEach(p => addXferProduct(p.name, p.rate, p.unit, p.form));
    }

    // Granular tab
    if (d.granName) document.getElementById('gran-name').value = d.granName;
    if (d.granRate) document.getElementById('gran-rate').value = d.granRate;
    if (d.granArea) document.getElementById('gran-area').value = d.granArea;
    if (d.granBag) document.getElementById('gran-bag').value = d.granBag;
    if (d.granHopper) document.getElementById('gran-hopper').value = d.granHopper;

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
    calcCal();
    calcMix();
  } else {
    calcCal();
    calcMix();
  }
}
init();
