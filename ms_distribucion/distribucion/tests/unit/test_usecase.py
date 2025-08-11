import pytest
from freezegun import freeze_time
from distribucion.application.use_cases.handle_bloque_consolidado import HandleBloqueConsolidadoListo, ProjectionError
from distribucion.application.ports import ReadModelRepo

class FakeRepo(ReadModelRepo):
    def __init__(self):
        self.processed=set(); self.choferes={}; self.bloques={}; self.bloque_orden=set()
        self.ordenes={}; self.productos=[]
    def event_already_processed(self, event_id): return event_id in self.processed
    def mark_event_processed(self, event_id): self.processed.add(event_id)
    def upsert_chofer(self, chofer_id, nombre): self.choferes[chofer_id]=nombre
    def upsert_bloque(self, bloque_id, fecha, chofer_id, chofer_nombre):
        self.bloques[bloque_id]=(fecha, chofer_id, chofer_nombre)
    def link_bloque_orden(self, bloque_id, orden_id): self.bloque_orden.add((bloque_id, orden_id))
    def update_bloque_total_ordenes(self, bloque_id): pass
    def upsert_orden(self, orden): self.ordenes[orden["id"]] = orden
    def upsert_orden_producto(self, orden_id, prod): self.productos.append((orden_id, prod))

def make_evt(evt_id="e-1"):
    return {
      "specversion":"1.0","type":"logistrack.distribucion.BloqueConsolidadoListo.v1",
      "source":"symfony://distribucion","id":evt_id,"time":"2025-08-11T10:00:00Z",
      "datacontenttype":"application/json",
      "dataschema":"https://contracts.logistrack/schemas/BloqueConsolidadoListo/1.0/schema.json",
      "subject":"bloque:b-1","data":{
        "bloque_id":"b-1","fecha_despacho":"2025-08-11T10:00:00Z",
        "chofer":{"id":"c-1","nombre":"Test"},
        "ordenes":[{"id":"o-1","pyme_id":"p-1","origen_cd_id":"cd-a","destino_cd_id":"cd-b",
                    "productos":[{"sku":"S1","qty":1,"peso":1,"volumen":0.1}]}]
      }
    }

@freeze_time("2025-08-11T10:00:00Z")
def test_usecase_ok():
    repo = FakeRepo()
    uc = HandleBloqueConsolidadoListo(repo)
    res = uc(make_evt("e-ok"))
    assert res["status"] == "ok"
    assert "b-1" in repo.bloques
    assert "o-1" in repo.ordenes
    assert ("b-1","o-1") in repo.bloque_orden
    assert "e-ok" in repo.processed

def test_usecase_idempotente():
    repo = FakeRepo()
    uc = HandleBloqueConsolidadoListo(repo)
    evt = make_evt("e-idem")
    assert uc(evt)["status"] == "ok"
    assert uc(evt)["status"] == "skipped"

def test_contrato_invalido_falla_rapido():
    repo = FakeRepo()
    uc = HandleBloqueConsolidadoListo(repo)
    bad = make_evt("e-bad"); bad["data"]["ordenes"] = []  # viola minItems
    with pytest.raises(ProjectionError):
        uc(bad)
