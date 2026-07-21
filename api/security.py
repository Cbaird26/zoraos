from __future__ import annotations

import hmac
import ipaddress

PLACEHOLDER_SECRETS = {"", "change-me-to-a-random-string"}


def is_loopback_client(host: str | None) -> bool:
    if not host:
        return False
    if host in {"localhost", "testclient"}:
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


def authorize_api_request(
    configured_secret: str,
    supplied_secret: str | None,
    client_host: str | None,
) -> tuple[bool, int, str]:
    """Authorize protected API routes without exposing secret material.

    A placeholder configuration is permitted only from a loopback client. Once a real
    secret is configured, every client (including localhost) must send X-ZoraOS-Key.
    """

    if configured_secret in PLACEHOLDER_SECRETS:
        if is_loopback_client(client_host):
            return True, 200, "local-only development access"
        return False, 403, "Remote API access is disabled until a gateway key is configured"

    if supplied_secret and hmac.compare_digest(supplied_secret, configured_secret):
        return True, 200, "authenticated"
    return False, 401, "Missing or invalid X-ZoraOS-Key header"
