from distribucion.models import (
    Chofer, Bloque, BloqueOrden, Orden, OrdenProducto, EventOffset
)

class DjangoReadModelRepo:
    def event_already_processed(self, event_id: str) -> bool:
        return EventOffset.objects.filter(event_id=event_id).exists()

    def mark_event_processed(self, event_id: str) -> None:
        EventOffset.objects.get_or_create(event_id=event_id)

    def upsert_chofer(self, chofer_id: str, nombre: str) -> None:
        Chofer.objects.update_or_create(id=chofer_id, defaults={"nombre": nombre})

    def upsert_bloque(self, bloque_id, fecha, chofer_id, chofer_nombre) -> None:
        Bloque.objects.update_or_create(
            id=bloque_id,
            defaults={
                "fecha": fecha, "chofer_id": chofer_id,
                "chofer_nombre": chofer_nombre
            },
        )

    def link_bloque_orden(self, bloque_id: str, orden_id: str) -> None:
        BloqueOrden.objects.get_or_create(bloque_id=bloque_id, orden_id=orden_id)

    def update_bloque_total_ordenes(self, bloque_id: str) -> None:
        total = BloqueOrden.objects.filter(bloque_id=bloque_id).count()
        Bloque.objects.filter(id=bloque_id).update(total_ordenes=total)

    def upsert_orden(self, orden: dict) -> None:
        Orden.objects.update_or_create(
            id=orden["id"],
            defaults={
                "pyme_id": orden["pyme_id"],
                "origen_cd_id": orden["origen_cd_id"],
                "destino_cd_id": orden["destino_cd_id"],
                "fecha_despacho": orden["fecha_despacho"],
                "estado_preparacion": orden["estado_preparacion"],
                "peso_total": orden["peso_total"],
                "volumen_total": orden["volumen_total"],
                "chofer_id": orden["chofer_id"],
            },
        )

    def upsert_orden_producto(self, orden_id: str, prod: dict) -> None:
        OrdenProducto.objects.update_or_create(
            orden_id=orden_id, sku=prod["sku"],
            defaults={
                "qty": prod["qty"],
                "peso": prod.get("peso", 0),
                "volumen": prod.get("volumen", 0),
            },
        )
