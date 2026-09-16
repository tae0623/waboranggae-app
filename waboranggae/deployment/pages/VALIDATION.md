# Pages 연결 코드 로컬 검증 — 2026-09-16

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
