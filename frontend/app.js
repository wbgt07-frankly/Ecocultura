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
let bubblePos      = 'top-left';
let processingInterval = null;

// ── Screens ──────────────────────────────────────────

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

// ── File / photo handling ─────────────────────────────

const uploadZone    = document.getElementById('upload-zone');
const fileInput     = document.getElementById('file-input');
const preview       = document.getElementById('photo-preview');
const placeholder   = document.getElementById('upload-placeholder');
const btnNextUpload = document.getElementById('btn-next-upload');

function handlePhotoFile(file) {
  userPhotoFile = file;
  const reader = new FileReader();
  reader.onload = e => {
    preview.src = e.target.result;
    preview.classList.remove('hidden');
    placeholder.classList.add('hidden');
    btnNextUpload.disabled = false;
  };
  reader.readAsDataURL(file);
}

uploadZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) handlePhotoFile(fileInput.files[0]);
});

// ── Tip sheet (selfie tips) ───────────────────────────

document.getElementById('btn-selfie').addEventListener('click', () => {
  document.getElementById('tip-sheet').classList.remove('hidden');
});

document.getElementById('tip-backdrop').addEventListener('click', () => {
  document.getElementById('tip-sheet').classList.add('hidden');
});

document.getElementById('btn-tip-ok').addEventListener('click', () => {
  document.getElementById('tip-sheet').classList.add('hidden');
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

  document.getElementById('bubble-text').value = '';
  drawResult();
  showScreen('screen-result');
}

function drawResult() {
  const canvas = document.getElementById('result-canvas');
  const ctx    = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(resultImg, 0, 0);

}

// ── Speech bubble ─────────────────────────────────────

function drawBubble(ctx, text, pos, W, H) {
  const scale    = W / 1080;
  const fontSize = Math.max(26, Math.round(38 * scale));
  const padding  = Math.round(22 * scale);
  const r        = Math.round(20 * scale);
  const tailH    = Math.round(26 * scale);
  const maxTextW = Math.round(W * 0.58);
  const margin   = Math.round(W * 0.045);
  const brandH   = Math.round(H * 0.15);

  ctx.font = `bold ${fontSize}px Arial, Helvetica, sans-serif`;

  const lines = wrapText(ctx, text, maxTextW);
  const lineH = Math.round(fontSize * 1.35);
  const textW = Math.max(...lines.map(l => ctx.measureText(l).width));
  const boxW  = Math.min(maxTextW + padding * 2, textW + padding * 2);
  const boxH  = lines.length * lineH + padding * 1.2;

  let bx, by, tailX;

  if (pos === 'top-right') {
    bx    = W - margin - boxW;
    by    = margin;
    tailX = bx + boxW * 0.75;
  } else if (pos === 'bottom-left') {
    bx    = margin;
    by    = H - brandH - margin - boxH - tailH;
    tailX = bx + boxW * 0.25;
  } else {
    bx    = margin;
    by    = margin;
    tailX = bx + boxW * 0.3;
  }

  ctx.save();
  ctx.shadowColor   = 'rgba(0,0,0,0.28)';
  ctx.shadowBlur    = Math.round(18 * scale);
  ctx.shadowOffsetX = Math.round(2 * scale);
  ctx.shadowOffsetY = Math.round(5 * scale);
  ctx.beginPath();
  bubblePath(ctx, bx, by, boxW, boxH, r, tailX, tailH);
  ctx.fillStyle = 'rgba(255,255,255,0.97)';
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  bubblePath(ctx, bx, by, boxW, boxH, r, tailX, tailH);
  ctx.strokeStyle = '#1C4220';
  ctx.lineWidth   = Math.max(2, Math.round(3 * scale));
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.fillStyle    = '#1a2e1c';
  ctx.font         = `bold ${fontSize}px Arial, Helvetica, sans-serif`;
  ctx.textBaseline = 'top';
  lines.forEach((line, i) => {
    ctx.fillText(line, bx + padding, by + padding * 0.55 + i * lineH);
  });
  ctx.restore();
}

function bubblePath(ctx, x, y, w, h, r, tailX, tailH) {
  const tw = Math.round(tailH * 0.65);
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(Math.min(tailX + tw, x + w - r), y + h);
  ctx.lineTo(tailX, y + h + tailH);
  ctx.lineTo(Math.max(tailX - tw, x + r), y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const test = current ? current + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// ── Bubble controls ───────────────────────────────────


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
document.getElementById('btn-error-retry').addEventListener('click', () => showScreen('screen-upload'));

document.getElementById('btn-restart').addEventListener('click', () => {
  userPhotoFile  = null;
  selectedBaseId = null;
  resultBlob     = null;
  resultImg      = null;
  baseImages     = [];

  fileInput.value = '';
  preview.src     = '';
  preview.classList.add('hidden');
  placeholder.classList.remove('hidden');
  btnNextUpload.disabled = true;

  document.getElementById('proc-bg').src = '';
  document.getElementById('featured-img').src = '';
  const lbl = document.getElementById('featured-label');
  if (lbl) lbl.textContent = '';

  const canvas = document.getElementById('result-canvas');
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);


  showScreen('screen-landing');
});
