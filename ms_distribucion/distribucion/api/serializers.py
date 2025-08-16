# distribucion/api/serializers.py
from rest_framework import serializers
from distribucion.models import (
    Pyme, CentroDistribucion, Chofer, Producto,
    Orden, OrdenProducto, Bloque, Recepcion, Distribucion
)

# ---- minis ----
class PymeMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Pyme
        fields = ("id", "nombre")

class CentroMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = CentroDistribucion
        fields = ("id", "nombre")

class ChoferMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Chofer
        fields = ("id", "nombre")

class ProductoMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Producto
        fields = ("sku", "nombre")

# ---- orden / líneas ----
class OrdenProductoSerializer(serializers.ModelSerializer):
    producto = ProductoMiniSerializer(read_only=True)

    class Meta:
        model = OrdenProducto
        fields = ("producto", "qty", "peso", "volumen")

class OrdenSerializer(serializers.ModelSerializer):
    pyme = PymeMiniSerializer(read_only=True)
    origen_cd = CentroMiniSerializer(read_only=True)
    destino_cd = CentroMiniSerializer(read_only=True)
    chofer = ChoferMiniSerializer(read_only=True)
    lineas = OrdenProductoSerializer(many=True, read_only=True)
    estado_preparacion_label = serializers.CharField(
        source="get_estado_preparacion_display", read_only=True
    )
    bolsas_count = serializers.IntegerField(read_only=True)
    class Meta:
        model = Orden
        fields = (
            "id",
            "pyme", "origen_cd", "destino_cd",
            "fecha_despacho",
            "estado_preparacion", "estado_preparacion_label",
            "peso_total", "volumen_total",
            "chofer",
            "lineas",
            "bolsas_count",
        )

# ---- recepcion / distribucion ----
class RecepcionSerializer(serializers.ModelSerializer):
    cd = CentroMiniSerializer(read_only=True)
    class Meta:
        model = Recepcion
        fields = ("orden_id", "cd", "fecha_recepcion", "usuario_receptor", "incidencias")

class DistribucionSerializer(serializers.ModelSerializer):
    estado_label = serializers.CharField(source="get_estado_display", read_only=True)

    class Meta:
        model = Distribucion
        fields = ("orden_id", "estado", "estado_label", "fecha_entrega", "chofer_id")

# ---- bloques ----
class BloqueListSerializer(serializers.ModelSerializer):
    chofer = ChoferMiniSerializer(read_only=True)

    class Meta:
        model = Bloque
        fields = ("id", "fecha", "chofer", "chofer_nombre", "total_ordenes", "estado_completitud")

class BloqueDetailSerializer(serializers.ModelSerializer):
    chofer = ChoferMiniSerializer(read_only=True)
    ordenes = serializers.SerializerMethodField()

    class Meta:
        model = Bloque
        fields = (
            "id", "fecha", "chofer", "chofer_nombre",
            "total_ordenes", "estado_completitud",
            "ordenes",
        )

    def get_ordenes(self, obj):
        qs = (
            Orden.objects
            .filter(en_bloques__bloque=obj)
            .select_related("pyme", "origen_cd", "destino_cd", "chofer")
            .prefetch_related("lineas__producto")
            .only(
                "id", "pyme_id", "origen_cd_id", "destino_cd_id",
                "fecha_despacho", "estado_preparacion",
                "peso_total", "volumen_total", "chofer_id"
            )
        )
        # Devuelve detalle con líneas y producto (sku/nombre)
        return OrdenSerializer(qs, many=True).data
