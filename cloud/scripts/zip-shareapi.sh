#!/usr/bin/env bash
# ============================================================
# 打包 CloudBase 云函数 shareApi 为规范 zip（供控制台上传）
#
# 用法：
#   bash cloud/scripts/zip-shareapi.sh
# 产物：
#   cloud/dist/shareApi.zip   （zip 第一层直接是 index.js + package.json）
#
# 注意：不要用 macOS Finder「压缩」整个文件夹 —— 那会让 zip 第一层变成
# shareApi/ 文件夹，云函数入口解析会失败（报 Entryfile/scf_bootstrap 错）。
# ============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="$ROOT/cloud/functions/shareApi"
OUT_DIR="$ROOT/cloud/dist"
OUT="$OUT_DIR/shareApi.zip"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if ! command -v zip >/dev/null 2>&1; then
  echo "缺少 zip 命令，请先安装（macOS/Linux 一般自带）。" >&2
  exit 1
fi

# 在函数目录内打包「当前目录内容」，保证 zip 第一层就是 index.js / package.json
cp "$SRC/index.js" "$SRC/package.json" "$TMP/"
mkdir -p "$OUT_DIR"
rm -f "$OUT"
( cd "$TMP" && zip -q -X -r "$OUT" index.js package.json )
echo "已生成：$OUT"
echo "上传到 CloudBase 控制台 → 云函数 → 新建 shareApi → 运行环境选 Nodejs（不要选自定义运行时）→ 本地上传 zip → 选择此文件。"
