import json, socket, time
import pytest
import redis
from django.core.management import call_command
from django.conf import settings

def _redis_up(host, port):
    s=socket.socket(); s.settimeout(0.3)
    try:
        s.connect((host, port)); s.close(); return True
    except Exception: return False

@pytest.mark.integration
def test_consume_from_stream_end_to_end(db):
    # Skip si no hay Redis local
    url = settings.REDIS_DSN  # p.ej. redis://127.0.0.1:6379/0
    host = url.split("//")[1].split(":")[0]
    port = int(url.split(":")[2].split("/")[0])
    if not _redis_up(host, port):
        pytest.skip("Redis no disponible")

    r = redis.Redis.from_url(url, decode_responses=True)
    stream = settings.REDIS_STREAM
    group = settings.REDIS_GROUP
    # limpia
    try: r.xgroup_destroy(stream, group)
    except Exception: pass
    r.delete(stream, settings.DLQ_STREAM)

    # publica 1 evento
    evt = {
      "specversion":"1.0","type":"logistrack.distribucion.BloqueConsolidadoListo.v1",
      "source":"symfony://distribucion","id":"it-1","time":"2025-08-11T10:00:00Z",
      "datacontenttype":"application/json",
      "dataschema":"https://contracts.logistrack/schemas/BloqueConsolidadoListo/1.0/schema.json",
      "subject":"bloque:b-it1",
      "data":{"bloque_id":"b-it1","fecha_despacho":"2025-08-11T10:00:00Z",
              "chofer":{"id":"c-1","nombre":"Test"},
              "ordenes":[{"id":"o-it1","pyme_id":"p-1","origen_cd_id":"cd-a","destino_cd_id":"cd-b",
                          "productos":[{"sku":"S1","qty":1,"peso":1,"volumen":0.1}]}]}
    }
    r.xadd(stream, {"data": json.dumps(evt)})

    # corre el worker una vez, leyendo backlog
    call_command("consume_distribucion", "--from-start", "--once")

    # verifica que no haya pendientes
    pend = r.xpending(stream, group)
    assert pend["pending"] == 0
