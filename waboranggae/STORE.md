# 스토어 제출

1차 심사에는 Google Play, Apple App Store, 원스토어 중 최소 1개 등록 링크가 필요합니다.
**2026-09-15 결정: Kotlin 네이티브 Android 앱의 원스토어 우선 출시. iOS 병행은 보류합니다.**
현재 작업 상태·제출 차단 조건은 [ONE_STORE_RELEASE.md](ONE_STORE_RELEASE.md)를 우선 참고하세요.
아래 EAS/Expo 관련 항목은 이전 프레임워크 참고 자료이며 이번 네이티브 제출 절차가 아닙니다.

설명자료는 저장소 루트 `README.md`와 이 파일, `PRIVACY_POLICY.md`입니다.

## 등록 전 교체

- `PRIVACY_POLICY.md` 운영자 이메일
- EAS production `EXPO_PUBLIC_API_BASE_URL`을 HTTPS API로
- 서버 `CORS_ORIGINS`, JWT(32자 이상), `DATABASE_URL`
- 실기기에서 추천·지도·공유·로그인 확인

## 스토어 문안

- 이름: 뚜버기 - 전남 뚜벅이 여행
- 짧은 설명: 전남 관광정보를 식사 시간까지 맞춘 대중교통·도보 코스로 추천해요.
- 카테고리: 여행 및 지역정보
- 검색어: 전남여행, 뚜벅이여행, 관광코스, 순천여행, 여수여행, 목포여행

자세한 설명 초안: 차 없이 전남을 여행할 때 장소보다 어려운 것은 순서입니다. 뚜버기는 한국관광공사 관광정보의 실제 장소·주소·좌표로 관광지·음식점·카페·시장을 시간표로 연결합니다.

## Android

```powershell
cd waboranggae
pnpm install
pnpm verify
npx eas-cli login
# EAS 대시보드의 production 환경 변수에 EXPO_PUBLIC_API_BASE_URL을 설정한 뒤 진행하세요.
# 로컬/임시 터널 주소와 팀 개발 암호는 production 빌드에서 거부됩니다.
npx eas-cli build --platform android --profile production
npx eas-cli submit --platform android --profile production
```

`.env`는 원격 빌드에 올라가지 않습니다. API 키는 서버 비밀값에만 둡니다.
위 클라우드 빌드/제출 명령은 현재 실행하지 않았습니다. 개발자 계정, 요금제 및 실기 검증 후 진행하세요.

## iOS

```powershell
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --profile production
```
