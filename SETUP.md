# Запуск проекта

## 1. Добавить базовое фото агронома

Скопируйте фото агронома в теплице:

```
backend/assets/base_images/female_1.jpg
```

Требования: лицо смотрит в камеру, хорошее освещение, разрешение ≥ 1080px.

## 2. Установить зависимости

```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## 3. Запустить сервер

```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

При первом запуске автоматически загрузятся:
- Шрифты Montserrat (~2 МБ) → `backend/assets/fonts/`
- Модели InsightFace buffalo_l + inswapper_128 (~950 МБ) → `backend/models/`

**Первый старт займёт несколько минут.** Последующие — мгновенно.

## 4. Открыть в браузере

```
http://localhost:8000
```

Для теста с телефона в той же сети:

```
http://<IP вашего компьютера>:8000
```

## Деплой на Railway

1. Создайте новый проект на [railway.app](https://railway.app)
2. Подключите GitHub-репозиторий
3. Railway автоматически прочитает `Procfile`
4. После деплоя скопируйте URL → сгенерируйте QR-код через [qr-code-generator.com](https://www.qr-code-generator.com)

## Генерация QR-кода

```bash
pip install qrcode[pil]
python -c "import qrcode; qrcode.make('https://ВАШ_URL').save('qr/qr_code.png')"
```
