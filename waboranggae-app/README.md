# 와보랑께 - 전남 뚜벅이 여행 앱 MVP

Android/iOS 공용 Expo 앱과 Express 서버로 구성된 공모전용 MVP입니다.

- 자연어 여행 조건 분석: 로컬 Ollama 모델이 한국어 문장을 추천 조건으로 변환
- 관광지 조회: 서버가 한국관광공사 TourAPI의 실제 관광정보 조회
- 코스 추천: 프로그램 코드가 거리·관심사·도보 부담을 점수화
- 추천 이유: Ollama가 계산된 코스 데이터만 근거로 자연어 설명 생성
- 안전한 폴백: Ollama나 TourAPI를 사용할 수 없으면 기본 분석기와 시연 코스로 동작

## 전체 구조

```text
Android/iOS 앱
      │ EXPO_PUBLIC_API_BASE_URL
      ▼
Express 서버 (server/index.ts)
      ├─ Ollama 로컬 LLM (server/providers/ollama.ts)
      └─ 한국관광공사 TourAPI (server/providers/tourApi.ts)
```

API 키는 모바일 앱에 넣지 않습니다. `TOUR_API_KEY`는 Express 서버의 `.env`에서만 읽습니다.

## 1. 준비할 프로그램

- Node.js 20 이상
- pnpm
- Expo Go 또는 Android Studio
- Ollama

iOS 시뮬레이터는 macOS가 필요하지만, 실제 iPhone에서는 Expo Go 또는 EAS Build를 사용할 수 있습니다.

## 2. Ollama 준비

Ollama를 설치한 뒤 PowerShell에서 모델을 받습니다.

```powershell
ollama pull qwen3:8b
ollama run qwen3:8b
```

PC가 느리거나 메모리가 부족하면 `.env`의 모델을 `qwen3:4b`로 바꾸고 해당 모델을 내려받으세요.

## 3. 한국관광공사 API 키 준비

공공데이터포털에서 `한국관광공사_국문 관광정보 서비스_GW` 활용신청을 하고 서비스키를 발급받습니다.

- 공식 TourAPI 안내: https://www.data.go.kr/data/15101578/openapi.do
- Ollama 구조화 출력 안내: https://docs.ollama.com/capabilities/structured-outputs
- Ollama Chat API: https://docs.ollama.com/api/chat

이 프로젝트는 2025년 이후 권장되는 법정동 코드 API를 사용합니다.

- `ldongCode2`: 전라남도와 시·군 법정동 코드 조회
- `areaBasedList2`: 해당 시·군의 관광지 조회
- 기본 주소: `https://apis.data.go.kr/B551011/KorService2`

서비스키는 채팅, 소스코드, GitHub에 올리지 마세요.

## 4. 환경변수 설정

프로젝트 폴더에서 의존성을 먼저 설치합니다.

```powershell
pnpm install
```

```powershell
Copy-Item .env.example .env
```

생성된 `.env`를 열고 다음 값을 설정합니다.

```dotenv
# 웹 또는 iOS 시뮬레이터
EXPO_PUBLIC_API_BASE_URL=http://localhost:8787

# Android Studio 기본 에뮬레이터
# EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8787

# 실제 휴대폰에서는 localhost가 아니라 개발 PC의 LAN IP 사용
# EXPO_PUBLIC_API_BASE_URL=http://192.168.0.10:8787

OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:8b
OLLAMA_ENABLED=true
PORT=8787

TOUR_API_KEY=공공데이터포털에서_발급받은_서비스키
```

`TOUR_API_KEY`가 비어 있으면 시연 코스가 표시됩니다. 발급키가 URL 인코딩된 형태여도 서버에서 한 번 정규화해 사용합니다.

## 5. 실행

터미널 1에서 서버를 실행합니다.

```powershell
pnpm server
```

브라우저에서 `http://localhost:8787/health`를 열면 Ollama 연결 여부와 TourAPI 키 설정 여부를 확인할 수 있습니다. 실제 키 값은 노출되지 않습니다.

터미널 2에서 앱을 실행합니다.

```powershell
pnpm start
```

- `w`: 웹 실행
- `a`: Android 에뮬레이터 실행
- 실제 휴대폰: Expo Go로 QR 코드 스캔

실제 휴대폰과 개발 PC는 같은 네트워크에 있어야 하며, `.env`의 `EXPO_PUBLIC_API_BASE_URL`에는 개발 PC의 LAN IP를 사용해야 합니다.

스토어 배포용 앱에서는 로컬 HTTP 주소 대신 HTTPS로 배포한 Express 서버 주소를 사용하세요.

## 서버 API

### `POST /api/analyze`

```json
{ "query": "순천에서 많이 걷지 않고 정원과 맛집을 보고 싶어요" }
```

Ollama가 지역, 시간, 걷기 강도, 관심사 등을 구조화합니다. Ollama가 꺼져 있거나 응답하지 않으면 기본 한국어 규칙 분석기가 대신 처리합니다.

### `POST /api/recommend`

`/api/analyze`에서 받은 `preferences`를 전송합니다. 서버가 TourAPI 관광지를 내부 `Course` 모델로 변환하고 코스 점수를 계산합니다. 키가 없거나 조회에 실패하면 시연 코스를 반환합니다.

### `POST /api/explain`

사용자 조건과 계산된 코스를 받아 Ollama가 추천 이유를 만듭니다. 제공된 장소, 점수, 거리만 사용하도록 제한되어 있습니다.

## 데이터 해석 시 주의사항

- TourAPI 장소명·주소는 실제 공공데이터입니다.
- 화면의 코스 거리, 이동시간, 접근성 점수는 좌표를 이용한 MVP 추정치입니다.
- 실제 도보·대중교통 경로가 아니므로 앱에도 방문 전 확인 안내가 표시됩니다.
- 물품보관함·자전거·버스 실시간 정보는 아직 시연 데이터입니다. 각각 별도의 공공데이터 제공처를 `server/providers`에 추가해야 합니다.
- TourAPI 호출 결과는 개발계정 트래픽을 아끼기 위해 서버 메모리에 30분간 캐시됩니다.

## 검증

```powershell
pnpm typecheck
pnpm test
pnpm export:web
```

## 주요 파일

```text
App.tsx                         앱 상태와 추천 흐름
src/services/aiClient.ts       모바일 → 우리 서버 통신
src/domain/demoEngine.ts       기본 분석과 재현 가능한 점수 계산
server/index.ts                 앱이 호출하는 서버 API
server/providers/ollama.ts     로컬 LLM 연결
server/providers/tourApi.ts    한국관광공사 API 연결·정규화·캐시
server/schemas.ts              LLM 구조화 출력 검증 스키마
```
