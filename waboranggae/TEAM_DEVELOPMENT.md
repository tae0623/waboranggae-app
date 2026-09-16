# 무료 공동 개발 서버

> 2026-09-16: 이 PC의 API·Quick Tunnel·팀 DB 운영을 종료했습니다. 아래 내용은 이전 구성 기록입니다. 새 전환 절차는 [무료 고정 웹 주소 안내](FREE_FIXED_WEB_SETUP.md)를 참고하세요. 이 PC의 `.runtime/team-retired.json`은 `team:setup/start/restart` 재실행을 차단합니다. 소스·DB 데이터는 보존했습니다.

이 PC의 Node.js API, 별도 Docker PostgreSQL, 무료 Cloudflare Quick Tunnel을 사용합니다.
클라우드 서버/GPU 유료 상품을 만들지 않습니다. PC 전기료·인터넷 비용은 별도이며,
PC 종료/절전/인터넷 끊김 시 공유 서버도 중단됩니다.

## 현재 준비된 폴더

`github-upload/waboranggae-app-ver4-review/waboranggae`에서 실행합니다.
새 웹/앱 디자인, 날씨와 소셜 로그인 설정은 `FREE_API_SETUP.md`를 확인하세요.

```powershell
pnpm install
pnpm team:setup
pnpm team:build
pnpm team:start
pnpm team:status
pnpm team:test
```

- 먼저 Docker Desktop의 엔진이 실행 중이어야 합니다.
- `team:setup`: 새 개발 DB 시작, Prisma 생성/마이그레이션, cloudflared 다운로드 및 SHA-256 검증.
- `team:start`: API와 웹 화면을 127.0.0.1:8788에서 실행하고 HTTPS 공유 주소 생성.
- 실행 시 별도 터미널 창이 뜨지 않습니다. 로그: `.runtime/api.log`, `.runtime/tunnel.log`.
- `team:test`는 로컬 서버를 통해 실제 TourAPI 추천·이미지·카카오 준비 상태·TMAP 미호출을 확인합니다.
- 팀원에게 줄 주소와 접속 정보: `.runtime/TEAM_ACCESS.md`.
- 접속 이름은 `team`, 암호는 자동 생성됩니다.
- `pnpm team:stop`은 이 런처의 API와 터널만 종료합니다. DB 데이터는 유지됩니다.
- `pnpm team:restart`는 API만 다시 실행합니다. 터널이 실행 중이면 공유 주소를 유지하며 `.env` 변경이 반영됩니다.
- DB까지 중지: `docker compose --env-file .env.team.local -f docker-compose.team.yml stop db`.
- 재시작 시 Quick Tunnel 주소가 바뀔 수 있으므로 팀원과 카카오 도메인 등록에 새 주소를 반영합니다.
- 기존 계정/찜 정보를 포함한 개인 DB를 외부에 공유하지 않습니다. 새 개발 DB는 빈 DB입니다.

## 프론트엔드 팀원

웹 테스트는 공유 주소에서 브라우저 접속 이름/암호를 입력하면 됩니다.
팀원이 자신의 PC에서 프론트엔드를 개발할 때만 개인 `.env`에 다음을 입력합니다.

```env
EXPO_PUBLIC_API_BASE_URL=https://현재주소.trycloudflare.com
EXPO_PUBLIC_DEV_ACCESS_KEY=TEAM_ACCESS.md에_있는_팀접속암호
```

Expo를 다시 시작해야 반영됩니다. 이 접속 키는 개발 팀만 사용하고, 저장소·스토어 빌드에는 넣지 않습니다.
TourAPI, 카카오 REST 키와 DB/JWT 비밀키는 서버 소유자만 관리합니다.
공유 웹 빌드는 `same-origin`으로 연결되므로 터널 주소가 바뀌어도 다시 빌드할 필요가 없습니다.

## 코드 수정 공유

GitHub의 작업 브랜치 → Pull Request → 통합 브랜치로 공유합니다.
이 무료 PC 서버에는 GitHub 자동 배포를 연결하지 않았습니다. 반영할 커밋을 확인하고 다음처럼 갱신합니다.

```powershell
pnpm team:stop
# 작업 중인 변경을 커밋한 후, 원하는 통합 브랜치에서 실행:
git pull --ff-only
pnpm install
pnpm team:setup
pnpm team:build
pnpm team:start
```

프론트엔드 변경은 웹 재빌드, 서버 변경은 재시작이 필요합니다.
DB 변경은 마이그레이션 파일을 커밋하고 `migrate deploy`로만 공동 DB에 적용합니다.
`migrate reset`, Docker `down -v`는 개발 데이터를 삭제하므로 사용하지 않습니다.

## 카카오 키 발급과 입력

1. https://developers.kakao.com 에 로그인 → 앱 생성 → 와보랑께 앱을 선택합니다.
2. `카카오맵 → 사용 설정`을 ON으로 설정합니다.
3. 해당 앱에 `카카오맵 무료 쿼터` 뱃지가 있는지 확인합니다.
   2026-07-21 이후에는 개발자 계정에서 처음 활성화한 앱에만 무료 쿼터를 제공합니다.
4. 유료 API 사용을 활성화하지 않습니다. 무료 적용이 안 되는 앱이라면
   `KAKAO_FREE_TIER_CONFIRMED=false`를 유지합니다.
5. 앱의 플랫폼 키에서 JavaScript 키와 REST API 키를 각각 확인합니다.
6. 이 프로젝트 루트의 `.env`에 다음 값을 입력합니다. 채팅/GitHub에는 키를 게시하지 않습니다.

```env
KAKAO_MAP_JS_KEY=JavaScript_키
KAKAO_REST_API_KEY=REST_API_키
KAKAO_FREE_TIER_CONFIRMED=true
KAKAO_DAILY_REQUEST_LIMIT=200
```

7. JavaScript 키의 JavaScript SDK 도메인에 다음을 등록합니다.
   - `http://127.0.0.1:8788`
   - `http://localhost:8788`
   - `.runtime/TEAM_ACCESS.md`에 적힌 HTTPS 주소 (경로 없이 도메인만)
8. `pnpm team:restart`로 API만 재시작합니다. 터널 주소는 유지됩니다. PC 재부팅 후 주소가 바뀌면 새 주소도 등록합니다.

지도는 서버의 `/maps/embed`에서 로드되므로 팀원의 localhost나 임의의 WebView 주소를 등록할 필요가 없습니다.
JavaScript 키는 지도 SDK 특성상 브라우저에 보이며, 등록 도메인으로 제한합니다.
REST API 키는 서버에서만 사용합니다. Admin 키는 사용하지 않습니다.

키가 없어도 카카오맵 도보/대중교통 바로가기는 작동합니다. 지도 배경과 앱 내 구간 조회는
키·무료 쿼터 확인이 완료된 뒤 사용할 수 있습니다. 안내 이미지는 TourAPI에서 가져옵니다.

## 길찾기 흐름과 비용 보호

- 추천 생성: 관광정보+출발 좌표+이동시간 추정. TMAP 경로 API는 호출하지 않습니다.
- 동선 탭: 장소마다 도보/대중교통을 고르고 카카오맵 바로가기를 열 수 있습니다.
- `이 구간을 앱 지도에서 확인`: 그 구간만 카카오 REST API로 조회합니다.
- 성공한 구간만 실선, 그 외는 점선입니다. 전체 여행시간은 여전히 예상값입니다.
- 경로 조회는 조회 시점의 정보이며, 미래 여행 날짜의 배차를 보장하지 않습니다.
- 무료 쿼터 확인 전에는 지도 SDK/REST API 호출이 비활성화됩니다.
- 내부 한도는 기본 하루 200회(검색·경로 합산), 최대 900회입니다. 실패 요청도 차감합니다.
- 한도 기록은 `.runtime/kakao-usage.json`에 저장되어 재시작으로 초기화되지 않습니다.
- 짧은 메모리 캐시로 중복 조회를 줄입니다. 기록 실패 시 외부 호출을 중단합니다.
- 이 한도는 단일 API 프로세스용입니다. 여러 서버/동일 키의 다른 앱 사용량까지 집계하지는 않습니다.
- 앱 외부의 카카오맵 바로가기는 이 서버의 REST 호출량을 사용하지 않습니다.

공식 문서: [카카오 사용 설정](https://developers.kakao.com/docs/ko/kakaomap/common),
[무료 쿼터](https://developers.kakao.com/docs/ko/getting-started/quota),
[경로 API](https://developers.kakao.com/docs/ko/kakaomap/rest-api),
[카카오맵 바로가기](https://apis.map.kakao.com/web/guide/),
[Cloudflare 개발 터널](https://developers.cloudflare.com/tunnel/get-started/).

## 현재 DB 구조

PostgreSQL 15 + Prisma 5.22. 업무 테이블은 3개이며 마이그레이션 관리 테이블이 별도로 있습니다.

| 테이블 | 내용 | 관계/제약 |
|---|---|---|
| users | 이메일, 표시 이름, bcrypt 비밀번호 해시, 토큰 버전, 생성/수정 일시 | 이메일 UNIQUE |
| bookmarks | 회원 ID, 코스 ID, 코스명, 도시, 생성 일시 | 회원별 같은 코스 중복 금지 |
| search_history | 회원 ID, 검색 문장, 도시, 여행 속도, 생성 일시 | 회원별 검색 이력 |
| _prisma_migrations | 적용된 DB 스키마 변경 기록 | Prisma 내부 관리 |

회원 1명에 찜/검색 이력이 여러 개 연결됩니다. 회원 삭제 시 연결된 이력도 삭제됩니다.
관광지 원본, 이미지, 코스 상세 시간표, 경로 전체, LLM 대화는 현재 DB에 저장되지 않습니다.
특히 찜에는 코스 ID/제목만 저장되므로 동적으로 생성한 코스를 나중에 완전히 복원할 수 없습니다.
향후 저장 코스 기능을 강화할 때 코스 상세 스냅샷과 조건을 저장하는 테이블이 필요합니다.

기존 로컬 DB: `localhost:5432/waboranggae`.
새 공동 개발 DB: `127.0.0.1:55432/waboranggae_dev` (호스트 루프백에만 바인딩).
새 DB 볼륨: `waboranggae-team_team_pgdata`. 클라우드 DB/유료 백업을 사용하지 않습니다.
