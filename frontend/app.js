'use strict';

const PROCESSING_MESSAGES = [
  'Надеваем халат агронома...',
  'Проверяем томаты...',
  'Настраиваем освещение в теплице...',
  'Готовим идеальный кадр...',
  'Финальные штрихи...',
];

let userPhotoFile  = null;
let selectedBaseId = null;
let baseImages     = [];
let resultBlob     = null;
let resultImg      = null;
let processingInterval = null;
let landingTimers  = [];

// ── Screens ──────────────────────────────────────────

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
  if (id === 'screen-landing') startLandingSequence();
}

// ── Landing cinematic sequence ────────────────────────

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

const uploadZone    = document.getElementById('upload-zone');
const fileInput     = document.getElementById('file-input');
const preview       = document.getElementById('photo-preview');
const placeholder   = document.getElementById('upload-placeholder');
const btnNextUpload = document.getElementById('btn-next-upload');
const btnSelfie     = document.getElementById('btn-selfie');
const btnCancelPhoto = document.getElementById('btn-cancel-photo');
const uploadMicro   = document.getElementById('upload-micro');

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
    btnNextUpload.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

function resetUploadScreen() {
  userPhotoFile = null;
  fileInput.value = '';
  preview.src = '';
  preview.classList.add('hidden');
  placeholder.classList.remove('hidden');
  btnCancelPhoto.classList.add('hidden');
  btnNextUpload.classList.add('hidden');
  btnSelfie.classList.remove('hidden');
  uploadMicro.classList.remove('hidden');
}

uploadZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) handlePhotoFile(fileInput.files[0]);
});

btnCancelPhoto.addEventListener('click', e => {
  e.stopPropagation();
  resetUploadScreen();
});

// ── Selfie button — open camera directly ─────────────

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

// ── Base images ───────────────────────────────────────

async function loadBaseImages() {
  const grid  = document.getElementById('base-grid');
  const noMsg = document.getElementById('no-images-msg');
  grid.innerHTML = '<span class="base-loading">Загрузка...</span>';

  try {
    const resp = await fetch('/api/base-images');
    baseImages  = await resp.json();

    if (!baseImages.length) {
      grid.innerHTML = '';
      noMsg.classList.remove('hidden');
      return;
    }

    grid.innerHTML = '';
    baseImages.forEach(img => {
      const card = document.createElement('div');
      card.className = 'base-card';
      card.dataset.id = img.id;
      card.innerHTML = `<img src="${img.thumb}" alt="${img.label}" loading="lazy">`;
      card.addEventListener('click', () => selectBase(img.id));
      grid.appendChild(card);
    });

    selectBase(baseImages[0].id);

  } catch {
    grid.innerHTML = '';
    noMsg.classList.remove('hidden');
  }
}

function selectBase(id) {
  selectedBaseId = id;

  const img = baseImages.find(i => i.id === id);
  if (img) {
    document.getElementById('featured-img').src = img.thumb;
    const lbl = document.getElementById('featured-label');
    if (lbl) lbl.textContent = img.label;
  }

  document.querySelectorAll('.base-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.id === id);
  });

  document.getElementById('btn-generate').disabled = false;
}

// ── Processing animation ──────────────────────────────

function startProcessingAnimation() {
  const el = document.getElementById('processing-msg');
  let i = 0;
  el.textContent = PROCESSING_MESSAGES[0];
  processingInterval = setInterval(() => {
    i = (i + 1) % PROCESSING_MESSAGES.length;
    el.style.opacity = '0';
    setTimeout(() => {
      el.textContent = PROCESSING_MESSAGES[i];
      el.style.opacity = '1';
    }, 300);
  }, 2200);
}

function stopProcessingAnimation() {
  clearInterval(processingInterval);
}

// ── Face swap API call ────────────────────────────────

async function doSwap() {
  const img = baseImages.find(i => i.id === selectedBaseId);
  if (img) document.getElementById('proc-bg').src = img.thumb;

  showScreen('screen-processing');
  startProcessingAnimation();

  const form = new FormData();
  form.append('user_photo', userPhotoFile);
  form.append('base_id', selectedBaseId);

  try {
    const resp = await fetch('/api/swap', { method: 'POST', body: form });

    if (!resp.ok) {
      let msg = 'Ошибка обработки. Попробуйте другое фото.';
      try { const d = await resp.json(); msg = d.detail || msg; } catch {}
      throw new Error(msg);
    }

    resultBlob = await resp.blob();
    stopProcessingAnimation();
    await showResult(resultBlob);

  } catch (err) {
    stopProcessingAnimation();
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
  const file = new File([blob], 'eco-kultura-agronom.jpg', { type: 'image/jpeg' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Я — агроном ЭКО Культуры!' });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }

  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = 'eco-kultura-agronom.jpg';
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('btn-share').addEventListener('click', async () => {
  const blob = await getCanvasBlob();
  const file = new File([blob], 'eco-kultura-agronom.jpg', { type: 'image/jpeg' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'Я — агроном ЭКО Культуры!',
        text: 'овощи, в которых уверен',
      });
    } catch (e) {
      if (e.name !== 'AbortError') document.getElementById('btn-download').click();
    }
  } else {
    document.getElementById('btn-download').click();
  }
});

// ── Navigation ────────────────────────────────────────

document.getElementById('btn-start').addEventListener('click', () => showScreen('screen-upload'));

document.getElementById('btn-next-upload').addEventListener('click', () => {
  loadBaseImages();
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
  resetUploadScreen();
  selectedBaseId = null;
  resultBlob     = null;
  resultImg      = null;
  baseImages     = [];

  document.getElementById('proc-bg').src = '';
  document.getElementById('featured-img').src = '';
  const lbl = document.getElementById('featured-label');
  if (lbl) lbl.textContent = '';

  const canvas = document.getElementById('result-canvas');
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);


  showScreen('screen-landing');
});

startLandingSequence();
