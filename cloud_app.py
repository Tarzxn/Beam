"""Render entry point. The Windows entry point remains desktop.py."""
from cloud_gateway import create_app

app = create_app()
