#!/usr/bin/env bash
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker CLI가 필요합니다." >&2
  exit 1
fi

container_name="pixel-panic-api-ci"
image_name="pixel-panic-api:test"
test_port="18080"
export BACKEND_SHARED_TOKEN="ci-test-only-backend-token-32-bytes-minimum"
export OPENAI_API_KEY=""

cleanup() {
  docker rm -f "$container_name" >/dev/null 2>&1 || true
}
trap cleanup EXIT
cleanup

docker build -t "$image_name" backend
docker run -d \
  --name "$container_name" \
  -p "127.0.0.1:${test_port}:8080" \
  --env BACKEND_SHARED_TOKEN \
  --env OPENAI_API_KEY \
  --env OPENAI_MODEL=gpt-5.6-luna \
  "$image_name" >/dev/null

for _ in $(seq 1 45); do
  if curl --fail --silent "http://127.0.0.1:${test_port}/health" >/dev/null; then break; fi
  sleep 1
done

curl --fail --silent "http://127.0.0.1:${test_port}/health" >/dev/null
unauthorized_status="$(curl --silent --output /dev/null --write-out '%{http_code}' \
  -X POST "http://127.0.0.1:${test_port}/v1/plan" \
  -H 'Content-Type: application/json' \
  --data '{"command":"화재를 먼저 진압해줘"}')"
test "$unauthorized_status" = "401"

authorized_body="$(curl --fail --silent \
  -X POST "http://127.0.0.1:${test_port}/v1/plan" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer ${BACKEND_SHARED_TOKEN}" \
  --data '{"command":"화재를 먼저 진압해줘"}')"
node -e 'const body=JSON.parse(process.argv[1]); if(body.source!=="fallback" || body.plan.priority.length!==4) process.exit(1)' "$authorized_body"

for _ in $(seq 1 45); do
  health="$(docker inspect --format '{{.State.Health.Status}}' "$container_name")"
  if [ "$health" = "healthy" ]; then break; fi
  sleep 1
done
test "$(docker inspect --format '{{.State.Health.Status}}' "$container_name")" = "healthy"
echo "Backend Docker integration PASSED: health=200, unauthorized=401, authorized fallback=200, container=healthy"
