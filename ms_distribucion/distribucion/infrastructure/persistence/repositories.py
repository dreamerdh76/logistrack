# distribucion/infrastructure/persistence/repositories.py
from typing import Iterable, List
from distribucion.models import (
    Chofer, Bloque, BloqueOrden, Orden, EventOffset,
    EstadoCompletitudBloque,
)

class DjangoReadModelRepo:
    def event_already_processed(self, event_id: str) -> bool:
        return EventOffset.objects.filter(event_id=event_id).exists()

    def mark_event_processed(self, event_id: str) -> None:
        EventOffset.objects.get_or_create(event_id=event_id)

    def upsert_chofer(self, chofer_id: str, nombre: str) -> None:
        Chofer.objects.update_or_create(id=chofer_id, defaults={"nombre": nombre})

    def upsert_bloque(self, bloque_id: str, fecha, chofer_id: str, chofer_nombre: str) -> None:
        Bloque.objects.update_or_create(
            id=bloque_id,
            defaults={"fecha": fecha, "chofer_id": chofer_id, "chofer_nombre": chofer_nombre},
        )

    def set_bloque_incompleto(self, bloque_id: str) -> None:
        Bloque.objects.filter(id=bloque_id).update(estado_completitud=EstadoCompletitudBloque.INCOMPLETO)

    def existing_order_ids(self, ids: Iterable[str]) -> List[str]:
        return list(Orden.objects.filter(id__in=list(ids)).values_list("id", flat=True))

    def bulk_link_bloque_orden(self, bloque_id: str, order_ids: Iterable[str]) -> int:
        objs = [BloqueOrden(bloque_id=bloque_id, orden_id=o) for o in order_ids]
        created = BloqueOrden.objects.bulk_create(objs, ignore_conflicts=True)
        return len(created)

    def update_bloque_total_ordenes(self, bloque_id: str) -> None:
        total = BloqueOrden.objects.filter(bloque_id=bloque_id).count()
        Bloque.objects.filter(id=bloque_id).update(total_ordenes=total)
