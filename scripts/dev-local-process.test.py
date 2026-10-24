import importlib.util
import json
import os
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


if __name__ == '__main__':
    unittest.main()
