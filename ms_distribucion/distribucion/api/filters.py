import django_filters as df
from django.utils import timezone
from datetime import datetime, timedelta
from distribucion.models import Orden, Bloque, Recepcion, Distribucion
from django.db.models import Q

class RangoFechaMixin:
    desde = df.IsoDateTimeFilter(field_name="fecha_despacho", lookup_expr="gte")
    hasta = df.IsoDateTimeFilter(field_name="fecha_despacho", lookup_expr="lte")

# Despacho
class DespachoOrdenFilter(RangoFechaMixin, df.FilterSet):
    cd = df.CharFilter(method="by_cd_name")          # origen o destino
    pyme_id = df.CharFilter(field_name="pyme_id", lookup_expr="exact")
    class Meta:
        model = Orden
        fields = ("cd","pyme_id")
    def by_cd_name(self, qs, name, value: str):
        """
        Busca por nombre (parcial, case-insensitive) en origen o destino.
        Soporta múltiple entrada separada por comas: ?cd=Quito,Guayaquil
        """
        terms = [t.strip() for t in value.split(",") if t.strip()]
        cond = Q()
        for t in terms:
            cond |= Q(origen_cd__nombre__icontains=t) | Q(destino_cd__nombre__icontains=t)
        return qs.filter(cond).distinct()

# Preparación
class PreparacionOrdenFilter(RangoFechaMixin, df.FilterSet):
    estado = df.CharFilter(field_name="estado_preparacion", lookup_expr="exact")
    class Meta:
        model = Orden
        fields = ("estado",)

# Expedición (ordenes con chofer asignado)
class ExpedicionOrdenFilter(df.FilterSet):
    chofer_id = df.CharFilter(field_name="chofer_id", lookup_expr="exact")
    fecha = df.DateFilter(method="por_dia")
    class Meta:
        model = Orden
        fields = ("chofer_id","fecha")
    def por_dia(self, qs, name, value):
        start = datetime.combine(value, datetime.min.time(), tzinfo=timezone.get_current_timezone())
        end   = start + timedelta(days=1)
        return qs.filter(fecha_despacho__gte=start, fecha_despacho__lt=end)

# Recepción
class RecepcionFilter(df.FilterSet):
    cd_id = df.CharFilter(field_name="cd_id", lookup_expr="exact")
    incidencias = df.BooleanFilter(field_name="incidencias")
    desde = df.IsoDateTimeFilter(field_name="fecha_recepcion", lookup_expr="gte")
    hasta = df.IsoDateTimeFilter(field_name="fecha_recepcion", lookup_expr="lte")
    class Meta:
        model = Recepcion
        fields = ("cd_id","incidencias")

# Consolidación
class BloqueFilter(df.FilterSet):
    fecha = df.DateFilter(method="por_dia")
    chofer_id = df.CharFilter(field_name="chofer_id", lookup_expr="exact")
    estado = df.CharFilter(field_name="estado_completitud", lookup_expr="exact")
    chofer_nombre = df.CharFilter(field_name="chofer_nombre", lookup_expr="icontains")
    class Meta:
        model = Bloque
        fields = ("fecha","chofer_id","estado","chofer_nombre")
    def por_dia(self, qs, name, value):
        start = datetime.combine(value, datetime.min.time(), tzinfo=timezone.get_current_timezone())
        end   = start + timedelta(days=1)
        return qs.filter(fecha__gte=start, fecha__lt=end)

# Distribución
class DistribucionFilter(df.FilterSet):
    estado = df.CharFilter(field_name="estado", lookup_expr="exact")
    chofer_id = df.CharFilter(field_name="chofer_id", lookup_expr="exact")
    desde = df.IsoDateTimeFilter(field_name="fecha_entrega", lookup_expr="gte")
    hasta = df.IsoDateTimeFilter(field_name="fecha_entrega", lookup_expr="lte")
    class Meta:
        model = Distribucion
        fields = ("estado","chofer_id")
