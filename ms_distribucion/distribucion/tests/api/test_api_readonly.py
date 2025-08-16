# tests/api/test_api_readonly.py
from datetime import datetime, timezone
from django.urls import reverse
from rest_framework.test import APIClient

from distribucion.models import (
    Pyme, CentroDistribucion, TipoCentro,
    Chofer, Orden, OrdenProducto, Distribucion, Recepcion, Producto, Bloque, BloqueOrden
)

def _dt(s: str) -> datetime:
    # admite "Z"
    return datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone(timezone.utc)

def test_consolidacion_list_y_detail(db):
    # mínimos para FKs
    p = Pyme.objects.create(id="p-1", nombre="Pyme 1")
    cap = CentroDistribucion.objects.create(id="cap-1", nombre="CAP Norte", tipo=TipoCentro.CAP)
    cd  = CentroDistribucion.objects.create(id="cd-1",  nombre="CD Norte",  tipo=TipoCentro.CD)

    c = Chofer.objects.create(nombre="Test")  # UUID autogenerado
    b = Bloque.objects.create(
        id="b-1", fecha=_dt("2025-08-11T10:00:00Z"),
        chofer=c, chofer_nombre="Test", total_ordenes=1, estado_completitud="COM"
    )
    o = Orden.objects.create(
        id="o-1", pyme=p, origen_cd=cap, destino_cd=cd,
        fecha_despacho=_dt("2025-08-11T10:00:00Z"), estado_preparacion="PEN"
    )
    BloqueOrden.objects.create(bloque=b, orden=o)

    api = APIClient()

    # list (filtrando por fecha)
    r = api.get("/api/v1/consolidacion/bloques", {"fecha": "2025-08-11"})
    assert r.status_code == 200
    assert r.data["results"][0]["id"] == "b-1"

    # detail
    r = api.get(f"/api/v1/consolidacion/bloques/{b.id}")
    assert r.status_code == 200
    assert r.data["ordenes"][0]["id"] == "o-1"


def test_despacho_filtra_por_cd_por_nombre(db):
    # Centros y pyme para respetar CAP -> CD
    p1 = Pyme.objects.create(id="p-1", nombre="Pyme A")
    p2 = Pyme.objects.create(id="p-2", nombre="Pyme B")

    cap_a = CentroDistribucion.objects.create(id="cap-a", nombre="CAP Norte", tipo=TipoCentro.CAP)
    cap_b = CentroDistribucion.objects.create(id="cap-b", nombre="CAP Oeste", tipo=TipoCentro.CAP)
    cd_a  = CentroDistribucion.objects.create(id="cd-a",  nombre="CD Norte",  tipo=TipoCentro.CD)
    cd_b  = CentroDistribucion.objects.create(id="cd-b",  nombre="CD Sur",    tipo=TipoCentro.CD)

    # Dos órdenes CAP -> CD; sólo la primera entrega en "CD Norte"
    Orden.objects.create(
        id="o-1", pyme=p1, origen_cd=cap_a, destino_cd=cd_a,
        fecha_despacho=_dt("2025-08-10T10:00:00Z"), estado_preparacion="PEN"
    )
    Orden.objects.create(
        id="o-2", pyme=p2, origen_cd=cap_b, destino_cd=cd_b,
        fecha_despacho=_dt("2025-08-12T10:00:00Z"), estado_preparacion="PEN"
    )

    api = APIClient()
    # 👇 el filtro usa nombre, no id
    r = api.get("/api/v1/despacho/ordenes", {"cd": "CD Norte"})
    assert r.status_code == 200
    ids = [x["id"] for x in r.data["results"]]
    assert set(ids) == {"o-1"}  # sólo la que va a "CD Norte"


def test_distribucion_filtros(db):
    p = Pyme.objects.create(id="p-1", nombre="Pyme 1")
    cap = CentroDistribucion.objects.create(id="cap-1", nombre="CAP Norte", tipo=TipoCentro.CAP)
    cd  = CentroDistribucion.objects.create(id="cd-1",  nombre="CD Norte",  tipo=TipoCentro.CD)

    chofer = Chofer.objects.create(nombre="Test Chofer")

    o = Orden.objects.create(
        id="o-1", pyme=p, origen_cd=cap, destino_cd=cd,
        fecha_despacho=_dt("2025-08-11T10:00:00Z"), estado_preparacion="PEN", chofer=chofer
    )
    Distribucion.objects.create(orden=o, estado="ENT", fecha_entrega=_dt("2025-08-12T09:00:00Z"), chofer=chofer)

    api = APIClient()
    r = api.get("/api/v1/distribucion/ordenes", {"estado": "ENT", "chofer_id": str(chofer.id)})
    assert r.status_code == 200
    assert r.data["results"][0]["orden_id"] == "o-1"


def test_recepcion_filtros_por_cd_nombre_e_incidencias(db):
    p = Pyme.objects.create(id="p-1", nombre="Pyme 1")
    cap = CentroDistribucion.objects.create(id="cap-1", nombre="CAP Norte", tipo=TipoCentro.CAP)
    cd1 = CentroDistribucion.objects.create(id="cd-a",  nombre="CD Norte",  tipo=TipoCentro.CD)
    cd2 = CentroDistribucion.objects.create(id="cd-b",  nombre="CD Sur",    tipo=TipoCentro.CD)

    o1 = Orden.objects.create(
        id="o-1", pyme=p, origen_cd=cap, destino_cd=cd1,
        fecha_despacho=_dt("2025-08-11T10:00:00Z"), estado_preparacion="PEN"
    )
    o2 = Orden.objects.create(
        id="o-2", pyme=p, origen_cd=cap, destino_cd=cd2,
        fecha_despacho=_dt("2025-08-12T10:00:00Z"), estado_preparacion="PEN"
    )

    Recepcion.objects.create(
        orden=o1, cd=cd1, fecha_recepcion=_dt("2025-08-12T11:00:00Z"),
        usuario_receptor="u1", incidencias=True
    )
    Recepcion.objects.create(
        orden=o2, cd=cd2, fecha_recepcion=_dt("2025-08-12T12:00:00Z"),
        usuario_receptor="u2", incidencias=False
    )

    api = APIClient()
    # 👇 nombre del CD + booleano; DRF BooleanFilter entiende "true"/"1"
    r = api.get("/api/v1/recepcion/ordenes", {"cd": "CD Norte", "incidencias": "true"})
    assert r.status_code == 200
    assert [x["orden_id"] for x in r.data["results"]] == ["o-1"]
