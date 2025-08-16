# tests/test_use_case.py
import pytest
from freezegun import freeze_time

from distribucion.application.use_cases.handle_bloque_consolidado import (
    HandleBloqueConsolidadoListo,
    ProjectionError,
    ContractError,
)

# ----- Doble de ReadModelRepo con solo lo que usa el UC -----
class FakeRepo:
    def __init__(self, existing_orders=None):
        self.processed = set()
        self.choferes = {}                 # chofer_id -> nombre
        self.bloques = {}                  # bloque_id -> (fecha, chofer_id, chofer_nombre)
        self.incompleto = set()            # bloques marcados incompletos
        self.links = set()                 # (bloque_id, orden_id)
        self._existing = set(existing_orders or [])

    # idempotencia
    def event_already_processed(self, event_id): return event_id in self.processed
    def mark_event_processed(self, event_id): self.processed.add(event_id)

    # upserts mínimos
    def upsert_chofer(self, chofer_id, nombre): self.choferes[chofer_id] = nombre
    def upsert_bloque(self, bloque_id, fecha, chofer_id, chofer_nombre):
        self.bloques[bloque_id] = (fecha, chofer_id, chofer_nombre)
    def set_bloque_incompleto(self, bloque_id): self.incompleto.add(bloque_id)

    # linking / totales
    def existing_order_ids(self, ids):
        return [i for i in ids if i in self._existing]

    def bulk_link_bloque_orden(self, bloque_id, order_ids):
        before = len(self.links)
        for oid in order_ids:
            self.links.add((bloque_id, oid))
        return len(self.links) - before

    def update_bloque_total_ordenes(self, bloque_id):
        pass


# ----- Evento válido v2 (data v1.2) -----
def make_evt(evt_id="e-1", bloque_id="b-1", orden_ids=("o-1",), chofer_id="11111111-1111-4111-8111-111111111111"):
    ordenes = []
    for oid in orden_ids:
        ordenes.append({
            "id": oid,
            "pyme": {"id": "p-1", "nombre": "Pyme 1"},
            "origen_cd": {"id": "cd-a", "nombre": "CD A"},
            "destino_cd": {"id": "cd-b", "nombre": "CD B"},
            "fecha_despacho": "2025-08-11T10:00:00Z",
            "estado_preparacion": "COM",
            "peso_total": 0,
            "volumen_total": 0,
            "productos": [
                {"producto": {"sku": "SKU1", "nombre": "Prod 1"}, "qty": 1, "peso": 0, "volumen": 0}
            ]
        })

    return {
        "specversion": "1.0",
        "type": "logistrack.distribucion.BloqueConsolidadoListo.v2",
        "source": "symfony://distribucion",
        "id": evt_id,
        "time": "2025-08-11T10:00:00Z",
        "datacontenttype": "application/json",
        "dataschema": "https://contracts.logistrack/schemas/BloqueConsolidadoListo/1.2/schema.json",
        "subject": f"bloque:{bloque_id}",
        "data": {
            "bloque": {
                "id": bloque_id,
                "fecha": "2025-08-11T10:00:00Z",
                "chofer": {"id": chofer_id, "nombre": "Chofer Test"},
            },
            "ordenes": ordenes,
        },
    }


@freeze_time("2025-08-11T10:00:00Z")
def test_usecase_ok_enlaza_existentes_y_marca_incompleto():
    repo = FakeRepo(existing_orders={"o-1"})
    uc = HandleBloqueConsolidadoListo(repo)

    res = uc(make_evt("e-ok", orden_ids=("o-1",)))

    # ✅ el UC NO incluye "status" en el OK
    assert "status" not in res
    assert res["id"] == "e-ok"
    assert res["bloque_id"] == "b-1"
    assert res["linked"] == 1
    assert res["missing"] == 0

    assert "b-1" in repo.bloques
    assert "b-1" in repo.incompleto
    assert ("b-1", "o-1") in repo.links
    assert "e-ok" in repo.processed



def test_usecase_idempotente_devuelve_duplicate():
    repo = FakeRepo(existing_orders={"o-1"})
    uc = HandleBloqueConsolidadoListo(repo)
    evt = make_evt("e-idem", orden_ids=("o-1",))

    res1 = uc(evt)
    assert "status" not in res1                  

    res2 = uc(evt)
    assert res2["status"] == "duplicate"     


def test_falla_por_faltantes_con_strict_orders():
    # ninguna orden existe -> debe fallar con ProjectionError
    repo = FakeRepo(existing_orders=set())
    uc = HandleBloqueConsolidadoListo(repo)  # strict_orders=True por defecto
    with pytest.raises(ProjectionError):
        uc(make_evt("e-miss", orden_ids=("o-1", "o-2")))


def test_contrato_type_invalido_lanza_contracterror():
    repo = FakeRepo(existing_orders={"o-1"})
    uc = HandleBloqueConsolidadoListo(repo)
    bad = make_evt("e-bad")
    bad["type"] = "logistrack.distribucion.BloqueConsolidadoListo.v1"  # no es v2
    with pytest.raises(ContractError):
        uc(bad)
