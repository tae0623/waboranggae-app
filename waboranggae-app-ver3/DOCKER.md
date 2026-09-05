# Docker 전체 스택 가이드

PostgreSQL · API · Ollama · Expo Web을 Docker Compose로 함께 실행합니다.

## 구성

| 서비스 | 컨테이너 | 포트 | 역할 |
|---|---|---|---|
| `db` | waboranggae-db | 5432 | PostgreSQL |
| `api` | waboranggae-api | 8787 | Express 백엔드 |
| `ollama` | waboranggae-ollama | 11434 | 로컬 LLM |
| `ollama-init` | (일회성) | - | 모델 pull |
| `web` | waboranggae-web | 8081 | Expo Web 개발 서버 |

모바일 네이티브(Android/iOS) 실기기는 Docker 안에서 돌리기 어렵습니다.  
앱은 호스트에서 `pnpm start`로 띄우고 API만 Docker를 쓰는 방식도 가능합니다.

## 사전 준비

1. [Docker Desktop](https://www.docker.com/products/docker-desktop/) 설치
2. `.env` 파일 확인 (없으면 `.env.example` 복사)

```powershell
cd C:\project\waboranggae-app\waboranggae-app-ver3
copy .env.example .env
```

`JWT_SECRET` / `JWT_REFRESH_SECRET`는 `.env`에서 읽습니다. compose에 약한 기본값을 넣지 않습니다.  
운영으로 올릴 때는 `NODE_ENV=production`과 32자 이상 무작위 키를 쓰세요. placeholder(`change-this`, `change-in-production` 등)는 기동을 막습니다.

Docker 네트워크 안에서는 compose가 `DATABASE_URL` / `OLLAMA_URL`을 컨테이너 주소로 덮어씁니다.

## 실행

```powershell
# 빌드 + 전체 기동
pnpm docker:up
# 또는
docker compose up -d --build

# 상태
pnpm docker:ps

# 로그
pnpm docker:logs

# 중지 (볼륨 데이터 유지)
pnpm docker:down
```

첫 실행 시 `ollama-init`이 `qwen3:8b`를 받느라 시간이 오래 걸릴 수 있습니다.  
Ollama 없이 API만 쓰려면:

```powershell
$env:OLLAMA_ENABLED="false"
docker compose up -d --build db api web
```

## 접속

- API health: http://localhost:8787/health
- Expo Web: http://localhost:8081
- DB: `localhost:5432` (user/password/db = postgres / password / waboranggae)

## 자주 쓰는 명령

```powershell
# API 로그만
docker compose logs -f api

# DB 접속
docker compose exec db psql -U postgres -d waboranggae

# 모델 다시 pull
docker compose run --rm ollama-init

# 데이터까지 삭제
docker compose down -v
```

## 개발 팁

- 코드 변경 후 API 반영: `docker compose up -d --build api`
- 호스트에서 Expo만 실행할 때: `EXPO_PUBLIC_API_BASE_URL=http://localhost:8787 pnpm start`
- `apis.data.go.kr` 계열 서비스키는 `.env`의 `DATA_GO_KR_KEY` 하나로 TourAPI·정류장·공영 물품보관함 요청에 사용됩니다
