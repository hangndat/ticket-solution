#!/usr/bin/env python3
"""Verify this design folder, or a ZIP containing it, against MANIFEST.json."""

import hashlib
import json
import sys
import zipfile
from pathlib import Path


def verify(manifest, payloads):
    listed = {item["path"]: item for item in manifest["files"]}
    assert set(listed) == set(payloads), (
        f"Missing: {sorted(set(listed) - set(payloads))}; "
        f"Extra: {sorted(set(payloads) - set(listed))}"
    )
    for name, item in listed.items():
        data = payloads[name]
        assert len(data) == item["bytes"], f"Size mismatch: {name}"
        assert hashlib.sha256(data).hexdigest() == item["sha256"], f"SHA-256 mismatch: {name}"
    print(f"PASS: {len(listed)} payload files; no missing, extra or mismatched files.")


source = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent
if source.is_dir():
    manifest = json.loads((source / "MANIFEST.json").read_text())
    payloads = {
        str(file.relative_to(source)): file.read_bytes()
        for file in source.rglob("*")
        if file.is_file() and file.name not in {"MANIFEST.json", ".DS_Store"}
    }
else:
    with zipfile.ZipFile(source) as archive:
        assert archive.testzip() is None, "Archive CRC verification failed"
        manifests = [name for name in archive.namelist() if name.endswith("/MANIFEST.json")]
        assert len(manifests) == 1, "Expected one MANIFEST.json in archive"
        prefix = manifests[0][: -len("MANIFEST.json")]
        manifest = json.loads(archive.read(manifests[0]))
        payloads = {
            name[len(prefix) :]: archive.read(name)
            for name in archive.namelist()
            if name.startswith(prefix)
            and not name.endswith("/")
            and name not in {manifests[0], prefix + ".DS_Store"}
        }
verify(manifest, payloads)
