# 뚜버기

전남 도보·대중교통 여행 코스 앱입니다. 협업 기준 브랜치는 **ver5**, 프로젝트 루트는 **waboranggae/**입니다.
원스토어 출시는 운영자가 2026-09-19 완료했다고 알려주었습니다. 이 저장소는 이후 수정까지 포함하는 개발 소스이며 스토어 APK와 파일 단위로 동일하다고 보장하는 태그가 아닙니다.

## 팀원이 시작할 곳

[팀 개발·검증 안내](waboranggae/TEAM_HANDOFF.md)를 먼저 읽으세요.
아이폰에서는 [팀 웹](https://waboranggae-app.pages.dev/)을 브라우저로 확인할 수 있습니다. 팀 웹 접속 암호는 운영자에게 별도로 받으며 저장소에 포함하지 않습니다.
Android 앱은 Kotlin/Jetpack Compose, 웹은 React/Vite로 각각 구현되어 있습니다. 웹 수정이 Android 화면에 자동 반영되지는 않습니다.

| 폴더 | 역할 |
|---|---|
| waboranggae/android-native/ | 현재 Android 앱 |
| waboranggae/web/ | 팀 웹 화면 |
| waboranggae/server/ | 추천·관광정보·회원 API |
| waboranggae/src/domain/, src/types/ | 공통 여행 규칙·계약 |
| waboranggae/prisma/ | DB 스키마·마이그레이션 |
| waboranggae/deployment/pages/ | 비공개 팀 웹 중계·공개 안내 페이지 |
| waboranggae/deployment/edge/, supabase/ | API 서버 빌드·배포 |
| waboranggae/tests/ | 서버·공통 로직 테스트 |
| waboranggae/release-assets/ | 공개 스토어 이미지·브랜드 자료 |

이전 Expo 소스는 보존되어 있습니다. 현재 Android 출시 화면을 수정할 때는 android-native를 사용합니다.

## 기본 명령

프로젝트 루트인 waboranggae에서 실행합니다. Node 24 / pnpm 11 기준입니다.

```sh
git switch ver5
git pull --ff-only origin ver5
git switch -c feature/my-change
cd waboranggae
pnpm install --frozen-lockfile
pnpm db:generate
pnpm typecheck
pnpm test
pnpm web
```

로컬 API 설정은 [팀 개발 안내](waboranggae/TEAM_HANDOFF.md)를 따르세요. GitHub에 올릴 때 .env, 서명키, 테스트 계정 암호, APK, DB 백업은 포함하지 않습니다.

## 회원가입 보호

기존 봇 확인·가입 횟수 제한에 [무료 일회용 이메일 도메인 차단](waboranggae/server/src/auth/disposable-email-data/README.md)을 추가했습니다. 목록 갱신 및 오탐 예외 처리 방법도 해당 문서에 있습니다.

ver5 push는 연결된 Pages 웹의 자동 빌드를 유발할 수 있습니다. Supabase API와 DB 변경은 별도 배포가 필요하며, Android 변경은 새 APK 빌드·실기기 검증·스토어 업데이트가 필요합니다.
