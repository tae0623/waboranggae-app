# 데이터베이스 설정 가이드

## PostgreSQL 설치 및 실행

### macOS (Homebrew)
```bash
brew install postgresql@15
brew services start postgresql@15
```

### Windows (PostgreSQL Installer)
1. [PostgreSQL 다운로드](https://www.postgresql.org/download/windows/)
2. 설치 후 pgAdmin 또는 psql로 접속

### Docker (권장)

전체 스택(DB + API + Ollama + Web)은 [DOCKER.md](./DOCKER.md)를 참고하세요.

DB만 띄울 때:

```bash
docker compose up -d db
```

`DATABASE_URL` (호스트에서 Prisma/서버 실행 시):

```
DATABASE_URL="postgresql://postgres:password@localhost:5432/waboranggae"
```

## 환경 설정

### .env.local 파일 생성
```bash
cp .env.local.example .env.local
```

또는 직접 수정:
```
DATABASE_URL="postgresql://postgres:password@localhost:5432/waboranggae"
```

## Prisma 마이그레이션

### 첫 실행 (개발 환경)
```bash
pnpm db:migrate
```
→ Prisma CLI가 자동으로 마이그레이션 파일을 생성하고 실행합니다.

### 스키마 수정 후 마이그레이션
1. `prisma/schema.prisma` 수정
2. 마이그레이션 실행:
   ```bash
   pnpm db:migrate
   ```
3. 마이그레이션 이름 입력 (예: `add_user_table`)

### 프로덕션 배포
```bash
pnpm db:migrate:prod
```
→ 기존 마이그레이션만 실행하고 새로운 마이그레이션 파일을 생성하지 않습니다.

## Prisma Studio (GUI)
```bash
pnpm db:studio
```
→ 브라우저에서 데이터베이스를 시각적으로 관리할 수 있습니다.

## 데이터베이스 스키마

### users (사용자)
- id: 고유 ID
- email: 이메일 (고유)
- displayName: 표시 이름
- createdAt: 생성 날짜
- updatedAt: 수정 날짜

### bookmarks (코스 북마크)
- id: 고유 ID
- userId: 사용자 ID (FK)
- courseId: 코스 ID
- courseName: 코스 이름
- city: 도시
- createdAt: 생성 날짜

### search_history (검색 이력)
- id: 고유 ID
- userId: 사용자 ID (FK)
- query: 원본 검색어
- city: 추출된 도시
- pace: 추출된 속도 (easy|balanced|full)
- createdAt: 생성 날짜

## API 엔드포인트

모든 사용자 관련 API는 `x-user-id` 헤더가 필수입니다:
```bash
curl -H "x-user-id: user-123" http://localhost:8787/api/user/me
```

### 사용자
- `POST /api/user/profile` - 프로필 생성/수정
- `GET /api/user/me` - 현재 사용자 정보

### 북마크
- `POST /api/user/bookmarks/add` - 북마크 추가
- `DELETE /api/user/bookmarks/:courseId` - 북마크 제거
- `GET /api/user/bookmarks` - 북마크 목록
- `GET /api/user/bookmarks/:courseId/is-bookmarked` - 북마크 여부 확인

### 검색 이력
- `POST /api/user/search-history` - 검색 이력 기록
- `GET /api/user/search-history` - 검색 이력 조회
- `GET /api/user/search-history/frequent-cities` - 자주 검색한 도시
- `DELETE /api/user/search-history/:historyId` - 특정 이력 삭제
- `DELETE /api/user/search-history` - 전체 이력 삭제

## 문제 해결

### "database doesn't exist" 오류
```bash
createdb waboranggae
```

### Prisma 클라이언트 재생성
```bash
pnpm db:generate
```

### 마이그레이션 리셋 (개발용, 데이터 손실!)
```bash
prisma migrate reset
```
