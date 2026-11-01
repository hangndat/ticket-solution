#!/usr/bin/env python3
"""Build an immutable release natively on the VPS (no emulation from an arm64 Mac).

Wraps scripts/release-artifact.py (the committed version at --sha) without editing it:
  1. The exact SHA is `git push`ed into a persistent bare repo on the VPS (--git-dir, never
     /opt/vemoki/src). Only objects the VPS lacks are sent, so after the first run this is tiny.
  2. On the VPS release-artifact.py `build` runs from that bare repo, publishing
     into --release-root (same layout as a local build; verify runs inside build).
  3. A `docker` shim on PATH adds resource limits and a unique build label to `docker run`
     and runs it under nice/ionice, so production is not starved.
  4. While building, prod health (public /v1/health) and available memory are polled;
     the remote build is killed if either degrades.
The build never reads /opt/vemoki/.env. The remote build dir is removed on success or failure.
"""
import argparse
import os
import shlex
import subprocess
import sys
import time
import urllib.request
import uuid

HEALTH_URL = "https://api.vemoki.com/v1/health"


def log(message):
    print(f"[remote-build {time.strftime('%H:%M:%S')}] {message}", flush=True)


# One multiplexed connection for every ssh/git call of a run (a handshake costs ~1s).
SSH_OPTS = ["-o", "BatchMode=yes", "-o", "ControlMaster=auto",
            "-o", "ControlPath=~/.ssh/cm-vemoki-%C", "-o", "ControlPersist=120"]


def ssh(host, command, **kw):
    return subprocess.run(["ssh", *SSH_OPTS, host, command], **kw)


def health_ok():
    try:
        with urllib.request.urlopen(HEALTH_URL, timeout=10) as res:
            return res.status == 200
    except Exception:
        return False


def mem_available_mb(host):
    out = ssh(host, "awk '/MemAvailable/{print int($2/1024)}' /proc/meminfo", capture_output=True, text=True)
    return int(out.stdout.strip() or 0)


SHIM = """#!/bin/sh
# docker shim: throttle `docker run` builds so prod is not starved.
REAL=/usr/bin/docker
if [ "$1" = run ]; then
  shift
  exec nice -n 19 ionice -c3 $REAL run --cpus {cpus} --memory {mem}m --memory-swap {mem}m \\
    --cpu-shares 64 --label vemoki.release-build={token} \\
    --user "$(id -u):$(id -g)" -e HOME=/tmp "$@"
fi
exec nice -n 19 ionice -c3 $REAL "$@"
"""


def abort_command(work, token):
    # The runtime image also runs all four production app containers. Never
    # select by ancestor: only containers launched by this exact build token
    # may be stopped by the health/memory abort path.
    # Bracketed first character prevents pkill from matching its own shell.
    runner = shlex.quote(f"{work}/[r]un.sh")
    artifact = shlex.quote(f"{work}/[r]elease-artifact.py")
    selector = f"docker ps -q --filter label=vemoki.release-build={token}"
    return (f"{selector} | xargs -r docker kill >/dev/null; "
            f"pkill -f {runner} 2>/dev/null || true; pkill -f {artifact} 2>/dev/null || true; "
            f"for i in 1 2 3 4 5 6 7 8 9 10; do "
            f"if ! pgrep -f {runner} >/dev/null && ! pgrep -f {artifact} >/dev/null "
            f"&& [ -z \"$({selector})\" ]; then exit 0; fi; sleep 1; done; "
            f"pkill -KILL -f {runner} 2>/dev/null || true; "
            f"pkill -KILL -f {artifact} 2>/dev/null || true; "
            f"[ -z \"$({selector})\" ] && ! pgrep -f {runner} >/dev/null "
            f"&& ! pgrep -f {artifact} >/dev/null")


def start_command(work):
    # Use the same absolute path that abort_command matches. In particular,
    # an abort during git clone/show must stop the runner before cleanup.
    runner = shlex.quote(f"{work}/run.sh")
    log_path = shlex.quote(f"{work}/build.log")
    # `setsid -f` forks before returning; a trailing `&` would keep ssh open until the build ends.
    return f"cd {shlex.quote(work)} && setsid -f nohup nice -n 19 ionice -c3 {runner} > {log_path} 2>&1 < /dev/null"

RUNNER = """#!/bin/bash
set -u
cd {work}
export PATH={work}/bin:$PATH
t() {{ echo "[vps $(date +%H:%M:%S)] $*"; }}
cd {git_dir}
git cat-file -e {sha}^{{commit}} || {{ t "FAILED: sha missing"; echo EXIT=1; exit 1; }}
git show {sha}:scripts/release-artifact.py > {work}/release-artifact.py
t "start: release-artifact build (native {platform})"
python3.9 {work}/release-artifact.py --root {root} build --sha {sha} --platform {platform} \\
  --schema-min {smin} --schema-max {smax} --migrate-input-min {imin} --migrate-input-max {imax} \\
  --migrate-target {target}
rc=$?
t "done: release-artifact build rc=$rc"
echo EXIT=$rc
"""


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--host", default="conanphong")
    p.add_argument("--sha", required=True)
    p.add_argument("--build-root", default="/opt/vemoki/release-build")
    p.add_argument("--git-dir", default="/opt/vemoki/release-git", help="persistent bare repo on the host")
    p.add_argument("--poll-seconds", type=int, default=5)
    p.add_argument("--release-root", default="/opt/vemoki/releases")
    p.add_argument("--platform", default="linux/amd64")
    p.add_argument("--cpus", type=int, default=4)
    p.add_argument("--memory-mb", type=int, default=5120)
    p.add_argument("--min-available-mb", type=int, default=1500)
    for name in ("schema-min", "schema-max", "migrate-input-min", "migrate-input-max", "migrate-target"):
        p.add_argument("--" + name, type=int, required=True)
    a = p.parse_args()

    token = uuid.uuid4().hex
    work = f"{a.build_root}/{a.sha[:12]}-{token[:8]}"
    started = time.monotonic()
    if not health_ok():
        sys.exit("prod health is not 200 before build; aborting")
    log(f"preflight ok; available RAM {mem_available_mb(a.host)} MB")
    ok = False
    cleanup_allowed = True
    try:
        git_dir = shlex.quote(a.git_dir)
        ssh(a.host, f"rm -rf {work} && mkdir -p {work}/bin && chmod 700 {a.build_root} && "
                    f"{{ [ -d {git_dir} ] || git init -q --bare {git_dir}; }} && chmod 700 {git_dir}", check=True)
        t0 = time.monotonic()
        subprocess.run(["git", "push", "-q", f"{a.host}:{a.git_dir}", f"+{a.sha}:refs/builds/{a.sha}"], check=True,
                       env={**os.environ, "GIT_SSH_COMMAND": shlex.join(["ssh", *SSH_OPTS])})
        log(f"source pushed ({time.monotonic() - t0:.0f}s)")
        shim = SHIM.format(cpus=a.cpus, mem=a.memory_mb, token=token)
        runner = RUNNER.format(work=work, git_dir=git_dir, sha=a.sha, platform=a.platform, root=a.release_root,
                               smin=a.schema_min, smax=a.schema_max, imin=a.migrate_input_min,
                               imax=a.migrate_input_max, target=a.migrate_target)
        ssh(a.host, f"cat > {work}/bin/docker && chmod 755 {work}/bin/docker", input=shim, text=True, check=True)
        ssh(a.host, f"cat > {work}/run.sh && chmod 755 {work}/run.sh", input=runner, text=True, check=True)
        cleanup_allowed = False
        ssh(a.host, start_command(work), check=True)
        log(f"remote build started (log {work}/build.log, cpus={a.cpus}, mem={a.memory_mb}m)")
        offset, bad_health = 0, 0
        while True:
            time.sleep(a.poll_seconds)
            out = ssh(a.host, f"tail -c +{offset + 1} {work}/build.log", capture_output=True, text=True).stdout
            offset += len(out.encode())
            for line in out.replace("\r", "\n").splitlines():
                if line.strip() and not line.startswith("Progress:"):
                    print("  | " + line[:200], flush=True)
            avail = mem_available_mb(a.host)
            bad_health = 0 if health_ok() else bad_health + 1
            if bad_health >= 2 or avail < a.min_available_mb:
                log(f"ABORT: prod degraded (health failures={bad_health}, available RAM={avail} MB); killing build")
                cleanup_allowed = ssh(a.host, abort_command(work, token)).returncode == 0
                if not cleanup_allowed:
                    log(f"ABORT INCOMPLETE: build processes may remain; retaining {work} for inspection")
                break
            if "EXIT=" in out:
                ok = "EXIT=0" in out
                cleanup_allowed = True
                break
        log(f"{'OK' if ok else 'FAILED'}; total {time.monotonic() - started:.0f}s; "
            f"health={'200' if health_ok() else 'NOT 200'}; available RAM {mem_available_mb(a.host)} MB")
    finally:
        if cleanup_allowed:
            # keep only the build log (no secrets: the build never reads .env)
            ssh(a.host, f"mkdir -p {a.build_root}/logs && cp {shlex.quote(work)}/build.log "
                        f"{a.build_root}/logs/{a.sha[:12]}-$(date +%Y%m%dT%H%M%S).log 2>/dev/null; "
                        f"chmod -R u+w {shlex.quote(work)} 2>/dev/null; rm -rf {shlex.quote(work)}")
            log("remote build dir removed")
        else:
            log(f"remote build dir retained: {work}")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
