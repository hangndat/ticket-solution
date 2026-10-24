import importlib.util
import json
import os
import signal
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest

SCRIPT = Path(__file__).with_name('dev-local-process.py')
spec = importlib.util.spec_from_file_location('dev_process', SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ProcessOwnershipTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.pidfile = self.root / 'api.pid'

    def tearDown(self):
        module.stop(self.pidfile)
        self.temp.cleanup()

    def run_helper(self, *args):
        return subprocess.run([sys.executable, str(SCRIPT), *map(str, args)], capture_output=True, text=True)

    def start(self, code='import time; time.sleep(120)'):
        r = self.run_helper('start', self.pidfile, self.root / 'log', self.root, sys.executable, '-c', code)
        self.assertEqual(r.returncode, 0, r.stderr)
        return json.loads(self.pidfile.with_suffix('.json').read_text())

    def test_private_group_and_idempotent_start(self):
        first = self.start()
        self.assertEqual(first['pid'], first['group'])
        self.assertEqual(self.start()['pid'], first['pid'])
        self.assertEqual(self.run_helper('alive', self.pidfile).returncode, 0)
        self.assertEqual(self.pidfile.stat().st_mode & 0o777, 0o600)
        self.assertEqual(self.run_helper('stop', self.pidfile).returncode, 0)
        self.assertEqual(self.run_helper('alive', self.pidfile).returncode, 1)

    def test_stale_identity_does_not_signal_foreign_process(self):
        foreign = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(120)'], start_new_session=True)
        try:
            self.pidfile.write_text(str(foreign.pid))
            self.pidfile.with_suffix('.json').write_text(json.dumps({'pid': foreign.pid, 'started': 'wrong identity', 'group': foreign.pid}))
            self.assertEqual(self.run_helper('stop', self.pidfile).returncode, 0)
            self.assertIsNone(foreign.poll())
        finally:
            foreign.terminate()
            foreign.wait(timeout=5)

    def test_paused_stack_cannot_start_a_process(self):
        pause = self.root / 'paused'
        pause.touch()
        result = subprocess.run([sys.executable, str(SCRIPT), 'start', str(self.pidfile), str(self.root / 'log'), str(self.root), sys.executable, '-c', 'import time;time.sleep(120)'], env={**os.environ, 'DEV_LOCAL_PAUSE_FILE': str(pause)}, capture_output=True, text=True)
        self.assertEqual(result.returncode, 1)
        self.assertFalse(self.pidfile.exists())

    def test_stop_reaches_owned_descendants(self):
        childfile = self.root / 'child'
        self.start(f'import subprocess,sys,time; from pathlib import Path; child=subprocess.Popen([sys.executable,"-c","import time;time.sleep(120)"]); Path({str(childfile)!r}).write_text(str(child.pid)); time.sleep(120)')
        for _ in range(20):
            if childfile.exists():
                break
            time.sleep(.05)
        child = int(childfile.read_text())
        self.assertEqual(self.run_helper('stop', self.pidfile).returncode, 0)
        for _ in range(20):
            if module.identity(child) is None:
                break
            time.sleep(.05)
        self.assertIsNone(module.identity(child))

    def test_stop_kills_child_ignoring_term_after_leader_exits(self):
        childfile, ready = self.root / 'child', self.root / 'ready'
        child_code = f'import signal,time;from pathlib import Path;signal.signal(signal.SIGTERM,signal.SIG_IGN);Path({str(ready)!r}).touch();time.sleep(120)'
        owner = self.start(f'import subprocess,sys,time;from pathlib import Path;child=subprocess.Popen([sys.executable,"-c",{child_code!r}]);Path({str(childfile)!r}).write_text(str(child.pid));time.sleep(120)')
        child, birth = None, None
        try:
            for _ in range(100):
                if ready.exists() and childfile.exists():
                    break
                time.sleep(.02)
            self.assertTrue(ready.exists())
            child = int(childfile.read_text())
            birth = module.identity(child)
            self.assertEqual(os.getpgid(child), owner['group'])
            result = self.run_helper('stop', self.pidfile)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIsNone(module.identity(owner['pid']))
            self.assertIsNone(module.identity(child))
            self.assertFalse(self.pidfile.exists())
        finally:
            if child and birth and module.identity(child) == birth and os.getpgid(child) == owner['group']:
                os.kill(child, signal.SIGKILL)

    def test_down_reports_compose_failure_and_preserves_pause(self):
        docker = self.root / 'docker'
        docker.write_text('#!/bin/sh\nprintf "%s\\n" "$*" >&2\nexit 37\n')
        docker.chmod(0o700)
        state = self.root / 'state'
        result = subprocess.run(['bash', str(SCRIPT.with_name('dev-local-stack.sh')), 'down'], env={**os.environ, 'PATH': str(self.root) + os.pathsep + os.environ['PATH'], 'UI869_DEV_STATE_DIR': str(state)}, capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue((state / 'paused').exists())
        self.assertIn('ui869dev', result.stderr)
        self.assertIn('stop failed', result.stdout)

    def test_dead_leader_with_surviving_child_fails_and_keeps_owner(self):
        childfile, ready = self.root / 'child', self.root / 'ready'
        child_code = f'import signal,time;from pathlib import Path;signal.signal(signal.SIGTERM,signal.SIG_IGN);Path({str(ready)!r}).touch();time.sleep(120)'
        parent_code = (f'import subprocess,sys,time;from pathlib import Path;'
                       f'child=subprocess.Popen([sys.executable,"-c",{child_code!r}]);'
                       f'Path({str(childfile)!r}).write_text(str(child.pid));'
                       f'\nwhile not Path({str(ready)!r}).exists(): time.sleep(.01)'
                       '\ntime.sleep(.2)')
        owner = self.start(parent_code)
        child, birth = None, None
        try:
            self.assertTrue(module.wait_stopped(lambda: module.identity(owner['pid']), 4))
            child = int(childfile.read_text())
            birth = module.identity(child)
            self.assertIsNotNone(birth)
            self.assertEqual(os.getpgid(child), owner['group'])
            before = self.pidfile.with_suffix('.json').read_text()
            result = self.run_helper('stop', self.pidfile)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(json.loads(result.stderr)['errorCode'], 'owned_group_identity_unverifiable')
            self.assertEqual(self.pidfile.with_suffix('.json').read_text(), before)
            self.assertTrue(self.pidfile.exists())
            self.assertEqual(module.identity(child), birth)
        finally:
            if child and birth and module.identity(child) == birth and os.getpgid(child) == owner['group']:
                os.kill(child, signal.SIGKILL)
                self.assertTrue(module.wait_stopped(lambda: module.identity(child), 2))

    def test_dead_leader_with_empty_group_cleans_stale_receipt(self):
        owner = self.start('import time;time.sleep(.2)')
        self.assertTrue(module.wait_stopped(lambda: module.identity(owner['pid']), 4))
        self.assertEqual(module.group_members(owner['group']), {})
        result = self.run_helper('stop', self.pidfile)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(self.pidfile.exists())
        self.assertFalse(self.pidfile.with_suffix('.json').exists())


if __name__ == '__main__':
    unittest.main()
