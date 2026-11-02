"""Small, stateless Render gateway. User jobs and databases stay in Codespaces."""
from __future__ import annotations
import base64
import hashlib
import io
import json
import os
from pathlib import Path
import queue
import secrets
import signal
import shlex
import shutil
import subprocess
import tempfile
import threading
import time
import zipfile

from cryptography.fernet import Fernet, InvalidToken
from flask import Flask, Response, g, jsonify, redirect, render_template, request
import requests

ROOT = Path(__file__).resolve().parent
SESSION_TTL = 7 * 86400
MAX_WIRE = 64_000_000


def bundle():
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(ROOT.glob('*.py')):
            if path.name not in {'app.py', 'cloud_app.py', 'cloud_gateway.py', 'build_worker_bundle.py'}:
                info = zipfile.ZipInfo(path.name, (2026, 1, 1, 0, 0, 0)); info.compress_type = zipfile.ZIP_DEFLATED
                archive.writestr(info, path.read_bytes())
        for name in ('requirements.txt', 'requirements-cloud-worker.txt'):
            info = zipfile.ZipInfo(name, (2026, 1, 1, 0, 0, 0)); info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, (ROOT / name).read_bytes())
    return buffer.getvalue()


class Transport:
    def __init__(self, identity, payload):
        self.identity = dict(identity)
        self.payload = payload
        self.lock = threading.RLock()
        self.messages = queue.Queue()
        self.process = None
        self.folder = None
        self.status, self.message = 'connecting', 'Starting your Codespace connection…'
        self.last_use = time.monotonic()
        threading.Thread(target=self.start, name='Beam Codespace connection', daemon=True).start()

    def start(self):
        try:
            self.folder = tempfile.TemporaryDirectory(prefix='beam-ssh-')
            env = {k: v for k, v in os.environ.items() if k in ('PATH', 'HOME', 'USERPROFILE', 'SystemRoot', 'TEMP', 'TMP', 'SSL_CERT_FILE', 'SSL_CERT_DIR')}
            env.update(GH_TOKEN=self.identity['access_token'], GH_HOST='github.com', GH_CONFIG_DIR=self.folder.name,
                GH_PROMPT_DISABLED='1', GH_NO_UPDATE_NOTIFIER='1', HOME=self.folder.name, USERPROFILE=self.folder.name)
            bootstrap = (ROOT / 'cloud_bootstrap.py').read_text()
            command = 'python3 -u -c ' + shlex.quote(bootstrap)
            self.process = subprocess.Popen(['gh', 'codespace', 'ssh', '-c', self.identity['codespace'], '--', '-T', '-o', 'BatchMode=yes', command],
                stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, env=env,
                **({'creationflags': subprocess.CREATE_NO_WINDOW} if os.name == 'nt' else {'start_new_session': True}))
            def read():
                try:
                    while line := self.process.stdout.readline(MAX_WIRE + 1):
                        if len(line) > MAX_WIRE: break
                        try: self.messages.put(json.loads(line))
                        except ValueError: continue
                finally:
                    self.status, self.message = 'failed', 'The Codespace connection closed. Reconnect to restore your saved workspace.'
                    self.messages.put({'error': self.message})
            threading.Thread(target=read, daemon=True).start()
            self.write({'bundle': base64.b64encode(self.payload).decode(), 'sha256': hashlib.sha256(self.payload).hexdigest()})
            # Installer progress arrives before the persistent bridge accepts init.
            deadline = time.monotonic() + 900
            while True:
                packet = self.messages.get(timeout=max(1, deadline - time.monotonic()))
                if 'progress' in packet: self.message = str(packet['progress'])[:300]; continue
                if packet.get('bridge_ready'):
                    self.write({'operation': 'init', 'owner': str(self.identity['user']['id']), 'codespace': self.identity['codespace'], 'github_token': self.identity['access_token'], 'origin': self.identity.get('public_origin', '')})
                    continue
                if 'error' in packet: raise ValueError(packet['error'])
                if packet.get('result', {}).get('ready'): break
                if time.monotonic() > deadline: raise ValueError('Codespace setup timed out; reconnect to retry')
            self.status, self.message = 'ready', 'Connected. Your workspace is stored in this Codespace.'
        except Exception as error:
            self.status, self.message = 'failed', str(error)[:500]
            self.close()

    def write(self, data):
        self.process.stdin.write((json.dumps(data) + '\n').encode()); self.process.stdin.flush()

    def api(self, path, method='GET', body=None):
        if self.status != 'ready': raise ValueError(self.message)
        with self.lock:
            self.last_use = time.monotonic()
            try:
                self.write({'owner': str(self.identity['user']['id']), 'path': path, 'method': method, 'body': body})
                packet = self.messages.get(timeout=170)
                if 'error' in packet: raise ValueError(packet['error'])
                return packet['result']
            except (BrokenPipeError, OSError, queue.Empty, KeyError):
                self.status, self.message = 'failed', 'Connection interrupted. Reconnect to continue from your saved workspace.'
                self.close(); raise ValueError(self.message) from None

    def close(self):
        if self.process:
            if self.process.poll() is None:
                if os.name == 'posix':
                    try: os.killpg(self.process.pid, signal.SIGTERM)
                    except ProcessLookupError: pass
                else: self.process.terminate()
                try: self.process.wait(timeout=5)
                except subprocess.TimeoutExpired: self.process.kill()
            for stream in (self.process.stdin, self.process.stdout):
                try: stream.close()
                except (OSError, ValueError): pass
        if self.folder:
            try: self.folder.cleanup()
            except OSError: pass


class Pool:
    def __init__(self, factory=Transport):
        self.factory, self.entries, self.lock = factory, {}, threading.RLock()
        self.payload = bundle()

    def get(self, identity, start=True):
        if not identity.get('codespace'): return None
        key = (identity['sid'], str(identity['user']['id']), identity['codespace'])
        with self.lock:
            item = self.entries.get(key)
            if item and item.status == 'failed' and start:
                item.close(); self.entries.pop(key); item = None
            if not item and start:
                if len(self.entries) >= 4:
                    oldest = min(self.entries, key=lambda k: self.entries[k].last_use)
                    self.entries.pop(oldest).close()
                item = self.entries[key] = self.factory(identity, self.payload)
            if item: item.last_use = time.monotonic()
            return item

    def close(self, identity):
        with self.lock:
            keys = [k for k in self.entries if k[0] == identity['sid']]
            for key in keys: self.entries.pop(key).close()


def create_app(config=None, pool=None):
    app = Flask(__name__, static_folder=str(ROOT / 'cloud_static'), static_url_path='/cloud_static', template_folder=str(ROOT / 'cloud_templates'))
    app.config.update(MAX_CONTENT_LENGTH=8 * 1024 * 1024,
        PUBLIC_URL=os.environ.get('PUBLIC_URL') or os.environ.get('RENDER_EXTERNAL_URL', ''),
        BEAM_SESSION_KEY=os.environ.get('BEAM_SESSION_KEY', ''),
        GITHUB_CLIENT_ID=os.environ.get('GITHUB_CLIENT_ID', ''), GITHUB_CLIENT_SECRET=os.environ.get('GITHUB_CLIENT_SECRET', ''))
    if config: app.config.update(config)
    secret = app.config['BEAM_SESSION_KEY']
    if len(secret) < 32: raise ValueError('Set BEAM_SESSION_KEY to a random secret of at least 32 characters')
    cipher = Fernet(base64.urlsafe_b64encode(hashlib.sha256(secret.encode()).digest()))
    app.pool = pool or Pool()

    def origin():
        value = app.config['PUBLIC_URL'].rstrip('/')
        if not value: raise ValueError('Set PUBLIC_URL to the HTTPS address of your Beam Cloud service')
        return value

    def encode(data): return cipher.encrypt(json.dumps(data).encode()).decode()
    def decode(value, ttl=SESSION_TTL):
        try: return json.loads(cipher.decrypt(value.encode(), ttl=ttl))
        except (InvalidToken, ValueError, AttributeError): return None
    def cookie(response, data, name='beam_cloud', ttl=SESSION_TTL):
        response.set_cookie(name, encode(data), max_age=ttl, secure=origin().startswith('https:'), httponly=True, samesite='Lax', path='/')
        return response
    def github(path, token):
        with requests.get('https://api.github.com' + path, headers={'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json'}, timeout=(8, 25), allow_redirects=False) as response:
            if response.status_code == 401: raise ValueError('GitHub access expired. Sign out and sign in again.')
            if response.status_code != 200: raise ValueError('GitHub could not complete this request. Check Codespaces permissions and availability.')
            return response.json()

    @app.before_request
    def authenticate():
        g.identity = decode(request.cookies.get('beam_cloud'))
        g.refresh_cookie = False
        if request.path.startswith('/api/') or request.path == '/auth/logout':
            if not g.identity: return jsonify(error='Sign in with GitHub to continue', sign_in=True), 401
            if request.method == 'POST':
                if request.headers.get('Origin') != origin(): return jsonify(error='Cross-origin request denied'), 403
                if not secrets.compare_digest(request.headers.get('X-Beam-Token', ''), g.identity['csrf']): return jsonify(error='Your browser session needs to be refreshed'), 403
            if g.identity.get('expires_at', 0) < time.time() + 60:
                if not g.identity.get('refresh_token'): return jsonify(error='Sign in with GitHub again', sign_in=True), 401
                with requests.post('https://github.com/login/oauth/access_token', headers={'Accept': 'application/json'}, data={
                    'client_id': app.config['GITHUB_CLIENT_ID'], 'client_secret': app.config['GITHUB_CLIENT_SECRET'], 'grant_type': 'refresh_token', 'refresh_token': g.identity['refresh_token']}, timeout=(8, 25)) as response:
                    data = response.json()
                if not data.get('access_token'): return jsonify(error='GitHub sign-in expired', sign_in=True), 401
                g.identity.update(access_token=data['access_token'], refresh_token=data.get('refresh_token', g.identity['refresh_token']), expires_at=time.time() + data.get('expires_in', 28800))
                app.pool.close(g.identity); g.refresh_cookie = True

    @app.after_request
    def security(response):
        response.headers.update({'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer',
            'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; frame-src blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"})
        if getattr(g, 'refresh_cookie', False): cookie(response, g.identity)
        return response

    @app.errorhandler(ValueError)
    def bad_request(error): return jsonify(error=str(error)), 400
    @app.errorhandler(requests.RequestException)
    def upstream_error(error): return jsonify(error='The cloud service could not be reached. Retry shortly.'), 502
    @app.errorhandler(413)
    def too_large(error): return jsonify(error='This request exceeds the 8 MB limit'), 413

    @app.get('/healthz')
    def health(): return jsonify(ok=True, name='Beam Cloud', version='0.8.0-cloud')

    @app.get('/auth/login')
    def login():
        from urllib.parse import urlencode
        if not app.config['GITHUB_CLIENT_ID'] or not app.config['GITHUB_CLIENT_SECRET']:
            return render_template('login.html', error='The host needs to configure GitHub OAuth. Follow CLOUD_SETUP.md.'), 503
        state, verifier = secrets.token_urlsafe(32), secrets.token_urlsafe(64)
        challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip('=')
        url = 'https://github.com/login/oauth/authorize?' + urlencode({'client_id': app.config['GITHUB_CLIENT_ID'], 'redirect_uri': origin() + '/auth/callback',
            'scope': 'read:user codespace', 'state': state, 'code_challenge': challenge, 'code_challenge_method': 'S256'})
        return cookie(redirect(url), {'state': state, 'verifier': verifier}, 'beam_oauth', 600)

    @app.get('/auth/callback')
    def callback():
        pending = decode(request.cookies.get('beam_oauth'), 600)
        if not pending or not secrets.compare_digest(request.args.get('state', ''), pending['state']): return render_template('login.html', error='Sign-in expired or did not match. Try again.'), 400
        if request.args.get('error'): return render_template('login.html', error='GitHub sign-in was cancelled.'), 400
        with requests.post('https://github.com/login/oauth/access_token', headers={'Accept': 'application/json'}, data={
            'client_id': app.config['GITHUB_CLIENT_ID'], 'client_secret': app.config['GITHUB_CLIENT_SECRET'], 'code': request.args.get('code', ''),
            'redirect_uri': origin() + '/auth/callback', 'code_verifier': pending['verifier']}, timeout=(8, 25)) as response:
            token = response.json()
        if not token.get('access_token'): return render_template('login.html', error='GitHub could not complete sign-in. Try again.'), 400
        profile = github('/user', token['access_token'])
        identity = {'sid': secrets.token_urlsafe(24), 'csrf': secrets.token_urlsafe(32), 'user': {k: profile[k] for k in ('id', 'login')},
            'access_token': token['access_token'], 'refresh_token': token.get('refresh_token'), 'expires_at': time.time() + token.get('expires_in', SESSION_TTL), 'codespace': None, 'public_origin': origin()}
        response = cookie(redirect('/'), identity); response.delete_cookie('beam_oauth', path='/')
        return response

    @app.post('/auth/logout')
    def logout():
        app.pool.close(g.identity)
        response = jsonify(ok=True); response.delete_cookie('beam_cloud', path='/')
        return response

    @app.get('/')
    def index():
        if not g.identity: return render_template('login.html', error='')
        text = (ROOT / 'templates/desktop.html').read_text('utf-8')
        text = text.replace('<title>Beam</title>', '<title>Beam Cloud · Studio & Crew</title>')
        text = text.replace('/desktop_static/beam-computer.js', '/cloud_static/cloud-ui.js').replace('/desktop_static/beam-privacy.js', '/cloud_static/cloud-privacy.js')
        text = text.replace('</head>', '<link rel="stylesheet" href="/cloud_static/cloud.css"></head>')
        text = text.replace('>This PC<', '>Codespace<').replace('<strong>beam</strong>', '<strong>beam<span class="cloud-brand">cloud</span></strong>')
        from markupsafe import escape
        text = text.replace('Import Desktop client JSON…', 'Import Web client JSON…').replace('<strong>Desktop app</strong>', '<strong>Web application</strong>. Register <code>' + str(escape(origin())) + '/auth/google/callback</code> as an authorized redirect URI')
        text = text.replace('Google’s desktop setup guide', 'Google OAuth setup guide').replace('Local process (stdio)', 'Codespace process (stdio)').replace('Connect local tool servers or remote MCP endpoints.', 'Connect Codespace tool processes or remote MCP endpoints.')
        text = text.replace('Beam uses a separate Chrome/Edge profile. It can read page text and use controls, while you can inspect the screenshot or open its browser window.', 'Headless Chromium runs in your Codespace. Inspect screenshots and use page controls in the Browser panel.')
        text = text.replace('Website actions ask for approval. Enter passwords yourself in the visible browser. Browser cookies stay in this browser profile and are not included in model prompts.', 'Website actions ask for approval. Cookies stay in the Codespace browser profile. Some sites restrict automated sign-in.')
        from flask import render_template_string
        return render_template_string(text, token=g.identity['csrf'])

    @app.get('/desktop_static/<path:name>')
    def assets(name):
        from flask import send_from_directory
        if name in ('beam.js', 'beam-web.js'):
            content = (ROOT / 'desktop_static' / name).read_text('utf-8')
            content = content.replace('Desktop client', 'Web application client').replace('your Windows account permissions', 'your Codespace account permissions').replace('The local app returned an invalid response', 'The cloud worker returned an invalid response')
            return Response(content, mimetype='application/javascript')
        return send_from_directory(ROOT / 'desktop_static', name)

    @app.get('/api/account')
    def account(): return jsonify(user=g.identity['user'], codespace=g.identity.get('codespace'), csrf=g.identity['csrf'])

    @app.get('/api/codespaces')
    def computers():
        data = github('/user/codespaces?per_page=100', g.identity['access_token'])
        spaces = [space for space in data.get('codespaces', []) if str(space.get('owner', {}).get('id')) == str(g.identity['user']['id'])]
        return jsonify(computers=[{k: space.get(k) for k in ('name','display_name','state','repository')} for space in spaces])

    @app.post('/api/codespaces/connect')
    def connect():
        import re
        name = request.get_json().get('codespace', '')
        if not isinstance(name, str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9-]{0,119}', name): raise ValueError('Choose a Codespace')
        space = github('/user/codespaces/' + name, g.identity['access_token'])
        if str(space.get('owner', {}).get('id')) != str(g.identity['user']['id']): return jsonify(error='Choose a Codespace owned by your GitHub account'), 403
        if space.get('state') not in ('Available', 'Shutdown', 'Starting', 'Created'): raise ValueError('This Codespace is not ready. Open it in GitHub and retry.')
        app.pool.close(g.identity)
        g.identity['codespace'] = name
        item = app.pool.get(g.identity)
        return cookie(jsonify(status=item.status, message=item.message), g.identity)

    @app.get('/api/codespaces/status')
    def status():
        item = app.pool.get(g.identity, start=False)
        if not item and g.identity.get('codespace'): item = app.pool.get(g.identity)
        return jsonify(status=item.status if item else 'disconnected', message=item.message if item else 'Choose your Codespace', codespace=g.identity.get('codespace'))

    @app.get('/auth/google/callback')
    def google_callback():
        if not g.identity: return redirect('/')
        item = app.pool.get(g.identity)
        if not item or item.status != 'ready': return 'Reconnect your Codespace in Beam, then connect Google again.', 409
        answer = item.api('/api/cloud/google/callback', 'POST', {k: request.args.get(k, '') for k in ('state','code','error')})
        return ('Google connected. Return to the Beam Cloud tab.' if answer['status'] == 200 else 'Google sign-in did not finish. Return to Beam Cloud and try again.'), answer['status']

    @app.route('/api/<path:path>', methods=['GET', 'POST'])
    def proxy(path):
        if path.startswith(('computer', 'privacy/')): return jsonify(error='Beam Cloud runs only in your Codespace'), 404
        item = app.pool.get(g.identity)
        if not item or item.status != 'ready':
            if path == 'state': return jsonify(name='Beam Cloud', version='0.8.0-cloud', cloud=True, connected=False, projects=[], sessions=[], active={}, configured=False, theme='dark', effort='high', command_budget=8)
            return jsonify(error='Connect your Codespace first', reconnect=True), 409
        body = request.get_json() if request.method == 'POST' else None
        if request.method == 'POST' and not isinstance(body, dict): raise ValueError('Expected a JSON object')
        if path == 'connections/google/start': body = {**body, 'redirect_uri': origin() + '/auth/google/callback'}
        target = '/api/' + path + ('?' + request.query_string.decode('ascii') if request.query_string else '')
        answer = item.api(target, request.method, body)
        raw = base64.b64decode(answer['data'], validate=True)
        return Response(raw, status=answer['status'], headers=answer.get('headers', {}))

    return app
