from rest_framework import generics
from distribucion.models import Orden, Bloque, Recepcion, Distribucion
from .serializers import (
    OrdenSerializer, BloqueListSerializer, BloqueDetailSerializer,
    RecepcionSerializer, DistribucionSerializer
)
from .filters import (
    DespachoOrdenFilter, PreparacionOrdenFilter, ExpedicionOrdenFilter,
    BloqueFilter, RecepcionFilter, DistribucionFilter
)
from drf_spectacular.utils import extend_schema, OpenApiParameter

# Despacho
@extend_schema(parameters=[
  OpenApiParameter(name='desde', location='query', required=False, type=str),
  OpenApiParameter(name='hasta', location='query', required=False, type=str),
  OpenApiParameter(name='cd_id', location='query', required=False, type=str),
])
class DespachoOrdenList(generics.ListAPIView):
    queryset = Orden.objects.all().order_by("-fecha_despacho")
    serializer_class = OrdenSerializer
    filterset_class = DespachoOrdenFilter
    ordering_fields = ["fecha_despacho","pyme_id","origen_cd_id","destino_cd_id"]

# Preparación.
@extend_schema(parameters=[
  OpenApiParameter(name='desde', location='query', required=False, type=str),
  OpenApiParameter(name='hasta', location='query', required=False, type=str),
  OpenApiParameter(name='cd_id', location='query', required=False, type=str),
])
class PreparacionOrdenList(generics.ListAPIView):
    queryset = Orden.objects.all().order_by("-fecha_despacho")
    serializer_class = OrdenSerializer
    filterset_class = PreparacionOrdenFilter
    ordering_fields = ["fecha_despacho","estado_preparacion"]

# Expedición
class ExpedicionOrdenList(generics.ListAPIView):
    queryset = Orden.objects.exclude(chofer_id__isnull=True).order_by("-fecha_despacho")
    serializer_class = OrdenSerializer
    filterset_class = ExpedicionOrdenFilter
    ordering_fields = ["fecha_despacho","chofer_id"]

# Recepción
class RecepcionOrdenList(generics.ListAPIView):
    queryset = Recepcion.objects.select_related("orden").order_by("-fecha_recepcion")
    serializer_class = RecepcionSerializer
    filterset_class = RecepcionFilter
    ordering_fields = ["fecha_recepcion","cd_id","incidencias"]

# Consolidación
class BloqueList(generics.ListAPIView):
    queryset = Bloque.objects.all().order_by("-fecha")
    serializer_class = BloqueListSerializer
    filterset_class = BloqueFilter
    ordering_fields = ["fecha","chofer_id","estado_completitud","total_ordenes"]

class BloqueDetail(generics.RetrieveAPIView):
    queryset = Bloque.objects.all()
    serializer_class = BloqueDetailSerializer
    lookup_field = "id"

# Distribución
class DistribucionOrdenList(generics.ListAPIView):
    queryset = Distribucion.objects.select_related("orden").order_by("-fecha_entrega", "-orden__fecha_despacho")
    serializer_class = DistribucionSerializer
    filterset_class = DistribucionFilter
    ordering_fields = ["fecha_entrega","estado","chofer_id"]
