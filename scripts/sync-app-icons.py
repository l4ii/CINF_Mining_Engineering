# -*- coding: utf-8 -*-
"""把 frontend/public 中的 Logo 分配到安装包 / 桌面 / 界面使用的标准文件名。

来源（按存在优先）：
  cinf-logo-source.png   → 用户提供的透明底 CINF 品牌图形
  logoico.ico / icon.ico  → 安装向导、卸载程序图标（保持用户提供的 ICO）
  logopng.png / icon.png  → 兼容旧目录结构的 PNG 来源
  logosvg.svg             → 保留为矢量源，同时复制为 icon.svg
"""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print('ERROR: 需要 Pillow。请先执行: pip install Pillow', file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'frontend' / 'public'
BUILD = ROOT / 'electron' / 'build'
DIST = ROOT / 'frontend' / 'dist'
ICO_SIZES = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]


def first_existing(*names: str) -> Path | None:
    for name in names:
        path = PUBLIC / name
        if path.is_file():
            return path
    return None


def to_square(img: Image.Image, background: tuple[int, int, int, int] = (0, 0, 0, 0)) -> Image.Image:
    img = img.convert('RGBA')
    bbox = img.getchannel('A').getbbox()
    if bbox:
        img = img.crop(bbox)
    width, height = img.size
    side = max(width, height)
    padding = max(8, int(side * 0.12))
    canvas_side = side + padding * 2
    canvas = Image.new('RGBA', (canvas_side, canvas_side), background)
    canvas.paste(img, ((canvas_side - width) // 2, (canvas_side - height) // 2), img)
    return canvas


def copy_file(src: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if src.resolve() == dest.resolve():
        return
    shutil.copy2(src, dest)
    print(f'  {src.relative_to(ROOT)} -> {dest.relative_to(ROOT)}')


def main() -> int:
    ico_src = first_existing('logoico.ico', 'icon.ico')
    png_src = first_existing('cinf-logo-source.png', 'logopng.png', 'icon.png')
    svg_src = first_existing('logosvg.svg', 'icon.svg')

    if png_src is None:
        print('ERROR: 未找到 frontend/public/logopng.png 或 icon.png', file=sys.stderr)
        return 1
    if ico_src is None:
        print('ERROR: 未找到 frontend/public/logoico.ico 或 icon.ico', file=sys.stderr)
        return 1

    BUILD.mkdir(parents=True, exist_ok=True)
    print('分配软件图标:')

    # 界面 / favicon / 许可页：透明底 PNG；同时输出浅色背景专用白底版
    ui_png = PUBLIC / 'icon.png'
    png_img = to_square(Image.open(png_src))
    png_img.save(ui_png, format='PNG', optimize=True)
    print(f'  {png_src.relative_to(ROOT)} -> {ui_png.relative_to(ROOT)} (透明底)')
    white_ui = PUBLIC / 'icon-white.png'
    png_img.convert('RGBA')
    white_canvas = Image.new('RGBA', png_img.size, (255, 255, 255, 255))
    white_canvas.alpha_composite(png_img)
    white_canvas.save(white_ui, format='PNG', optimize=True)
    print(f'  {png_src.relative_to(ROOT)} -> {white_ui.relative_to(ROOT)} (白底)')
    copy_file(ui_png, PUBLIC / 'logopng.png')
    if DIST.is_dir():
        copy_file(ui_png, DIST / 'icon.png')
        copy_file(white_ui, DIST / 'icon-white.png')

    # 闪屏 / Linux：PNG（方形 512，减小体积）
    splash = png_img.resize((512, 512), Image.Resampling.LANCZOS)
    splash_path = BUILD / 'icon.png'
    splash.save(splash_path, format='PNG')
    print(f'  {png_src.relative_to(ROOT)} -> {splash_path.relative_to(ROOT)} (512x512)')

    # 桌面快捷方式 / exe / 任务栏：由 PNG 生成含 256 的 ICO
    # Windows .lnk 不能稳定引用 PNG，必须用 ICO 容器；256 档为 PNG 压缩，观感与原图一致
    desktop_ico = BUILD / 'icon.ico'
    png_img.save(desktop_ico, format='ICO', sizes=ICO_SIZES)
    print(f'  {png_src.relative_to(ROOT)} -> {desktop_ico.relative_to(ROOT)} (16..256 ICO，桌面/程序)')

    # 安装向导：用户提供的 ICO
    installer_ico = BUILD / 'installer.ico'
    copy_file(ico_src, installer_ico)

    if svg_src is not None:
        copy_file(svg_src, PUBLIC / 'icon.svg')

    print('完成。安装向导用 installer.ico，桌面/程序用由 PNG 生成的 icon.ico，界面用 icon.png。')
    return 0


if __name__ == '__main__':
    sys.exit(main())
