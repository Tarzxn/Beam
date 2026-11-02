# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all,collect_data_files
from PyInstaller.config import CONF
from pathlib import Path
import os,sys
root=SPECPATH
sys.path.insert(0,root)
from build_worker_bundle import build
build(root)
binaries=[]
datas=[(os.path.join(root,'worker','worker.zip'),'worker'),(os.path.join(root,'worker','github'),'worker/github'),(os.path.join(root,'desktop_static'),'desktop_static'),(os.path.join(root,'templates','desktop.html'),'templates')]
hiddenimports=['cloud_client','crew_avatar','remote_tools','privacy_guard','crew','agent_runtime','cad_templates','enhanced_artifacts','artifacts','cad_engine','mesh_engine','model_pipeline','image_provider','manifold3d','webview.platforms.edgechromium','webview.platforms.winforms']
for package in ('webview','pythonnet','clr_loader','docx','pptx','reportlab','manifold3d','playwright','ddgs','primp'):
    d,b,h=collect_all(package)
    datas+=d;binaries+=b;hiddenimports+=h
# Only bundled DejaVu fonts are needed, not development sample datasets.
datas+=collect_data_files('matplotlib',includes=['mpl-data/fonts/ttf/*','mpl-data/matplotlibrc','mpl-data/stylelib/*'])
a=Analysis([os.path.join(root,'desktop.py')],pathex=[root],binaries=binaries,datas=datas,hiddenimports=hiddenimports,
    excludes=['torch','tensorflow','cv2','pandas','scipy','IPython','notebook','jupyter','PyQt5','PyQt6','PySide2','PySide6','tkinter','pytest','sympy','sklearn','statsmodels','bokeh','plotly','wx','gi','webview.platforms.cocoa','webview.platforms.gtk','webview.platforms.qt','webview.platforms.android'],noarchive=False)
# Compile application modules from the saved sources, even if the analysis graph
# was restored from a previous incremental build during active development.
application_root=Path(root).resolve()
application_code=CONF['code_cache'].setdefault(id(a.pure),{})
for module_name,source_path,typecode in a.pure:
    if source_path and source_path!='-' and Path(source_path).resolve().parent==application_root:
        level={'PYMODULE':0,'PYMODULE-1':1,'PYMODULE-2':2}[typecode]
        application_code[module_name]=compile(Path(source_path).read_bytes(),source_path,'exec',dont_inherit=True,optimize=level)
pyz=PYZ(a.pure)
exe=EXE(pyz,a.scripts,[],exclude_binaries=True,name='Beam',debug=False,bootloader_ignore_signals=False,strip=False,upx=False,console=False,version=os.path.join(root,'version_info.txt'),icon=os.path.join(root,'desktop_static','beam.ico'))
coll=COLLECT(exe,a.binaries,a.datas,strip=False,upx=False,name='Beam')
