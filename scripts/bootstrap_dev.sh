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
if [ "$node_major" -lt 20 ] || [ "$node_major" -ge 23 ]; then
  echo "Node.js >=20 <23 버전이 필요합니다. 현재: $(node --version)" >&2
  exit 1
fi
if ! command -v python3 >/dev/null 2>&1; then
  echo "Python >=3.10 버전이 필요합니다. Python 3.12를 권장합니다." >&2
  exit 1
fi
python_version="$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:3])))')"
if ! python3 -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)'; then
  echo "Python >=3.10 버전이 필요합니다. 현재: $python_version (권장: 3.12)" >&2
  exit 1
fi
if [ -x .venv/bin/python ] && ! .venv/bin/python -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)'; then
  echo "기존 .venv가 Python 3.10 미만입니다. .venv를 정리한 뒤 다시 실행해주세요." >&2
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
