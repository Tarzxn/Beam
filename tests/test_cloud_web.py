"""Cloud account isolation, real persisted worker state and offline lifecycle."""
import base64
import json
import queue
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest.mock import Mock, patch
from urllib.parse import parse_qs, urlparse

from cloud_gateway import create_app, Transport, bundle
from cloud_worker import Service
from beam_core import Run


class Reply:
    status_code = 200
    def __init__(self, data): self.data = data
    def __enter__(self): return self
    def __exit__(self, *args): pass
    def json(self): return self.data


class FakePool:
    def __init__(self): self.identities = []; self.item = Mock(status='ready', message='Ready')
    def get(self, identity, start=True):
        self.identities.append(dict(identity))
        if not identity.get('codespace'): return None
        return self.item
    def close(self, identity): pass


class TransportTests(unittest.TestCase):
    def test_persistent_ssh_handshake_keeps_credentials_off_arguments(self):
        class Output:
            def __init__(self): self.queue = queue.Queue()
            def readline(self, limit): return self.queue.get(timeout=4)
            def close(self): pass
        class Process:
            def __init__(self):
                self.stdout = Output(); self.stdin = self; self.dead = False; self.sent = []
            def write(self, raw):
                data = json.loads(raw); self.sent.append(data)
                if 'bundle' in data:
                    self.stdout.queue.put(b'{"progress":"Preparing"}\n'); self.stdout.queue.put(b'{"bridge_ready":true}\n')
                elif data.get('operation') == 'init': self.stdout.queue.put(b'{"result":{"ready":true}}\n')
                else: self.stdout.queue.put(b'{"result":{"status":200,"data":"e30="}}\n')
            def flush(self): pass
            def poll(self): return 0 if self.dead else None
            def terminate(self): self.dead = True; self.stdout.queue.put(b'')
            def wait(self, timeout): return 0
            def close(self): pass
        process = Process()
        identity = {'sid':'fixture-session','user':{'id':101},'codespace':'fixture-space','access_token':'fixture-private-github-token'}
        with patch('cloud_gateway.subprocess.Popen', return_value=process) as launch:
            transport = Transport(identity, bundle())
            deadline = time.monotonic() + 4
            while transport.status == 'connecting' and time.monotonic() < deadline: time.sleep(.01)
            self.assertEqual(transport.status, 'ready', transport.message)
            self.assertEqual(transport.api('/api/state')['status'], 200)
            self.assertEqual(process.sent[1]['operation'], 'init')
            self.assertEqual(process.sent[2]['owner'], '101')
            self.assertNotIn(identity['access_token'], str(launch.call_args.args))
            self.assertEqual(launch.call_args.kwargs['env']['GH_TOKEN'], identity['access_token'])
            self.assertNotIn('GITHUB_CLIENT_SECRET', launch.call_args.kwargs['env'])
            transport.close()


class GatewayTests(unittest.TestCase):
    def setUp(self):
        self.pool = FakePool()
        self.app = create_app({'TESTING': True, 'BEAM_SESSION_KEY': 'test-only-secret-' * 4,
            'PUBLIC_URL': 'https://beam.example', 'GITHUB_CLIENT_ID': 'client', 'GITHUB_CLIENT_SECRET': 'secret'}, self.pool)
        self.client = self.app.test_client()

    def login(self, client=None, ident=101):
        client = client or self.client
        response = client.get('/auth/login', base_url='https://beam.example')
        params = parse_qs(urlparse(response.location).query)
        self.assertEqual(params['code_challenge_method'], ['S256'])
        self.assertNotIn('gist', params['scope'][0])
        with patch('cloud_gateway.requests.post', return_value=Reply({'access_token': 'fake-access-key-' + str(ident)})), patch('cloud_gateway.requests.get', return_value=Reply({'id': ident, 'login': 'account' + str(ident)})):
            response = client.get('/auth/callback?state=' + params['state'][0] + '&code=fixture', base_url='https://beam.example')
        self.assertEqual(response.status_code, 302)
        self.assertNotIn('fake-access-key', response.headers['Set-Cookie'])
        self.assertIn('HttpOnly', response.headers['Set-Cookie'])
        return client.get('/api/account', base_url='https://beam.example').json

    def post(self, path, data, csrf=None, client=None, **kwargs):
        return (client or self.client).post(path, json=data, base_url='https://beam.example',
            headers={'Origin': kwargs.get('origin', 'https://beam.example'), 'X-Beam-Token': csrf or ''})

    def test_anonymous_and_tampered_sessions_cannot_access_work(self):
        self.assertEqual(self.client.get('/api/state').status_code, 401)
        self.client.set_cookie('beam_cloud', 'forged', domain='beam.example')
        self.assertEqual(self.client.get('/api/state', base_url='https://beam.example').status_code, 401)
        self.assertEqual(self.client.get('/healthz').status_code, 200)

    def test_oauth_state_is_required_and_one_time(self):
        self.client.get('/auth/login', base_url='https://beam.example')
        with patch('cloud_gateway.requests.post') as post:
            self.assertEqual(self.client.get('/auth/callback?state=wrong&code=fixture', base_url='https://beam.example').status_code, 400)
            post.assert_not_called()
        self.login()
        self.assertEqual(self.client.get('/auth/callback?state=old&code=fixture', base_url='https://beam.example').status_code, 400)

    def test_owner_validation_csrf_and_cross_origin(self):
        account = self.login()
        self.assertEqual(self.post('/api/codespaces/connect', {'codespace': 'mine'}).status_code, 403)
        self.assertEqual(self.post('/api/codespaces/connect', {'codespace': 'mine'}, account['csrf'], origin='https://evil.example').status_code, 403)
        with patch('cloud_gateway.requests.get', return_value=Reply({'owner': {'id': 999}, 'state': 'Available'})):
            self.assertEqual(self.post('/api/codespaces/connect', {'codespace': 'other-person'}, account['csrf']).status_code, 403)
        self.assertFalse(self.pool.identities)

    def test_accounts_use_distinct_transports_and_proxy_has_no_local_execution(self):
        a = self.login()
        other = self.app.test_client(); b = self.login(other, 202)
        for client, account, ident in ((self.client, a, 101), (other, b, 202)):
            with patch('cloud_gateway.requests.get', return_value=Reply({'owner': {'id': ident}, 'state': 'Available'})):
                self.assertEqual(self.post('/api/codespaces/connect', {'codespace': 'space-' + str(ident)}, account['csrf'], client).status_code, 200)
        self.assertNotEqual(self.pool.identities[-1]['sid'], self.pool.identities[-2]['sid'])
        self.assertNotEqual(self.pool.identities[-1]['codespace'], self.pool.identities[-2]['codespace'])
        self.pool.item.api.return_value = {'status': 200, 'headers': {'Content-Type': 'application/json'}, 'data': base64.b64encode(b'{"files":[]}').decode()}
        with patch('cloud_gateway.subprocess.Popen') as process:
            response = self.client.get('/api/projects/project/files', base_url='https://beam.example')
            self.assertEqual(response.json, {'files': []}); process.assert_not_called()
        self.assertEqual(self.post('/api/computer/target', {'target': 'local'}, a['csrf']).status_code, 404)

    def test_disconnected_shell_is_clean_and_uses_cloud_assets(self):
        self.login()
        html = self.client.get('/', base_url='https://beam.example').text
        self.assertIn('cloud-ui.js', html); self.assertIn('cloud-privacy.js', html)
        self.assertNotIn('beam-computer.js', html)
        self.assertEqual(self.client.get('/api/state', base_url='https://beam.example').json['connected'], False)


class RuntimeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.base = Path(self.temp.name); self.workspace = self.base / 'workspaces'; self.workspace.mkdir()
        self.patcher = patch('cloud_runtime.WORKSPACES', self.workspace); self.patcher.start()
        self.service = Service(self.workspace / '.beam-cloud')
        self.service.dispatch({'operation': 'init', 'owner': '101', 'codespace': 'fixture-space', 'github_token': 'fixture-github-token', 'origin': 'https://beam.example'})
        self.app = self.service.app; self.app.lifecycle.closed.set()
        self.app.lifecycle.stop_computer = Mock()

    def tearDown(self):
        self.service.close(); self.app.store.db.close(); self.patcher.stop(); self.temp.cleanup()

    def api(self, path, body=None):
        answer = self.service.dispatch({'owner': '101', 'path': '/api/' + path, 'method': 'GET' if body is None else 'POST', 'body': body})
        return answer['status'], json.loads(base64.b64decode(answer['data']))

    def test_worker_rejects_other_accounts_and_native_routes(self):
        with self.assertRaises(ValueError): self.service.dispatch({'owner': '202', 'path': '/api/state'})
        with self.assertRaises(ValueError): self.service.dispatch({'owner': '101', 'path': 'https://evil.example'})
        self.assertEqual(self.api('computer/target', {'target': 'local'})[0], 404)
        self.assertEqual(self.api('privacy/models')[0], 404)
        with self.assertRaises(ValueError): self.app.agent.integrations.config.validate('https://beam.example/api/state')

    def test_keys_encrypted_and_reopen_with_history_and_avatars(self):
        self.assertEqual(self.api('settings', {'api_key': 'fixture-ollama-secret'})[0], 200)
        settings = self.app.store.settings_path.read_text()
        self.assertNotIn('fixture-ollama-secret', settings)
        self.assertEqual(self.app.store.key(), 'fixture-ollama-secret')
        pid = self.api('workspace', {})[1]['id']
        session = self.api('sessions', {'project_id': pid})[1]['id']
        self.app.store.emit(session, 'assistant', text='Saved in the Codespace')
        self.api('crew/bots', {'id': 'engineer', 'avatar': {'shape': 'star', 'color': '#aabbcc', 'eyes': 'round'}})
        from cloud_runtime import CloudStore
        reopened = CloudStore(self.app.store.root)
        self.assertEqual(reopened.key(), 'fixture-ollama-secret')
        self.assertEqual(reopened.events(session)[0]['text'], 'Saved in the Codespace')
        self.assertIn('star', reopened.db.execute("SELECT avatar FROM crew_bots WHERE id='engineer'").fetchone()['avatar'])
        reopened.db.close()
        self.assertNotIn('fixture-ollama-secret', json.dumps(self.api('state')[1]))

    def test_existing_repository_and_file_editor_stay_inside_workspace(self):
        repo = self.workspace / 'my-repo'; repo.mkdir(); (repo / 'hello.py').write_text('print(1)')
        pid = self.api('projects', {'path': str(repo)})[1]['id']
        self.assertIn('hello.py', json.dumps(self.api('projects/' + pid + '/files')[1]))
        self.assertEqual(self.api('projects/' + pid + '/file', {'path': 'hello.py', 'content': 'print(2)', 'original': 'print(1)'})[0], 200)
        self.assertEqual((repo / 'hello.py').read_text(), 'print(2)')
        self.assertEqual(self.api('projects', {'path': str(self.base)})[0], 400)
        self.assertEqual(self.api('projects', {'path': str(self.app.store.root)})[0], 400)
        from urllib.parse import quote
        self.assertEqual(self.api('cloud/folders?path=' + quote(str(self.base), safe=''))[0], 400)
        self.assertEqual(self.api('projects/' + pid + '/file?path=../.beam-cloud/vault.key')[0], 400)

    def test_no_local_privacy_option_and_no_local_model_fallback(self):
        self.assertEqual(self.app.agent.privacy_choices, ['cloud', 'stop'])
        with self.assertRaises(ValueError): self.app.agent.choose_privacy('missing', 'missing', 'local')

    def test_watchdog_off_by_default_multiple_tabs_and_background_opt_in(self):
        life = self.app.lifecycle
        self.assertFalse(life.state()['background_work'])
        life.changed = 0; life.tabs = {'tab-a': 400, 'tab-b': 600}
        with patch.object(life, 'shutdown') as shutdown:
            life.tick(500); shutdown.assert_not_called()
            life.tick(601); shutdown.assert_called_once()
        self.api('settings', {'background_work': True})
        with patch.object(life, 'shutdown') as shutdown:
            life.tick(1000); shutdown.assert_not_called()

    def test_pause_is_durable_before_codespace_shutdown(self):
        self.api('settings', {'api_key': 'fixture-ollama-secret'})
        pid = self.api('workspace', {})[1]['id']
        sid = self.api('sessions', {'project_id': pid})[1]['id']
        run = Run(); run.permission_mode = 'edit'; self.app.agent.runs[sid] = run
        self.app.lifecycle.shutdown()
        self.app.lifecycle.stop_computer.assert_called_once()
        self.assertTrue(run.cancelled.is_set())
        self.assertEqual(self.app.store.db.execute('SELECT session_id FROM cloud_paused').fetchone()['session_id'], sid)

    def test_drafts_persist_and_background_rejects_invalid_settings(self):
        self.assertEqual(self.api('cloud/drafts', {'id': 'studio:new', 'text': 'A draft for later'})[0], 200)
        self.assertEqual(self.api('cloud/drafts')[1]['drafts']['studio:new'], 'A draft for later')
        self.assertEqual(self.api('settings', {'background_work': 'yes'})[0], 400)
        self.assertEqual(self.api('cloud/leave', {'background': True})[0], 400)
        pid = self.api('workspace', {})[1]['id']
        self.assertEqual(self.api('cloud/ui', {'project': pid, 'session': None, 'mode': 'crew'})[0], 200)
        self.assertEqual(self.api('cloud/ui')[1]['mode'], 'crew')

    def test_studio_finishes_real_file_without_a_connected_web_request(self):
        self.api('settings', {'api_key': 'fixture-ollama-secret', 'background_work': True})
        pid = self.api('workspace', {})[1]['id']
        sid = self.api('sessions', {'project_id': pid})[1]['id']
        entered, release = threading.Event(), threading.Event()
        class ModelReply:
            status_code = 200
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def close(self): pass
            def iter_lines(inner):
                entered.set(); release.wait(3)
                yield json.dumps({'message': {'tool_calls': [{'function': {'name': 'write_file', 'arguments': {'path': 'background.md', 'content': '# Saved in the Codespace'}}}]}, 'done': True}).encode()
        class Finished(ModelReply):
            def iter_lines(inner): yield json.dumps({'message': {'content': 'Background work finished.'}, 'done': True}).encode()
        with patch('beam_core.requests.post', side_effect=[ModelReply(), Finished()]):
            self.assertEqual(self.api('sessions/' + sid + '/run', {'prompt': 'Create the requested project note.', 'mode': 'edit'})[0], 200)
            self.assertTrue(entered.wait(3))
            # The request ended; no browser, Render connection or event polling
            # is needed for the worker to finish and persist this output.
            release.set(); self.app.agent.runs[sid].worker.join(5)
        self.assertEqual((Path(self.app.store.project(pid)['path']) / 'background.md').read_text(), '# Saved in the Codespace')
        self.assertEqual(self.app.agent.runs[sid].status, 'done')

    def test_private_prompt_waits_before_any_cloud_model_request(self):
        self.api('settings', {'api_key': 'fixture-ollama-secret'})
        pid = self.api('workspace', {})[1]['id']; sid = self.api('sessions', {'project_id': pid})[1]['id']
        with patch('beam_core.requests.post') as upstream:
            self.api('sessions/' + sid + '/run', {'prompt': 'Tell me about my IP address 192.168.77.42', 'mode': 'ask'})
            deadline = time.monotonic() + 3
            while self.app.agent.runs[sid].status != 'privacy' and time.monotonic() < deadline: time.sleep(.01)
            run = self.app.agent.runs[sid]
            self.assertEqual(run.status, 'privacy'); upstream.assert_not_called()
            self.assertEqual(run.privacy_pending['choices'], ['cloud', 'stop'])
            self.assertEqual(self.api('sessions/' + sid + '/privacy', {'action_id': run.privacy_pending['action_id'], 'choice': 'local'})[0], 400)
            self.api('sessions/' + sid + '/privacy', {'action_id': run.privacy_pending['action_id'], 'choice': 'stop'})
            run.worker.join(3); upstream.assert_not_called()

    def test_google_web_oauth_uses_pkce_and_cancel_invalidates_callback(self):
        google = self.app.agent.integrations.google
        redirect = 'https://beam.example/auth/google/callback'
        google.configure({'web': {'client_id': 'fixture.apps.googleusercontent.com', 'client_secret': 'fixture-google-secret', 'redirect_uris': [redirect]}})
        result = google.start(redirect); params = parse_qs(urlparse(result['authorization_url']).query)
        self.assertEqual(params['code_challenge_method'], ['S256'])
        with self.assertRaises(ValueError): google.finish({'state': 'wrong', 'code': 'fixture'})
        google.disconnect()
        with self.assertRaises(ValueError): google.finish({'state': params['state'][0], 'code': 'fixture'})
        self.assertNotIn('fixture-google-secret', google.config.vault.path.read_text())


if __name__ == '__main__': unittest.main()
