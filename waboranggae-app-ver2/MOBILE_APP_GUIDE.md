# Android/iOS 앱 실행 가이드

## 앱 구조

모바일 앱은 외부 데이터 제공처에 직접 연결하지 않고 `EXPO_PUBLIC_API_BASE_URL`의 와보랑께 Express 서버만 호출합니다. TourAPI 키, DB 접속정보, Ollama 주소는 서버에서만 관리합니다.

## 로컬 단말 실행

1. PC와 휴대폰을 같은 네트워크에 연결합니다.
2. `.env.local`에 PC의 LAN IP를 설정합니다.

```dotenv
EXPO_PUBLIC_API_BASE_URL=http://192.168.0.10:8787
```

3. 서버와 앱을 각각 실행합니다.

```powershell
# 터미널 1
pnpm server

# 터미널 2
pnpm start
```

4. Expo Go에서 QR 코드를 스캔합니다. Windows에서는 Android 단말을 시험할 수 있고, iOS 시뮬레이터는 macOS가 필요하지만 실제 iPhone의 Expo Go 또는 EAS preview 빌드로 확인할 수 있습니다.

## 앱 사용 흐름

1. UI에서 지역, 시작 시각, 여행 길이, 식사 일정, 동행, 관심사, 걷기 강도를 선택합니다.
2. `이 조건으로 추천받기`를 누릅니다.
3. TourAPI 실제 후보를 Ollama와 서버 규칙이 구성·검증한 코스를 확인합니다.
4. 상세 화면에서 추천 근거, 시간표, 장소 주소와 이미지를 확인합니다.
5. 동선 화면에서 선택한 출발 거점부터 시작하는 실제 좌표 지도와 경로 출처를 확인합니다.

자연어 입력은 선택 기능입니다. AI가 조건을 자동으로 채운 뒤에도 사용자가 UI에서 수정·확정해야 추천이 시작됩니다.

## 스토어 빌드

스토어용 빌드는 로컬 IP를 사용할 수 없습니다. 먼저 API·DB·Ollama를 항상 켜진 HTTPS 서버에 배포하고 EAS production 환경에 공개 API 주소를 등록합니다. 자세한 순서는 `STORE_SUBMISSION.md`를 따릅니다.

```powershell
npx eas-cli env:set --name EXPO_PUBLIC_API_BASE_URL --value https://실제-api-주소 --environment production --visibility plaintext
npx eas-cli build --platform android --profile production
```

## 구현 상태

- Android/iOS 공용 Expo 화면: 완료
- 실제 TourAPI 장소·이미지·좌표: 연결 완료
- Ollama 조건 분석·일정 구성·설명: 연결 완료
- 출발 거점·식사 시간·식사 후 카페·연속 음식점/카페·중복·총시간 검증: 완료
- Leaflet/OpenStreetMap 실제 좌표 지도: Web 및 네이티브 WebView 연결
- 역·터미널 출발 좌표: Nominatim 연결 및 주요 도시 오프라인 시연 좌표 제공
- 실제 대중교통·도보 경로: TMAP Transit 연결 (`TMAP_TRANSIT_API_KEY` 미설정/실패 구간은 예상 경로로 구분)
- 회원·북마크 서버 모듈: 준비되어 있으나 현재 공개 앱 UI에는 미노출
