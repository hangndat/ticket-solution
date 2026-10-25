import importlib.util
import json
import sqlite3
import subprocess
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

    def make_release(self, sha, marker, schema_min=1, schema_max=2, worker_safe=True,
                     migrate_input_min=1, migrate_input_max=1, migrate_target=2):
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
        for rel in ("apps/web/.data", "apps/web/.next/cache", "apps/portal/.next/cache"):
            (path / rel).mkdir(parents=True)
        files = release.inventory(path)
        manifest = {"format": 2, "sourceSha": sha,
            "lockfileSha256": release.digest(path / "pnpm-lock.yaml"),
            "workerPendingPushSafe": worker_safe,
            "services": {name: {"paths": list(paths),
                "packageVersion": "fixture-1",
                "sha256": release.service_digest(files, paths),
                "schema": ({"inputMin": migrate_input_min, "inputMax": migrate_input_max,
                            "target": migrate_target} if name == "migrate" else
                           {"min": schema_min, "max": schema_max})}
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
        (old / "apps/api/dist/artifact").write_text("c")
        (old / "apps/web/.next/cache").rmdir()
        with self.assertRaisesRegex(ValueError, "mount target"):
            release.verify(old)

    def test_migration_input_is_independent_of_app_range(self):
        new = self.make_release("f" * 40, "f", schema_min=2, schema_max=2)
        self.pin(new, "migrate", 1)
        self.assertEqual(release.current_schema(release.verify(new)), 2)
        with self.assertRaisesRegex(ValueError, "incompatible"):
            self.pin(new, "api", 1)
        with self.assertRaisesRegex(ValueError, "incompatible"):
            self.pin(new, "migrate", 2)
        self.pin(new, "api", 2)
        manifest = json.loads((new / "release-manifest.json").read_text())
        manifest["services"]["migrate"]["schema"]["target"] = 0
        (new / "release-manifest.json").write_text(json.dumps(manifest))
        with self.assertRaisesRegex(ValueError, "migration input/target"):
            release.verify(new)

    def test_cleanup_pin_file_and_path_guards(self):
        old = self.make_release("1" * 40, "1")
        other = self.make_release("2" * 40, "2")
        with self.assertRaisesRegex(ValueError, "pin file missing"):
            release.cleanup(SimpleNamespace(root=self.root, releases=[old.name], pins=self.pins,
                                            active=[], execute=True))
        self.pins.write_text(f"RELEASE_API_DIR={other}\nRELEASE_API_DIR={old}\n")
        with self.assertRaisesRegex(ValueError, "invalid pin file"):
            release.cleanup(SimpleNamespace(root=self.root, releases=[old.name], pins=self.pins,
                                            active=[], execute=True))
        self.pins.write_text(f"RELEASE_API_DIR={Path(self.temp.name) / old.name}\n")
        with self.assertRaisesRegex(ValueError, "invalid pin file path"):
            release.cleanup(SimpleNamespace(root=self.root, releases=[old.name], pins=self.pins,
                                            active=[], execute=True))
        self.pins.write_text("")
        with self.assertRaisesRegex(ValueError, "pinned or active"):
            release.cleanup(SimpleNamespace(root=self.root, releases=[old.name], pins=self.pins,
                                            active=[str(old / "apps/api/dist")], execute=False))
        with self.assertRaisesRegex(ValueError, "pinned or active"):
            release.cleanup(SimpleNamespace(root=self.root, releases=[old.name], pins=self.pins,
                                            active=[str(self.root)], execute=False))
        alias = Path(self.temp.name) / "outside-alias"
        alias.symlink_to(other, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, "invalid pin file path"):
            self.pins.write_text(f"RELEASE_API_DIR={alias}\n")
            release.cleanup(SimpleNamespace(root=self.root, releases=[old.name], pins=self.pins,
                                            active=[], execute=True))

    def test_stopped_container_subdirectory_mount_blocks_cleanup(self):
        try:
            subprocess.run(["docker", "info"], stdout=subprocess.DEVNULL,
                           stderr=subprocess.DEVNULL, check=True)
            subprocess.run(["docker", "image", "inspect", "postgres:18.1-alpine"],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        except (FileNotFoundError, subprocess.CalledProcessError):
            self.skipTest("Docker with local postgres:18.1-alpine image unavailable")
        old = self.make_release("3" * 40, "3")
        self.pins.write_text("")
        container = subprocess.check_output([
            "docker", "create", "--label", "ticket.task=task_93ead9bd28b9",
            "--mount", f"type=bind,src={old / 'apps/api/dist'},dst=/fixture,readonly",
            "postgres:18.1-alpine", "sh", "-c", "exit 0"], text=True).strip()
        self.addCleanup(lambda: subprocess.run(["docker", "rm", "-f", container],
                                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
        with self.assertRaisesRegex(ValueError, "pinned or active"):
            release.cleanup(SimpleNamespace(root=self.root, releases=[old.name], pins=self.pins,
                                            active=[], execute=True))
        self.assertTrue(old.is_dir())

    def test_legacy_worker_and_escape_rejected(self):
        old = self.make_release("d" * 40, "d", worker_safe=False)
        with self.assertRaisesRegex(ValueError, "legacy worker"):
            self.pin(old, "worker", 1)
        self.pins.write_text("")
        (old / "escape").symlink_to(self.pins)
        with self.assertRaisesRegex(ValueError, "symlink escapes"):
            release.verify(old)
        alias = Path(self.temp.name) / "release-alias"
        alias.symlink_to(self.root, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, "without a symlink"):
            release.pin(SimpleNamespace(root=alias, release=old.name, service="api",
                                        schema=1, pins=self.pins))

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
