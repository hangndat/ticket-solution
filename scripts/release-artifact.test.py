import importlib.util
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

spec = importlib.util.spec_from_file_location("release_artifact", Path(__file__).with_name("release-artifact.py"))
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


class ReleaseFixture(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = (Path(self.temp.name) / "releases").resolve()
        self.root.mkdir()
        self.pins = Path(self.temp.name) / "pins.env"

    def make_release(self, sha, marker, schema_min=1, schema_max=2, worker_safe=True):
        path = self.root / f"{sha}-{marker * 12}"
        path.mkdir()
        (path / "pnpm-lock.yaml").write_text("lock\n")
        for paths in release.ARTIFACTS.values():
            for rel in paths:
                target = path / rel
                if target.suffix:
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_text(marker)
                else:
                    target.mkdir(parents=True, exist_ok=True)
                    (target / "artifact").write_text(marker)
        files = release.inventory(path)
        manifest = {"format": 1, "sourceSha": sha,
            "lockfileSha256": release.digest(path / "pnpm-lock.yaml"),
            "workerPendingPushSafe": worker_safe,
            "services": {name: {"paths": list(paths),
                "packageVersion": "fixture-1",
                "sha256": release.service_digest(files, paths),
                "schema": {"min": schema_min, "max": schema_max}}
                for name, paths in release.ARTIFACTS.items()}, "files": files}
        (path / "release-manifest.json").write_text(json.dumps(manifest))
        release.verify(path)
        return path

    def pin(self, path, service, schema):
        release.pin(SimpleNamespace(root=self.root, release=path.name, service=service,
                                    schema=schema, pins=self.pins))

    def test_independent_pins_and_rollback_on_expand_schema(self):
        old = self.make_release("a" * 40, "a")
        new = self.make_release("b" * 40, "b")
        self.pin(old, "api", 1)
        self.pin(old, "worker", 1)
        old_worker_hash = release.verify(old)["services"]["worker"]["sha256"]
        self.pin(new, "api", 2)
        pins = release.read_pins(self.pins)
        self.assertEqual(pins["RELEASE_WORKER_DIR"], str(old))
        self.assertEqual(release.verify(old)["services"]["worker"]["sha256"], old_worker_hash)
        self.pin(new, "worker", 2)
        self.pin(old, "api", 2)
        self.assertEqual(release.read_pins(self.pins)["RELEASE_API_DIR"], str(old))
        with self.assertRaisesRegex(ValueError, "pinned or active"):
            release.cleanup(SimpleNamespace(root=self.root, releases=[old.name], pins=self.pins,
                                            active=[], execute=True))
        with self.assertRaisesRegex(ValueError, "pinned or active"):
            release.cleanup(SimpleNamespace(root=self.root, releases=[new.name], pins=Path(self.temp.name) / "empty.env",
                                            active=[str(new)], execute=False))

    def test_tamper_and_incompatible_rollback_fail_closed(self):
        old = self.make_release("c" * 40, "c", 1, 2)
        self.pin(old, "api", 1)
        with self.assertRaisesRegex(ValueError, "incompatible"):
            self.pin(old, "api", 3)
        (old / "apps/api/dist/artifact").write_text("tampered")
        with self.assertRaisesRegex(ValueError, "checksum"):
            release.verify(old)

    def test_legacy_worker_and_escape_rejected(self):
        old = self.make_release("d" * 40, "d", worker_safe=False)
        with self.assertRaisesRegex(ValueError, "legacy worker"):
            self.pin(old, "worker", 1)
        self.pins.write_text("")
        (old / "escape").symlink_to(self.pins)
        with self.assertRaisesRegex(ValueError, "symlink escapes"):
            release.verify(old)

    def test_expand_backfill_old_new_and_forward_recovery_fixture(self):
        db = sqlite3.connect(":memory:")
        db.execute("CREATE TABLE jobs(id INTEGER PRIMARY KEY, status TEXT NOT NULL)")
        db.execute("INSERT INTO jobs(status) VALUES ('PENDING')")
        # Expand: old writer and reader continue on the same schema.
        db.execute("ALTER TABLE jobs ADD COLUMN provider_status TEXT")
        db.execute("INSERT INTO jobs(status) VALUES ('PENDING')")
        self.assertEqual(db.execute("SELECT count(*) FROM jobs WHERE status='PENDING'").fetchone()[0], 2)
        # Idempotent backfill and new writer coexist with old reader.
        for _ in range(2):
            db.execute("UPDATE jobs SET provider_status='PENDING' WHERE provider_status IS NULL")
        db.execute("INSERT INTO jobs(status,provider_status) VALUES ('PENDING','ACCEPTED')")
        self.assertEqual(db.execute("SELECT count(*) FROM jobs WHERE status='PENDING'").fetchone()[0], 3)
        self.assertEqual(db.execute("SELECT count(*) FROM jobs WHERE provider_status IS NULL").fetchone()[0], 0)
        # Contract is deferred until old binaries are retired. A later incompatible
        # schema requires forward recovery, never a destructive down migration.
        old = self.make_release("e" * 40, "e", 1, 2)
        with self.assertRaisesRegex(ValueError, "incompatible"):
            self.pin(old, "api", 3)
        db.execute("UPDATE jobs SET provider_status='PENDING' WHERE id=3")
        self.assertEqual(db.execute("SELECT provider_status FROM jobs WHERE id=3").fetchone()[0], "PENDING")


if __name__ == "__main__":
    unittest.main()
