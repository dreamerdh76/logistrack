from __future__ import annotations
from datetime import datetime
from distribucion.contracts.validator import validate_cloudevent, validate_data, ContractError
from ..ports import ReadModelRepo

class ProjectionError(RuntimeError): ...

class HandleBloqueConsolidadoListo:
    """
    Caso de uso: proyecta el evento (idempotente) al read-model.
    """

    def __init__(self, repo: ReadModelRepo) -> None:
        self.repo = repo

    def __call__(self, cloudevent: dict) -> dict:
        # 1) contrato
        try:
            validate_cloudevent(cloudevent)
            validate_data(cloudevent["data"], cloudevent["dataschema"])
        except ContractError as e:
            raise ProjectionError(f"Contrato inválido: {e}") from e

        evt_id = cloudevent["id"]
        data   = cloudevent["data"]

        # 2) idempotencia
        if self.repo.event_already_processed(evt_id):
            return {"status": "skipped", "reason": "already_processed"}

        # 3) upserts
        bloque_id       = data["bloque_id"]
        fecha_despacho  = _parse_dt(data["fecha_despacho"])
        chofer_id       = data["chofer"]["id"]
        chofer_nombre   = data["chofer"]["nombre"]

        self.repo.upsert_chofer(chofer_id, chofer_nombre)
        self.repo.upsert_bloque(bloque_id, fecha_despacho, chofer_id, chofer_nombre)

        total_ordenes = 0
        for o in data["ordenes"]:
            total_ordenes += 1
            orden_dict = {
                "id":             o["id"],
                "pyme_id":        o["pyme_id"],
                "origen_cd_id":   o["origen_cd_id"],
                "destino_cd_id":  o["destino_cd_id"],
                "fecha_despacho": fecha_despacho,
                "chofer_id":      chofer_id,
                # calcula si no viene
                "peso_total":     o.get("peso_total", _sum(o["productos"], "peso")),
                "volumen_total":  o.get("volumen_total", _sum(o["productos"], "volumen")),
                # estado_preparacion default = pendiente (lo ajustará el flujo real)
                "estado_preparacion": "PEN",
            }
            self.repo.upsert_orden(orden_dict)

            for p in o["productos"]:
                self.repo.upsert_orden_producto(o["id"], {
                    "sku": p["sku"], "qty": p["qty"],
                    "peso": p.get("peso", 0), "volumen": p.get("volumen", 0),
                })

            self.repo.link_bloque_orden(bloque_id, o["id"])

        self.repo.update_bloque_total_ordenes(bloque_id)

        # 4) marca idempotencia
        self.repo.mark_event_processed(evt_id)

        return {"status": "ok", "bloque_id": bloque_id, "ordenes": total_ordenes}

def _sum(items: list[dict], field: str) -> float:
    return float(sum(float(x.get(field, 0) or 0) for x in items))

def _parse_dt(s: str) -> datetime:
    from datetime import timezone
    if s.endswith("Z"):
        return datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone(timezone.utc)
    return datetime.fromisoformat(s)
