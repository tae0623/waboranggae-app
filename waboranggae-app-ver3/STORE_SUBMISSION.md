# 와보랑께 1차 심사·앱 스토어 제출 체크리스트

1차 심사에는 Google Play, Apple App Store, 원스토어 중 최소 1개 스토어의 등록 완료 링크가 필요합니다. 추가 기간이 없으므로 Android Google Play 또는 원스토어 등록을 우선 완료하고 iOS를 병행합니다.

## 제출물

- 스토어 공개 또는 심사자가 접근 가능한 테스트 링크
- Android AAB와 내부 테스트 설치 링크(백업 제출물)
- 앱 구동 영상 또는 화면 캡처
- `README.md`, `ARCHITECTURE.md`, `DEMO_GUIDE.md` 설명자료
- TourAPI와 Ollama 통합 검증 결과

## 스토어 등록 전 필수 교체

- `PRIVACY_POLICY.md`의 운영자 문의 이메일
- 배포 서버의 HTTPS URL을 EAS production 환경의 `EXPO_PUBLIC_API_BASE_URL`에 설정
- 배포 서버의 `CORS_ORIGINS`, 강력한 JWT 비밀키, PostgreSQL 접속정보 설정
- 실제 단말에서 추천·지도·공유·오프라인 오류 화면 확인
- 스토어 콘솔 개인정보 수집 항목을 실제 서버 운영 방식과 일치시킴

## Android 권장 순서

```powershell
pnpm install
pnpm verify
npx eas-cli login
npx eas-cli env:set --name EXPO_PUBLIC_API_BASE_URL --value https://실제-api-주소 --environment production --visibility plaintext
npx eas-cli build --platform android --profile production
npx eas-cli submit --platform android --profile production
```

`.env`와 `.env.local`은 원격 빌드에 올라가지 않습니다. `eas.json`의 production 프로필은 EAS의 production 환경을 사용하므로 위 공개 API 주소를 EAS 프로젝트 환경변수에 먼저 등록해야 합니다. API 키·DB 비밀번호·JWT 비밀값은 앱 빌드 환경이 아니라 서버의 비밀 환경변수에만 둡니다.

Google Play Console의 앱 등록, 개인정보처리방침 URL, 데이터 보안 설문, 콘텐츠 등급, 스토어 이미지, 테스트 트랙 요구사항은 계정 유형에 따라 달라질 수 있으므로 콘솔에 표시되는 최신 요구사항을 기준으로 마감 전에 완료합니다.

## iOS 병행 순서

```powershell
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --profile production
```

Apple Developer Program과 App Store Connect 앱 레코드가 필요합니다. 심사 기간을 고려해 Android 제출보다 늦지 않게 빌드를 시작합니다.
