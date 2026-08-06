# PIXEL PANIC OCI 백엔드 배포

대상은 Ubuntu 22.04 VM `pixel-panic-api-prod-01`, API Gateway `pixel-panic-api-gateway-prod`, NSG `pixel-panic-api-nsg`입니다. 커스텀 도메인이나 사용자 인증서는 사용하지 않고 OCI API Gateway의 자동 생성 HTTPS 주소를 사용합니다.

## 1. 네트워크 선행 조건

- VM은 private subnet 또는 public IP가 없는 private VNIC를 권장합니다.
- `pixel-panic-api-nsg`의 TCP 8080 ingress source는 API Gateway가 사용하는 private subnet CIDR 또는 Gateway NSG로만 제한합니다.
- TCP 22 ingress는 팀의 고정 IP/CIDR만 허용합니다.
- VM egress TCP 443은 OpenAI API, GitHub, Ubuntu/Docker 패키지 저장소 접근을 위해 허용합니다.
- `0.0.0.0/0:8080` 규칙은 만들지 않습니다.

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

## 3. 배포 사용자와 저장소

```bash
sudo useradd --create-home --shell /bin/bash pixelpanic
sudo usermod -aG docker pixelpanic
sudo install -d -o pixelpanic -g pixelpanic /opt/pixel-panic
sudo -u pixelpanic git clone https://github.com/KorTechTim/aihackathon_pre.git /opt/pixel-panic
```

SSH 공개키는 `/home/pixelpanic/.ssh/authorized_keys`에 최소 권한으로 배치합니다. 개인키는 VM이나 저장소에 복사하지 않습니다.

## 4. 환경변수 생성

```bash
cd /opt/pixel-panic/infra/oci
cp env.production.example .env.production
chmod 600 .env.production
```

`.env.production`에서 다음을 실제 값으로 바꿉니다.

- `BIND_ADDRESS`: VM private VNIC 주소
- `OPENAI_API_KEY`: 운영용 키
- `OPENAI_MODEL`: 승인된 GPT-5.6 계열 모델
- `ALLOWED_ORIGINS`: 운영 Vercel 주소와 필요한 Preview 주소만 쉼표로 구분
- `TRUST_PROXY_HOPS=1`: API Gateway 한 홉만 신뢰

키나 전체 명령은 health 응답과 애플리케이션 로그에 기록되지 않습니다.

## 5. 컨테이너 실행과 확인

```bash
cd /opt/pixel-panic/infra/oci
docker compose --env-file .env.production config
docker compose --env-file .env.production up -d --build
docker compose --env-file .env.production ps
curl --fail http://127.0.0.1:8080/health
docker compose --env-file .env.production logs --tail=100 pixel-panic-api
```

컨테이너는 non-root `node` 사용자, read-only filesystem, 10MB×3 로그 제한으로 실행됩니다.

## 6. 재부팅 자동 기동

```bash
sudo cp pixel-panic-api.service.example /etc/systemd/system/pixel-panic-api.service
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

## 7. API Gateway

1. VCN 내부에 `pixel-panic-api-gateway-prod`를 생성합니다.
2. `api-gateway-deployment.example.json`의 `10.0.1.10`을 VM private IP로 교체합니다.
3. deployment path prefix는 `/`를 사용해 backend의 `/v1/plan`과 중복되지 않게 합니다.
4. 자동 생성 endpoint에서 아래를 확인합니다.

```bash
curl --fail https://<generated-gateway-hostname>/health
curl --fail -X POST https://<generated-gateway-hostname>/v1/plan \
  -H 'Content-Type: application/json' \
  --data '{"command":"고양이를 먼저 구조해줘"}'
```

브라우저 preflight도 확인합니다.

```bash
curl -i -X OPTIONS https://<generated-gateway-hostname>/v1/plan \
  -H 'Origin: https://pixel-panic-ai-rescue.vercel.app' \
  -H 'Access-Control-Request-Method: POST'
```

## 8. Vercel 연결

Production 환경변수 `NEXT_PUBLIC_API_BASE_URL=https://<generated-gateway-hostname>`을 설정하고 새로 배포합니다. 브라우저 네트워크 탭과 OCI execution log에서 `/v1/plan` 요청 ID가 일치하는지 확인한 다음 Vercel의 `OPENAI_API_KEY`를 제거합니다.

## 9. 업데이트와 롤백

업데이트:

```bash
cd /opt/pixel-panic
git fetch origin
git checkout <approved-commit>
cd infra/oci
docker compose --env-file .env.production up -d --build
curl --fail http://127.0.0.1:8080/health
```

롤백:

```bash
cd /opt/pixel-panic
git checkout <previous-known-good-commit>
cd infra/oci
docker compose --env-file .env.production up -d --build
```

장애 시 `docker compose stop pixel-panic-api`로 훈련하고, 프런트가 `LOCAL` fallback으로 전체 흐름을 완료하는지 확인합니다. 운영 복구 후 `docker compose start pixel-panic-api`를 실행합니다.
