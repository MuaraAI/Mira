import os
from pathlib import Path
import subprocess


REPO_ROOT = Path(__file__).resolve().parents[1]
DEPLOY_SCRIPT = REPO_ROOT / "scripts" / "deploy.sh"


def test_deploy_rsync_preserves_remote_files(tmp_path):
    mock_bin = tmp_path / "bin"
    mock_bin.mkdir()
    rsync_log = tmp_path / "rsync-args.txt"

    ssh = mock_bin / "ssh"
    ssh.write_text(
        "#!/usr/bin/env bash\n"
        "case \"$*\" in\n"
        "  *'curl -s http://127.0.0.1:8300/health'*) echo '{\"status\":\"ok\",\"redis\":\"up\"}';;\n"
        "  *'curl -sI http://127.0.0.1:8350/mcp'*) echo 'HTTP/1.1 405 Method Not Allowed';;\n"
        "esac\n"
    )
    ssh.chmod(0o755)

    rsync = mock_bin / "rsync"
    rsync.write_text("#!/usr/bin/env bash\nprintf '%s\\n' \"$@\" >> \"$RSYNC_ARGS_LOG\"\n")
    rsync.chmod(0o755)

    sleep = mock_bin / "sleep"
    sleep.write_text("#!/usr/bin/env bash\nexit 0\n")
    sleep.chmod(0o755)

    env = os.environ | {
        "PATH": f"{mock_bin}:{os.environ['PATH']}",
        "RSYNC_ARGS_LOG": str(rsync_log),
    }
    subprocess.run(["bash", str(DEPLOY_SCRIPT)], cwd=REPO_ROOT, env=env, check=True)

    args = rsync_log.read_text().splitlines()
    assert "--delete" not in args
    assert "--delete-excluded" not in args
    assert any(arg.startswith("--exclude=.env") for arg in args)
    assert any(arg.endswith(":/opt/ubsi-api/") for arg in args)
