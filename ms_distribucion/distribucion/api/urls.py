from django.urls import path
from . import views
from .health import health

urlpatterns = [
    path("despacho/ordenes", views.DespachoOrdenList.as_view()),
    path("preparacion/ordenes", views.PreparacionOrdenList.as_view()),
    path("expedicion/ordenes", views.ExpedicionOrdenList.as_view()),
    path("recepcion/ordenes", views.RecepcionOrdenList.as_view()),
    path("consolidacion/bloques", views.BloqueList.as_view()),
    path("consolidacion/bloques/<str:id>", views.BloqueDetail.as_view()),
    path("distribucion/ordenes", views.DistribucionOrdenList.as_view()),
    path("health", health),
]