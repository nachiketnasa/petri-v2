from fastapi.testclient import TestClient

from petri_backend.app import app

client = TestClient(app)

ALLOWED_ORIGIN = "http://localhost:5173"
DISALLOWED_ORIGIN = "http://evil.example.com"


def test_preflight_from_allowed_origin_returns_200_with_cors_headers():
    response = client.options(
        "/experiments",
        headers={
            "Origin": ALLOWED_ORIGIN,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGIN
    assert response.headers["access-control-allow-credentials"] == "true"
    assert "access-control-allow-methods" in response.headers
    assert "access-control-allow-headers" in response.headers


def test_real_response_to_allowed_origin_includes_matching_allow_origin():
    response = client.get("/health", headers={"Origin": ALLOWED_ORIGIN})
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGIN
    assert response.headers["access-control-allow-credentials"] == "true"


def test_disallowed_origin_gets_no_allow_origin_header():
    response = client.get("/health", headers={"Origin": DISALLOWED_ORIGIN})
    assert response.status_code == 200
    assert "access-control-allow-origin" not in response.headers
