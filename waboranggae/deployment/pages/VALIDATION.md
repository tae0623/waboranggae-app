# Pages 연결 검증 — 2026-09-16

## 실제 배포·접속 검증 (19:41 KST)

- 주소: https://waboranggae-app.pages.dev/ — GitHub `ver5`, 커밋 `0eeedff122d29451bae05422a11cd0bbcc12d026`.
- Cloudflare Production 배포 `036ab667-9d60-4a65-9fc1-5ad0353fe190` 성공. Supabase 코드 묶음 `214c5dad6b02e93b` 배포 완료.
- 승인한 세 비밀값은 Pages Production Secret으로, API 키의 해시·만료일만 Supabase에 등록. 기존 DB/OAuth/관광 API 비밀값은 Cloudflare에 전송하지 않음.
- Production/Preview 모두 Fail closed, Preview 배포 None, Preview에 팀 비밀값 없음 확인.
- 실서버 33개 검사 통과: 팀 암호/쿠키 인증, 익명·잘못된 암호·변조 쿠키·CSRF 차단, 정적 파일 보호, 서버·DB 준비 상태, 지역/사진/지도 HTML API, 가상 계정 가입·로그인·삭제·토큰 무효화.
- 추가 3개 검사 통과: Supabase 무인증·잘못된 중계 키 및 Pages 대체 배포 호스트 접근은 모두 403.
- 테스트 도구의 이미지 중복 인코딩 및 웹과 다른 DELETE 헤더를 수정한 후 재검증. 생성한 가상 계정 2개는 모두 삭제했고 실제 계정은 변경하지 않음.
- 소스 382파일에서 알려진 서버 비밀값 0건, 커밋 대상 비밀 설정 0건. 빌드 산출물 5파일의 비밀값·직접 API 우회 검사도 통과.
- 연결 키 만료: **2026-10-16 19:30 KST**. 팀 접속 정보는 Git에서 제외한 `.runtime/PAGES_TEAM_ACCESS.md`에만 보관.

미확인: 실제 브라우저 지도 표시와 실계정 소셜 로그인, 카카오 한도 내 실제 추천, Cloudflare Free 요금제. 내장 브라우저가 주소 열기를 차단해 UI 검사는 완료하지 못했음. 카카오 한도와 요금제는 변경하지 않았음. 카카오/구글 provider 활성 상태만으로 실계정 로그인 성공을 주장하지 않음.

## 배포 전 로컬 검증 기록

검증 기록 시점: 로컬 구현·검증 완료, GitHub 반영 전. Cloudflare 프로젝트 생성/비밀값 등록/Supabase 재배포는 이 검증에 포함되지 않음.

## 확인한 것

- Vitest 50파일, 463테스트 통과. 신규 Pages/서버 중계 게이트 관련 57테스트 포함.
- 루트 및 웹 TypeScript 검사 통과.
- `pages:build` 통과: 웹 40모듈, Worker 3모듈. Worker는 default 진입점만 내보냄.
- `pages:verify` 통과: 컴파일된 Worker 설정 누락 503, 무인증 401, 인증 후 200 및 보안 쿠키 확인.
- 배포 파일 5개에서 알려진 로컬 서버 비밀값 0건. 브라우저의 Supabase 직접 호출/이전 터널·로컬 API 주소 0건.
- 소스 비밀값 검사 376파일: 알려진 서버 비밀값 0건, 커밋 대상 개인 설정 파일 0건. Git 이력 전체나 미지의 비밀값 검출을 보증하지 않음.
- 지도·이미지·법적 안내의 MIME 처리, 미등록 API/경로 인코딩 우회/외부 리디렉션 차단, CSRF 출처 검사, 본문 크기 제한, 쿠키 만료/암호 교체, 앱 Bearer 토큰 분리 전달을 mock으로 검사함.

검증 명령(프로젝트 루트):

```powershell
pnpm typecheck
pnpm web:typecheck
pnpm test
pnpm pages:build
pnpm pages:verify
node scripts/audit-release-local.mjs
```

## 실제 배포 후에만 확인할 수 있는 것

- Cloudflare 클린 의존성 설치/실행 호환성, Production Secret, fail_open=false, Free 요금제와 preview 제한.
- Supabase 중계 해시/만료일 등록 및 새 서버 코드 배포, 기존 앱 테스트 키와의 독립성.
- 실제 Pages origin을 등록한 카카오 지도 로딩과 이미지 표시. Supabase 소셜 콜백은 유지.
- 팀 암호 → 회원/게스트 → 코스 → 지도 → 계정 로그아웃 전체 흐름 및 실계정 소셜 로그인.
- 실제 카카오 호출 한도 내 추천 성공. 이번 검사에서 한도를 늘리거나 초기화하지 않음.
- PC를 꺼도 Pages 및 Supabase로 접속하는지 확인. Ollama는 이전하지 않았으며 운영 설정은 비활성화 상태.

이번 변경은 팀 테스트 웹 접속 경로에 대한 작업이며 스토어 출시 심사/공개 운영 준비 완료를 뜻하지 않습니다.
