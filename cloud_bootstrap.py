"""Stdlib-only installer sent over SSH. Installation logs contain no credentials."""
import base64
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import zipfile


def main():
    packet = json.loads(sys.stdin.buffer.readline(4_000_001))
    raw = base64.b64decode(packet['bundle'], validate=True)
    digest = hashlib.sha256(raw).hexdigest()
    if digest != packet['sha256']: raise ValueError('Worker bundle checksum did not match')
    root = Path('/workspaces/.beam-cloud-runtime') / digest[:20]
    root.mkdir(parents=True, exist_ok=True)
    os.chmod(root.parent, 0o700)
    def progress(message): print(json.dumps({'progress': message}), flush=True)
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        for name in archive.namelist():
            target = (root / name).resolve()
            if not target.is_relative_to(root.resolve()): raise ValueError('Invalid bundle path')
        archive.extractall(root)
    python = root / 'venv/bin/python'
    marker = root / 'installed'
    def install(args):
        process = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        if process.returncode: raise ValueError('Worker dependency setup failed. Open the Codespace to check Python, pip, sudo and available storage, then retry.')
    if not marker.exists():
        progress('Preparing Python in your Codespace…')
        install(['python3', '-m', 'venv', str(root / 'venv')])
        progress('Installing Beam’s document, 3D, browser and MCP libraries…')
        install([str(python), '-m', 'pip', 'install', '--disable-pip-version-check', '-r', str(root / 'requirements-cloud-worker.txt')])
        progress('Installing the cloud browser…')
        # This runs on the user-selected Codespace, never on Render or their PC.
        install([str(python), '-m', 'playwright', 'install', '--with-deps', 'chromium'])
        marker.write_text(digest)
    progress('Connecting Studio and Crew…')
    os.execv(str(python), [str(python), '-u', str(root / 'cloud_worker.py')])


if __name__ == '__main__':
    try: main()
    except Exception as error:
        print(json.dumps({'error': str(error)[:800]}), flush=True)
        sys.exit(1)
