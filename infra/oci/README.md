# PIXEL PANIC OCI 백엔드 배포

대상은 공인 IP가 연결된 Ubuntu 22.04 VM `pixel-panic-api-prod-01`입니다. 브라우저는 VM을 호출하지 않습니다. Vercel 서버 라우트가 공유 Bearer 토큰을 사용해 VM의 TCP 8080으로 요청합니다.

```text
사용자 브라우저 → Vercel same-origin /api/plan → OCI VM 공인 IP:8080 → OpenAI
```

## 1. 네트워크 선행 조건

| Source | Port | 설명 |
|---|---:|---|
| 관리자 공인 IP `/32` | 22 | SSH 관리 |
| Vercel 고정 송신 IP | 8080 | 사용할 수 있다면 최우선 |
| `0.0.0.0/0` | 8080 | 고정 송신 IP가 없을 때만 사용 |

- TCP 8080을 전체 공개해야 한다면 Bearer 인증, IP별 rate limit, 짧은 timeout을 반드시 유지합니다.
- VM egress TCP 443은 OpenAI와 패키지 저장소 접근을 위해 허용합니다.
- 공인 IP의 HTTP 연결은 암호화되지 않습니다. 이번 해커톤에서는 게임 명령만 전송하고 공유 토큰을 주기적으로 교체합니다. 운영 서비스로 확장할 때는 HTTPS 종단을 추가해야 합니다.

## 2. Ubuntu 22.04 초기 준비

```bash
sudo apt-get update
sudo apt-get -y upgrade
sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
```

## 3. 배포 사용자와 승인 코드

```bash
sudo useradd --create-home --shell /bin/bash pixelpanic
sudo usermod -aG docker pixelpanic
sudo install -d -o pixelpanic -g pixelpanic /opt/pixel-panic
sudo -u pixelpanic git clone https://github.com/KorTechTim/aihackathon_pre.git /opt/pixel-panic
cd /opt/pixel-panic
sudo -u pixelpanic git fetch origin
sudo -u pixelpanic git checkout <approved-main-commit>
```

안정화 코드와 배포 전 수정이 `main`에 병합된 커밋만 사용합니다. SSH 개인키나 GitHub 토큰은 저장소에 복사하지 않습니다.

## 4. 저장소 밖 비밀 환경파일

```bash
sudo install -d -o root -g pixelpanic -m 0750 /etc/pixel-panic
sudo install -o root -g pixelpanic -m 0640 /dev/null /etc/pixel-panic/backend.env
sudoedit /etc/pixel-panic/backend.env
sudo -u pixelpanic test -r /etc/pixel-panic/backend.env
```

`infra/oci/env.production.example`의 변수 이름만 참고해 값을 편집합니다. OpenAI 키와 32바이트 이상의 무작위 공유 토큰은 비밀 관리 도구에서 가져오며 터미널 출력, 명령 인자, 로그 또는 Git에 기록하지 않습니다.

필수 값:

- `OPENAI_API_KEY`: OCI 서버에만 저장
- `OPENAI_MODEL=gpt-5.6-luna`
- `BACKEND_SHARED_TOKEN`: Vercel의 `OCI_BACKEND_TOKEN`과 동일한 값
- `TRUST_PROXY_HOPS=1`: 인증된 Vercel 요청의 전달 IP 한 홉 사용

## 5. Compose 검증과 실행

구성 검증에는 비밀값을 출력하지 않는 `--quiet`만 사용합니다.

```bash
cd /opt/pixel-panic/infra/oci
docker compose \
  --env-file /etc/pixel-panic/backend.env \
  -f docker-compose.yml \
  config --quiet
docker compose --env-file /etc/pixel-panic/backend.env -f docker-compose.yml up -d --build --remove-orphans
docker compose --env-file /etc/pixel-panic/backend.env -f docker-compose.yml ps
curl --fail http://127.0.0.1:8080/health
curl -sS -o /dev/null -w '%{http_code}\n' \
  -X POST http://127.0.0.1:8080/v1/plan \
  -H 'Content-Type: application/json' \
  --data '{"command":"화재를 먼저 진압해줘"}'
```

마지막 명령은 인증 헤더가 없으므로 `401`이어야 합니다. 전체 로그 대신 다음처럼 제한된 최근 로그만 확인하고 command나 비밀값이 없는지 점검합니다.

```bash
docker compose --env-file /etc/pixel-panic/backend.env -f docker-compose.yml logs --tail=100 pixel-panic-api
```

컨테이너는 non-root 사용자, read-only filesystem, `no-new-privileges`, 16MB `/tmp`, 10MB×3 로그 제한으로 실행됩니다.

## 6. 재부팅 자동 기동

```bash
sudo cp /opt/pixel-panic/infra/oci/pixel-panic-api.service.example /etc/systemd/system/pixel-panic-api.service
sudo systemctl daemon-reload
sudo systemctl enable --now pixel-panic-api.service
sudo reboot
```

재접속 후 확인합니다.

```bash
systemctl status pixel-panic-api.service --no-pager
docker inspect --format '{{.State.Health.Status}}' pixel-panic-api
curl --fail http://127.0.0.1:8080/health
```

## 7. Vercel 서버 프록시 연결

Vercel Production과 Preview에 다음 서버 전용 값을 등록하고 새로 배포합니다.

```env
OCI_BACKEND_URL=http://OCI_PUBLIC_IP:8080
OCI_BACKEND_TOKEN=SAME_VALUE_AS_BACKEND_SHARED_TOKEN
OCI_BACKEND_TIMEOUT_MS=6500
NEXT_PUBLIC_ENABLE_TEST_DEBUG=0
```

Vercel에서 `OPENAI_API_KEY`와 `OPENAI_MODEL`을 제거합니다. 브라우저 네트워크에는 same-origin `/api/plan`만 보여야 하며, 요청 ID는 Vercel 로그와 OCI 로그에서 일치해야 합니다.

## 8. 업데이트와 롤백

업데이트:

```bash
cd /opt/pixel-panic
sudo -u pixelpanic git fetch origin
sudo -u pixelpanic git checkout <approved-main-commit>
sudo systemctl reload pixel-panic-api.service
curl --fail http://127.0.0.1:8080/health
```

롤백:

```bash
cd /opt/pixel-panic
sudo -u pixelpanic git checkout <previous-known-good-commit>
sudo systemctl reload pixel-panic-api.service
curl --fail http://127.0.0.1:8080/health
```

장애 훈련 시 컨테이너를 중지하고 Vercel 프록시가 `LOCAL` fallback으로 전체 게임을 완료하는지 확인한 뒤 즉시 다시 기동합니다.
