'use strict';

const BRAND_FACTS = [
  'Томаты ЭКО-Культура проходят контроль качества и выращиваются без ГМО и нитратов. Именно поэтому их вкус и качество гарантирован.',
];

// ── Skeleton doc animation ────────────────
const SKEL_WIDTHS = ['75%', '52%', '66%', '40%'];
let skelTimers = [];

function animateSkeleton() {
  skelTimers.forEach(clearTimeout);
  skelTimers = [];
  const lines = document.querySelectorAll('.skel-line');
  lines.forEach(l => { l.style.width = '0%'; l.classList.remove('sk-on'); });

  function showLine(i) {
    if (i >= lines.length) {
      skelTimers.push(setTimeout(animateSkeleton, 900));
      return;
    }
    lines[i].style.width = SKEL_WIDTHS[i];
    lines[i].classList.add('sk-on');
    skelTimers.push(setTimeout(() => showLine(i + 1), 420));
  }
  showLine(0);
}

function stopSkeleton() {
  skelTimers.forEach(clearTimeout);
  skelTimers = [];
}

// ── Typewriter ────────────────────────────
let twTimer = null;

function startTypewriter() {
  clearTimeout(twTimer);
  const el    = document.getElementById('fact-typed');
  const fact  = BRAND_FACTS[Math.floor(Math.random() * BRAND_FACTS.length)];
  el.textContent = '';
  let i = 0;

  return new Promise(resolve => {
    function typeChar() {
      if (i < fact.length) {
        el.textContent += fact[i++];
        setProgressBar(i / fact.length);
        twTimer = setTimeout(typeChar, 68);
      } else {
        resolve();
      }
    }
    typeChar();
  });
}

function stopTypewriter() {
  clearTimeout(twTimer);
  twTimer = null;
}

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

  const blocks = ['ct-1', 'ct-2', 'ct-3', 'ct-4', 'ct-5'];
  blocks.forEach(id => {
    const el = document.getElementById(id);
    el.classList.remove('ct-show', 'ct-hide');
  });
  document.getElementById('land-btn-wrap').classList.remove('visible');
  document.getElementById('land-cinema-overlay').classList.remove('intense');

  const t  = (fn, ms) => landingTimers.push(setTimeout(fn, ms));
  const show = id => document.getElementById(id).classList.add('ct-show');
  const hide = id => {
    const el = document.getElementById(id);
    el.classList.remove('ct-show');
    el.classList.add('ct-hide');
  };

  const D = 3500;
  t(() => show('ct-1'),                                              D);
  t(() => hide('ct-1'),                                          D+3000);
  t(() => show('ct-2'),                                          D+3400);
  t(() => hide('ct-2'),                                          D+6700);
  t(() => show('ct-3'),                                          D+7000);
  t(() => hide('ct-3'),                                         D+10500);
  t(() => { show('ct-4'); document.getElementById('land-cinema-overlay').classList.add('intense'); }, D+10800);
  t(() => hide('ct-4'),                                         D+13200);
  t(() => { document.getElementById('land-cinema-overlay').classList.remove('intense'); show('ct-5'); }, D+13500);
  t(() => hide('ct-5'),                                         D+16800);
  t(() => {
    document.getElementById('land-btn-wrap').classList.add('visible');
  }, D+17200);
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
  const carousel = document.getElementById('quality-carousel');
  carousel.innerHTML = '';
  selectedQuality = null;
  document.getElementById('btn-generate').disabled = true;

  try {
    const resp = await fetch('/api/qualities');
    const qualities = await resp.json();

    qualities.forEach(q => {
      const card = document.createElement('div');
      card.className = 'quality-card';
      card.dataset.id = q.id;
      card.innerHTML = `
        <img src="/quality-images/${q.id}.png" alt="${q.label}" loading="lazy">
        <span class="qc-check">
          <svg viewBox="0 0 18 18" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round">
            <polyline points="3,9 7,13 15,5"/>
          </svg>
        </span>
      `;
      card.addEventListener('click', () => selectQuality(q.id));
      carousel.appendChild(card);
    });
  } catch {
    carousel.innerHTML = '<p class="emsg">Не удалось загрузить список качеств</p>';
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
}

function setProgressBar(ratio) {
  const fill = document.querySelector('.pbar-fill');
  fill.style.transition = 'none';
  fill.style.width = (ratio * 100) + '%';
}

function completeProgressBar() {
  const fill = document.querySelector('.pbar-fill');
  fill.style.transition = 'width 0.4s ease-out';
  fill.style.width = '100%';
}

// ── API call ──────────────────────────────────────────

async function doSwap() {
  showScreen('screen-processing');
  startProgressBar();  // сбросить в 0
  animateSkeleton();
  const twDone = startTypewriter();

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
    stopSkeleton();
    await twDone;           // ждём пока текст дочитается
    stopTypewriter();
    await showResult(resultBlob);

  } catch (err) {
    stopSkeleton();
    stopTypewriter();
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
