const { geometries, presets, draw } = window.CrosshairCore;
const DEFAULTS = {
  presetId: 'cross-01',
  color: '#ffffff',
  outlineColor: '#05070a',
  rainbow: false,
  rainbowSpeed: 1,
  spinSpeed: 100,
  spinning: false,
  spinDirection: 1,
  rotation: 0,
  size: 17,
  thickness: 1,
  gap: 1,
  opacity: 100,
  outline: 1,
  centerDot: false,
  positionX: 0,
  positionY: 0,
  scale: 100,
  glowIntensity: 0,
  shadowStrength: 8,
  pulse: false,
  imageData: '',
  imageName: '',
  overlayEnabled: true,
  allDisplays: true,
  hotkey: 'CommandOrControl+Alt+X',
  startAtLogin: false,
  favorites: [],
  recentPresets: []
};
const RANGE_CONTROLS = {
  'dashboard-size': ['size', 'dashboard-size-value', (value) => `${value} px`],
  'dashboard-gap': ['gap', 'dashboard-gap-value', (value) => `${value} px`],
  'quick-thickness': ['thickness', 'quick-thickness-value', (value) => `${value} px`],
  'quick-opacity': ['opacity', 'quick-opacity-value', (value) => `${value}%`],
  'quick-spin-speed': ['spinSpeed', 'quick-spin-value', (value) => `${value}°/s`],
  size: ['size', 'size-value', (value) => `${value} px`],
  thickness: ['thickness', 'thickness-value', (value) => `${value} px`],
  gap: ['gap', 'gap-value', (value) => `${value} px`],
  opacity: ['opacity', 'opacity-value', (value) => `${value}%`],
  outline: ['outline', 'outline-value', (value) => `${value} px`],
  'position-x': ['positionX', 'position-x-value', (value) => `${value}%`],
  'position-y': ['positionY', 'position-y-value', (value) => `${value}%`],
  rotation: ['rotation', 'rotation-input-value', (value) => `${value}°`],
  'spin-speed': ['spinSpeed', 'spin-speed-value', (value) => `${value}°/s`],
  'effects-spin-speed': ['spinSpeed', 'effects-spin-speed-value', (value) => `${value}°/s`],
  scale: ['scale', 'scale-value', (value) => `${value}%`],
  'rainbow-speed': ['rainbowSpeed', 'rainbow-speed-value', (value) => `${Number(value).toFixed(1)}×`],
  'glow-intensity': ['glowIntensity', 'glow-intensity-value', (value) => `${value} px`],
  'shadow-strength': ['shadowStrength', 'shadow-strength-value', (value) => `${value} px`]
};
const canvases = ['dashboard-canvas', 'custom-canvas', 'effects-canvas'];
let settings = { ...DEFAULTS };
let savedDesigns = [];
let currentPage = 'library';
let libraryScope = 'featured';
let geometryFilter = 'all';
let librarySearch = '';
let savedSearch = '';
let compareMode = false;
let history = [];
let future = [];
let saveTimer;
let toastTimer;
let previousFrameTime = 0;

const byId = (id) => document.getElementById(id);
const clone = (value) => JSON.parse(JSON.stringify(value));
const selectedPreset = () => presets.find((preset) => preset.id === settings.presetId) || presets[0];

function showToast(message) {
  const toast = byId('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function queueSave() {
  const indicator = byId('save-indicator');
  indicator.classList.add('saving');
  indicator.querySelector('span').textContent = 'SAVING CHANGES';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      const saved = await window.crosshairApp.saveSettings(settings);
      settings = { ...settings, ...saved };
      indicator.classList.remove('saving');
      indicator.querySelector('span').textContent = 'ALL CHANGES SAVED';
    } catch (error) {
      console.error('Could not save crosshair settings:', error);
      indicator.querySelector('span').textContent = 'SAVE FAILED';
      showToast('Could not save settings. Check the app data folder permissions.');
    }
  }, 180);
}

function updateHistoryButtons() {
  byId('undo-button').disabled = history.length === 0;
  byId('redo-button').disabled = future.length === 0;
  byId('history-count').textContent = `${history.length} / ${future.length}`;
}

function commit(nextSettings, { checkpoint = true, persist = true, redrawLibrary = false } = {}) {
  const next = { ...settings, ...nextSettings };
  if (JSON.stringify(next) === JSON.stringify(settings)) return;
  if (checkpoint) {
    history.push(clone(settings));
    if (history.length > 60) history.shift();
    future = [];
  }
  settings = next;
  updateControls();
  updateHistoryButtons();
  if (redrawLibrary) renderLibrary();
  if (persist) queueSave();
}

function undo() {
  if (!history.length) return;
  future.push(clone(settings));
  settings = history.pop();
  updateControls();
  updateHistoryButtons();
  renderLibrary();
  queueSave();
}

function redo() {
  if (!future.length) return;
  history.push(clone(settings));
  settings = future.pop();
  updateControls();
  updateHistoryButtons();
  renderLibrary();
  queueSave();
}

function setPage(page) {
  if (!byId(`page-${page}`)) return;
  currentPage = page;
  document.querySelectorAll('.page').forEach((item) => item.classList.toggle('active', item.id === `page-${page}`));
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.page === page));
  const pageNames = {
    dashboard: 'Dashboard',
    library: 'Crosshair Library',
    customize: 'Customize',
    effects: 'Effects',
    image: 'Image Upload',
    advanced: 'Advanced Settings',
    saved: 'Saved Crosshairs'
  };
  byId('breadcrumb-current').textContent = pageNames[page] || 'Crosshair Library';
  byId('import-button').classList.toggle('hidden', page !== 'advanced' && page !== 'saved');
  document.body.classList.remove('focused-preview');
}

function setRange(input, value) {
  if (!input) return;
  input.value = value;
  const min = Number(input.min);
  const max = Number(input.max);
  const amount = max > min ? (Number(value) - min) / (max - min) * 100 : 0;
  input.style.setProperty('--fill', `${Math.min(100, Math.max(0, amount))}%`);
}

function updateControls() {
  for (const [id, [key, outputId, format]] of Object.entries(RANGE_CONTROLS)) {
    const input = byId(id);
    if (!input) continue;
    setRange(input, settings[key]);
    if (outputId) byId(outputId).textContent = format(settings[key]);
  }
  byId('quick-rainbow-state').textContent = settings.rainbow ? 'On' : 'Off';
  byId('quick-rainbow').classList.toggle('active', settings.rainbow);
  byId('rainbow-toggle').checked = settings.rainbow;
  byId('pulse-toggle').checked = settings.pulse;
  byId('center-dot').checked = settings.centerDot;
  byId('glow-toggle').checked = Number(settings.glowIntensity) > 0;
  byId('show-overlay').checked = settings.overlayEnabled;
  byId('show-overlay-advanced').checked = settings.overlayEnabled;
  byId('all-displays').checked = settings.allDisplays;
  byId('start-at-login').checked = settings.startAtLogin;
  byId('spin-direction').value = String(settings.spinDirection);
  byId('hotkey-select').value = settings.hotkey;
  byId('color-picker').value = settings.color;
  byId('color-hex').value = settings.color.toUpperCase();
  byId('color-label').textContent = settings.color.toUpperCase();
  byId('outline-picker').value = settings.outlineColor;
  byId('outline-hex').value = settings.outlineColor.toUpperCase();
  byId('outline-color-label').textContent = settings.outlineColor.toUpperCase();
  byId('shape-select').value = selectedPreset().type;
  byId('quick-shape').value = selectedPreset().type;
  byId('spin-toggle').textContent = settings.spinning ? 'Ⅱ Pause spinning' : '▶ Start spinning';
  byId('custom-spin-toggle').textContent = settings.spinning ? 'Ⅱ Pause spinning' : '▶ Start spinning';
  byId('effects-spin-toggle').textContent = settings.spinning ? 'Ⅱ Pause' : '▶ Start';
  byId('animation-state').textContent = settings.spinning ? 'Rotation is running' : 'Rotation is paused';
  byId('rotation-value').textContent = `${Math.round(settings.rotation)}° · ${settings.spinning ? 'spinning' : 'paused'}`;
  byId('active-design').textContent = selectedPreset().name;
  byId('color-style').innerHTML = `${settings.rainbow ? 'Rainbow' : colorName(settings.color)} <small>${settings.rainbow ? 'cycling' : 'optional rainbow'}</small>`;
  byId('keep-on-button').classList.toggle('active', settings.overlayEnabled);
  byId('saved-count-dashboard').textContent = String(savedDesigns.length);
  byId('library-count').textContent = '11';
  if (settings.imageData) {
    byId('uploaded-file').classList.remove('hidden');
    byId('uploaded-preview').src = settings.imageData;
    byId('uploaded-name').textContent = settings.imageName || 'Custom image';
    byId('drop-zone').classList.add('hidden');
  } else {
    byId('uploaded-file').classList.add('hidden');
    byId('drop-zone').classList.remove('hidden');
  }
}

function colorName(color) {
  const known = { '#ffffff': 'White', '#55b9e8': 'Blue', '#62f5c2': 'Mint', '#ff4f81': 'Pink', '#ffdc51': 'Yellow' };
  return known[color.toLowerCase()] || 'Custom';
}

function fillShapeSelects() {
  for (const id of ['quick-shape', 'shape-select']) {
    const select = byId(id);
    select.replaceChildren(...geometries.map((geometry) => {
      const option = document.createElement('option');
      option.value = geometry.type;
      option.textContent = geometry.name;
      return option;
    }));
  }
}

function defaultPreset(type) {
  return presets.find((preset) => preset.type === type) || presets[0];
}

function choosePreset(id) {
  const preset = presets.find((item) => item.id === id);
  if (!preset) return;
  const recent = [id, ...(settings.recentPresets || []).filter((item) => item !== id)].slice(0, 15);
  commit({
    presetId: id,
    size: preset.size,
    thickness: preset.thickness,
    gap: preset.gap,
    outline: preset.outline,
    centerDot: preset.centerDot,
    imageData: '',
    imageName: '',
    recentPresets: recent
  });
  renderLibrary();
  showToast(`${preset.name} selected`);
}

function toggleFavorite(id) {
  const favorites = new Set(settings.favorites || []);
  if (favorites.has(id)) favorites.delete(id);
  else favorites.add(id);
  commit({ favorites: [...favorites] }, { redrawLibrary: true });
}

function renderLibrary() {
  const container = byId('preset-grid');
  const favorites = new Set(settings.favorites || []);
  let visible = presets.filter((preset) => {
    if (libraryScope === 'featured' && !preset.featured) return false;
    if (libraryScope === 'recent' && !(settings.recentPresets || []).includes(preset.id)) return false;
    if (geometryFilter === 'favorites' && !favorites.has(preset.id)) return false;
    return `${preset.name} ${preset.type}`.toLowerCase().includes(librarySearch);
  });
  if (libraryScope === 'recent') {
    const order = settings.recentPresets || [];
    visible.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  }
  container.replaceChildren();
  byId('result-count').textContent = `${visible.length} ${visible.length === 1 ? 'design' : 'designs'}`;
  byId('empty-state').classList.toggle('hidden', visible.length > 0);

  for (const preset of visible) {
    const card = document.createElement('article');
    card.className = `preset-card${settings.presetId === preset.id ? ' selected' : ''}`;
    const button = document.createElement('button');
    button.className = 'favorite-button';
    button.classList.toggle('favorited', favorites.has(preset.id));
    button.title = favorites.has(preset.id) ? 'Remove favorite' : 'Add to favorites';
    button.setAttribute('aria-label', button.title);
    button.textContent = favorites.has(preset.id) ? '♥' : '♡';
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleFavorite(preset.id);
    });
    const wrap = document.createElement('div');
    wrap.className = 'card-canvas-wrap';
    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 96;
    wrap.appendChild(canvas);
    const name = document.createElement('strong');
    name.className = 'preset-name';
    name.textContent = preset.name;
    const meta = document.createElement('span');
    meta.className = 'preset-meta';
    meta.textContent = preset.type;
    card.append(button, wrap, name, meta);
    card.addEventListener('click', () => choosePreset(preset.id));
    container.appendChild(card);
    const context = canvas.getContext('2d');
    context.translate(canvas.width / 2, canvas.height / 2);
    draw(context, { ...settings, ...preset, imageData: '', color: '#f5f4ed', outlineColor: '#05070a', opacity: 100, scale: 100, glowIntensity: 5, spinning: false, rotation: 0 }, performance.now() / 1000);
  }
}

function renderSavedDesigns() {
  const container = byId('saved-list');
  const needle = savedSearch.toLowerCase();
  const visible = savedDesigns.filter((design) => design.name.toLowerCase().includes(needle));
  container.replaceChildren();
  byId('saved-empty').classList.toggle('hidden', visible.length > 0);
  byId('saved-count-dashboard').textContent = String(savedDesigns.length);
  for (const design of visible) {
    const row = document.createElement('article');
    row.className = 'saved-item';
    const preview = document.createElement('canvas');
    preview.className = 'saved-preview';
    preview.width = 90;
    preview.height = 80;
    const context = preview.getContext('2d');
    context.translate(45, 40);
    draw(context, { ...design.settings, imageData: '' }, performance.now() / 1000);
    const info = document.createElement('div');
    info.className = 'saved-info';
    const name = document.createElement('strong');
    name.textContent = design.name;
    const details = document.createElement('small');
    const preset = presets.find((item) => item.id === design.settings.presetId);
    details.textContent = `${preset ? preset.name : 'Custom'} · ${design.settings.color} / ${design.settings.outlineColor} outline`;
    info.append(name, details);
    const actions = document.createElement('div');
    actions.className = 'saved-actions';
    const makeAction = (label, action) => {
      const button = document.createElement('button');
      button.className = 'secondary-button';
      button.textContent = label;
      button.addEventListener('click', action);
      return button;
    };
    actions.append(
      makeAction('Load', () => { commit({ ...design.settings }); setPage('dashboard'); showToast(`${design.name} loaded`); }),
      makeAction('Rename', () => renameDesign(design.id)),
      makeAction('Duplicate', () => duplicateDesign(design.id)),
      makeAction('Delete', () => deleteDesign(design.id))
    );
    row.append(preview, info, actions);
    container.appendChild(row);
  }
}

async function persistDesigns() {
  try {
    savedDesigns = await window.crosshairApp.saveDesigns(savedDesigns);
    renderSavedDesigns();
    updateControls();
  } catch (error) {
    console.error('Could not save crosshair designs:', error);
    showToast('Could not save the design to this device.');
  }
}

function saveCurrentDesign(name = '') {
  const suggested = selectedPreset().name;
  const chosenName = (name || window.prompt('Name this crosshair design:', suggested) || '').trim();
  if (!chosenName) return;
  savedDesigns = [...savedDesigns, { id: crypto.randomUUID(), name: chosenName, settings: clone(settings) }];
  persistDesigns();
  showToast(`“${chosenName}” saved`);
}

function renameDesign(id) {
  const design = savedDesigns.find((item) => item.id === id);
  if (!design) return;
  const name = (window.prompt('Rename this crosshair:', design.name) || '').trim();
  if (!name) return;
  savedDesigns = savedDesigns.map((item) => item.id === id ? { ...item, name } : item);
  persistDesigns();
}

function duplicateDesign(id) {
  const design = savedDesigns.find((item) => item.id === id);
  if (!design) return;
  savedDesigns = [...savedDesigns, { id: crypto.randomUUID(), name: `${design.name} copy`, settings: clone(design.settings) }];
  persistDesigns();
  showToast('Design duplicated');
}

function deleteDesign(id) {
  const design = savedDesigns.find((item) => item.id === id);
  if (!design || !window.confirm(`Delete “${design.name}”?`)) return;
  savedDesigns = savedDesigns.filter((item) => item.id !== id);
  persistDesigns();
}

function exportConfig() {
  const content = JSON.stringify({ app: 'Stolen Crosshair', version: 1, settings, savedDesigns }, null, 2);
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'stolen-crosshair-config.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('Config exported to your Downloads folder');
}

function importConfig(file) {
  const reader = new FileReader();
  reader.onerror = () => showToast('Could not read that config file.');
  reader.onload = async () => {
    try {
      const config = JSON.parse(reader.result);
      if (!config.settings || typeof config.settings !== 'object') throw new Error('Missing settings');
      const saved = await window.crosshairApp.saveConfig(config);
      settings = { ...DEFAULTS, ...saved.settings };
      savedDesigns = saved.savedDesigns;
      history = [];
      future = [];
      updateControls();
      renderLibrary();
      renderSavedDesigns();
      updateHistoryButtons();
      showToast('Configuration imported');
    } catch (error) {
      console.error('Could not import configuration:', error);
      showToast('That config file is invalid or could not be imported.');
    }
  };
  reader.readAsText(file);
}

function randomizeDesign({ effects = false } = {}) {
  const preset = presets[Math.floor(Math.random() * presets.length)];
  const colors = ['#ffffff', '#55b9e8', '#ff598c', '#ffc857', '#62f5c2', '#b57aff', '#ff7552'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  if (effects) {
    commit({
      rainbow: Math.random() > 0.5,
      rainbowSpeed: Number((0.4 + Math.random() * 2.4).toFixed(1)),
      spinning: Math.random() > 0.35,
      spinSpeed: Math.round(30 + Math.random() * 280),
      spinDirection: Math.random() > 0.5 ? 1 : -1,
      glowIntensity: Math.round(Math.random() * 20),
      pulse: Math.random() > 0.6
    });
    return;
  }
  commit({
    presetId: preset.id,
    size: preset.size,
    thickness: preset.thickness,
    gap: preset.gap,
    outline: preset.outline,
    color,
    rainbow: Math.random() > 0.72,
    spinning: false
  });
  renderLibrary();
  showToast('Random design ready');
}

function setOverlayEnabled(enabled) {
  commit({ overlayEnabled: enabled });
}

function setShape(type) {
  const preset = defaultPreset(type);
  commit({
    presetId: preset.id,
    size: preset.size,
    thickness: preset.thickness,
    gap: preset.gap,
    outline: preset.outline,
    centerDot: preset.centerDot,
    imageData: '',
    imageName: ''
  });
  renderLibrary();
}

function bindRangeControls() {
  for (const [id, [key]] of Object.entries(RANGE_CONTROLS)) {
    const input = byId(id);
    if (!input) continue;
    input.addEventListener('input', () => {
      commit({ [key]: Number(input.value) });
      if (key === 'spinSpeed' && Number(input.value) === 0) commit({ spinning: false });
    });
  }
}

function setColor(key, value, hexId) {
  if (!/^#[0-9a-f]{6}$/i.test(value)) return;
  const patch = key === 'color' ? { color: value.toLowerCase(), rainbow: false } : { [key]: value.toLowerCase() };
  commit(patch);
  byId(hexId).value = value.toUpperCase();
}

function handleImage(file) {
  if (!file) return;
  if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
    showToast('Choose a PNG, JPG, WEBP, or GIF image.');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast('That image is too large. Choose a file under 5 MB.');
    return;
  }
  const reader = new FileReader();
  reader.onerror = () => showToast('Could not read that image.');
  reader.onload = () => {
    const image = new Image();
    image.onerror = () => showToast('That image could not be decoded.');
    image.onload = () => {
      commit({ imageData: reader.result, imageName: file.name });
      showToast('Custom crosshair image applied');
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function drawCanvas(canvas, time, compare = false) {
  const context = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, rect.width, rect.height);
  if (compare) {
    const alternate = presets.find((item) => item.id !== settings.presetId) || presets[1];
    context.save();
    context.translate(rect.width * .32, rect.height / 2);
    draw(context, settings, time);
    context.restore();
    context.save();
    context.translate(rect.width * .68, rect.height / 2);
    draw(context, { ...settings, ...alternate, imageData: '', size: settings.size, color: '#55b9e8' }, time);
    context.restore();
  } else {
    context.save();
    context.translate(rect.width / 2, rect.height / 2);
    draw(context, settings, time);
    context.restore();
  }
}

function animate(now) {
  const time = now / 1000;
  const delta = previousFrameTime ? Math.min(0.1, (now - previousFrameTime) / 1000) : 0;
  previousFrameTime = now;
  for (const id of canvases) {
    const canvas = byId(id);
    if (canvas.offsetParent) drawCanvas(canvas, time, id === 'dashboard-canvas' && compareMode);
  }
  if (settings.spinning) {
    settings.rotation = (settings.rotation + settings.spinSpeed * (settings.spinDirection === -1 ? -1 : 1) * delta) % 360;
    byId('rotation-value').textContent = `${Math.round(settings.rotation)}° · spinning`;
  }
  requestAnimationFrame(animate);
}

function bindEvents() {
  document.querySelectorAll('.nav-item').forEach((button) => button.addEventListener('click', () => setPage(button.dataset.page)));
  document.querySelectorAll('[data-go]').forEach((button) => button.addEventListener('click', () => setPage(button.dataset.go)));
  bindRangeControls();

  byId('geometry-filter').addEventListener('change', (event) => { geometryFilter = event.target.value; renderLibrary(); });
  byId('design-filter').addEventListener('change', (event) => { libraryScope = event.target.value; renderLibrary(); });
  byId('search').addEventListener('input', (event) => { librarySearch = event.target.value.trim().toLowerCase(); renderLibrary(); });
  byId('saved-search').addEventListener('input', (event) => { savedSearch = event.target.value.trim(); renderSavedDesigns(); });

  for (const id of ['shape-select', 'quick-shape']) byId(id).addEventListener('change', (event) => setShape(event.target.value));
  byId('color-picker').addEventListener('input', (event) => setColor('color', event.target.value, 'color-hex'));
  byId('color-hex').addEventListener('change', (event) => setColor('color', event.target.value.trim(), 'color-hex'));
  byId('outline-picker').addEventListener('input', (event) => setColor('outlineColor', event.target.value, 'outline-hex'));
  byId('outline-hex').addEventListener('change', (event) => setColor('outlineColor', event.target.value.trim(), 'outline-hex'));

  byId('center-dot').addEventListener('change', (event) => commit({ centerDot: event.target.checked }));
  byId('rainbow-toggle').addEventListener('change', (event) => commit({ rainbow: event.target.checked }));
  byId('pulse-toggle').addEventListener('change', (event) => commit({ pulse: event.target.checked }));
  byId('glow-toggle').addEventListener('change', (event) => commit({ glowIntensity: event.target.checked ? Math.max(8, settings.glowIntensity) : 0 }));
  byId('quick-rainbow').addEventListener('click', () => commit({ rainbow: !settings.rainbow }));
  byId('spin-toggle').addEventListener('click', () => commit({ spinning: !settings.spinning, spinSpeed: settings.spinSpeed || 100 }));
  byId('custom-spin-toggle').addEventListener('click', () => commit({ spinning: !settings.spinning, spinSpeed: settings.spinSpeed || 100 }));
  byId('effects-spin-toggle').addEventListener('click', () => commit({ spinning: !settings.spinning, spinSpeed: settings.spinSpeed || 100 }));
  byId('reverse-spin').addEventListener('click', () => commit({ spinDirection: settings.spinDirection * -1 }));
  byId('custom-reverse').addEventListener('click', () => commit({ spinDirection: settings.spinDirection * -1 }));
  byId('spin-direction').addEventListener('change', (event) => commit({ spinDirection: Number(event.target.value) }));
  for (const id of ['show-overlay', 'show-overlay-advanced']) byId(id).addEventListener('change', (event) => setOverlayEnabled(event.target.checked));
  byId('all-displays').addEventListener('change', (event) => commit({ allDisplays: event.target.checked }));
  byId('start-at-login').addEventListener('change', (event) => commit({ startAtLogin: event.target.checked }));
  byId('hotkey-select').addEventListener('change', (event) => commit({ hotkey: event.target.value }));
  byId('recenter-button').addEventListener('click', () => commit({ positionX: 0, positionY: 0 }));
  document.querySelectorAll('.range-reset').forEach((button) => button.addEventListener('click', () => {
    const keyById = { 'position-x': 'positionX', 'position-y': 'positionY', rotation: 'rotation', 'spin-speed': 'spinSpeed', scale: 'scale' };
    const key = keyById[button.dataset.reset];
    if (key) commit({ [key]: DEFAULTS[key] });
  }));
  byId('reset-settings').addEventListener('click', () => {
    const preset = selectedPreset();
    commit({ ...DEFAULTS, presetId: preset.id, size: preset.size, thickness: preset.thickness, gap: preset.gap, outline: preset.outline, centerDot: preset.centerDot });
    renderLibrary();
    showToast('Settings reset to this preset');
  });

  byId('randomize-button').addEventListener('click', () => randomizeDesign());
  byId('random-library').addEventListener('click', () => randomizeDesign());
  byId('create-design').addEventListener('click', () => {
    commit({ presetId: 'cross-01', size: 24, thickness: 2, gap: 4, outline: 1, color: '#ffffff', rainbow: false });
    setPage('customize');
    renderLibrary();
  });
  byId('random-effects').addEventListener('click', () => randomizeDesign({ effects: true }));
  byId('random-shape').addEventListener('click', () => randomizeDesign());
  byId('random-effects-motion').addEventListener('click', () => randomizeDesign({ effects: true }));
  byId('compare-button').addEventListener('click', () => {
    compareMode = !compareMode;
    byId('compare-label').classList.toggle('hidden', !compareMode);
    byId('compare-button').classList.toggle('active', compareMode);
  });
  byId('keep-on-button').addEventListener('click', () => setOverlayEnabled(true));
  byId('stage-focus').addEventListener('click', () => document.body.classList.toggle('focused-preview'));
  byId('stage-grid-toggle').addEventListener('click', () => document.querySelectorAll('.preview-stage').forEach((stage) => stage.classList.toggle('no-grid')));

  byId('save-current-button').addEventListener('click', () => saveCurrentDesign());
  byId('save-design-button').addEventListener('click', () => saveCurrentDesign());
  byId('save-current-saved').addEventListener('click', () => saveCurrentDesign());
  byId('undo-button').addEventListener('click', undo);
  byId('redo-button').addEventListener('click', redo);
  byId('export-button').addEventListener('click', exportConfig);
  byId('export-saved').addEventListener('click', exportConfig);
  byId('import-button').addEventListener('click', () => byId('config-file').click());
  byId('config-file').addEventListener('change', (event) => {
    if (event.target.files[0]) importConfig(event.target.files[0]);
    event.target.value = '';
  });

  byId('browse-image').addEventListener('click', (event) => { event.stopPropagation(); byId('image-file').click(); });
  byId('drop-zone').addEventListener('click', () => byId('image-file').click());
  byId('drop-zone').addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') byId('image-file').click(); });
  byId('image-file').addEventListener('change', (event) => { handleImage(event.target.files[0]); event.target.value = ''; });
  byId('remove-image').addEventListener('click', () => commit({ imageData: '', imageName: '' }));
  const dropZone = byId('drop-zone');
  for (const eventName of ['dragenter', 'dragover']) dropZone.addEventListener(eventName, (event) => { event.preventDefault(); dropZone.classList.add('drag-over'); });
  for (const eventName of ['dragleave', 'drop']) dropZone.addEventListener(eventName, (event) => { event.preventDefault(); dropZone.classList.remove('drag-over'); });
  dropZone.addEventListener('drop', (event) => handleImage(event.dataTransfer.files[0]));

  window.addEventListener('keydown', (event) => {
    const editing = ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName);
    if (event.key === '/' && !editing) {
      event.preventDefault();
      setPage('library');
      byId('search').focus();
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !editing) {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    }
    if (event.key === 'Escape') document.body.classList.remove('focused-preview');
  });

  window.crosshairApp.onSettings((nextSettings) => {
    settings = { ...settings, ...nextSettings };
    updateControls();
    renderLibrary();
  });
  window.crosshairApp.onSavedDesigns((designs) => {
    savedDesigns = designs;
    renderSavedDesigns();
    updateControls();
  });
}

async function initialize() {
  fillShapeSelects();
  bindEvents();
  try {
    const [savedSettings, saved] = await Promise.all([
      window.crosshairApp.getSettings(),
      window.crosshairApp.getSavedDesigns()
    ]);
    settings = { ...DEFAULTS, ...savedSettings };
    savedDesigns = saved;
  } catch (error) {
    console.error('Could not load saved app data:', error);
    showToast('Saved settings could not be loaded.');
  }
  if (!presets.some((preset) => preset.id === settings.presetId)) settings.presetId = DEFAULTS.presetId;
  setRange(byId('dashboard-size'), settings.size);
  setRange(byId('dashboard-gap'), settings.gap);
  setRange(byId('quick-thickness'), settings.thickness);
  setRange(byId('quick-opacity'), settings.opacity);
  setRange(byId('quick-spin-speed'), settings.spinSpeed);
  updateControls();
  updateHistoryButtons();
  renderLibrary();
  renderSavedDesigns();
  requestAnimationFrame(animate);
}

initialize();
