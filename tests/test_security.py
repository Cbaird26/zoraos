"""Tests for local-only and API-key gateway access."""

from api.security import authorize_api_request, is_loopback_client


def test_loopback_detection() -> None:
    assert is_loopback_client("127.0.0.1")
    assert is_loopback_client("::1")
    assert not is_loopback_client("192.168.1.20")


def test_placeholder_secret_is_local_only() -> None:
    local = authorize_api_request(
        "change-me-to-a-random-string",
        None,
        "127.0.0.1",
    )
    remote = authorize_api_request(
        "change-me-to-a-random-string",
        None,
        "192.168.1.20",
    )

    assert local[0]
    assert not remote[0]
    assert remote[1] == 403


def test_configured_secret_is_required_for_every_client() -> None:
    missing = authorize_api_request("configured-secret", None, "127.0.0.1")
    wrong = authorize_api_request("configured-secret", "wrong", "192.168.1.20")
    valid = authorize_api_request(
        "configured-secret",
        "configured-secret",
        "192.168.1.20",
    )

    assert not missing[0]
    assert missing[1] == 401
    assert not wrong[0]
    assert valid[0]
