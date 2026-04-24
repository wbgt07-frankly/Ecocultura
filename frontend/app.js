'use strict';

let userPhotoFile   = null;
let userName        = '';
let selectedQuality = null;
let resultBlob      = null;
let resultImg       = null;
let pbarRAF         = null;
let pbarStartTime   = 0;
let landingTimers   = [];

const PBAR_DURATION_MS = 12000;

const QUALITY_ICONS = {
  juicy:   '💧',
  ripe:    '🍅',
  quality: '⭐',
  tasty:   '😋',
  natural: '🌿',
};

// ── Screens ──────────────────────────────────────────

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
  if (id === 'screen-landing') startLandingSequence();
}

// ── Landing ───────────────────────────────────────────

function startLandingSequence() {
  landingTimers.forEach(t => clearTimeout(t));
  landingTimers = [];

  ['title-1', 'title-2', 'title-3'].forEach(id => {
    document.getElementById(id).className = 'title-line';
  });
  document.getElementById('land-btn-wrap').classList.remove('visible');

  const sequence = [
    { id: 'title-1', showAt: 3700, hideAt: 5700 },
    { id: 'title-2', showAt: 5700, hideAt: 8700 },
    { id: 'title-3', showAt: 8700, hideAt: 11700 },
  ];

  sequence.forEach(({ id, showAt, hideAt }) => {
    landingTimers.push(setTimeout(() => {
      const el = document.getElementById(id);
      el.classList.remove('title-out');
      el.classList.add('title-in');
    }, showAt));
    landingTimers.push(setTimeout(() => {
      const el = document.getElementById(id);
      el.classList.remove('title-in');
      el.classList.add('title-out');
    }, hideAt - 700));
  });

  landingTimers.push(setTimeout(() => {
    document.getElementById('land-btn-wrap').classList.add('visible');
  }, 11700));
}

// ── File / photo handling ─────────────────────────────

const uploadZone     = document.getElementById('upload-zone');
const fileInput      = document.getElementById('file-input');
const preview        = document.getElementById('photo-preview');
const placeholder    = document.getElementById('upload-placeholder');
const btnNextUpload  = document.getElementById('btn-next-upload');
const btnSelfie      = document.getElementById('btn-selfie');
const btnCancelPhoto = document.getElementById('btn-cancel-photo');
const uploadMicro    = document.getElementById('upload-micro');
const uploadFoot     = document.getElementById('upload-foot');
const nameInputWrap  = document.getElementById('name-input-wrap');
const inputName      = document.getElementById('input-name');

function handlePhotoFile(file) {
  userPhotoFile = file;
  const reader = new FileReader();
  reader.onload = e => {
    preview.src = e.target.result;
    preview.classList.remove('hidden');
    placeholder.classList.add('hidden');
    btnCancelPhoto.classList.remove('hidden');
    btnSelfie.classList.add('hidden');
    uploadMicro.classList.add('hidden');
    nameInputWrap.classList.remove('hidden');
    uploadFoot.classList.remove('hidden');
    checkUploadReady();
  };
  reader.readAsDataURL(file);
}

function checkUploadReady() {
  btnNextUpload.disabled = !(userPhotoFile && inputName.value.trim().length > 0);
}

function resetUploadScreen() {
  userPhotoFile = null;
  userName = '';
  fileInput.value = '';
  preview.src = '';
  preview.classList.add('hidden');
  placeholder.classList.remove('hidden');
  btnCancelPhoto.classList.add('hidden');
  uploadFoot.classList.add('hidden');
  btnSelfie.classList.remove('hidden');
  uploadMicro.classList.remove('hidden');
  nameInputWrap.classList.add('hidden');
  inputName.value = '';
  btnNextUpload.disabled = true;
}

uploadZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) handlePhotoFile(fileInput.files[0]);
});

btnCancelPhoto.addEventListener('click', e => {
  e.stopPropagation();
  resetUploadScreen();
});

inputName.addEventListener('input', checkUploadReady);

btnSelfie.addEventListener('click', () => {
  const cam = document.createElement('input');
  cam.type    = 'file';
  cam.accept  = 'image/*';
  cam.capture = 'user';
  cam.addEventListener('change', () => {
    if (cam.files[0]) handlePhotoFile(cam.files[0]);
  });
  cam.click();
});

// ── Quality selection ─────────────────────────────────

async function loadQualities() {
  const grid = document.getElementById('quality-grid');
  grid.innerHTML = '';
  selectedQuality = null;
  document.getElementById('btn-generate').disabled = true;

  try {
    const resp = await fetch('/api/qualities');
    const qualities = await resp.json();

    qualities.forEach(q => {
      const card = document.createElement('button');
      card.className = 'quality-card';
      card.dataset.id = q.id;
      card.innerHTML = `
        <span class="qc-icon">${QUALITY_ICONS[q.id] || '🍅'}</span>
        <span class="qc-label">${q.label}</span>
      `;
      card.addEventListener('click', () => selectQuality(q.id));
      grid.appendChild(card);
    });
  } catch {
    grid.innerHTML = '<p class="emsg">Не удалось загрузить список качеств</p>';
  }
}

function selectQuality(id) {
  selectedQuality = id;
  document.querySelectorAll('.quality-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.id === id);
  });
  document.getElementById('btn-generate').disabled = false;
}

// ── Processing animation ──────────────────────────────

function startProgressBar() {
  const fill = document.querySelector('.pbar-fill');
  fill.style.transition = 'none';
  fill.style.width = '0%';
  pbarStartTime = performance.now();

  function tick(now) {
    const t = Math.min((now - pbarStartTime) / PBAR_DURATION_MS, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    fill.style.width = (eased * 88) + '%';
    if (t < 1) pbarRAF = requestAnimationFrame(tick);
  }
  pbarRAF = requestAnimationFrame(tick);
}

function completeProgressBar() {
  if (pbarRAF) { cancelAnimationFrame(pbarRAF); pbarRAF = null; }
  const fill = document.querySelector('.pbar-fill');
  fill.style.transition = 'width 0.5s ease-out';
  fill.style.width = '100%';
}

// ── API call ──────────────────────────────────────────

async function doSwap() {
  showScreen('screen-processing');
  startProgressBar();

  const form = new FormData();
  form.append('user_photo', userPhotoFile);
  form.append('quality', selectedQuality);
  form.append('user_name', userName);

  try {
    const resp = await fetch('/api/swap', { method: 'POST', body: form });

    if (!resp.ok) {
      let msg = 'Ошибка обработки. Попробуйте другое фото.';
      try { const d = await resp.json(); msg = d.detail || msg; } catch {}
      throw new Error(msg);
    }

    resultBlob = await resp.blob();
    completeProgressBar();
    await showResult(resultBlob);

  } catch (err) {
    completeProgressBar();
    document.getElementById('error-detail').textContent = err.message;
    showScreen('screen-error');
  }
}

// ── Canvas result rendering ───────────────────────────

async function showResult(blob) {
  const url = URL.createObjectURL(blob);
  resultImg = new Image();
  await new Promise((res, rej) => {
    resultImg.onload  = res;
    resultImg.onerror = () => rej(new Error('Не удалось отобразить результат. Попробуйте снова.'));
    resultImg.src = url;
  });

  const canvas = document.getElementById('result-canvas');
  canvas.width  = resultImg.naturalWidth;
  canvas.height = resultImg.naturalHeight;
  drawResult();
  showScreen('screen-result');
}

function drawResult() {
  const canvas = document.getElementById('result-canvas');
  const ctx    = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(resultImg, 0, 0);
}

// ── Download & Share ──────────────────────────────────

function getCanvasBlob() {
  return new Promise(res => {
    document.getElementById('result-canvas').toBlob(res, 'image/jpeg', 0.92);
  });
}

document.getElementById('btn-download').addEventListener('click', async () => {
  const blob = await getCanvasBlob();
  const file = new File([blob], 'tomato-people-cover.jpg', { type: 'image/jpeg' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Я — герой журнала TOMATO PEOPLE!' });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }

  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = 'tomato-people-cover.jpg';
  a.click();
  URL.revokeObjectURL(url);
});

// ── Navigation ────────────────────────────────────────

document.getElementById('btn-start').addEventListener('click', () => showScreen('screen-upload'));

document.getElementById('btn-next-upload').addEventListener('click', () => {
  userName = inputName.value.trim();
  loadQualities();
  showScreen('screen-choose');
});

document.getElementById('btn-back-upload').addEventListener('click', () => showScreen('screen-landing'));
document.getElementById('btn-back-choose').addEventListener('click', () => showScreen('screen-upload'));
document.getElementById('btn-generate').addEventListener('click', doSwap);

document.getElementById('btn-error-retry').addEventListener('click', () => {
  resetUploadScreen();
  showScreen('screen-upload');
});

document.getElementById('btn-restart').addEventListener('click', () => {
  resultBlob = null;
  resultImg  = null;
  selectedQuality = null;
  loadQualities();
  showScreen('screen-choose');
});

startLandingSequence();
