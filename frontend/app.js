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
const uploadFoot    = document.getElementById('upload-foot');

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
    uploadFoot.classList.remove('hidden');
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
  uploadFoot.classList.add('hidden');
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

// ── Carousel ──────────────────────────────────────────

let currentSlide = 0;

async function loadBaseImages() {
  const noMsg = document.getElementById('no-images-msg');
  const track = document.getElementById('carousel-track');
  const dotsEl = document.getElementById('carousel-dots');

  track.innerHTML = '';
  dotsEl.innerHTML = '';

  try {
    const resp = await fetch('/api/base-images');
    baseImages = await resp.json();

    if (!baseImages.length) {
      noMsg.classList.remove('hidden');
      return;
    }

    baseImages.forEach((img, i) => {
      const slide = document.createElement('div');
      slide.className = 'carousel-slide';
      slide.innerHTML = `<img src="${img.thumb}" alt="${img.label}"><div class="carousel-slide-lbl">${img.label}</div>`;
      track.appendChild(slide);

      const dot = document.createElement('span');
      dot.className = 'cdot';
      dotsEl.appendChild(dot);
    });

    goToSlide(0);
    initCarouselSwipe();

  } catch {
    noMsg.classList.remove('hidden');
  }
}

function goToSlide(index) {
  currentSlide = Math.max(0, Math.min(index, baseImages.length - 1));
  selectedBaseId = baseImages[currentSlide].id;
  document.getElementById('carousel-track').style.transform = `translateX(-${currentSlide * 100}%)`;
  document.querySelectorAll('.cdot').forEach((d, i) => d.classList.toggle('active', i === currentSlide));
  document.getElementById('btn-generate').disabled = false;
}

function initCarouselSwipe() {
  const wrap = document.getElementById('carousel-wrap');
  let startX = 0, startY = 0;

  wrap.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  wrap.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      goToSlide(currentSlide + (dx < 0 ? 1 : -1));
    }
  }, { passive: true });
}

// ── Processing animation ──────────────────────────────

let pbarRAF = null;
let pbarStartTime = 0;
const PBAR_DURATION_MS = 12000;

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

function startProcessingAnimation() {
  const el = document.getElementById('processing-msg');
  let i = 0;
  el.style.opacity = '1';
  el.textContent = PROCESSING_MESSAGES[0];
  startProgressBar();

  processingInterval = setInterval(() => {
    i = (i + 1) % PROCESSING_MESSAGES.length;
    el.style.opacity = '0';
    el.addEventListener('transitionend', function handler() {
      el.removeEventListener('transitionend', handler);
      el.textContent = PROCESSING_MESSAGES[i];
      el.style.opacity = '1';
    }, { once: true });
  }, 2800);
}

function stopProcessingAnimation() {
  clearInterval(processingInterval);
  completeProgressBar();
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
