"""Entrypoint for the original asset conversion stages in a Pyodide worker.

Set RA2_ASSET_CACHE=/cache and RA2_PUBLIC_DIR=/public before importing this module.
Write converter sources under /project/scripts and the four original MIX files
under /cache/game. Load Pyodide packages pillow, pycryptodome and audioop-lts.
JavaScript owns installer extraction, previews, persistence and readiness.
"""
import gc
import importlib
import os
import runpy
import sys
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1]
STAGES = [
    ('extract', '解包原版 MIX 数据档案。'),
    ('maps', '提取北极圈等全部原版遭遇战地图。'),
    ('sprites', '转换原版建筑、单位与图标。'),
    ('voxels', '生成原版车辆、舰船和飞机的全部方向。'),
    ('audio', '解码原版语音、音效和音乐。'),
    ('infantry', '转换全部步兵动画与建筑图层。'),
    ('overlays', '转换原版矿石、桥梁、树木与围墙。'),
    ('sidebar', '转换原版侧栏、菜单与指针。'),
    ('terrain', '转换雪地、温带与城市地形。'),
    ('scenery', '转换地图中的原版建筑与景物。'),
]


def browser_stages():
    return [{'id': stage, 'message': message} for stage, message in STAGES]


def run_browser_stage(stage):
    """Run one named stage, returning the stage id on success; raise on failure."""
    os.environ['RA2_BROWSER_RUNTIME'] = '1'
    modules = {
        'extract': 'bootstrap', 'sprites': 'export_assets', 'voxels': 'export_voxels',
        'audio': 'export_browser_audio', 'infantry': 'complete_sprites',
        'overlays': 'export_overlays', 'sidebar': 'export_sidebar',
    }
    files = {'maps': 'extract_original_maps.py', 'terrain': 'export_terrain.py', 'scenery': 'export_scenery.py'}
    if stage in modules:
        importlib.import_module(modules[stage]).main()
    elif stage in files:
        filename = SCRIPTS / 'maps' / files[stage]
        previous_argv = sys.argv
        try:
            sys.argv = [str(filename)]
            runpy.run_path(str(filename), run_name='__main__')
        finally:
            sys.argv = previous_argv
    else:
        raise ValueError(f'Unknown browser asset conversion stage: {stage}')
    if stage == 'audio':
        assets = importlib.import_module('export_assets')
        assets.M.pop('theme', None)
        assets.M.pop('audio', None)
    gc.collect()
    return stage
