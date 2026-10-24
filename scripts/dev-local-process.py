#!/usr/bin/env python3
"""Own isolated dev process groups; never signal a stale/reused PID."""
import json
import fcntl
import os
from pathlib import Path
import signal
import subprocess
import sys
import time


def identity(pid):
    result = subprocess.run(['ps', '-o', 'lstart=', '-o', 'stat=', '-p', str(pid)], capture_output=True, text=True)
    parts = result.stdout.strip().split()
    if result.returncode or len(parts) < 6 or parts[-1].startswith('Z'):
        return None
    return ' '.join(parts[:-1])


def read_owner(pidfile):
    try:
        record = json.loads(pidfile.with_suffix('.json').read_text())
        pid = int(pidfile.read_text().strip())
        if pid <= 1 or pid != record['pid'] or identity(pid) != record['started']:
            return None
        return record
    except (OSError, ValueError, KeyError):
        return None


def write_owner(pidfile, pid):
    pidfile.parent.mkdir(parents=True, exist_ok=True)
    record = {'pid': pid, 'started': identity(pid), 'group': os.getpgid(pid)}
    if not record['started']:
        raise RuntimeError('process_exited_before_ready')
    for path, value in [(pidfile, str(pid)), (pidfile.with_suffix('.json'), json.dumps(record))]:
        path.write_text(value + '\n')
        path.chmod(0o600)


def stop(pidfile):
    record = read_owner(pidfile)
    if record:
        pid = record['pid']
        if record['group'] == pid and os.getpgid(pid) == pid:
            os.killpg(pid, signal.SIGTERM)
            time.sleep(.3)
            if identity(pid) == record['started']:
                os.killpg(pid, signal.SIGKILL)
        else:
            # Legacy process adopted once during migration: enumerate descendants,
            # never kill its shared terminal/supervisor process group.
            rows = subprocess.check_output(['ps', '-axo', 'pid=,ppid='], text=True).splitlines()
            parents = {int(p): int(pp) for p, pp in (row.split() for row in rows)}
            selected = [pid]
            for parent in selected:
                selected.extend(p for p, pp in parents.items() if pp == parent and p not in selected)
            births = {p: identity(p) for p in selected}
            for p in reversed(selected):
                if births[p] and identity(p) == births[p]:
                    try:
                        os.kill(p, signal.SIGTERM)
                    except ProcessLookupError:
                        pass
    for path in [pidfile, pidfile.with_suffix('.json')]:
        path.unlink(missing_ok=True)


def main(args):
    command, name, *rest = args
    pidfile = Path(name)
    if command == 'alive':
        return 0 if read_owner(pidfile) else 1
    if command == 'stop':
        stop(pidfile)
    elif command == 'start':
        pause = os.environ.get('DEV_LOCAL_PAUSE_FILE')
        if pause and Path(pause).exists():
            raise RuntimeError('stack_paused')
        if read_owner(pidfile):
            return 0
        log, cwd, *argv = rest
        with open(log, 'ab') as stream:
            os.chmod(log, 0o600)
            proc = subprocess.Popen(argv, cwd=cwd, stdin=subprocess.DEVNULL, stdout=stream, stderr=stream, start_new_session=True, close_fds=True)
        write_owner(pidfile, proc.pid)
    elif command == 'adopt':
        # Explicit migration only; caller must provide the exact expected cwd.
        pid = int(pidfile.read_text().strip())
        cwd = subprocess.check_output(['lsof', '-a', '-p', str(pid), '-d', 'cwd', '-Fn'], text=True)
        actual = next((line[1:] for line in cwd.splitlines() if line.startswith('n')), '')
        if Path(actual).resolve() != Path(rest[0]).resolve():
            raise RuntimeError('process_cwd_mismatch')
        write_owner(pidfile, pid)
    else:
        raise RuntimeError('unknown_process_command')
    return 0


if __name__ == '__main__':
    try:
        lock = Path(sys.argv[2]).with_suffix('.lock')
        lock.parent.mkdir(parents=True, exist_ok=True)
        with lock.open('a') as stream:
            os.chmod(lock, 0o600)
            fcntl.flock(stream, fcntl.LOCK_EX)
            sys.exit(main(sys.argv[1:]))
    except Exception as error:
        print(json.dumps({'ok': False, 'errorCode': type(error).__name__}), file=sys.stderr)
        sys.exit(1)
