from django.core.management.base import BaseCommand
from django.conf import settings
from pathlib import Path
from uuid import uuid4
from datetime import datetime, timedelta, timezone
import json, random, redis

from distribucion.application.use_cases.handle_bloque_consolidado import HandleBloqueConsolidadoListo
from distribucion.infrastructure.persistence.repositories import DjangoReadModelRepo

OK_FULL_PATH = Path(settings.LOGISTRACK_CONTRACTS_DIR) / "examples" / "ok-full.json"

def gen_traceparent() -> str:
    trace_id  = uuid4().hex + uuid4().hex[:0]  # 32 hex
    parent_id = uuid4().hex[:16]               # 16 hex
    return f"00-{trace_id}-{parent_id}-01"

def make_event(base: dict, i: int) -> dict:
    ev = json.loads(json.dumps(base))  # deep copy
    now = datetime.now(timezone.utc)
    ev["id"] = str(uuid4())
    ev["time"] = now.isoformat()
    ev["subject"] = f"bloque:b-{1000+i}"
    ev["traceparent"] = gen_traceparent()
    # data
    ev["data"]["bloque_id"] = f"b-{1000+i}"
    ev["data"]["fecha_despacho"] = (now - timedelta(days=random.randint(0, 10))).isoformat()
    # chofer
    choferes = [
        {"id": "c-10", "nombre": "María López"},
        {"id": "c-11", "nombre": "Juan Pérez"},
        {"id": "c-12", "nombre": "Ana Gómez"},
    ]
    ch = random.choice(choferes)
    ev["data"]["chofer"] = ch
    # órdenes (1..3)
    n = random.randint(1, 3)
    ev["data"]["ordenes"] = []
    for j in range(n):
        oid = f"o-{i}-{j}"
        ev["data"]["ordenes"].append({
            "id": oid, "pyme_id": f"p-{random.randint(1,5)}",
            "origen_cd_id": f"cd-{random.choice(list('abc'))}",
            "destino_cd_id": f"cd-{random.choice(list('abc'))}",
            "productos": [
                {"sku": f"SKU-{random.randint(1,9)}", "qty": random.randint(1,3),
                 "peso": round(random.uniform(0.5, 5.0), 2),
                 "volumen": round(random.uniform(0.01, 0.2), 3)}
            ]
        })
    return ev

class Command(BaseCommand):
    help = "Genera eventos de ejemplo (desde ok-full.json), los publica en Redis o ejecuta el use case."

    def add_arguments(self, p):
        p.add_argument("--n", type=int, default=30)
        p.add_argument("--publish", action="store_true", help="Publica en Redis (XADD)")
        p.add_argument("--usecase", action="store_true", help="Ejecuta el caso de uso directamente")

    def handle(self, *args, **opts):
        base = json.loads(OK_FULL_PATH.read_text(encoding="utf-8"))
        n = opts["n"]
        do_pub = opts["publish"]
        do_uc  = opts["usecase"]

        if not (do_pub or do_uc):
            self.stdout.write(self.style.WARNING("Nada que hacer: usa --publish y/o --usecase"))
            return

        r = None
        stream = settings.REDIS_STREAM
        if do_pub:
            r = redis.Redis.from_url(settings.REDIS_DSN, decode_responses=True)

        uc = None
        if do_uc:
            uc = HandleBloqueConsolidadoListo(DjangoReadModelRepo())

        for i in range(n):
            ev = make_event(base, i)
            payload = json.dumps(ev, ensure_ascii=False)

            if do_pub:
                r.xadd(stream, {"data": payload}, maxlen=10000, approximate=True)
            if do_uc:
                uc(ev)

        self.stdout.write(self.style.SUCCESS(f"OK: generados {n} eventos ({'pub ' if do_pub else ''}{'uc' if do_uc else ''})"))
