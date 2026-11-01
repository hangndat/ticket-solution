#!/usr/bin/env python3
"""Build, verify, pin and retire immutable VPS release directories.

No command in this file connects to a host or starts Compose. The operator runs
Compose separately, after inspecting the proposed pin file.
"""

import argparse
import hashlib
import json
import os
import platform as host_platform
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import time
from pathlib import Path

SERVICES = ("api", "worker", "web", "portal", "migrate")
ARTIFACTS = {
    "api": ("apps/api/dist", "packages/backend/dist", "packages/contracts/dist"),
    "worker": ("apps/worker/dist", "packages/backend/dist", "packages/contracts/dist"),
    "web": ("apps/web/.next", "packages/ui/dist", "packages/web-session/dist", "packages/contracts/dist"),
    "portal": ("apps/portal/.next", "packages/ui/dist", "packages/web-session/dist", "packages/contracts/dist"),
    "migrate": ("packages/backend/prisma/migrations", "packages/backend/prisma/schema.prisma"),
}
SOURCE_PATHS = ("package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "tsconfig.base.json",
                "apps/api", "apps/worker", "apps/web", "apps/portal", "packages/backend",
                "packages/contracts", "packages/ui", "packages/web-session", "brand")
SHA = re.compile(r"[0-9a-f]{40}\Z")
RELEASE_ID = re.compile(r"[0-9a-f]{40}-[0-9a-f]{12}\Z")


def fail(message):
    raise ValueError(message)


def digest(path):
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def files_for(root):
    for path in sorted(root.rglob("*")):
        if path.is_symlink():
            try:
                target = path.resolve(strict=True)
            except (OSError, RuntimeError):
                fail(f"broken or cyclic symlink: {path}")
            if not target.is_relative_to(root.resolve()):
                fail(f"symlink escapes release: {path}")
            yield path
        elif path.is_file():
            yield path


def inventory(root, hint=None):
    """Checksum every file. `hint(rel, path)` may return a known digest to skip re-reading a file;
    the final `verify` always re-hashes everything, so a wrong hint fails the build."""
    result = {}
    for p in files_for(root):
        if p.name == "release-manifest.json":
            continue
        rel = str(p.relative_to(root))
        if p.is_symlink():
            result[rel] = "link:" + os.readlink(p)
        else:
            result[rel] = (hint and hint(rel, p)) or digest(p)
    return result


def validate_root(root):
    if not root.is_absolute() or root.is_symlink() or str(root.resolve()) in ("/", "/opt", "/opt/vemoki"):
        fail("release root must be an absolute, dedicated directory without a symlink")


def release_path(root, name):
    validate_root(root)
    if not RELEASE_ID.fullmatch(name):
        fail("invalid release ID")
    path = root / name
    if path.is_symlink():
        fail("release path is a symlink")
    return path


def verify(path):
    if path.is_symlink() or not path.is_dir():
        fail("release is absent or symlinked")
    manifest = json.loads((path / "release-manifest.json").read_text())
    if manifest.get("format") not in (1, 2) or not SHA.fullmatch(manifest.get("sourceSha", "")):
        fail("invalid manifest")
    if not RELEASE_ID.fullmatch(path.name) or not path.name.startswith(manifest["sourceSha"] + "-"):
        fail("release ID and source SHA mismatch")
    if digest(path / "pnpm-lock.yaml") != manifest.get("lockfileSha256"):
        fail("lockfile checksum mismatch")
    actual = inventory(path)
    if actual != manifest.get("files"):
        fail("artifact file checksum mismatch")
    for rel in ("apps/web/.data", "apps/web/.next/cache", "apps/portal/.next/cache"):
        if not (path / rel).is_dir() or (path / rel).is_symlink():
            fail(f"missing writable mount target: {rel}")
    for service in SERVICES:
        entry = manifest.get("services", {}).get(service, {})
        paths = ARTIFACTS[service]
        if entry.get("paths") != list(paths):
            fail(f"missing service artifact: {service}")
        if not isinstance(entry.get("packageVersion"), str) or not entry["packageVersion"]:
            fail(f"missing service version: {service}")
        for rel in paths:
            if not (path / rel).exists():
                fail(f"missing artifact path: {rel}")
        if entry.get("sha256") != service_digest(actual, paths):
            fail(f"service checksum mismatch: {service}")
        compat = entry.get("schema", {})
        if service == "migrate" and manifest["format"] == 2:
            if (set(compat) != {"inputMin", "inputMax", "target"}
                    or any(type(compat[key]) is not int for key in compat)
                    or compat["inputMin"] > compat["inputMax"]
                    or compat["target"] < compat["inputMax"]):
                fail("invalid migration input/target contract")
        elif (set(compat) != {"min", "max"}
              or any(type(compat[key]) is not int for key in compat)
              or compat["min"] > compat["max"]):
            fail(f"invalid schema range: {service}")
    return manifest


def service_digest(files, paths):
    subset = {key: value for key, value in files.items()
              if any(key == path or key.startswith(path + "/") for path in paths)}
    return hashlib.sha256(json.dumps(subset, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def current_schema(manifest):
    schema = manifest["services"]["migrate"]["schema"]
    return schema.get("target", schema.get("max"))


def compatible(manifest, service, schema):
    bounds = manifest["services"][service]["schema"]
    if service == "migrate" and manifest["format"] == 2:
        return bounds["inputMin"] <= schema <= bounds["inputMax"]
    return bounds["min"] <= schema <= bounds["max"]


def read_pins(path):
    if not path.exists():
        return {}
    result = {}
    for line in path.read_text().splitlines():
        if not line or line.startswith("#"):
            continue
        key, sep, value = line.partition("=")
        if not sep or key not in {f"RELEASE_{name.upper()}_DIR" for name in SERVICES} or key in result or not value:
            fail("invalid pin file")
        result[key] = value
    return result


def write_pins(path, pins):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", dir=path.parent, prefix=".pins-", delete=False) as out:
        temp = Path(out.name)
        for name in SERVICES:
            key = f"RELEASE_{name.upper()}_DIR"
            if key in pins:
                out.write(f"{key}={pins[key]}\n")
    os.chmod(temp, 0o600)
    os.replace(temp, path)

STORE_MOUNT = "/pnpm-store"
STEPS = (
    ("install", "pnpm install --frozen-lockfile --filter @ticket/api... --filter @ticket/worker... --filter @ticket/web... --filter @ticket/portal..."),
    ("build contracts", "pnpm --filter @ticket/contracts build"),
    ("build backend", "pnpm --filter @ticket/backend build"),
    ("build ui", "pnpm --filter @ticket/ui build"),
    ("build web-session", "pnpm --filter @ticket/web-session build"),
    ("build api", "pnpm --filter @ticket/api build"),
    ("build worker", "pnpm --filter @ticket/worker build"),
    ("build web", "pnpm --filter @ticket/web build"),
    ("build portal", "pnpm --filter @ticket/portal build"),
)
ARCH_OF = {"x86_64": "linux/amd64", "amd64": "linux/amd64", "arm64": "linux/arm64", "aarch64": "linux/arm64"}


def log(message):
    print(f"[release {time.strftime('%H:%M:%S')}] {message}", flush=True)


class Timed:
    """Print start/end and duration of one build step (never prints env or args secrets)."""

    def __init__(self, name):
        self.name = name

    def __enter__(self):
        self.start = time.monotonic()
        log(f"start: {self.name}")

    def __exit__(self, kind, *_):
        status = "FAILED" if kind else "done"
        log(f"{status}: {self.name} ({time.monotonic() - self.start:.1f}s)")


def default_pnpm_store(platform):
    """Persistent host pnpm store, one per platform (native modules differ). Safe to delete."""
    return Path.home() / ".cache" / "vemoki-release" / ("pnpm-store-" + platform.replace("/", "-"))


def prepare_store(path):
    path = Path(path).expanduser().absolute()
    path.mkdir(parents=True, exist_ok=True)
    os.chmod(path, 0o777)  # container user may not match the host user
    return path


HIDDEN = ".build-hidden"


def container_script(skip=(), hide=None):
    """Shell run in the builder; the store is the external mount, never under /app.
    `skip` names build steps whose outputs were reused from an older release. `hide` maps a step
    name to workspace dirs moved out of the tree while that step runs, so a build that reads a
    package it does not declare as a dependency fails instead of silently depending on it."""
    hide = hide or {}
    lines = [
        'step() { n="$1"; shift; s=$(date +%s); echo "[container $(date +%H:%M:%S)] start: $n"; '
        'if "$@"; then echo "[container $(date +%H:%M:%S)] done: $n ($(( $(date +%s) - s ))s)"; '
        'else echo "[container $(date +%H:%M:%S)] FAILED: $n ($(( $(date +%s) - s ))s)"; return 1; fi; }',
        f'hide() {{ for d in "$@"; do mkdir -p "{HIDDEN}/$(dirname "$d")"; mv "$d" "{HIDDEN}/$d"; done; }}',
        f'unhide() {{ for d in "$@"; do mv "{HIDDEN}/$d" "$d"; done; rm -rf "{HIDDEN}"; }}',
        f"pnpm config set store-dir {STORE_MOUNT}",
        "pnpm config set package-import-method copy",
    ]
    for name, cmd in STEPS:
        if name in skip:
            continue
        dirs = " ".join(hide.get(name, ()))
        lines += [f"hide {dirs}"] if dirs else []
        lines.append(f'step "{name}" {cmd}')
        lines += [f"unhide {dirs}"] if dirs else []
    return "\n".join(lines)


def docker_arch():
    try:
        out = subprocess.check_output(["docker", "info", "--format", "{{.Architecture}}"], text=True, timeout=30).strip()
    except (OSError, subprocess.SubprocessError):
        out = host_platform.machine()
    return ARCH_OF.get(out.lower())


def stale_builds(root, keep, min_age_minutes):
    cutoff = time.time() - min_age_minutes * 60
    return [p for p in sorted(root.glob(".build-*")) if p != keep and p.is_dir() and p.stat().st_mtime < cutoff]


def remove_tree(path):
    for directory in [path, *(p for p in path.rglob("*") if p.is_dir() and not p.is_symlink())]:
        try:
            os.chmod(directory, directory.stat().st_mode | 0o700)
        except OSError:
            pass
    shutil.rmtree(path)


# Incremental build. A package is rebuilt only when its build inputs change: its own tracked files,
# the inputs of every @ticket/* package it depends on, and the global inputs (root config, lockfile,
# brand/, builder image, platform, build commands). Otherwise its outputs (whatever its build wrote
# outside node_modules, recorded per release) are copied from the newest release with the same digest.
PACKAGES = {"contracts": "packages/contracts", "backend": "packages/backend", "ui": "packages/ui",
            "web-session": "packages/web-session", "api": "apps/api", "worker": "apps/worker",
            "web": "apps/web", "portal": "apps/portal"}


def copy_tree(src, dst):
    """Copy preserving mtimes; on XFS/btrfs `--reflink=auto` makes it copy-on-write (near instant)."""
    dst.parent.mkdir(parents=True, exist_ok=True)
    if subprocess.run(["cp", "-a", "--reflink=auto", str(src), str(dst)], capture_output=True).returncode != 0:
        if dst.exists() or dst.is_symlink():
            remove_tree(dst) if dst.is_dir() and not dst.is_symlink() else dst.unlink()
        if src.is_dir() and not src.is_symlink():
            shutil.copytree(src, dst, symlinks=True)
        else:
            shutil.copy2(src, dst, follow_symlinks=False)
    # Only touch entries that lack the bits: a chmod dirties the inode even when the mode is
    # unchanged, and tens of thousands of those flood a slow disk right before the build.
    for p in [dst, *(dst.rglob("*") if dst.is_dir() and not dst.is_symlink() else [])]:
        if p.is_symlink():
            continue
        mode = p.lstat().st_mode
        want = mode | 0o200 | (0o100 if stat.S_ISDIR(mode) else 0)
        if want != mode:
            os.chmod(p, want)


def tree_digest(base, rels):
    h = hashlib.sha256()
    for rel in sorted(rels):
        h.update(rel.encode() + b"\0" + digest(base / rel).encode() + b"\n")
    return h.hexdigest()


def source_files(stage, top):
    path = stage / top
    if path.is_file():
        return [top]
    return [str(p.relative_to(stage)) for p in path.rglob("*")
            if p.is_file() and not p.is_symlink() and "node_modules" not in p.relative_to(stage).parts]


def package_deps(stage, name):
    data = json.loads((stage / PACKAGES[name] / "package.json").read_text())
    names = {**data.get("dependencies", {}), **data.get("devDependencies", {})}
    return sorted(k[len("@ticket/"):] for k in names if k.startswith("@ticket/") and k[len("@ticket/"):] in PACKAGES)


def build_input_digests(stage, image_id, platform):
    """Call right after extraction, while the stage holds only tracked source files."""
    shared = [rel for top in SOURCE_PATHS if not top.startswith(("apps/", "packages/"))
              for rel in source_files(stage, top)]
    # This script decides what a build output is; any change to it invalidates every reuse.
    global_digest = hashlib.sha256(json.dumps([digest(Path(__file__)), image_id, platform, STEPS,
                                               tree_digest(stage, shared)]).encode()).hexdigest()
    own = {name: tree_digest(stage, source_files(stage, path)) for name, path in PACKAGES.items()}
    result = {}

    def resolve(name, seen=()):
        if name in seen:
            fail(f"workspace dependency cycle at {name}")
        if name not in result:
            deps = [resolve(dep, seen + (name,)) for dep in package_deps(stage, name)]
            result[name] = hashlib.sha256(json.dumps([global_digest, own[name], deps]).encode()).hexdigest()
        return result[name]
    for name in PACKAGES:
        resolve(name)
    return result


def hidden_during_build(stage):
    """For each build step, the workspace package dirs outside that package's dependency closure."""
    closure = {}

    def deps(name):
        if name not in closure:
            closure[name] = set()
            for dep in package_deps(stage, name):
                closure[name] |= {dep} | deps(dep)
        return closure[name]
    return {f"build {name}": [PACKAGES[other] for other in PACKAGES if other != name and other not in deps(name)]
            for name in PACKAGES}


NEXT_APPS = ("web", "portal")


def next_cache_entry(cache, name):
    return cache / f"next-{name}"


def seed_next_cache(stage, cache, names):
    """Give `next build` the previous build's .next/cache (Next validates it itself); it never ships."""
    seeded = []
    for name in names:
        entry = next_cache_entry(cache, name)
        if entry.is_dir():
            copy_tree(entry, stage / PACKAGES[name] / ".next" / "cache")
            seeded.append(name)
    return seeded


def save_next_cache(stage, cache, names):
    for name in names:
        source = stage / PACKAGES[name] / ".next" / "cache"
        if not source.is_dir():
            continue
        entry, temp = next_cache_entry(cache, name), cache / f".next-{name}-{os.getpid()}"
        if temp.exists():
            remove_tree(temp)
        copy_tree(source, temp)
        if entry.exists():
            remove_tree(entry)
        os.rename(temp, entry)


def snapshot(stage):
    """mtime of every path under the package dirs (node_modules excluded), to detect build outputs."""
    result = {}
    for path in PACKAGES.values():
        for p in (stage / path).rglob("*"):
            if "node_modules" not in p.relative_to(stage).parts:
                result[str(p.relative_to(stage))] = p.lstat().st_mtime_ns
    return result


def output_roots(stage, before, name):
    """Highest new path (or modified file) under one package dir after its build."""
    roots = set()
    pkg = stage / PACKAGES[name]
    for p in pkg.rglob("*"):
        rel = p.relative_to(stage)
        if ("node_modules" in rel.parts or p.is_dir() and not p.is_symlink()
                or ".next" in rel.parts and "cache" in rel.parts[rel.parts.index(".next") + 1:][:1]):
            continue
        key = str(rel)
        if key in before and before[key] == p.lstat().st_mtime_ns:
            continue
        root = rel
        while root.parent != pkg.relative_to(stage) and str(root.parent) not in before:
            root = root.parent
        roots.add(str(root))
    return sorted(roots)


def reuse_outputs(stage, bases, digests):
    """Copy outputs of unchanged packages from the newest release built from the same inputs."""
    reused = {}
    for name, want in digests.items():
        for base, manifest in bases:
            entry = manifest.get("buildInputs", {}).get(name)
            if not entry or entry.get("digest") != want:
                continue
            roots = entry.get("outputs") or []
            if not roots or not all((base / rel).exists() for rel in roots):
                continue
            try:
                for rel in roots:
                    target = stage / rel
                    if target.is_dir() and not target.is_symlink():
                        remove_tree(target)
                    elif target.exists() or target.is_symlink():
                        target.unlink()
                    copy_tree(base / rel, target)
            except (OSError, shutil.Error) as error:
                log(f"could not reuse {name} from {base.name}: {error}; rebuilding")
                continue
            reused[name] = {"digest": want, "outputs": roots, "from": base.name}
            break
    return reused


def release_bases(root, limit=3):
    bases = []
    for base in sorted((p for p in root.iterdir() if RELEASE_ID.fullmatch(p.name) and p.is_dir() and not p.is_symlink()),
                       key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            bases.append((base, json.loads((base / "release-manifest.json").read_text())))
        except (OSError, ValueError):
            continue
        if len(bases) == limit:
            break
    return bases


def digest_hint(bases):
    """Reuse an older manifest digest for a file with the same path, size and mtime (copies keep mtime)."""
    def hint(rel, path):
        info = path.lstat()
        for base, manifest in bases:
            sha = manifest.get("files", {}).get(rel)
            if not sha or sha.startswith("link:"):
                continue
            try:
                other = (base / rel).lstat()
            except OSError:
                continue
            if other.st_size == info.st_size and other.st_mtime_ns == info.st_mtime_ns:
                return sha
        return None
    return hint


NOISE_SUFFIXES = (".map", ".md", ".markdown", ".d.ts", ".d.mts", ".d.cts")


def strip_runtime_noise(stage):
    """Delete source maps, markdown and type declarations from third-party packages.

    None of them is read at runtime (no --enable-source-maps; TypeScript itself is left intact).
    Workspace dist output is never touched, so the service artifacts are unchanged.
    """
    store = stage / "node_modules" / ".pnpm"
    removed = freed = 0
    if not store.is_dir():
        return removed, freed
    for package in store.iterdir():
        if package.name.startswith("typescript@"):
            continue
        for path in package.rglob("*"):
            if path.is_symlink() or not path.is_file() or not path.name.endswith(NOISE_SUFFIXES):
                continue
            freed += path.stat().st_size
            path.unlink()
            removed += 1
    return removed, freed


def dedupe_against_releases(stage, bases, files):
    """Hardlink stage files that an older release's manifest says are identical.

    Releases stay complete, read-only trees (manifest and verify only see content), but unchanged
    dependencies stop costing disk per release. The older manifest is only a hint: the final
    verify re-hashes the published tree, so a lying manifest fails the build instead of shipping.
    Any link failure (other owner, other filesystem, link limit) just leaves the copy in place.
    """
    bases = [(base, manifest.get("files", {})) for base, manifest in bases]
    linked = saved = 0
    for rel, sha in files.items():
        if sha.startswith("link:"):
            continue
        path = stage / rel
        info = path.stat()
        want_mode = info.st_mode & 0o7777 & ~0o222
        for base, base_files in bases:
            if base_files.get(rel) != sha:
                continue
            other = base / rel
            temp = path.with_name(path.name + ".dedupe-tmp")
            try:
                other_info = other.lstat()
                if (not stat.S_ISREG(other_info.st_mode) or other_info.st_size != info.st_size
                        or other_info.st_mode & 0o7777 != want_mode or other_info.st_ino == info.st_ino):
                    continue
                os.link(other, temp)
                os.replace(temp, path)
            except OSError:
                try:
                    temp.unlink()
                except OSError:
                    pass
                continue
            linked += 1
            saved += info.st_size
            break
    return linked, saved


def build(args):
    validate_root(args.root)
    root = args.root.resolve()
    validate_root(root)
    if not SHA.fullmatch(args.sha):
        fail("source must be a full commit SHA")
    if args.schema_min > args.schema_max:
        fail("invalid schema range")
    if (args.migrate_input_min > args.migrate_input_max
            or args.migrate_target < args.migrate_input_max):
        fail("invalid migration input/target contract")
    root.mkdir(parents=True, exist_ok=True)
    store = prepare_store(args.pnpm_store or default_pnpm_store(args.platform))
    stage = Path(tempfile.mkdtemp(prefix=".build-", dir=root))
    started = time.monotonic()
    log(f"pnpm store (cache only, safe to delete): {store}")
    old = stale_builds(root, stage, args.stale_min_age_minutes)
    if old:
        if args.clean_stale:
            for path in old:
                log(f"removing stale build dir (> {args.stale_min_age_minutes} min old): {path}")
                try:
                    remove_tree(path)
                except OSError as error:
                    log(f"could not remove {path}: {error}")
        else:
            log(f"WARNING: {len(old)} stale .build-* dir(s) older than {args.stale_min_age_minutes} min in {root} "
                f"(dead runs?): {', '.join(p.name for p in old)}; rerun with --clean-stale to remove")
    try:
        archive_timer = Timed("git archive + extract")
        archive_timer.__enter__()
        archive = subprocess.Popen(["git", "archive", "--format=tar", args.sha, *SOURCE_PATHS], stdout=subprocess.PIPE)
        subprocess.run(["tar", "-xf", "-", "-C", str(stage)], stdin=archive.stdout, check=True)
        archive.stdout.close()
        if archive.wait() != 0:
            fail("git archive failed")
        for candidate in stage.rglob("*"):
            if candidate.is_file() and (candidate.name == ".env" or candidate.name.startswith(".env.")):
                candidate.unlink()
        archive_timer.__exit__(None)
        with Timed("docker platform check"):
            platform = subprocess.check_output(["docker", "run", "--rm", "--platform", args.platform, args.image, "node", "-p",
                "process.platform + '/' + process.arch + '/' + process.versions.node"], text=True).strip()
        host = docker_arch()
        if host == args.platform:
            log(f"docker platform {args.platform} runtime {platform}: native")
        else:
            log(f"docker platform {args.platform} runtime {platform}: EMULATED (docker host arch {host or 'unknown'}); "
                "expect a much slower build, prefer a native builder or --platform matching the host")
        expected_arch = {"linux/amd64": "x64", "linux/arm64": "arm64"}[args.platform]
        if not re.fullmatch(r"linux/" + expected_arch + r"/24\.[0-9.]+", platform):
            fail(f"builder must be Linux Node 24: {platform}")
        image_id = subprocess.check_output(["docker", "image", "inspect", args.image,
            "--format", "{{.Id}}"], text=True).strip()
        cache = (args.cache_dir or root.parent / "release-cache").absolute()
        bases = release_bases(root)
        with Timed("incremental plan"):
            inputs = build_input_digests(stage, image_id, args.platform)
            reused = {} if args.full else reuse_outputs(stage, bases, inputs)
            summary = ", ".join("%s (from %s)" % (name, entry["from"][:12]) for name, entry in reused.items()) or "none"
            log(f"reused outputs: {summary}{' (--full)' if args.full else ''}")
            before = snapshot(stage)
            next_apps = [name for name in NEXT_APPS if name not in reused]
            warm = [] if args.full else seed_next_cache(stage, cache, next_apps)
            if next_apps:
                log(f"next build cache: {', '.join(warm) or 'none'} of {', '.join(next_apps)}")
        # Build inside Linux/Node 24. The store and every workspace link stay within stage.
        command = container_script(skip={f"build {name}" for name in reused}, hide=hidden_during_build(stage))
        with Timed("container install + builds"):
            subprocess.run(["docker", "run", "--rm", "--platform", args.platform, "-v", f"{stage}:/app",
                            "-v", f"{store}:{STORE_MOUNT}", "-w", "/app", args.image, "sh", "-ec", command], check=True)
        build_inputs = {name: {"digest": entry["digest"], "outputs": entry["outputs"]} for name, entry in reused.items()}
        for name in PACKAGES:
            if name not in reused:
                build_inputs[name] = {"digest": inputs[name], "outputs": output_roots(stage, before, name)}
        if next_apps and not args.full:
            with Timed("save next build cache"):
                try:
                    cache.mkdir(parents=True, exist_ok=True)
                    save_next_cache(stage, cache, next_apps)
                except (OSError, shutil.Error) as error:
                    log(f"could not save next build cache: {error}")
        with Timed("strip runtime noise"):
            removed, freed = strip_runtime_noise(stage)
            log(f"removed {removed} source map/markdown/type-declaration files ({freed / 1024 / 1024:.0f} MiB)")
        with Timed("verify native modules"):
            subprocess.run(["docker", "run", "--rm", "--platform", args.platform, "-v", f"{stage}:/app:ro",
                            "-w", "/app", args.image, "node", "-e",
                            "require('./packages/backend/node_modules/sharp'); require('./packages/backend/dist/generated/prisma/client')"], check=True)
        # Next's build cache is staging-only. The pnpm store lives outside stage (host cache);
        # the rmtree stays as a guard so a store can never enter the artifact or hashes.
        shutil.rmtree(stage / ".pnpm-store", ignore_errors=True)
        for app in ("web", "portal"):
            shutil.rmtree(stage / "apps" / app / ".next" / "cache", ignore_errors=True)
            (stage / "apps" / app / ".next" / "cache").mkdir(parents=True)
        (stage / "apps" / "web" / ".data").mkdir(parents=True, exist_ok=True)
        manifest_timer = Timed("inventory + manifest")
        manifest_timer.__enter__()
        hint = None if args.full else digest_hint(bases)
        all_files = inventory(stage, hint)
        source = {"format": 2, "sourceSha": args.sha,
                  "buildId": hashlib.sha256(json.dumps(all_files, sort_keys=True).encode()).hexdigest()[:12],
                  "lockfileSha256": digest(stage / "pnpm-lock.yaml"),
                  "builder": {"image": args.image, "imageId": image_id, "runtime": platform},
                  "services": {}, "files": all_files, "buildInputs": build_inputs}
        for service, paths in ARTIFACTS.items():
            package = stage / ("packages/backend/package.json" if service == "migrate" else f"apps/{service}/package.json")
            source["services"][service] = {"paths": list(paths),
                "packageVersion": json.loads(package.read_text())["version"] if service != "migrate" else "prisma-migrations",
                "sha256": service_digest(all_files, paths),
                "schema": ({"inputMin": args.migrate_input_min, "inputMax": args.migrate_input_max,
                            "target": args.migrate_target} if service == "migrate" else
                           {"min": args.schema_min, "max": args.schema_max})}
        source["workerPendingPushSafe"] = subprocess.run(["git", "merge-base", "--is-ancestor",
            "710b57140fe476661e98fbdf6c9bf6d5170dfbc1", args.sha]).returncode == 0
        for service, paths in ARTIFACTS.items():
            for rel in paths:
                if not (stage / rel).exists():
                    fail(f"missing artifact path: {rel}")
        name = f"{args.sha}-{source['buildId']}"
        (stage / "release-manifest.json").write_text(json.dumps(source, indent=2, sort_keys=True) + "\n")
        # Verify generated bytes before the atomic publish.
        if inventory(stage, hint) != source["files"]:
            fail("staging checksums changed")
        with Timed("hardlink dedupe"):
            linked, saved = dedupe_against_releases(stage, bases, source["files"])
            log(f"hardlinked {linked} files from older releases (~{saved / 1024 / 1024:.0f} MiB not duplicated)")
        for p in [stage, *stage.rglob("*")]:
            if not p.is_symlink():
                os.chmod(p, p.stat().st_mode & ~0o222)
        dest = release_path(root, name)
        if dest.exists():
            fail("release already exists; refusing overwrite")
        os.rename(stage, dest)
        manifest_timer.__exit__(None)
        with Timed("final verify"):
            verify(dest)
        log(f"build total {time.monotonic() - started:.1f}s")
        print(json.dumps({"release": str(dest), "sourceSha": args.sha, "buildId": source["buildId"]}))
    finally:
        if stage.exists():
            for directory in [stage, *(p for p in stage.rglob("*") if p.is_dir() and not p.is_symlink())]:
                os.chmod(directory, directory.stat().st_mode | 0o700)
            shutil.rmtree(stage)


def pin(args):
    validate_root(args.root)
    root = args.root.resolve()
    dest = release_path(root, args.release)
    manifest = verify(dest)
    pins = read_pins(args.pins)
    schema = args.schema
    if not compatible(manifest, args.service, schema):
        fail("target service is incompatible with current schema; forward recovery required")
    if args.service == "worker" and not manifest.get("workerPendingPushSafe"):
        fail("legacy worker rollback is forbidden after F02 pending-push semantics")
    pins[f"RELEASE_{args.service.upper()}_DIR"] = str(dest)
    write_pins(args.pins, pins)
    print(json.dumps({"service": args.service, "release": str(dest), "schema": schema}))


def cleanup(args):
    validate_root(args.root)
    root = args.root.resolve()
    validate_root(root)
    if args.execute and (not args.pins.is_file() or args.pins.is_symlink()):
        fail("pin file missing; refusing cleanup")
    pins = read_pins(args.pins)
    for value in pins.values():
        pinned = Path(value)
        if (not pinned.is_absolute() or not RELEASE_ID.fullmatch(pinned.name)
                or pinned != release_path(root, pinned.name) or pinned.is_symlink()):
            fail("invalid pin file path")
    protected = [Path(value).resolve() for value in pins.values()]
    protected.extend(Path(value).resolve() for value in args.active or [])
    if args.execute:
        ids = subprocess.check_output(["docker", "ps", "-aq"], text=True).split()
        if ids:
            containers = json.loads(subprocess.check_output(["docker", "inspect", *ids], text=True))
            protected.extend(Path(mount["Source"]).resolve() for container in containers
                             for mount in container.get("Mounts", []) if mount.get("Source"))
    paths = []
    for name in args.releases:
        path = release_path(root, name)
        if any(path == source or path.is_relative_to(source) or source.is_relative_to(path)
               for source in protected):
            fail(f"release is pinned or active: {name}")
        verify(path)
        paths.append(path)
    for path in paths:
        if not args.execute:
            print(f"would remove {path}")
        else:
            # Directories only: files may be hardlinked into other releases and must stay read-only.
            for p in [*path.rglob("*"), path]:
                if p.is_dir() and not p.is_symlink():
                    os.chmod(p, p.stat().st_mode | 0o700)
            shutil.rmtree(path)
            print(f"removed {path}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    sub = parser.add_subparsers(dest="command", required=True)
    b = sub.add_parser("build")
    b.add_argument("--sha", required=True)
    b.add_argument("--image", default="vemoki-runtime:local")
    b.add_argument("--platform", choices=("linux/amd64", "linux/arm64"), default="linux/amd64")
    b.add_argument("--pnpm-store", type=Path, default=Path(os.environ["VEMOKI_PNPM_STORE"]) if os.environ.get("VEMOKI_PNPM_STORE") else None,
                   help="persistent host pnpm store (default ~/.cache/vemoki-release/pnpm-store-<platform>, env VEMOKI_PNPM_STORE); cache only, safe to delete")
    b.add_argument("--full", action="store_true", help="ignore older releases and the Next build cache; build everything")
    b.add_argument("--cache-dir", type=Path, help="Next build cache, same filesystem as --root for reflink (default <root>/../release-cache)")
    b.add_argument("--clean-stale", action="store_true", help="remove .build-* dirs in --root older than --stale-min-age-minutes")
    b.add_argument("--stale-min-age-minutes", type=int, default=60)
    b.add_argument("--schema-min", type=int, required=True)
    b.add_argument("--schema-max", type=int, required=True)
    b.add_argument("--migrate-input-min", type=int, required=True)
    b.add_argument("--migrate-input-max", type=int, required=True)
    b.add_argument("--migrate-target", type=int, required=True)
    v = sub.add_parser("verify")
    v.add_argument("release")
    p = sub.add_parser("pin")
    p.add_argument("release")
    p.add_argument("service", choices=SERVICES)
    p.add_argument("--schema", type=int, required=True)
    p.add_argument("--pins", type=Path, required=True)
    c = sub.add_parser("cleanup")
    c.add_argument("releases", nargs="+")
    c.add_argument("--pins", type=Path, required=True)
    c.add_argument("--active", action="append", help="active container mount path; repeat per container")
    c.add_argument("--execute", action="store_true")
    args = parser.parse_args()
    try:
        if args.command == "build": build(args)
        elif args.command == "verify":
            validate_root(args.root)
            print(json.dumps(verify(release_path(args.root.resolve(), args.release))["services"], sort_keys=True))
        elif args.command == "pin": pin(args)
        elif args.command == "cleanup": cleanup(args)
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        print(f"release error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
