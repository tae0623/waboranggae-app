# Supabase Edge 검증 경로

2026-09-15 현재 **Supabase 비공개 검증 배포 및 실제 API 검사 통과**.
기존 Node/Prisma 5 서버와 웹은 보존한다. 최신 Android 디버그 앱은 아래 임시 계정 테스트 설정으로 클라우드에 직접 연결해 S20+에서 검사했다.
API: `https://drtxexwznmpmiclvrjji.supabase.co/functions/v1/waboranggae-api`.
사용자가 프로젝트별 비밀값 전송·배포를 승인했다. 공개 서비스 전환이나 출시 완료 상태가 아니다.

## 구성

- 기존 라우트는 `server/app.ts`, PC용 listen/종료/정리는 `server/index.ts`.
- 별도 Prisma 6.19 JS 드라이버 + pg + WASM query compiler를 사용한다.
- bcrypt 네이티브 모듈 대신 같은 해시 형식을 지원하는 bcryptjs를 번들에만 사용한다.
- Edge 공개 경로는 `/functions/v1/waboranggae-api`. Android API·이미지 요청도 해당 경로를 보존한다.
- 클라우드 DB 역할 `waboranggae_api`: 앱 테이블 6개 CRUD만 허용. CREATE, 마이그레이션 테이블 SELECT, superuser, BYPASSRLS 없음.
- 서버 역할은 Transaction pooler 6543, 관리자 마이그레이션은 Session pooler 5432로 분리한다. CA와 호스트명 검증을 유지한다.
- 배포는 `EDGE_VALIDATION_MODE=true`. 공개 상태 확인·법적 안내·정확한 OAuth 공급자 GET 콜백 외에는 검증 자격 없이 403. 콜백 자체는 만료/일회성/공급자 바인딩 state를 검사한다. 서버 전용 검증 키를 APK에 넣으면 안 된다.
- 2시간 게스트 키와 24시간 계정 테스트 키를 분리한다. SHA-256 해시·만료·메서드/경로 허용 목록을 검사하며, 기존 게스트 키로는 계정 API를 사용할 수 없다. 새 계정 테스트 키도 사용자 JWT와 동의 검사를 대신하지 않는다.
- 사용자 승인 후 카카오/구글 OAuth 서버 비밀값을 지정 Supabase 프로젝트에 업로드했다. 두 공급자 활성화/시작/취소 검사 및 S20+ 버튼 활성화 확인. **실계정 인증 미검증**. Ollama는 클라우드에서 비활성화이며 PC 설정은 보존한다.
- 사용자 요청으로 TMAP 호출 모듈·장소 검색 잔재·화면 표시·환경 설정을 제거했다. 원격 비밀 설정에서 TMAP 항목 0개 확인. 키는 전송하지 않았다.
- 클라우드에서는 환경변수를 실행 중 수정할 수 없다. NODE_ENV/API_RUNTIME을 배포 시 주입한다.
- Buffer/process/Node 타이머를 번들에 명시적으로 import한다. 일반 Deno의 전역 객체에 의존하지 않는다.

## 재현

앱 루트에서 실행한다. 운영 비밀값이 든 파일을 화면/로그/Git에 출력하지 않는다.

1. `powershell -File scripts/install-edge-tools.ps1` (공식 체크섬 검증)
2. `npm.cmd install --prefix deployment/edge --ignore-scripts --no-fund --no-audit`
3. `node scripts/build-edge.mjs`
4. `node scripts/verify-edge-local.mjs` (로컬 팀 DB만, 임시 테스트 계정 생성 후 삭제)
5. `node scripts/prepare-edge-runtime.mjs --prepare-runtime` (이미 실행 완료. 기존 역할/대상 검증 후 재사용)
6. Supabase CLI 로그인: `.tools/edge/supabase.exe login`
7. **프로젝트 대상 비밀값 전송 승인 후에만** `node scripts/deploy-edge.mjs --deploy-validation` (승인·실행 완료)
8. `node scripts/verify-edge-cloud.mjs`, `node scripts/verify-edge-home.mjs`

`.env.edge.local`은 생성된 비밀 파일이며 Git 제외다. 제한된 DB 암호·JWT 키·외부 API 키를 포함한다.
관리자 DB 암호/CLI 계정 토큰/팀 암호를 함수 환경변수에 복사하지 않는다.
기존 역할은 있는데 비밀 파일이 없으면 자동 비밀번호 변경 없이 중단한다.
배포 명령은 함수 하나만 지정하며 `--prune`을 사용하지 않는다.

## 확인된 결과

### 최신: 23시 이후 계정 테스트 수정본

- 서버 검사 265개/TypeScript, Android 단위 검사 40개, S20+ 7개 실제 계정·추천·지도·종료·여행일 예보 검사 통과. 아래 초기 검사 수와 게스트 키 설명은 당시 기록이다.
- 선택 코스 `/api/recommend/refresh-route`: 카카오 실제 경로로 도착 시각·이동 합계·점수/제약 갱신. 초과 시 확인/저장 차단, 실패 구간은 추정으로 명시. 전체 후보마다 호출하지 않고 선택 코스만 조회하며 기존 무료 한도/캐시를 유지한다.
- `/api/weather/forecast`: 기상청 단기예보를 선택한 여행 날짜와 시간대로 필터링. 9월 16일 10~16시 25~29℃, 강수확률 최대 20% 수신. 미발표 날짜는 오늘 날씨로 대체하지 않는다.
- 최신 번들 4,500,653바이트. `.runtime/phone-account-test/`의 계정·클라우드 점검 결과 passed=true. 재사용 합성 계정 1개는 사용자 휴대폰 테스트를 위해 유지했다(암호는 `.env.phone-test-account.local`, Git 제외).
- APK에 서버 비밀값/테스트 암호 없음, 이전 팀 키 제외. 계정 테스트 입장 키 만료는 9월 16일 23:32:11 KST. 공개용 APK가 아니다.

### 초기 배포·게스트 검사 이력

- Supabase CLI: 지정 프로젝트의 함수 목록 읽기 성공. 다른 프로젝트 목록을 조회하지 않았다.
- Supabase runtime role: TLS, Transaction pooler 로그인, 앱 테이블 읽기/쓰기(롤백), 과도한 권한 없음 확인.
- 로컬 Deno: 준비 상태, 개인정보 동의 회원가입, bcrypt 로그인, 프로필, 북마크, 탈퇴, 탈퇴 토큰 거부 성공.
- 로컬 Deno: 최종 가입 140ms, 로그인 99ms. 서버 테스트 250개(퇴역 모듈 전용 4개 제거·회귀 검사 추가), TypeScript/웹 타입 검사 및 웹 빌드 통과. Android 단위 테스트 36개 통과.
- 번들 4,491,713바이트. 실제 Supabase 함수 시작·DB 연결·동의 가입·로그인·저장·탈퇴·탈퇴 토큰 거부 통과. 합성 테스트 계정은 삭제됐다.
- 클라우드 단발 요청: 시작 검사 2,830ms, DB 준비 검사 2,192ms, 가입 795ms, 로그인 820ms, 추천 6,294ms.
  네트워크를 포함한 요청 지연이며 서버 CPU 측정치/p95 또는 무중단 보장이 아니다.
- 실제 TourAPI로 순천 터미널 출발 6시간 코스 5개(제목 중복 없음), 관광 이미지 HTTP 200, 카카오 실제 구간 응답 및 외부 링크 확인.
- 홈 수요 API 1,620ms: demand 결과 6개 중 축제 3개. 포토코리아 시작 이미지 1,341ms. 기상청 관측 정보 774ms, available=true.
- 인증 없는 일반 API 요청은 403으로 차단됨을 확인. 게스트 키는 지역 API/공급자 상태 200, 계정 로그인 API 403. 실계정 소셜 로그인 검증은 아니다.
- 16:09 KST S20+ 클라우드 APK 실기: 홈/실제 관광 사진 → 순천종합버스터미널 → 6시간 추천 5개 → 코스 상세 → 두 번째 코스 지도/관광지 사진 통과. LiveFlowTest 1개, 전체 33.614초. 추천 응답 UI 표시 14.2초. 지도 타일·터미널 출발 핀·선택 장소 사진을 캡처로 직접 확인했다.
- 휴대폰 검증 추가 후 서버 테스트 251개, Android 단위 테스트 37개 통과. APK 검사: 서버 비밀값 0, 기존 팀 접속 키 미포함, 임시 게스트 키만 포함. 두 arm64 라이브러리의 ELF 16KB 정렬 확인.
- 최초 원격 실행 시 환경변수 수정 금지, Buffer 부재, Node 타이머 unref 호환 오류를 발견하고 수정했다.
- `npm audit --omit=dev`가 빌드 도구의 `@prisma/config`, `deepmerge-ts`, `effect`, `prisma`에 high 4건을 보고했다.
  esbuild 입력 메타데이터상 해당 코드는 배포 번들에 포함되지 않았다. 경고가 해결된 것은 아니며, 빌드 도구 업데이트 호환성 검증은 별도 잔여 사항이다.
  자동 `audit fix --force`나 Prisma 다운그레이드는 하지 않았다.

## 공개 전환 전 미완료

- Supabase 장시간/동시 부하, 반복 cold/warm 응답 및 CPU/메모리 여유, 외부 공급자 장애/무료 한도 소진 검증.
- 함수 재시작/다중 worker 환경의 요청 제한, 만료 OAuth·쿼터 DB 정리, 장애 복구 검증.
- 카카오·구글 실계정 로그인/최초 동의/탈퇴. 고정 콜백 등록은 사용자 완료 확인, 서버 전용 비밀값 업로드와 시작 요청 검사는 완료했다.
- Supabase 무료 도메인은 HTML을 text/plain으로 바꾼다. 법적 안내는 읽을 수 있는 텍스트로 대응했지만 웹 지도와 브라우저 직접 계정 삭제 화면은 별도 무료 정적 호스팅이 필요하다.
- 개인정보 정책은 개발 테스트용이다. Supabase 저장/처리 및 DB 설정 리전을 명시하고 동의 버전을 갱신했지만 외부 로그·백업 보관/국외 처리 등 최종 운영 조건 확정과 사용자 확인은 남았다.
- 디버그 APK는 고정 Supabase 주소로 변경해 실기 통과. 배포용 서명, 모바일 데이터로 전환한 검사, 실제 PC 종료 상태 검사는 아직 하지 않았다. 이번 요청은 PC API/터널을 경유하지 않았지만 PC 자체를 종료한 검사는 아니다.
- 비공개 검증 키를 제거해 공개 전환하는 것은 위 검증 뒤 별도 작업이다.

공식 문서:
[Edge 제한](https://supabase.com/docs/guides/functions/limits),
[Postgres 연결](https://supabase.com/docs/guides/functions/connect-to-postgres),
[서버별 DB 역할](https://supabase.com/docs/guides/database/postgres/roles).
무료 한도와 휴면 정책이 있으므로 SLA나 무중단/무제한을 보장하지 않는다.

## 임시 휴대폰 검증 APK

- `node scripts/prepare-device-validation.mjs --account`: 별도 계정 테스트 키와 24시간 만료 설정을 로컬 비밀 파일에 준비한다. `--account` 없는 기본값은 게스트 전용 2시간이다. 해당 종류의 키 교체 후 서버 배포 시 이전 키는 무효가 되므로 APK도 다시 구성한다.
- `node scripts/build-edge.mjs` 후 승인된 대상에 `node scripts/deploy-edge.mjs --deploy-validation`.
- `node android-native/tools/configure.mjs --cloud-device` 또는 `android-native/tools/build.ps1 -CloudDevice`로 디버그 설정을 생성한다. 플래그 없이 실행하면 기존 팀 개발 설정을 사용한다.
- 현재 검증 키 만료: **2026-09-16 23:32:11 KST**. 만료 후 403은 임시 접근 권한 만료일 수 있다. 이 APK를 스토어에 올리거나 공개 배포하지 않는다.
- 이미지 요청은 동일 HTTPS 호스트·포트와 정확한 `/functions/v1/waboranggae-api/api/media/tour-image` 경로에만 디버그 입장 헤더를 붙인다. 외부 사진 호스트나 리디렉션에는 보내지 않는다.
- 화면 및 보고서: `.runtime/native-pilot/cloud-account-20260915-final/`, `.runtime/native-pilot/apk-audit.json`, `.runtime/phone-account-test/`. 비밀 파일 `.env.device-validation.local`, `.env.phone-test-account.local` 및 Android `local.properties`는 Git 제외다.
