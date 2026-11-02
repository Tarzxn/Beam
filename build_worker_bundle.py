"""Build the source-only worker kit. Called by Beam.spec before packaging."""
from pathlib import Path
import zipfile

MODULES=('artifacts','enhanced_artifacts','artifact_quality','cad_engine','cad_quality',
         'cad_templates','mesh_engine','model_pipeline','image_provider','path_utils',
         'model_instructions','stl_engine','build_model','beam_core','crew','crew_avatar',
         'remote_tools','agent_runtime','privacy_guard','command_policy','integrations',
         'cloud_client','web_tools','google_tools','browser_tools','mcp_tools')

def build(root=None):
    root=Path(root or Path(__file__).parent)
    with zipfile.ZipFile(root/'worker/worker.zip','w',zipfile.ZIP_DEFLATED) as archive:
        for name in MODULES:archive.write(root/(name+'.py'),name+'.py')
        archive.write(root/'worker/runner.py','runner.py')
        archive.write(root/'worker/requirements.txt','requirements.txt')
        archive.write(root/'worker/setup.py','setup.py')
        archive.write(root/'worker/crew_daemon.py','crew_daemon.py')
    return root/'worker/worker.zip'

if __name__=='__main__':print(build())
