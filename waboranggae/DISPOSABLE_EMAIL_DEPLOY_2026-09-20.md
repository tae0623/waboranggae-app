# 일회용 이메일 차단 운영 반영

2026-09-20 01:35 KST 검증 완료.

- 대상: 기존 Supabase `waboranggae-api` 운영 함수.
- 코드 번들: `ad9ba7061a3e0c18`, CC0 목록 8,896개 포함.
- 공개 모드, 기존 비밀값, DB 스키마, 계정 데이터, 요금제 유지. 서버 코드만 배포.
- 이메일 가입만 차단하며 기존 계정 로그인·테스트 별칭·소셜 로그인 흐름 유지.

## 실제 확인 결과

| 확인 | 결과 |
|---|---|
| 서버·DB 준비 상태 | HTTP 200 |
| 일반 일회용 도메인 가입 | HTTP 400 / DISPOSABLE_EMAIL_DOMAIN |
| 대문자·하위 도메인 일회용 주소 | HTTP 400 / DISPOSABLE_EMAIL_DOMAIN |
| Gmail 도메인 가입, 봇 확인 토큰 생략 | 도메인 검사 통과 후 SIGNUP_BOT_CHECK로 거절 |
| 검증용 주소 DB 조회 | 생성된 계정 0개 |
| 기존 테스트 별칭 로그인·내 정보 | HTTP 200 |
| 현재 로그인 로그아웃 후 같은 토큰 재사용 | HTTP 401 |
| 인증 없는 내 정보 조회 | HTTP 401 |
| 팀 웹 비인증 접속 | HTTP 401 유지 |

운영 회원가입 요청 3회만 사용했고 카카오 API 호출, 메일 발송, 호출 한도 초기화는 하지 않았습니다. 같은 네트워크의 회원가입 제한(1시간 3회)을 사용하므로 곧바로 추가 가입 테스트를 하면 HTTP 429가 나올 수 있습니다. 기존 회원 로그인과는 별도입니다.

## 이후 배포

운영 담당자만 프로젝트 루트에서 실행합니다. 기존 운영 설정 파일과 Supabase 인증이 필요하며 이를 GitHub에 넣지 않습니다.

```sh
node scripts/build-edge.mjs
node scripts/deploy-edge.mjs --check-public --code-only
node scripts/deploy-edge.mjs --deploy-public --code-only
node scripts/verify-disposable-email-live.mjs --verify-public
```

검증 스크립트는 회원가입 시도 한도를 사용하므로 반복 실행하지 않습니다. 목록 갱신은 `pnpm email-domains:update` 후 코드 검토·테스트·운영 API 배포로 반영합니다.

차단 자체는 기존 설치 앱에도 적용됩니다. 현재 출시 APK는 일부 HTTP 400 오류를 일반 안내로 표시할 수 있습니다. 구체적인 일회용 이메일 차단 문구는 GitHub에 준비된 Android 코드를 다음 앱 업데이트로 배포하면 반영됩니다. 이번 작업에서 새 APK 설치·스토어 업데이트는 수행하지 않았습니다.
