import uuid
from django.utils.deprecation import MiddlewareMixin

class RequestIdMiddleware(MiddlewareMixin):
    HEADER = "HTTP_X_REQUEST_ID"
    def process_request(self, request):
        rid = request.META.get(self.HEADER) or str(uuid.uuid4())
        request.request_id = rid
    def process_response(self, request, response):
        rid = getattr(request, "request_id", None)
        if rid: response["X-Request-ID"] = rid
        return response
