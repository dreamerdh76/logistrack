from django.core.management.base import BaseCommand
from django.conf import settings
import json, logging, signal
import redis

from distribucion.application.use_cases.handle_bloque_consolidado import HandleBloqueConsolidadoListo, ProjectionError
from distribucion.infrastructure.persistence.repositories import DjangoReadModelRepo
from distribucion.contracts.validator import ContractError
from django.db import transaction

log = logging.getLogger(__name__)
RUNNING = True

class Command(BaseCommand):
    help = "Consume Redis Stream y proyecta el read-model (idempotente)."

    def add_arguments(self, parser):
        parser.add_argument("--once", action="store_true")
        parser.add_argument("--from-start", action="store_true", help="Consume backlog (id=0) en el primer ciclo")

    def handle(self, *args, **opts):
        global RUNNING
        signal.signal(signal.SIGTERM, lambda *_: self._stop())
        signal.signal(signal.SIGINT,  lambda *_: self._stop())

        r = redis.Redis.from_url(settings.REDIS_DSN, decode_responses=True)
        stream   = settings.REDIS_STREAM            # SIN prefijo
        dlq      = getattr(settings, "DLQ_STREAM", "ms.dlq.distribucion")
        group    = settings.REDIS_GROUP
        consumer = settings.REDIS_CONSUMER
        first_id = "0" if opts["from_start"] else ">"

        self._ensure_group(r, stream, group)
        uc = HandleBloqueConsolidadoListo(DjangoReadModelRepo())

        def process_record(mid: str, fields: dict):
            raw = fields.get("data")
            if not raw:
                log.warning("Mensaje sin campo 'data'", extra={"id": mid})
                r.xack(stream, group, mid)
                return
            try:
                evt = json.loads(raw)
            except Exception as e:
                log.exception("JSON inválido; va a DLQ", extra={"id": mid})
                r.xadd(dlq, {"data": raw, "error": f"json:{e}"})
                r.xack(stream, group, mid)
                return

            try:
                with transaction.atomic():
                    res = uc(evt)  # valida contrato + idempotencia + upserts
                log.info("OK", extra={"id": mid, "cloudevent_id": evt.get("id"), "res": res})
                r.xack(stream, group, mid)
            except (ContractError, ProjectionError) as e:
                log.exception("Contrato/proyección inválida; va a DLQ",
                              extra={"id": mid, "cloudevent_id": evt.get("id")})
                r.xadd(dlq, {"data": raw, "error": str(e)[:500]})
                r.xack(stream, group, mid)
            except Exception as e:
                log.exception("Error inesperado; va a DLQ", extra={"id": mid})
                r.xadd(dlq, {"data": raw, "error": f"unexpected:{e}"[:500]})
                r.xack(stream, group, mid)

        msgs = r.xreadgroup(group, consumer, {stream: first_id}, count=settings.XREAD_COUNT, block=1_000)
        if msgs:
            _, batch = msgs[0]
            for mid, fields in batch:
                process_record(mid, fields)
        while RUNNING:
            msgs = r.xreadgroup(group, consumer, {stream: ">"}, count=settings.XREAD_COUNT, block=settings.XREAD_BLOCK_MS)
            if not msgs:
                if opts["once"]:
                    break
                continue
            _, batch = msgs[0]
            for mid, fields in batch:
                process_record(mid, fields)
            if opts["once"]:
                break

        log.info("Worker detenido.")

    def _ensure_group(self, r: redis.Redis, stream: str, group: str):
        try:
            r.xgroup_create(stream, group, id="0", mkstream=True)
            log.info("Grupo creado", extra={"stream": stream, "group": group})
        except redis.ResponseError as e:
            if "BUSYGROUP" in str(e):  # ya existe
                log.debug("Grupo ya existe", extra={"group": group})
            else:
                raise

    def _stop(self):  # graceful shutdown
        global RUNNING
        RUNNING = False
