# distribucion/models.py
import uuid
from django.db import models

# -------- Choices (catálogos simples) --------
class EstadoPreparacion(models.TextChoices):
    PENDIENTE = "PEN", "Pendiente"
    COMPLETA  = "COM", "Completa"

class EstadoCompletitudBloque(models.TextChoices):
    INCOMPLETO = "INC", "Incompleto"
    COMPLETO   = "COM", "Completo"

class EstadoDistribucion(models.TextChoices):
    PENDIENTE = "PEN", "Pendiente"
    ENTREGADA = "ENT", "Entregada"
    RECHAZADA = "REJ", "Rechazada"

# -------- Base --------
class TimeStamped(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        abstract = True

# -------- Catálogos mínimos --------
class Chofer(TimeStamped):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nombre = models.CharField(max_length=200)
    def __str__(self): return self.nombre

class TipoCentro(models.TextChoices):
    CD = "CD", "Centro de Distribución"
    CAP = "CAP", "Centro de Admisión"

class Pyme(TimeStamped):
    id = models.CharField(primary_key=True, max_length=64)
    nombre = models.CharField(max_length=200)


class CentroDistribucion(TimeStamped):
    id = models.CharField(primary_key=True, max_length=64)
    nombre = models.CharField(max_length=200)
    tipo = models.CharField(max_length=3, choices=TipoCentro.choices, default=TipoCentro.CD)
    pyme_asociada = models.ForeignKey('Pyme', null=True, blank=True, on_delete=models.SET_NULL)
class Producto(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sku = models.CharField(max_length=64, unique=True, db_index=True)
    nombre = models.CharField(max_length=200)
    activo = models.BooleanField(default=True)

    def __str__(self): return f"{self.sku} - {self.nombre}"
# -------- Read-model de órdenes --------


class Orden(TimeStamped):
    id = models.CharField(primary_key=True, max_length=64)
    pyme = models.ForeignKey(
        Pyme, to_field="id", on_delete=models.PROTECT,
        related_name="ordenes"
    )
    
    origen_cd  = models.ForeignKey(
        CentroDistribucion, to_field="id", on_delete=models.PROTECT,
        related_name="ordenes_origen"
    )
    destino_cd = models.ForeignKey(
        CentroDistribucion, to_field="id", on_delete=models.PROTECT,
        related_name="ordenes_destino"
    )

    fecha_despacho = models.DateTimeField(db_index=True)
    estado_preparacion = models.CharField(
        max_length=3, choices=EstadoPreparacion.choices, default=EstadoPreparacion.PENDIENTE, db_index=True
    )

    peso_total = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    volumen_total = models.DecimalField(max_digits=12, decimal_places=6, default=0)

    chofer = models.ForeignKey(Chofer, null=True, blank=True, on_delete=models.SET_NULL, related_name="ordenes")

    class Meta:
        indexes = [
            models.Index(fields=["pyme", "fecha_despacho"]),
            models.Index(fields=["destino_cd", "fecha_despacho"]),
        ]

class OrdenProducto(models.Model):
    orden = models.ForeignKey(Orden, on_delete=models.CASCADE, related_name="lineas")
    producto = models.ForeignKey(Producto, on_delete=models.PROTECT, related_name="lineas")
    qty = models.PositiveIntegerField()
    peso = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    volumen = models.DecimalField(max_digits=12, decimal_places=6, default=0)

    class Meta:
        unique_together = [("orden", "producto")]
        indexes = [
            models.Index(fields=["orden"]),
            models.Index(fields=["producto"]),
        ]

    
# -------- Consolidación (bloques) --------
class Bolsa(TimeStamped):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    codigo = models.CharField(max_length=64, unique=True, db_index=True)  # etiqueta/QR único
    orden = models.ForeignKey(Orden, on_delete=models.CASCADE, related_name='bolsas')
    peso = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    volumen = models.DecimalField(max_digits=12, decimal_places=6, default=0)
    preparada = models.BooleanField(default=False)
    fecha_preparacion = models.DateTimeField(null=True, blank=True)
    usuario_preparador = models.CharField(max_length=120, null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=['orden'])]
class Bloque(TimeStamped):
    id = models.CharField(primary_key=True, max_length=64)
    fecha = models.DateTimeField(db_index=True)
    chofer = models.ForeignKey(Chofer, on_delete=models.PROTECT, related_name="bloques")
    # denormalizado para listar rápido
    chofer_nombre = models.CharField(max_length=200)
    total_ordenes = models.PositiveIntegerField(default=0)
    estado_completitud = models.CharField(
        max_length=3, choices=EstadoCompletitudBloque.choices, default=EstadoCompletitudBloque.INCOMPLETO, db_index=True
    )
    class Meta:
        indexes = [
            models.Index(fields=["fecha"]),
            models.Index(fields=["chofer", "estado_completitud"]),
        ]

class BloqueOrden(models.Model):
    bloque = models.ForeignKey(Bloque, on_delete=models.CASCADE, related_name="bloque_ordenes")
    orden = models.ForeignKey(Orden, on_delete=models.PROTECT, related_name="en_bloques")
    class Meta:
        unique_together = [("bloque", "orden")]

# -------- Recepción --------
class Recepcion(TimeStamped):
    orden = models.OneToOneField(Orden, on_delete=models.CASCADE, related_name="recepcion")
    cd  = models.ForeignKey(
        CentroDistribucion, to_field="id", on_delete=models.PROTECT,
        related_name="recepciones"
    )
    fecha_recepcion = models.DateTimeField(db_index=True)
    usuario_receptor = models.CharField(max_length=120)
    incidencias = models.BooleanField(default=False)
    class Meta:
        indexes = [models.Index(fields=["cd", "fecha_recepcion", "incidencias"])]

# -------- Distribución (última milla) --------
class Distribucion(TimeStamped):
    orden = models.OneToOneField(Orden, on_delete=models.CASCADE, related_name="distribucion")
    estado = models.CharField(max_length=3, choices=EstadoDistribucion.choices, db_index=True)
    fecha_entrega = models.DateTimeField(null=True, blank=True, db_index=True)
    chofer = models.ForeignKey(Chofer, null=True, blank=True, on_delete=models.SET_NULL)
    class Meta:
        indexes = [
            models.Index(fields=["estado", "fecha_entrega"]),
            models.Index(fields=["chofer", "estado"]),
        ]

# -------- Idempotencia (event processing) --------
class EventOffset(models.Model):
    event_id = models.CharField(primary_key=True, max_length=128)
    processed_at = models.DateTimeField(auto_now_add=True)
