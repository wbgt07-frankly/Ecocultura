FROM python:3.11-slim

# Системные зависимости для insightface / onnxruntime / opencv
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    libglib2.0-0 \
    libgl1-mesa-glx \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

WORKDIR /app/backend

ENV PORT=8000
EXPOSE 8000

CMD sh -c "uvicorn main:app --host 0.0.0.0 --port ${PORT}"
