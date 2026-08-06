#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"

step() {
  echo "[PIXEL PANIC setup] $1"
}

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20 이상이 필요합니다." >&2
  exit 1
fi
node_major="$(node -p 'Number(process.versions.node.split(".")[0])')"
if [ "$node_major" -lt 20 ]; then
  echo "Node.js 20 이상이 필요합니다. 현재: $(node --version)" >&2
  exit 1
fi
if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3가 필요합니다." >&2
  exit 1
fi

step "프런트엔드 의존성 설치"
npm ci
step "OCI 백엔드 의존성 설치"
npm --prefix backend ci
step "프로젝트 전용 Python 가상환경 준비"
if [ ! -x .venv/bin/python ]; then python3 -m venv .venv; fi
.venv/bin/python -m pip install --upgrade pip
.venv/bin/pip install -r requirements-dev.txt
step "Playwright Chromium 준비"
npx playwright install chromium
step "완료: npm run ci 로 전체 검증할 수 있습니다"
