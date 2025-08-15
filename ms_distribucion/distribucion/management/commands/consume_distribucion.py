# distribucion/management/commands/consume_bloques.py
from django.core.management.base import BaseCommand
from django.conf import settings
from django.db import transaction
import json, logging, signal

from distribucion.application.use_cases.handle_bloque_consolidado import (
    HandleBloqueConsolidadoListo, ProjectionError
)
from distribucion.infrastructure.persistence.repositories import DjangoReadModelRepo
from distribucion.contracts.validator import ContractError, validate_cloudevent, validate_data
from distribucion.infrastructure.messaging.redis_consumer import RedisEventConsumer

log = logging.getLogger(__name__)
RUNNING = True

class Command(BaseCommand):
    help = "Consume eventos y proyecta Bloque/BloqueOrden (idempotente)."

    def add_arguments(self, parser):
        parser.add_argument("--once", action="store_true")
        parser.add_argument("--from-start", action="store_true")

    def handle(self, *args, **opts):
        global RUNNING
        signal.signal(signal.SIGTERM, lambda *_: self._stop())
        signal.signal(signal.SIGINT,  lambda *_: self._stop())

        # ⚙️ Instancia del adapter (implementar EventConsumer)
        consumer = RedisEventConsumer(
            dsn=settings.REDIS_DSN,
            stream=settings.REDIS_STREAM,
            group=settings.REDIS_GROUP,
            consumer=settings.REDIS_CONSUMER,
        )

        uc = HandleBloqueConsolidadoListo(repo=DjangoReadModelRepo(), strict_orders=True)

        def process(msg):
            mid = msg["id"]
            raw = msg.get("data")
            if not raw:
                log.warning("Mensaje sin 'data'", extra={"id": mid})
                return consumer.ack(mid)

            try:
                evt = json.loads(raw)
            except Exception as e:
                log.exception("JSON inválido", extra={"id": mid})
                return consumer.dead_letter(raw, f"json:{e}") or consumer.ack(mid)

            # ✅ Validación contrato (CE + data)
            try:
                validate_cloudevent(evt)
                validate_data(evt.get("data") or {}, evt.get("dataschema"))
            except ContractError as e:
                log.exception("Contrato inválido", extra={"id": mid, "cloudevent_id": evt.get("id")})
                return consumer.dead_letter(raw, f"contract:{e}") or consumer.ack(mid)

            # 🧩 Proyección
            try:
                with transaction.atomic():
                    res = uc(evt)
                log.info("OK", extra={"id": mid, "cloudevent_id": evt.get("id"), "res": res})
                return consumer.ack(mid)
            except ProjectionError as e:
                log.exception("Proyección inválida", extra={"id": mid, "cloudevent_id": evt.get("id")})
                return consumer.dead_letter(raw, f"projection:{e}") or consumer.ack(mid)
            except Exception as e:
                log.exception("Error inesperado", extra={"id": mid})
                return consumer.dead_letter(raw, f"unexpected:{e}") or consumer.ack(mid)

        # Primer barrido opcional (backlog)
        start_block = 1000 if opts["from_start"] else 1
        for m in consumer.read(count=settings.XREAD_COUNT, block_ms=start_block):
            process(m)

        # Loop principal
        while RUNNING:
            msgs = list(consumer.read(count=settings.XREAD_COUNT, block_ms=settings.XREAD_BLOCK_MS))
            if not msgs and opts["once"]:
                break
            for m in msgs:
                process(m)
            if opts["once"]:
                break

        log.info("Worker detenido.")

    def _stop(self):  # graceful shutdown
        global RUNNING
        RUNNING = False
