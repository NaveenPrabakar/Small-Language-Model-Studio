# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all

datas = [("frontend_dist", "frontend_dist")]
binaries = []
hiddenimports = ["uvicorn.logging", "uvicorn.loops", "uvicorn.loops.auto",
                  "uvicorn.protocols", "uvicorn.protocols.http",
                  "uvicorn.protocols.http.auto", "uvicorn.lifespan",
                  "uvicorn.lifespan.on", "aiosqlite",
                  "sqlalchemy.dialects.sqlite.aiosqlite"]

for pkg in ("mcp",):
    d, b, h = collect_all(pkg)
    datas += d; binaries += b; hiddenimports += h

a = Analysis(
    ["desktop_launcher.py"],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz, a.scripts, a.binaries, a.datas, [],
    name="SLMStudio",
    console=False,       # no terminal window
    onefile=True
)