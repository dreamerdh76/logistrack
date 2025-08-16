# LogisTrack – Stack Docker (Django + Worker + Symfony CLI + Angular + MySQL + Redis)

## Servicios

- **mysql** (`mysql:8`)
  BD `distribucion` (usuario `root`, pass `12345678`).

- **redis** (`redis:7-alpine`)
  Broker para eventos (Streams).

- **ms_distribucion** (Django + Gunicorn, `:8000`)
  En el arranque ejecuta en **el mismo contenedor**:
  1) `python manage.py migrate --noinput`  
  2) `python manage.py shell -c 'from distribucion.factory import run; run()'` *(si lo definiste en `command`)*  
  3) `gunicorn ms_distribucion.wsgi:application -b 0.0.0.0:8000 -w 3 --timeout 120`

  Monta contratos en `/contracts/schemas` (solo lectura).

- **ms_distribucion_worker** (Django)
  Ejecuta `python manage.py consume_distribucion` para procesar eventos desde Redis.

- **logistrack_web** (Angular, `:4200`)
  UI en desarrollo (Tailwind). CORS hacia `http://localhost:4200`.

- **symfony_cli** (PHP CLI)
  Sin servidor web. Para correr `php bin/console ...` que **publica eventos en Redis**.

---

## API (Django)

Base: `http://localhost:8000`

- **Swagger UI**: `GET /schema/swagger-ui/`
- **OpenAPI JSON**: `GET /schema/`

Prefijo de negocio: `/api/v1/`

- `GET /api/v1/despacho/ordenes`
- `GET /api/v1/preparacion/ordenes`
- `GET /api/v1/expedicion/ordenes`
- `GET /api/v1/recepcion/ordenes`
- `GET /api/v1/consolidacion/bloques`
- `GET /api/v1/consolidacion/bloques/<id>`
- `GET /api/v1/distribucion/ordenes`
- `GET /api/v1/health`

---

## Puesta en marcha

```bash
# Construir e iniciar
docker compose up -d --build

# Verificar
docker compose ps
# Swagger: http://localhost:8000/schema/swagger-ui/
# Angular: http://localhost:4200
```

## Publicar 30 eventos “BloqueConsolidadoListo” (PHP → Redis)

Ejecuta el comando en **symfony_cli** para publicar 30 eventos en el stream configurado:

```bash
# Contenedor ya corriendo
docker compose exec symfony_cli php bin/console app:seed-events

> Revisa que en `symfony_cli` estén definidos, como mínimo:  
> `REDIS_DSN=redis://redis:6379` y `REDIS_STREAM=distribucion.bloques`.  
> (Opcional) `DLQ_STREAM`, `SOURCE_URI`, `CONTRACT_DATA_SCHEMA` si tu comando los usa.

---

## Operaciones útiles

```bash
# Logs del worker (procesamiento de eventos)
docker compose logs -f ms_distribucion_worker

# Escalar workers
docker compose up -d --scale ms_distribucion_worker=3

# Migraciones manuales
docker compose exec ms_distribucion python manage.py migrate --noinput

# Seed manual (Django factory)
docker compose exec ms_distribucion   python manage.py shell -c "from distribucion.factory import run; run()"
```

---

## Contratos

- Montados como solo lectura en Django: `./logistrack-contracts/schemas:/contracts/schemas:ro`
- Variables (Django):
  - `LOGISTRACK_CONTRACTS_DIR=/contracts/schemas`
  - (Compat) `CONTRACTS_DIR=/contracts/schemas`

---

## Variables relevantes

**Django**
- DB: `MYSQL_HOST=mysql`, `MYSQL_PORT=3306`, `MYSQL_USER=root`, `MYSQL_PASSWORD=12345678`, `MYSQL_DB=distribucion`
- Redis: `REDIS_DSN=redis://redis:6379/0`
- Streams: `REDIS_STREAM=distribucion.bloques`, `REDIS_GROUP=grp.distribucion`, `DLQ_STREAM=ms.dlq.distribucion`

**PHP (symfony_cli)**
- Redis/streams equivalentes a los usados por Django Worker.

---

## Notas de arquitectura

- **DDD + eventos** vía **Redis Streams** (`distribucion.bloques`).
- **Django** (API) + **Worker** desacoplado; contratos montados RO.
- **Angular** con Tailwind; separación de lógica y plantilla en componentes.
- Principios **SOLID** + **arquitectura limpia** tanto en backend como frontend.
