from typing import Any, Optional

def success_response(
    data: Any,
    cached: bool = False,
    stale: bool = False,
    source: Optional[str] = None
) -> dict[str, Any]:
    res: dict[str, Any] = {
        "success": True,
        "data": data,
        "cached": cached,
    }
    if stale:
        res["stale"] = True
    if source:
        # Alias sumber data: mis. /v1/studentv2/schedule yang dijawab dari MyBest
        # karena SIAKAD gagal. Konsumen bisa menampilkan label sumber.
        res["source"] = source
    return res

def error_response(
    code: str,
    message: str,
    module: Optional[str] = None,
    extra: Optional[dict[str, Any]] = None
) -> dict[str, Any]:
    err_obj: dict[str, Any] = {
        "code": code,
        "message": message,
    }
    if module:
        err_obj["module"] = module
    if extra:
        err_obj.update(extra)
    return {
        "success": False,
        "error": err_obj,
    }
