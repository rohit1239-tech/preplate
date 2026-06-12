from rest_framework.views import exception_handler


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None and isinstance(response.data, dict):
        code = getattr(exc, "default_code", "error")
        response.data = {
            "code": str(code).upper(),
            "message": response.data.get("detail", response.data),
        }
    return response
