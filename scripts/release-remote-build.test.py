import importlib.util
import os
import subprocess
import tempfile
import time
import unittest
from pathlib import Path


spec = importlib.util.spec_from_file_location("release_remote_build", Path(__file__).with_name("release-remote-build.py"))
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


class AbortIsolationTest(unittest.TestCase):
    def test_abort_only_kills_container_with_its_build_label(self):
        token = "a" * 32
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            docker = root / "docker"
            docker.write_text("""#!/bin/sh
if [ "$1" = ps ]; then
  case "$*" in
    *label=vemoki.release-build=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa*)
      if [ ! -e "$KILLED_STATE" ]; then echo build-container; fi ;;
    *ancestor=vemoki-runtime:local*) printf 'prod-api\\nprod-worker\\nbuild-container\\n' ;;
  esac
elif [ "$1" = kill ]; then
  shift
  printf '%s\\n' "$@" >> "$KILL_LOG"
  touch "$KILLED_STATE"
fi
""")
            docker.chmod(0o755)
            pkill = root / "pkill"
            pkill.write_text("#!/bin/sh\nexit 0\n")
            pkill.chmod(0o755)
            log = root / "killed"
            state = root / "killed-state"
            env = {**os.environ, "PATH": f"{root}:{os.environ['PATH']}",
                   "KILL_LOG": str(log), "KILLED_STATE": str(state)}
            subprocess.run(release.abort_command("/opt/vemoki/release-build/job", token),
                           shell=True, check=True, env=env)
            self.assertEqual(log.read_text().splitlines(), ["build-container"])
            shim = release.SHIM.format(cpus=4, mem=5120, token=token)
            self.assertIn(f"--label vemoki.release-build={token}", shim)

    def test_abort_stops_real_runner_before_first_docker_run(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runner = root / "run.sh"
            runner.write_text('#!/bin/sh\nprintf ready > "$RUN_READY"\nwhile :; do sleep 1; done\n')
            runner.chmod(0o755)
            ready = root / "ready"
            docker = root / "docker"
            docker.write_text("#!/bin/sh\nexit 0\n")
            docker.chmod(0o755)
            env = {**os.environ, "PATH": f"{root}:{os.environ['PATH']}", "RUN_READY": str(ready)}
            command = release.start_command(str(root))
            self.assertIn(str(runner), command)
            self.assertNotIn("./run.sh", command)
            # A trailing `&` keeps the ssh session open until the whole build ends.
            self.assertIn("setsid -f", command)
            self.assertFalse(command.rstrip().endswith("&"))
            process = subprocess.Popen([str(runner)], env=env,
                                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            try:
                deadline = time.monotonic() + 5
                while not ready.exists() and time.monotonic() < deadline:
                    time.sleep(0.02)
                self.assertTrue(ready.exists(), "runner did not start")
                subprocess.run(release.abort_command(str(root), "b" * 32),
                               shell=True, check=True, env=env)
                process.wait(timeout=5)
                self.assertIsNotNone(process.returncode)
            finally:
                if process.poll() is None:
                    process.kill()
                    process.wait(timeout=5)


if __name__ == "__main__":
    unittest.main()
