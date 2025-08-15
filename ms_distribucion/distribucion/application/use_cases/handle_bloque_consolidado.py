# distribucion/application/use_cases/handle_bloque_consolidado.py
from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Dict
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from distribucion.contracts.validator import ContractError   # ✅ usa el mismo
from distribucion.application.ports import ReadModelRepo

class ProjectionError(Exception): ...
class ContractError(Exception): ...

@dataclass
class HandleBloqueConsolidadoListo:
    repo: "ReadModelRepo"
    strict_orders: bool = True

    def __call__(self, ce: Dict[str, Any]) -> dict:
        evt_id = ce.get("id")
        if not evt_id: raise ContractError("CloudEvent sin id")
        if self.repo.event_already_processed(evt_id):
            return {"id": evt_id, "status": "duplicate"}
        if ce.get("type") != "logistrack.distribucion.BloqueConsolidadoListo.v2":
            raise ContractError("type inválido")

        data   = ce["data"]
        b      = data["bloque"]
        b_id   = str(b["id"])
        b_fecha= _to_dt(b["fecha"])
        ch_id  = str(b["chofer"]["id"])
        ch_nom = b["chofer"]["nombre"]

        # upserts mínimos + forzar INCOMPLETO
        self.repo.upsert_chofer(ch_id, ch_nom)
        self.repo.upsert_bloque(b_id, b_fecha, ch_id, ch_nom)
        self.repo.set_bloque_incompleto(b_id)

        # enlazar órdenes existentes
        ids = [str(o["id"]) for o in data["ordenes"] if o.get("id")]
        existentes = set(self.repo.existing_order_ids(ids))
        faltantes  = [i for i in ids if i not in existentes]
        if faltantes and self.strict_orders:
            raise ProjectionError(f"órdenes inexistentes: {faltantes[:5]}{'…' if len(faltantes)>5 else ''}")

        linked = self.repo.bulk_link_bloque_orden(b_id, list(existentes))
        self.repo.update_bloque_total_ordenes(b_id)
        self.repo.mark_event_processed(evt_id)
        return {"id": evt_id, "bloque_id": b_id, "linked": linked, "missing": len(faltantes)}

def _to_dt(s: str):
    dt = parse_datetime(s)
    if dt is None: raise ContractError(f"fecha inválida: {s}")
    if timezone.is_naive(dt): dt = timezone.make_aware(dt, timezone.utc)
    return dt
