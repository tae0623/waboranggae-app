# 운영 서버 배포 안내

앱을 다른 네트워크에서도 안정적으로 시연하거나 스토어에 배포하려면 API 서버와 PostgreSQL은 항상 켜진 서버에 있어야 합니다. AI 보조 기능까지 항상 제공하려면 Ollama도 항상 켜진 GPU 서버에 둬야 합니다.

## 권장 구조

```text
Android / iOS 앱
        │ HTTPS
        ▼
Express API 서버 ───── 한국관광공사 TourAPI
        │
        ├──── PostgreSQL
        │
        └──── 사설망 Ollama GPU 서버 (qwen3:8b)
```

- 모바일 앱은 `EXPO_PUBLIC_API_BASE_URL=https://api.example.com`만 알고 있습니다.
- TourAPI 키, DB 비밀번호, JWT 비밀값은 API 서버에만 둡니다.
- Ollama의 `11434` 포트는 인터넷에 직접 공개하지 않습니다. API 서버만 사설망으로 접근하게 합니다.
- 사용자 조건 선택과 코스 계산은 LLM 없이도 동작합니다. Ollama 장애 시 AI 자동 채우기는 규칙 분석기로, 추천 이유는 기본 설명으로 대체됩니다.

## 서버 배치 방법

### 1안: 한 대의 GPU 서버에 모두 배치

API, PostgreSQL, Ollama를 한 서버에서 실행합니다. 초기 시연은 단순하지만 GPU 서버 비용이 계속 들고, 한 서버 장애가 전체 서비스 장애로 이어질 수 있습니다.

### 2안: API·DB와 GPU 서버 분리 — 권장

- 작은 상시 서버: Express API
- 관리형 PostgreSQL 또는 별도 DB 서버: 사용자·검색 데이터
- 필요 시간에 맞춘 GPU 서버: Ollama

UI 조건 선택 기반 추천은 GPU가 없어도 계속 동작하므로, GPU 서버가 일시 중지되어도 핵심 추천 기능은 유지됩니다. 공모전 상시 시연 기간에는 GPU 서버도 켜 두고, 이후에는 예산에 맞춰 가동 시간을 조절할 수 있습니다.

## 배포 전 설정

1. `.env.production.example`을 배포 서비스의 비밀 환경변수 화면에 옮깁니다.
2. API 서버에서 `pnpm install --frozen-lockfile`, `pnpm db:generate`, `pnpm db:migrate:prod`를 실행합니다.
3. `pnpm server`로 API를 실행하고 프로세스 자동 재시작을 설정합니다.
4. HTTPS 도메인을 연결하고 `https://api.example.com/health`를 확인합니다.
5. 앱 빌드 전에 `EXPO_PUBLIC_API_BASE_URL`을 실제 HTTPS API 주소로 설정합니다.

운영 필수 환경변수:

```dotenv
NODE_ENV=production
PORT=8787
CORS_ORIGINS=https://app.example.com
DATABASE_URL=postgresql://...
JWT_SECRET=충분히_긴_무작위값
JWT_REFRESH_SECRET=또_다른_긴_무작위값
OLLAMA_URL=http://사설_Ollama_주소:11434
OLLAMA_MODEL=qwen3:8b
OLLAMA_ENABLED=true
TOUR_API_KEY=발급받은_서비스키
EXPO_PUBLIC_API_BASE_URL=https://api.example.com
```

`EXPO_PUBLIC_`으로 시작하는 값은 앱에 포함되므로 비밀값을 넣으면 안 됩니다.

## 운영 점검표

- API와 앱은 HTTPS만 사용
- PostgreSQL 자동 백업과 복원 시험
- `/health` 상태 감시 및 장애 알림
- API 프로세스 비정상 종료 시 자동 재시작
- DB와 Ollama 포트 외부 차단
- TourAPI 호출량과 서버 로그에서 개인정보·비밀값 제외
- JWT 비밀값을 개발용 값에서 교체
- Ollama 모델 저장 경로를 영구 디스크에 연결
- 앱 출시 전 실제 Android/iPhone에서 다른 네트워크로 시험

## 실제 배포를 시작할 때 필요한 결정

현재 코드는 공급자에 종속되지 않게 준비되어 있습니다. 실제 배포에는 서버 공급자, API 도메인, 월 GPU 예산을 먼저 정해야 합니다. 이 세 가지가 정해지면 해당 환경에 맞는 Docker 배포 파일, HTTPS, DB 이전, 앱 운영 빌드 순서로 진행할 수 있습니다.
