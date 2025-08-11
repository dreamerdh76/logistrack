from rest_framework import serializers
from distribucion.models import Orden, OrdenProducto, Bloque, BloqueOrden, Recepcion, Distribucion

class OrdenProductoSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrdenProducto
        fields = ("sku","qty","peso","volumen")

class OrdenSerializer(serializers.ModelSerializer):
    class Meta:
        model = Orden
        fields = (
            "id","pyme_id","origen_cd_id","destino_cd_id","fecha_despacho",
            "estado_preparacion","peso_total","volumen_total","chofer_id"
        )

class RecepcionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Recepcion
        fields = ("orden_id","cd_id","fecha_recepcion","usuario_receptor","incidencias")

class DistribucionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Distribucion
        fields = ("orden_id","estado","fecha_entrega","chofer_id")

class BloqueListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Bloque
        fields = ("id","fecha","chofer_id","chofer_nombre","total_ordenes","estado_completitud")

class BloqueDetailSerializer(serializers.ModelSerializer):
    ordenes = serializers.SerializerMethodField()
    class Meta:
        model = Bloque
        fields = ("id","fecha","chofer_id","chofer_nombre","total_ordenes","estado_completitud","ordenes")
    def get_ordenes(self, obj):
        qs = Orden.objects.filter(en_bloques__bloque_id=obj.id).only(
            "id","pyme_id","origen_cd_id","destino_cd_id","fecha_despacho","chofer_id","estado_preparacion"
        )
        return OrdenSerializer(qs, many=True).data
