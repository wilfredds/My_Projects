"""Backend tests for CourtSplit API."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://badminton-costs.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


# --- Basic health ---
def test_root(s):
    r = s.get(f"{API}/")
    assert r.status_code == 200
    assert "message" in r.json()


# --- CRUD + calculation ---
created_ids = []


def test_create_worked_example(s):
    payload = {
        "venue": "TEST_Court A",
        "date": "2026-01-15",
        "court_fee": 600,
        "num_shuttles": 3,
        "price_per_shuttle": 120,
        "currency": "PHP",
        "players": [{"name": f"TEST_P{i}"} for i in range(6)],
    }
    r = s.post(f"{API}/sessions", json=payload)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "id" in d
    assert len(d["players"]) == 6
    for p in d["players"]:
        assert "id" in p and p["paid"] is False
    assert d["court_fee"] == 600
    assert d["num_shuttles"] == 3
    assert d["price_per_shuttle"] == 120
    # calc verification: 600 + 360 = 960; per player 160 (100 court + 60 shuttle)
    total = d["court_fee"] + d["num_shuttles"] * d["price_per_shuttle"]
    assert total == 960
    per_player = total / len(d["players"])
    assert round(per_player, 2) == 160.00
    created_ids.append(d["id"])


def test_get_and_list(s):
    sid = created_ids[0]
    r = s.get(f"{API}/sessions/{sid}")
    assert r.status_code == 200
    assert r.json()["id"] == sid

    r2 = s.get(f"{API}/sessions")
    assert r2.status_code == 200
    ids = [x["id"] for x in r2.json()]
    assert sid in ids


def test_get_unknown_404(s):
    r = s.get(f"{API}/sessions/does-not-exist-xyz")
    assert r.status_code == 404


def test_toggle_paid(s):
    sid = created_ids[0]
    session = s.get(f"{API}/sessions/{sid}").json()
    pid = session["players"][0]["id"]
    r = s.patch(f"{API}/sessions/{sid}/players/{pid}", json={"paid": True})
    assert r.status_code == 200
    updated = r.json()
    p = next(p for p in updated["players"] if p["id"] == pid)
    assert p["paid"] is True
    # verify persistence
    g = s.get(f"{API}/sessions/{sid}").json()
    assert next(p for p in g["players"] if p["id"] == pid)["paid"] is True


def test_toggle_paid_unknown_player(s):
    sid = created_ids[0]
    r = s.patch(f"{API}/sessions/{sid}/players/nope", json={"paid": True})
    assert r.status_code == 404


def test_update_session(s):
    sid = created_ids[0]
    existing = s.get(f"{API}/sessions/{sid}").json()
    payload = {
        "venue": "TEST_Court B",
        "date": existing["date"],
        "court_fee": 800,
        "num_shuttles": 2,
        "price_per_shuttle": 150,
        "currency": "USD",
        "players": [{"id": p["id"], "name": p["name"], "paid": p["paid"]} for p in existing["players"][:4]],
    }
    r = s.put(f"{API}/sessions/{sid}", json=payload)
    assert r.status_code == 200
    d = r.json()
    assert d["venue"] == "TEST_Court B"
    assert d["currency"] == "USD"
    assert d["court_fee"] == 800
    assert len(d["players"]) == 4


def test_rounding_case(s):
    # 100 court + 0 shuttles / 3 players -> 33.33...
    payload = {
        "venue": "TEST_Round",
        "date": "2026-01-16",
        "court_fee": 100,
        "num_shuttles": 0,
        "price_per_shuttle": 0,
        "currency": "PHP",
        "players": [{"name": "A"}, {"name": "B"}, {"name": "C"}],
    }
    r = s.post(f"{API}/sessions", json=payload)
    assert r.status_code == 200
    d = r.json()
    created_ids.append(d["id"])
    per = (d["court_fee"] + d["num_shuttles"] * d["price_per_shuttle"]) / len(d["players"])
    assert round(per, 2) == 33.33


def test_delete_session(s):
    # Cleanup all created
    for sid in created_ids:
        r = s.delete(f"{API}/sessions/{sid}")
        assert r.status_code == 200
        g = s.get(f"{API}/sessions/{sid}")
        assert g.status_code == 404


def test_delete_unknown_404(s):
    r = s.delete(f"{API}/sessions/nope-nope")
    assert r.status_code == 404
