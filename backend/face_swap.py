import os
import logging
import urllib.request
import numpy as np
import cv2
import insightface
from insightface.app import FaceAnalysis

logger = logging.getLogger(__name__)

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")

INSWAPPER_URL = (
    "https://huggingface.co/ezioruan/inswapper_128.onnx"
    "/resolve/main/inswapper_128.onnx"
)

_analyzer = None
_swapper  = None


def _download_if_missing(path: str, url: str, label: str) -> None:
    if os.path.exists(path):
        return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    logger.info(f"Скачивание {label} ({url}) ...")

    def _progress(count, block, total):
        if total > 0 and count % 500 == 0:
            pct = min(100, count * block * 100 // total)
            logger.info(f"  {label}: {pct}%")

    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req) as resp, open(path, "wb") as f:
        block = 1024 * 256
        total = int(resp.headers.get("Content-Length", 0))
        count = 0
        while True:
            chunk = resp.read(block)
            if not chunk:
                break
            f.write(chunk)
            count += 1
            _progress(count, block, total)
    logger.info(f"{label} скачан.")


def init_models():
    global _analyzer, _swapper
    os.makedirs(MODELS_DIR, exist_ok=True)

    inswapper_path = os.path.join(MODELS_DIR, "models", "inswapper_128.onnx")
    _download_if_missing(inswapper_path, INSWAPPER_URL, "inswapper_128.onnx")

    logger.info("Загрузка face analyzer (buffalo_sc)...")
    _analyzer = FaceAnalysis(name="buffalo_sc", root=MODELS_DIR)
    _analyzer.prepare(ctx_id=-1, det_size=(320, 320))

    logger.info("Загрузка inswapper_128...")
    _swapper = insightface.model_zoo.get_model(inswapper_path, root=MODELS_DIR)
    logger.info("Модели готовы")


def swap_face(user_img_bytes: bytes, base_img_path: str) -> bytes:
    if _analyzer is None or _swapper is None:
        init_models()

    user_arr = np.frombuffer(user_img_bytes, np.uint8)
    user_img = cv2.imdecode(user_arr, cv2.IMREAD_COLOR)
    if user_img is None:
        raise ValueError("Не удалось открыть фото. Попробуйте другой файл.")

    h, w = user_img.shape[:2]
    if max(h, w) > 1920:
        scale    = 1920 / max(h, w)
        user_img = cv2.resize(user_img, (int(w * scale), int(h * scale)))

    base_img = cv2.imread(base_img_path)
    if base_img is None:
        raise ValueError("Базовое изображение не найдено.")

    user_faces = _analyzer.get(user_img)
    base_faces = _analyzer.get(base_img)

    if not user_faces:
        raise ValueError(
            "Лицо не найдено на вашем фото. "
            "Убедитесь, что лицо хорошо видно, и попробуйте снова."
        )
    if not base_faces:
        raise ValueError("Техническая ошибка: лицо не найдено на базовом изображении.")

    user_face = sorted(
        user_faces,
        key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]),
        reverse=True,
    )[0]
    base_face = base_faces[0]

    result = base_img.copy()
    result = _swapper.get(result, base_face, user_face, paste_back=True)

    _, buffer = cv2.imencode(".jpg", result, [cv2.IMWRITE_JPEG_QUALITY, 92])
    return buffer.tobytes()
