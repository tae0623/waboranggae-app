# 무료 고정 웹 주소로 팀 테스트 전환

2026-09-16. **연결 코드의 로컬 수정·검증까지 완료. 새 웹 배포 완료 보고가 아닙니다.**

## 현재 상태

- GitHub `ver5`의 기준 커밋: `e942adf`.
- PC의 팀 API(8788), Cloudflare Quick Tunnel, 팀 DB 컨테이너 운영 종료.
- 팀 DB 볼륨 `waboranggae-team_team_pgdata`, 소스, 개인 설정은 보존.
- 컨테이너 자동 재시작 해제. 이 PC는 `.runtime/team-retired.json`으로 기존 `team:setup/start/restart`도 차단.
- 배포된 Supabase 서버/DB/비밀값/카카오 호출 한도는 변경하지 않음. 새 웹 중계 인증을 허용하는 서버 코드만 로컬에서 수정함.
- Cloudflare는 계정만 준비된 상태. Pages 프로젝트, 고정 주소, 신규 접속 암호는 아직 만들지 않음.
- 이 문서와 `pages:build` 명령이 포함된 최신 커밋을 사용해야 함. 이전 기준 커밋 `e942adf`에는 새 중계 기능이 없음.
- `pages:build`는 웹과 인증 중계를 함께 생성함. `web:build`만 실행한 파일을 대신 올리지 말 것.
- 로컬 테스트 50파일/463개, 루트·웹 타입 검사, Pages 빌드, 빌드 산출물 검사가 통과함. 실제 Cloudflare/Supabase 통신·소셜 로그인 성공은 아직 검증하지 않음.

## 목표 구조

팀원 브라우저 → 고정 Pages 웹 주소 → 인증을 검사하는 서버 측 중계 → 기존 Supabase API/DB.

PC는 꺼도 되며 개인 도메인을 구매할 필요는 없습니다. 단, 각 서비스의 무료 한도를 준수해야 하고 무중단 보장 상품은 아닙니다. PC의 Ollama는 이 구조로 자동 이전되지 않습니다.

## 1. 진행 순서

1. https://dash.cloudflare.com 에서 무료 계정을 만들거나 로그인합니다. 계정 생성·약관 동의는 직접 진행합니다. 도메인 구매, 유료 플랜, 유료 추가 기능은 선택하지 않습니다.
2. 검증한 이번 수정본이 GitHub `ver5`에 반영되어 있는지 확인합니다. `package.json`에 `pages:build`, `pages:verify` 명령이 있어야 합니다.
3. 이후 **Workers & Pages → Create application → Pages → Connect to Git**으로 이동합니다. 지금 프로젝트 주소를 미리 준비할 필요는 없습니다.
4. GitHub 연결 시 가능하면 **Only select repositories**로 `tae0623/waboranggae-app`만 허용합니다. 조직 전체 또는 불필요한 저장소 권한을 주지 않습니다.
5. 아래 설정으로 프로젝트를 준비합니다. **운영 환경 비밀값·Fail closed·프리뷰 제한을 확인하기 전 팀원에게 주소를 공유하지 않습니다.**

| 항목 | 이 저장소 기준 예정값 |
|---|---|
| 저장소 | `tae0623/waboranggae-app` |
| 배포 브랜치 | `ver5` |
| 프로젝트 이름 | `ddubugi-team` 등 사용 가능한 이름. 주소는 실제 발급 결과로 확정 |
| 루트 디렉터리 | `waboranggae` |
| 프레임워크 | React (Vite), 아래 명령/출력 폴더로 조정 |
| 빌드 명령 | `pnpm pages:build && pnpm pages:verify` |
| 빌드 출력 디렉터리 | `web/dist` |

루트 pnpm workspace 의존성을 설치해야 합니다. 로컬 검증 버전은 Node 24.18.0 / pnpm 11.15.1입니다. Cloudflare의 `NODE_VERSION`, `PNPM_VERSION` 빌드 환경 설정으로 버전을 맞추고 설치 로그를 별도로 검증합니다. 기존 PC의 `.env`를 복사하거나 업로드하지 않습니다. 위 값은 클라우드 빌드 성공을 아직 검증하지 않은 준비값입니다.

## 2. 구현 내용과 남은 서버 설정

아래 연결 코드는 로컬에서 구현·검증했습니다. 계정 설정·신규 비밀값 전송·배포는 아직 하지 않았습니다.

- Pages의 `_worker.js` 중계가 모든 화면/정적 파일/API/지도/이미지 요청을 인증한 다음 전달합니다. API 목적지는 기존 Supabase 프로젝트로 고정하며 허용 경로만 전달합니다.
- 팀 접속 아이디는 `team`. 새 무작위 암호로 인증하면 12시간짜리 Secure·HttpOnly 쿠키를 발급합니다. 앱 자체 회원 로그인/JWT/최초 개인정보 동의/사용자별 데이터 소유권 검사는 별도로 유지합니다.
- 브라우저는 같은 Pages 주소의 API만 호출합니다. 서버 전용 키는 브라우저 코드·URL·쿠키에 넣지 않습니다. GPS 권한은 이 팀 웹에서 비활성화하며 기기 좌표를 새로 수집하지 않습니다.
- 다른 사이트의 쓰기 요청, 미등록 경로, 128KiB 초과 본문, 외부 서버로의 리디렉션을 차단하고 인증 응답을 캐시하지 않습니다.
- Supabase 지도 HTML만 HTML 형식으로 복원합니다. 개인정보처리방침은 기존 텍스트, `/legal/config`는 JSON으로 유지합니다.
- 만료되는 현재 휴대폰 테스트 키를 웹 JavaScript에 넣지 않습니다. 필요한 중계용 권한을 최소화하고 서버 측 Secret으로 보관합니다. 비밀값을 Cloudflare로 전송할 때는 대상 계정/프로젝트와 항목을 확인합니다.
- Supabase는 현재 비공개 검증 모드입니다. 게이트를 임의로 끄지 않고 웹 중계 허용 경로·인증·기간을 별도 검증합니다.
- 현재 검증용 키는 2026-09-16 23:32 KST 만료 예정입니다. 새 웹의 지속적인 팀 접속 권한 설계와 별개입니다.
- 지도 iframe/이미지 응답, 허용 도메인, CORS, 캐시, 로그인 창의 콜백과 결과 조회를 확인합니다. 코드상 provider enabled만으로 실제 소셜 로그인 성공을 판단하지 않습니다.
- `VITE_` / `EXPO_PUBLIC_`에는 DB 암호, JWT 서명 키, OAuth Secret, Supabase 관리자 키, 서버 검증 키를 절대 넣지 않습니다.
- 프리뷰 배포에 운영 비밀값을 자동 제공하거나 모든 브랜치/외부 PR의 코드가 운영 Secret을 사용할 수 있게 설정하지 않습니다.

### 생성 후 등록할 값

템플릿: `.env.pages.example`. 실제 값은 코드나 이 문서에 기록하지 않습니다.

| 저장 위치 | 항목 | 용도 |
|---|---|---|
| Cloudflare Production 일반 변수 | `TEAM_WEB_ORIGIN` | 실제 발급된 `https://프로젝트.pages.dev` |
| Cloudflare Production 일반 변수 | `TEAM_WEB_API_EXPIRES_AT` | 중계 권한 만료 시각(ISO UTC) |
| Cloudflare Production Secret | `TEAM_WEB_PASSWORD` | 새로운 팀 접속 암호. 24바이트 이상 무작위 hex |
| Cloudflare Production Secret | `TEAM_WEB_SESSION_SECRET` | 쿠키 서명용 32바이트 무작위 hex |
| Cloudflare Production Secret | `TEAM_WEB_API_KEY` | Supabase 중계용 32바이트 무작위 hex |
| Supabase 서버 Secret | `EDGE_TEAM_WEB_VALIDATION_HASH` | 위 API 키의 SHA-256 해시만 저장 |
| Supabase 서버 Secret | `EDGE_TEAM_WEB_VALIDATION_EXPIRES_AT` | Cloudflare와 같은 만료 시각 |

세 비밀값은 서로 다르고 기존 팀/휴대폰/관리자 키와도 달라야 합니다. 갱신 기한은 배포 전에 정합니다. 키가 없거나 만료되면 접속을 차단합니다. 신규 비밀값은 정확한 Cloudflare 계정·Pages 프로젝트를 확인한 후 승인된 대상으로만 전송합니다. 기존 TourAPI·카카오 REST·OAuth Secret·DB 암호·Supabase 관리자 검증 키는 Cloudflare로 보낼 필요가 없습니다.

### 반드시 적용할 계정 설정

- **Pages → Settings → Runtime → Fail open / closed: Fail closed.** 무료 요청 한도를 소진했을 때 인증 중계를 건너뛰고 정적 화면이 공개되는 것을 막습니다. 코드의 설정 누락 차단만으로 이 플랫폼 설정을 대체할 수 없습니다.
- Production 브랜치는 `ver5`로 제한하고 불필요한 preview 자동 배포를 끕니다. Preview에는 운영 Secret을 등록하지 않습니다. 중계 코드도 실제 Production origin 외의 호스트를 차단합니다.
- 모든 화면에 인증을 적용하므로 정적 파일 요청도 Functions를 실행합니다. Free의 Workers·Pages Functions 합산 일 100,000회 한도를 사용하며 UTC 자정에 초기화됩니다. 유료 업그레이드 대신 한도 초과 시 접속을 중단합니다.
- Cloudflare 프로젝트 설정과 계정의 Free 상태를 확인하고, Supabase의 무료 중지/호출/DB 한도도 별도로 유지합니다. 무료라고 24시간 가용성을 보증하지 않습니다.

## 3. 배포 후 등록·검증

실제 발급받은 고정 `https://<프로젝트>.pages.dev` 주소를 사용합니다. 이 문서의 예시 주소를 그대로 등록하지 않습니다.

- 카카오 JavaScript SDK 도메인: 새 웹 주소에서 지도 SDK를 로드한다면 그 웹 **origin**을 추가합니다. 기존 Supabase 도메인은 유지합니다. 지도 중계 방식을 결정한 후 실제 SDK 요청 출처로 검증합니다.
- 카카오/구글 로그인: 콜백은 아래 Supabase 주소를 유지합니다. 새 Pages 주소를 콜백으로 사용하는 설계로 바꾸지 않는 한 추가 콜백 등록은 필요 없습니다.
- Google 앱이 테스트 모드이면 로그인할 팀원 Google 계정을 테스트 사용자로 등록합니다. 앱 비밀번호나 Google 계정 암호를 공유하지 않습니다.
- 테스트: 비인증 차단 → 팀 접속 → 회원/게스트 → 추천 → 지도/이미지 → 소셜 로그인 → 로그아웃 → PC를 끈 상태에서도 새 웹/API 접속. 카카오 쿼터 소진 상태는 정상 추천 성공으로 기록하지 않습니다.
- 고정 주소 등록 이후 프로젝트명을 바꾸거나 삭제·재생성하면 주소가 바뀔 수 있으므로 유지합니다.

## 삭제할 이전 주소 (해당 앱 설정에 실제 등록되어 있는 항목만)

### 카카오 JavaScript SDK 도메인

```text
https://qualification-excitement-flight-industry.trycloudflare.com
https://structured-ready-florida-pharmacy.trycloudflare.com
```

### 카카오 로그인 Redirect URI

```text
https://qualification-excitement-flight-industry.trycloudflare.com/auth/social/kakao/callback
https://structured-ready-florida-pharmacy.trycloudflare.com/auth/social/kakao/callback
```

### Google OAuth 웹 클라이언트 → 승인된 리디렉션 URI

```text
https://qualification-excitement-flight-industry.trycloudflare.com/auth/social/google/callback
https://structured-ready-florida-pharmacy.trycloudflare.com/auth/social/google/callback
```

Google의 승인된 JavaScript 원본 또는 다른 웹 도메인 항목에도 위 **두 origin**을 이 개발 서버 용도로 등록했다면 해당 항목만 제거합니다. 새 주소를 등록하지 않았다면 삭제할 항목도 없습니다. 다른 앱의 도메인·로컬 개발 주소·인증 키·Android 패키지/키 해시는 제거하지 않습니다.

## 유지할 주소

API:

```text
https://drtxexwznmpmiclvrjji.supabase.co/functions/v1/waboranggae-api
```

카카오 로그인 콜백:

```text
https://drtxexwznmpmiclvrjji.supabase.co/functions/v1/waboranggae-api/auth/social/kakao/callback
```

구글 로그인 콜백:

```text
https://drtxexwznmpmiclvrjji.supabase.co/functions/v1/waboranggae-api/auth/social/google/callback
```

카카오 SDK에 기존에 등록한 `https://drtxexwznmpmiclvrjji.supabase.co` 및 Android 네이티브 앱 키/키 해시도 이번 정리 대상이 아닙니다.

## 공식 참고

- [Pages GitHub 연결](https://developers.cloudflare.com/pages/get-started/git-integration/)
- [Pages 빌드 설정](https://developers.cloudflare.com/pages/configuration/build-configuration/)
- [Pages 인증 중계 방식](https://developers.cloudflare.com/pages/functions/advanced-mode/)
- [한도 초과 시 Fail closed](https://developers.cloudflare.com/pages/functions/routing/)
- [Functions 무료 요청 한도](https://developers.cloudflare.com/pages/functions/pricing/)
- [Pages 무료 한도](https://developers.cloudflare.com/pages/platform/limits/)
- [Supabase 무료 요금제·중지 조건](https://supabase.com/pricing)

무료 한도 내 호스팅을 목표로 합니다. 이 문서는 유료 가입이나 신규 공개 배포를 승인/완료한 기록이 아닙니다.
