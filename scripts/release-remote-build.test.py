import importlib.util
import os
import subprocess
import tempfile
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
    *label=vemoki.release-build=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa*) echo build-container ;;
    *ancestor=vemoki-runtime:local*) printf 'prod-api\\nprod-worker\\nbuild-container\\n' ;;
  esac
elif [ "$1" = kill ]; then
  shift
  printf '%s\\n' "$@" >> "$KILL_LOG"
fi
""")
            docker.chmod(0o755)
            pkill = root / "pkill"
            pkill.write_text("#!/bin/sh\nexit 0\n")
            pkill.chmod(0o755)
            log = root / "killed"
            env = {**os.environ, "PATH": f"{root}:{os.environ['PATH']}", "KILL_LOG": str(log)}
            subprocess.run(release.abort_command("/opt/vemoki/release-build/job", token),
                           shell=True, check=True, env=env)
            self.assertEqual(log.read_text().splitlines(), ["build-container"])
            shim = release.SHIM.format(cpus=4, mem=5120, token=token)
            self.assertIn(f"--label vemoki.release-build={token}", shim)


if __name__ == "__main__":
    unittest.main()
