# ver5 팀 개발 안내

## 현재 기준

원격 기준 커밋 `7d07206` 이후 로컬에 있던 Android·웹 화면, 다일 여행, 코스 저장, 계정, 봇 차단, API 보호, 공개 정책 페이지, 스토어 이미지 자료를 함께 정리했습니다. 추가로 이메일 회원가입 시 일회용 이메일 도메인을 서버에서 차단합니다.

운영자는 2026-09-19 원스토어 출시 완료를 알려주었습니다. 이번 소스에는 후속 수정도 포함되므로 출시 APK와 동일한 소스 태그로 간주하지 않습니다. 과거 `*_REVIEW_*`, `VALIDATION.md` 등은 작성일 당시의 기록입니다.

## 아이폰 팀원이 확인하는 방법

- 브라우저에서 https://waboranggae-app.pages.dev/ 접속 후 운영자가 별도로 전달한 팀 접속 정보를 사용합니다. 이는 앱 회원 로그인과 별개입니다.
- GitHub에서 `ver5`를 받고 새 `feature/작업명` 브랜치를 만들어 수정합니다.
- 웹 화면은 `web/src/`, Android 화면은 `android-native/app/src/main/java/kr/co/waboranggae/nativepilot/ui/`에 있습니다. UI는 각각 수정해야 합니다.
- 추천·계정 API는 `server/`, 공통 여행 조건·타입은 `src/domain/`, `src/types/`입니다. API 계약을 바꾸면 두 화면을 함께 확인합니다.
- 아이폰으로는 웹 동작을 확인할 수 있습니다. Android 지도, 권한, 로그인 앱 복귀, 설치·업데이트 검증은 운영자의 S20+ 또는 호환 Android 기기에서 수행합니다.

## 로컬 실행

Node 24, pnpm 11 기준입니다. 아래 명령은 저장소 안의 `waboranggae`에서 실행합니다.

```sh
pnpm install --frozen-lockfile
pnpm db:generate
pnpm typecheck
pnpm test
pnpm web
```

`pnpm web`은 http://127.0.0.1:5173 을 열 수 있는 개발 서버를 실행합니다. 현재 Vite의 로컬 API 프록시는 http://127.0.0.1:8788 로 연결합니다. API를 직접 개발한다면 `.env.example`을 `.env`로 복사하고 개발용 DB·자신의 API 키를 설정합니다. `PORT=8788`, `OLLAMA_ENABLED=false`로 실행할 수 있습니다. 외부 API를 점검할 때 `ALLOW_DEMO_COURSE_FALLBACK=false`로 두어 실패를 시연 데이터로 숨기지 않습니다.

개발 DB를 준비한 후 아래 명령을 별도 터미널에서 실행합니다. 운영 DB 연결 주소를 넣지 마세요.

```sh
pnpm db:migrate:prod
pnpm server
```

이 명령의 `prod`는 저장된 마이그레이션을 적용한다는 뜻이며 실제 대상은 `.env`의 `DATABASE_URL`입니다. 로컬 테스트라면 로컬/개발 DB여야 합니다. 처음 설치할 때 Prisma·bcrypt 빌드가 차단되면 `pnpm-workspace.yaml`의 승인된 의존성 목록과 pnpm 설정을 확인합니다.

서버를 직접 운영하지 않고 이미 배포된 화면만 검토한다면 팀 웹 주소만 사용하며 `.env`가 필요 없습니다. 로컬에서 회원가입 봇 위젯·소셜 로그인을 검증할 때는 별도 개발 도메인/콜백 등록이 필요할 수 있습니다.

## 일회용 이메일 차단 관리

무료 CC0 자료인 `disposable-email-domains/disposable-email-domains`를 사용합니다. 서버 코드와 함께 목록이 들어가며 사용자의 이메일을 원격 검증 서비스에 전송하지 않습니다.

- 구현: `server/src/auth/disposable-email.ts`, `server/src/auth/routes.ts`
- 고정 목록·라이선스·원본 커밋: `server/src/auth/disposable-email-data/`
- 오탐 예외/추가 차단: 같은 폴더의 `overrides.json`
- 갱신: `pnpm email-domains:update` → 변경 검토 → `pnpm test` → 커밋 → API 배포
- 적용: 새 이메일 회원가입만. 기존 로그인·테스트 별칭·소셜 로그인은 유지합니다.

목록 차단은 이메일 소유권 확인이 아닙니다. 기존 봇 확인과 가입 횟수 제한을 함께 유지합니다. 이메일 인증·복구 메일 기능은 도입하지 않았습니다.

## 공유하지 않는 파일

`.env`와 `.env.*.local`, `.dev.vars*`, `.runtime/`, `.release-private/`, `android-native/local.properties`, `android-native/release.properties`, 서명키, APK/AAB, 빌드 폴더, DB 백업, 테스트 계정 암호는 저장소에 포함하지 않습니다. `.env.*.example`에는 빈 값 또는 예시만 둡니다. 운영 서버의 DB·JWT·OAuth·관광 API 비밀값을 팀원 화면 코드나 `VITE_` 변수에 복사하지 않습니다.

## 검토와 반영

1. 새 브랜치에서 수정하고 `pnpm typecheck`, `pnpm test`, 웹 타입 검사·빌드를 수행합니다.
2. Android 변경은 `android-native/README.md`에 따라 빌드·단위 테스트하고 실기기에서 확인합니다.
3. Pull Request에 변경 화면과 확인 방법을 기록하고 검토 후 `ver5`에 합칩니다.
4. `ver5` push는 연결된 Pages 웹의 자동 빌드를 유발할 수 있습니다. Pages용 검증은 `pnpm pages:build`, `pnpm pages:verify`입니다.
5. API는 별도 Supabase 배포가 필요합니다. `scripts/build-edge.mjs`는 빌드만 수행하며 무시된 번들을 다시 생성합니다. 저장소의 Edge 진입점만 올려서는 서버가 바뀌지 않습니다.
6. `scripts/deploy-edge.mjs --deploy-validation`은 비공개 검증 서버용입니다. 공개 서버 코드 갱신은 운영자가 `node scripts/deploy-edge.mjs --check-public --code-only`로 사전 확인 후 `node scripts/deploy-edge.mjs --deploy-public --code-only`로 수행합니다. 공개 설정은 이미 켜져 있어야 하며 이 명령은 비밀값을 업로드하지 않습니다.
7. Android 새 버전은 정식 키로 서명하고 `versionCode`를 증가시킨 후 스토어에 제출합니다. 정식 키는 운영자만 보관합니다.

GitHub push 자체는 API 배포나 원스토어 업데이트가 아닙니다. **2026-09-20 01:35 KST에는 운영자의 추가 요청으로 일회용 이메일 차단 API 배포 및 실검증을 별도 완료했습니다.** [운영 반영 결과](DISPOSABLE_EMAIL_DEPLOY_2026-09-20.md)를 참고하세요. 새 Android 안내 문구의 스토어 업데이트는 별도입니다.
