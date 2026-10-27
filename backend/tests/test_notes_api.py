# Notes API regression tests (CRUD + reset seed)
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# Reset/seed
class TestReset:
    def test_reset_seeds_8(self, s):
        r = s.post(f"{API}/notes/reset")
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 8
        for n in data:
            assert "id" in n and "_id" not in n
            assert isinstance(n["id"], str) and len(n["id"]) == 24
        titles = [n["title"] for n in data]
        assert titles[0] == "Buy groceries"
        dentist = next(n for n in data if n["title"] == "Call the dentist")
        assert dentist["is_task"] is True and dentist["done"] is True

    def test_list_after_reset_order(self, s):
        s.post(f"{API}/notes/reset")
        r = s.get(f"{API}/notes")
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 8
        assert data[0]["title"] == "Buy groceries"
        assert data[-1]["title"] == "Renew passport"
        assert all("_id" not in n for n in data)


# CRUD
class TestCrud:
    def test_create_get_update_delete(self, s):
        r = s.post(f"{API}/notes", json={"title": "TEST_note", "body": "b", "is_task": True})
        assert r.status_code == 200
        n = r.json()
        assert n["title"] == "TEST_note" and n["is_task"] is True and n["done"] is False
        assert "_id" not in n
        nid = n["id"]

        g = s.get(f"{API}/notes/{nid}")
        assert g.status_code == 200 and g.json()["title"] == "TEST_note"

        # new note appears first in list (sorted by created_at desc)
        lst = s.get(f"{API}/notes").json()
        assert lst[0]["id"] == nid

        u = s.patch(f"{API}/notes/{nid}", json={"done": True, "title": "TEST_upd"})
        assert u.status_code == 200
        assert u.json()["done"] is True and u.json()["title"] == "TEST_upd"
        g2 = s.get(f"{API}/notes/{nid}").json()
        assert g2["done"] is True and g2["title"] == "TEST_upd" and g2["body"] == "b"

        d = s.delete(f"{API}/notes/{nid}")
        assert d.status_code == 200 and d.json() == {"ok": True}
        assert s.get(f"{API}/notes/{nid}").status_code == 404

    def test_create_empty_title_allowed(self, s):
        # backend has no title validation (broken-forms mode relies on this)
        r = s.post(f"{API}/notes", json={"title": "", "body": ""})
        assert r.status_code == 200
        s.delete(f"{API}/notes/{r.json()['id']}")

    def test_create_missing_title_422(self, s):
        assert s.post(f"{API}/notes", json={"body": "x"}).status_code == 422


# Error handling
class TestErrors:
    @pytest.mark.parametrize("method", ["get", "patch", "delete"])
    def test_invalid_id_404(self, s, method):
        kw = {"json": {"done": True}} if method == "patch" else {}
        r = getattr(s, method)(f"{API}/notes/notanid", **kw)
        assert r.status_code == 404

    @pytest.mark.parametrize("method", ["get", "patch", "delete"])
    def test_missing_id_404(self, s, method):
        kw = {"json": {"done": True}} if method == "patch" else {}
        r = getattr(s, method)(f"{API}/notes/0123456789abcdef01234567", **kw)
        assert r.status_code == 404
