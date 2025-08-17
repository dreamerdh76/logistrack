# Base runtime para ms_distribucion y worker
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    DJANGO_SETTINGS_MODULE=ms_distribucion.settings \
    CONTRACTS_DIR=/contracts/schemas

WORKDIR /app

# Dependencias de sistema para mysqlclient y Pillow
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential gcc \
      pkg-config \
      default-libmysqlclient-dev \
      libjpeg62-turbo-dev zlib1g-dev \
      ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Instala Python deps
COPY requirements*.txt ./
RUN python -m pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Código
COPY . .

EXPOSE 8000

# Producción: gunicorn
CMD ["gunicorn", "ms_distribucion.wsgi:application", "-b", "0.0.0.0:8000", "-w", "3", "--timeout", "120"]


# Stage de tests (opcional)
FROM runtime AS test
# Paquetes de desarrollo para tests si existen
RUN if [ -f requirements-dev.txt ]; then pip install --no-cache-dir -r requirements-dev.txt; fi
CMD ["pytest"]
