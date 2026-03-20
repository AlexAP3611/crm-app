from typing import Any


def deep_merge(base: dict[str, Any] | None, incoming: dict[str, Any] | None) -> dict[str, Any]:
    """
    Recursively merge `incoming` into `base`.
    - Nested dicts are merged recursively (not replaced).
    - All other values in `incoming` overwrite values in `base`.
    - Returns an empty dict if both inputs are None.
    """
    result = dict(base or {})
    for key, value in (incoming or {}).items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = value
    return result
