# 와보랑께 - 전남 뚜벅이 여행 앱 MVP

Android/iOS 공용 Expo 앱과 Express 서버로 구성된 공모전용 MVP입니다.

- 기본 추천 방식: 지역·시간·동행·관심사·이동 조건을 UI에서 직접 선택하고 확인한 뒤 추천
- AI 보조 기능: 필요할 때만 Ollama가 한국어 문장을 분석해 같은 UI 조건을 자동으로 채움
- 관광지 조회: 서버가 한국관광공사 TourAPI의 실제 관광정보 조회
- 코스 추천: Ollama가 TourAPI의 실제 후보 ID로 일정을 구성하고 서버가 출발 거점·식사 시간·식사 후 카페·중복·선택 시간 충족을 검증
- 추천 이유: Ollama가 계산된 코스 데이터만 근거로 자연어 설명 생성
- 안전한 폴백: Ollama나 TourAPI를 사용할 수 없으면 기본 분석기와 시연 코스로 동작

AI는 장소명이나 운영정보를 만들어낼 수 없습니다. AI가 자동으로 채운 조건은 사용자가 확인·수정하며, 일정 구성 결과도 서버 검증을 통과하지 못하면 재현 가능한 시간 규칙 코스로 교체됩니다.

## 전체 구조

```text
Android/iOS 앱
      │ EXPO_PUBLIC_API_BASE_URL
      ▼
Express 서버 (server/index.ts)
      ├─ Ollama 로컬 LLM (조건 분석·후보 일정 구성·설명)
      ├─ 한국관광공사 TourAPI (관광 장소)
      ├─ Nominatim (선택한 역·터미널 좌표)
      └─ TMAP Transit (실제 대중교통·도보 경로)
```

API 키는 모바일 앱에 넣지 않습니다. `TOUR_API_KEY`와 `TMAP_TRANSIT_API_KEY`는 Express 서버의 `.env`에서만 읽습니다.

다른 네트워크에서 시연하거나 스토어에 출시할 때는 API·DB·Ollama를 상시 서버로 옮겨야 합니다. 공급자 선택 전 준비사항과 권장 분리 구조는 [DEPLOYMENT.md](./DEPLOYMENT.md)에 정리되어 있습니다.

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

## 3. 관광정보·길찾기 API 키 준비

공공데이터포털에서 `한국관광공사_국문 관광정보 서비스_GW` 활용신청을 하고 서비스키를 발급받습니다.

- 공식 TourAPI 안내: https://www.data.go.kr/data/15101578/openapi.do
- 공식 TMAP Transit 안내: https://transit.tmapmobility.com/docs/routes
- Ollama 구조화 출력 안내: https://docs.ollama.com/capabilities/structured-outputs
- Ollama Chat API: https://docs.ollama.com/api/chat

이 프로젝트는 2025년 이후 권장되는 법정동 코드 API를 사용합니다. 2026-07-01 시행된
`전남광주통합특별시(법정동 상위 코드 12)` 개편도 반영하며, 광주 5개 구는 전남 22개
시·군 선택 목록에서 제외합니다.

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
TMAP_TRANSIT_API_KEY=TMAP에서_발급받은_앱키
```

`TOUR_API_KEY`가 비어 있으면 시연 코스가 표시됩니다. 발급키가 URL 인코딩된 형태여도 서버에서 한 번 정규화해 사용합니다.
`TMAP_TRANSIT_API_KEY`가 비어 있으면 선택한 역·터미널의 실좌표는 유지하되, 구간은 점선과 `좌표 기반 예상`으로 명확히 표시합니다. 키를 넣으면 첫 출발 구간을 포함한 도보·대중교통 시간과 경로선이 TMAP 결과로 전환됩니다.

## 5. 실행

터미널 1에서 서버를 실행합니다.

```powershell
pnpm server
```

브라우저에서 `http://localhost:8787/health`를 열면 Ollama 연결 여부와 TourAPI·TMAP 키 설정 여부를 확인할 수 있습니다. 실제 키 값은 노출되지 않습니다.

터미널 2에서 앱을 실행합니다.

```powershell
pnpm start
```

- `w`: 웹 실행
- `a`: Android 에뮬레이터 실행
- 실제 휴대폰: Expo Go로 QR 코드 스캔

실제 휴대폰과 개발 PC는 같은 네트워크에 있어야 하며, `.env`의 `EXPO_PUBLIC_API_BASE_URL`에는 개발 PC의 LAN IP를 사용해야 합니다.

스토어 배포용 앱에서는 로컬 HTTP 주소 대신 HTTPS로 배포한 Express 서버 주소를 사용하세요.

## 앱 추천 흐름

1. 홈 화면에서 지역, 시작 시간, 여행 길이, 식사 일정, 동행, 관심사, 이동 조건을 선택합니다.
2. 선택 내용을 확인하고 `이 조건으로 추천받기`를 누릅니다.
3. 서버가 TourAPI 장소를 가져오고 Ollama가 실제 장소 ID만 사용해 최대 3개 일정을 제안합니다.
4. 서버가 출발 거점, 식사 시간, 식사 후 카페, 연속 음식점·카페, 장소 중복, 선택 시간 충족을 검사하며 실패한 일정은 시간 규칙으로 다시 구성합니다. 2~8시간 선택은 최대 30분 오차만 허용합니다.
5. 검증된 코스를 대중교통 접근성·도보 부담·주변 연계성·편의시설로 점수화합니다.
6. 코스 상세를 열 때 Ollama가 계산 결과를 근거로 추천 이유를 설명합니다.

자연어가 편한 사용자는 `AI로 조건 자동 채우기`를 펼쳐 문장을 입력할 수 있습니다. AI 분석은 조건 입력까지만 하며 추천을 즉시 실행하지 않습니다.

## 서버 API

### `POST /api/analyze`

```json
{ "query": "순천에서 많이 걷지 않고 정원과 맛집을 보고 싶어요" }
```

Ollama가 지역, 시간, 걷기 강도, 관심사 등을 구조화합니다. Ollama가 꺼져 있거나 응답하지 않으면 기본 한국어 규칙 분석기가 대신 처리합니다.

### `POST /api/recommend`

UI에서 사용자가 확인한 `preferences`를 전송합니다. 자연어 보조 기능을 썼다면 `/api/analyze` 결과를 UI에서 수정한 최종값이 전달됩니다. 서버가 TourAPI 관광지를 내부 `Course` 모델로 변환하고, Ollama 일정 제안과 결정적 검증·폴백을 거친 뒤 코스 점수를 계산합니다. 동일 조건 결과는 15분간 캐시합니다. 키가 없거나 조회에 실패하면 시연 코스를 반환합니다.

### `POST /api/explain`

사용자 조건과 계산된 코스를 받아 Ollama가 추천 이유를 만듭니다. 제공된 장소, 점수, 거리만 사용하도록 제한되어 있습니다.

## 데이터 해석 시 주의사항

- TourAPI 장소명·주소는 실제 공공데이터입니다.
- `TMAP_TRANSIT_API_KEY`가 설정되면 코스 거리·도보·대중교통 시간과 경로선은 TMAP Transit 결과입니다.
- 키가 없거나 특정 구간 조회에 실패하면 해당 구간만 좌표 기반 예상치와 점선으로 구분합니다.
- 출발지는 선택한 역·터미널을 Nominatim으로 좌표화하며 7일 캐시와 공개 서버 1초당 1회 제한을 적용합니다. 운영에서는 `START_LOCATION_OVERRIDES_JSON`으로 주요 거점을 고정할 수 있습니다.
- 버스정류장, 물품보관함, 자전거 제공처를 서버에서 조회하며 키·응답이 없으면 화면에 명확히 `시연 정보`로 표시합니다.
- TourAPI 호출 결과는 개발계정 트래픽을 아끼기 위해 서버 메모리에 30분간 캐시됩니다.

## 1차 심사와 스토어 제출

앱 버전, Android/iOS 식별자, EAS production 프로필, 앱 아이콘·스플래시가 설정되어 있습니다. 실제 등록에는 항상 켜진 HTTPS API·DB·Ollama 서버와 개발자 스토어 계정이 필요합니다.

- 제출 순서와 필수 교체값: [STORE_SUBMISSION.md](./STORE_SUBMISSION.md)
- 심사 시연 순서와 데이터 범위: [DEMO_GUIDE.md](./DEMO_GUIDE.md)
- 개인정보처리방침 원문: [PRIVACY_POLICY.md](./PRIVACY_POLICY.md)

## 검증

```powershell
pnpm db:validate
pnpm db:check-files
pnpm db:status
pnpm tourapi:test
pnpm ai-flow:test
pnpm typecheck
pnpm test
pnpm export:web
pnpm export:android
pnpm export:ios
```

## 주요 파일

```text
App.tsx                         앱 상태와 추천 흐름
src/services/apiClient.ts      모바일 → 우리 서버 통신
src/domain/demoEngine.ts       기본 분석과 재현 가능한 점수 계산
server/index.ts                 앱이 호출하는 서버 API
server/src/modules/analysis/ollama.ts
                                로컬 LLM 구조화 출력
server/src/modules/recommendation/planner.ts
                                일정 생성·식사/중복/시간 검증
server/src/modules/recommendation/data/tour-api.ts
                                한국관광공사 API 연결·정규화·캐시
server/src/shared/schemas.ts   API·LLM 구조화 출력 검증 스키마
```
