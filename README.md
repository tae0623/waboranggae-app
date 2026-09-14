# 와보랑께

전남 뚜벅이(대중교통·도보) 여행 코스를 추천하는 Expo + Express 앱입니다. **현재 작업 브랜치는 `ver4`이고, 앱 코드는 `waboranggae/`입니다.**

- 홈에서 지역·시간·식사·관심사·걷기 강도를 고른 뒤 추천
- 서버가 한국관광공사 TourAPI 실제 장소를 조회하고 일정을 검증
- 필요할 때만 Ollama가 문장을 조건으로 바꾸거나 추천 이유를 설명
- 로그인하면 북마크·검색 이력을 **내 여행** 탭에 저장

API 키는 앱에 넣지 않습니다. `DATA_GO_KR_KEY`, `TMAP_TRANSIT_API_KEY`, JWT 비밀값은 서버 `.env`에만 둡니다.

## 실행 (로컬)

```powershell
cd waboranggae
pnpm install
Copy-Item .env.example .env
# DATA_GO_KR_KEY, JWT_SECRET 등을 채웁니다.

# 터미널 1 — DB는 Docker만 써도 됩니다
docker compose up -d db
pnpm db:migrate
pnpm server

# 터미널 2
pnpm start
```

- 웹: `pnpm web` 또는 Expo에서 `w`
- 실기기: `EXPO_PUBLIC_API_BASE_URL`을 PC LAN IP로 (`http://192.168.x.x:8787`)
- 상태 확인: `http://localhost:8787/health`

Ollama는 선택입니다. 없으면 규칙 분석·규칙 일정으로 동작합니다.

```powershell
ollama pull qwen3:8b
```

### Docker로 DB + Ollama만

```powershell
cd waboranggae
docker compose up -d db ollama ollama-init
pnpm server
pnpm start
```

전체 스택(`db`·`api`·`ollama`·`web`)은 `pnpm docker:up`입니다. JWT는 `.env`에 있어야 하고, 로컬 compose의 `NODE_ENV` 기본은 `development`입니다.

TourAPI 키가 없거나 실패하면 시연 코스로 넘어갑니다. 끄려면 `.env`에 `ALLOW_DEMO_COURSE_FALLBACK=false`.

## 시연 순서

1. 홈에서 순천 · 10시 · 6시간 · 적게 걷기 · 자연·맛집·카페
2. `이 조건으로 추천받기`
3. 목록에서 출처 배지(TourAPI / 시연)와 시간표를 확인
4. 코스 상세에서 근거·지도·북마크 확인
5. `AI로 조건 자동 채우기`는 선택이며, 추천을 바로 실행하지 않음

## 구조

```text
앱 (Expo)  --EXPO_PUBLIC_API_BASE_URL-->  Express (waboranggae/server)
                                            ├─ TourAPI / TAGO / 보관함
                                            ├─ Nominatim · TMAP Transit
                                            ├─ PostgreSQL (Prisma)
                                            └─ Ollama (선택)
```

```text
waboranggae-app/                    git 루트 · 이 README
└── waboranggae/                    앱+서버 코드 (여기서 pnpm 실행)
    ├── App.tsx                     화면 전환, 추천·로그인 상태
    ├── src/
    │   ├── screens/                홈·코스·지도·내 여행·상세
    │   ├── components/             카드, 지도, 조건 폼, 탭바
    │   ├── hooks/                  분석·추천·인증·북마크·검색이력
    │   ├── domain/                 파서·점수·도시 목록 (서버와 공유)
    │   ├── services/               apiClient (JWT 포함)
    │   ├── data/                   시연용 하드코딩 코스
    │   └── types/                  여행·코스 타입
    ├── server/
    │   ├── index.ts                Express 진입점, /health
    │   └── src/
    │       ├── auth/               회원가입·로그인·JWT
    │       ├── middleware/         JWT 검증, rate limit
    │       ├── db/                 Prisma 쿼리
    │       ├── modules/
    │       │   ├── analysis/       자연어 분석 (Ollama + 규칙)
    │       │   ├── recommendation/ TourAPI·일정·길찾기·랭킹
    │       │   ├── explanation/    추천 이유
    │       │   ├── user/           프로필·북마크·검색이력 API
    │       │   └── media/          TourAPI 이미지 프록시
    │       ├── shared/             Zod 스키마
    │       └── utils/              좌표, 비밀번호 해시
    ├── prisma/                     DB 스키마·마이그레이션
    ├── tests/                      Vitest
    ├── scripts/                    TourAPI 등 연결 확인
    ├── docker/                     API 컨테이너 시작 스크립트
    ├── docs/SECURITY.md            보안 설계
    ├── STORE.md                    스토어 제출
    └── PRIVACY_POLICY.md           개인정보처리방침
```

| 데이터 | 담당 |
|---|---|
| 관광지명·좌표·이미지 | `server/src/modules/recommendation/data/tour-api.ts` |
| 일정·식사 검증 | `server/src/modules/recommendation/planner.ts` |
| 조건 파서·점수 | `src/domain/parseTravelText.ts`, `src/domain/rankCourses.ts` |
| 길찾기 | `server/src/modules/recommendation/routing.ts` + TMAP |

## 배포 요약

앱을 다른 네트워크나 스토어에 올리려면 API·DB는 상시 HTTPS 서버에 둡니다. Ollama는 사설망 GPU에 두고 `11434`를 인터넷에 열지 않습니다.

1. `.env.production.example`을 배포 환경변수로 복사
2. `pnpm db:migrate:prod` 후 API 기동
3. EAS production의 `EXPO_PUBLIC_API_BASE_URL`을 HTTPS API로 설정

운영 JWT는 32자 이상 무작위 값이어야 하며 `change-this` 같은 placeholder는 기동을 막습니다.

## 스토어·심사

체크리스트와 스토어 문안은 [waboranggae/STORE.md](./waboranggae/STORE.md)입니다.  
개인정보처리방침은 [waboranggae/PRIVACY_POLICY.md](./waboranggae/PRIVACY_POLICY.md)입니다.  
보안 설계는 [waboranggae/docs/SECURITY.md](./waboranggae/docs/SECURITY.md)입니다.

```powershell
cd waboranggae
pnpm typecheck
pnpm test
```
