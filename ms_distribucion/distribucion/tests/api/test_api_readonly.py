from django.urls import reverse
from rest_framework.test import APIClient
from distribucion.models import Bloque, Chofer, Orden, OrdenProducto, Distribucion, Recepcion
from datetime import datetime, timezone

def _dt(s): return datetime.fromisoformat(s.replace("Z","+00:00"))

def test_consolidacion_list_y_detail(db):
    c = Chofer.objects.create(id="c-1", nombre="Test")
    b = Bloque.objects.create(id="b-1", fecha=_dt("2025-08-11T10:00:00Z"),
                              chofer=c, chofer_nombre="Test", total_ordenes=1, estado_completitud="COM")
    o = Orden.objects.create(id="o-1", pyme_id="p-1", origen_cd_id="cd-a", destino_cd_id="cd-b",
                             fecha_despacho=_dt("2025-08-11T10:00:00Z"), estado_preparacion="PEN")
    b.bloque_ordenes.create(orden=o)

    api = APIClient()
    # list
    r = api.get("/api/v1/consolidacion/bloques", {"fecha":"2025-08-11"})
    assert r.status_code == 200
    assert r.data["results"][0]["id"] == "b-1"
    # detail
    r = api.get(f"/api/v1/consolidacion/bloques/{b.id}")
    assert r.status_code == 200
    assert r.data["ordenes"][0]["id"] == "o-1"

def test_despacho_filtros(db):
    o1 = Orden.objects.create(id="o-1", pyme_id="p-1", origen_cd_id="cd-a", destino_cd_id="cd-b",
                              fecha_despacho=_dt("2025-08-10T10:00:00Z"), estado_preparacion="PEN")
    o2 = Orden.objects.create(id="o-2", pyme_id="p-2", origen_cd_id="cd-x", destino_cd_id="cd-a",
                              fecha_despacho=_dt("2025-08-12T10:00:00Z"), estado_preparacion="PEN")
    api = APIClient()
    r = api.get("/api/v1/despacho/ordenes", {"cd_id":"cd-a"})
    assert r.status_code == 200
    ids = [x["id"] for x in r.data["results"]]
    assert set(ids) == {"o-1","o-2"}

def test_distribucion_filtros(db):
    c = Chofer.objects.create(id="c-1", nombre="Test")
    o = Orden.objects.create(id="o-1", pyme_id="p-1", origen_cd_id="cd-a", destino_cd_id="cd-b",
                             fecha_despacho=_dt("2025-08-11T10:00:00Z"), estado_preparacion="PEN", chofer=c)
    Distribucion.objects.create(orden=o, estado="ENT", fecha_entrega=_dt("2025-08-12T09:00:00Z"), chofer=c)
    api = APIClient()
    r = api.get("/api/v1/distribucion/ordenes", {"estado":"ENT","chofer_id":"c-1"})
    assert r.status_code == 200
    assert r.data["results"][0]["orden_id"] == "o-1"
