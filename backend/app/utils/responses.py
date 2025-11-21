from typing import Any, Dict, Optional


def success_response(message: str, data: Optional[Any] = None) -> Dict[str, Any]:
    response: Dict[str, Any] = {"success": True, "message": message}
    if data is not None:
        response["data"] = data
    return response


def error_response(message: str, errors: Optional[Any] = None, status_code: Optional[int] = None) -> Dict[str, Any]:
    response: Dict[str, Any] = {"success": False, "message": message}
    if errors is not None:
        response["errors"] = errors
    if status_code is not None:
        response["status_code"] = status_code
    return response
