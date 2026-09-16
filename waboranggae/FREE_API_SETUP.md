# 무료 API 연결 상태와 설정 위치

현재 작업 폴더: C:/Users/taeng/Documents/Codex/2026-07-18/ek/github-upload/waboranggae-app-ver4-review/waboranggae
서버의 실제 키는 이 폴더의 .env에 입력합니다. 기존 ver3 폴더의 .env와 다른 파일입니다.
키를 채팅이나 GitHub에 올리지 마세요. VITE_ / EXPO_PUBLIC_ 변수에는 서버 비밀키를 넣지 않습니다.

## 연결 확인

- TourAPI: DATA_GO_KR_KEY 재사용. 실제 코스 생성 및 관광지 이미지 HTTP 200 확인.
- 카카오맵: KAKAO_MAP_JS_KEY / KAKAO_REST_API_KEY 재사용. KAKAO_FREE_TIER_CONFIRMED=true인 경우에만 REST를 사용합니다.
  추천 계산마다 유료 길찾기를 대량 호출하지 않고, 사용자가 구간 조회를 눌렀을 때만 카카오 경로를 조회합니다.
  일일 내부 상한 및 캐시가 있으며 쿼터 초과 시 카카오맵 링크로 안내합니다. 무료 권한은 개발자 콘솔에서도 유지해야 합니다.
- 기상청: DATA_GO_KR_KEY 재사용. 2026-09-15 01:00 KST 순천 관측값(18.8°C, 강수 없음, 1.1m/s) 실응답 확인.
  동선 탭에서 선택한 코스 출발 좌표의 현재 관측값을 표시합니다. 여행일 예보로 표시하지 않습니다.
  출처: https://www.data.go.kr/data/15084084/openapi.do
- 카카오·구글 소셜 로그인: 서버/앱 연결 코드는 구현했지만 아래 콘솔 설정 전에는 ‘설정 필요’입니다. 실계정 로그인 테스트는 아직 하지 않았습니다.
- Apple 로그인: 사용자 요청으로 공통 웹/앱 화면과 제공자 목록에서 제거했습니다.

## 카카오 로그인

.env.social.example을 참고해 서버 .env에 아래 항목을 추가합니다.

    PUBLIC_APP_URL=https://현재-팀-공유주소.trycloudflare.com
    KAKAO_LOGIN_ENABLED=false
    KAKAO_OAUTH_CLIENT_SECRET=

KAKAO_REST_API_KEY는 이미 .env에 입력되어 있습니다. 같은 카카오 앱의 기존 REST 키를 재사용합니다.
JavaScript 키(KAKAO_MAP_JS_KEY)는 지도용이므로 로그인 시크릿 자리에 넣지 않습니다.

1. 카카오디벨로퍼스에서 와보랑께 앱을 선택합니다.
2. [카카오 로그인] > [사용 설정]의 상태를 ON으로 둡니다.
3. [앱] > [플랫폼 키] > 사용 중인 [REST API 키]를 선택합니다.
4. [클라이언트 시크릿] 코드를 복사해 .env의 KAKAO_OAUTH_CLIENT_SECRET에 넣습니다. 시크릿 활성화도 ON으로 둡니다.
5. 같은 REST API 키의 [카카오 로그인 리다이렉트 URI]에 아래 로그인 콜백 주소를 등록합니다.

등록할 Redirect URI는 PUBLIC_APP_URL 뒤에 /auth/social/kakao/callback을 붙인 주소입니다.
설정 완료 후 KAKAO_LOGIN_ENABLED=true로 바꾸고 pnpm team:restart를 실행합니다.
공유 터널 주소가 바뀌면 PUBLIC_APP_URL과 Redirect URI도 갱신합니다.

2026-09-15 현재 개발 서버 기준:

    PUBLIC_APP_URL=https://qualification-excitement-flight-industry.trycloudflare.com

카카오 로그인 리다이렉트 URI:

    https://qualification-excitement-flight-industry.trycloudflare.com/auth/social/kakao/callback

이 주소는 임시 개발용입니다. 출시 때는 고정 HTTPS 주소로 교체합니다.
현재 코드는 OpenID Connect 활성화를 추가로 요구하지 않습니다.
닉네임을 제공받으려면 [카카오 로그인] > [동의항목]에서 닉네임 항목도 확인합니다.
현재 코드는 이메일이나 전화번호 없이 제공자 회원번호로 계정을 구분합니다.

공식 문서: https://developers.kakao.com/docs/ko/kakaologin/prerequisite
설정 메뉴: https://developers.kakao.com/docs/ko/app-setting/app

### 웹훅과 리다이렉트 URI의 차이

- 리다이렉트 URI: 사용자가 카카오에서 로그인한 뒤 돌아오는 주소입니다. 현재 서버에 구현되어 있습니다.
- 연결 해제 웹훅: 사용자가 카카오 계정 설정에서 와보랑께 연결을 끊었을 때 카카오가 우리 서버에 보내는 알림입니다.

현재 서버에는 연결 해제 웹훅 수신 처리가 없습니다. 로그인 콜백 주소를 웹훅 칸에 넣으면 안 됩니다.
우선 로그인 테스트에는 사용 설정과 리다이렉트 URI를 준비합니다.
출시 전에는 연결 해제 시 계정·세션을 어떻게 처리할지 정하고, 요청 인증 검증과 함께 웹훅을 별도로 구현·검증해야 합니다.
웹훅 설정 위치는 [앱] > [웹훅] > [연결 해제 웹훅]입니다.

공식 문서: https://developers.kakao.com/docs/ko/kakaologin/callback

## 구글 로그인

Google의 클라이언트 보안 비밀번호(Client Secret)는 구글 계정 비밀번호가 아닙니다.
Google이 이 앱에 발급하는 서버용 비밀키이며, ID와 함께 아래 절차로 발급받습니다.

1. https://console.cloud.google.com/auth/overview 에서 프로젝트를 선택하거나 새 프로젝트를 만듭니다.
2. Google Auth Platform을 처음 설정한다면 시작하기를 눌러 앱 이름(와보랑께), 지원 이메일과 담당자 연락처를 입력합니다.
3. 일반 Gmail 계정으로 팀 테스트를 하려면 대상(Audience)은 외부(External), 게시 상태는 테스트(Testing)로 설정하고 본인·팀원의 Google 이메일을 테스트 사용자로 추가합니다.
4. [클라이언트(Clients)] > [클라이언트 만들기(Create client)]를 누릅니다.
5. 애플리케이션 유형은 [웹 애플리케이션]을 선택합니다. 현재는 서버가 인증 코드를 교환하므로 서버용 웹 클라이언트를 만드는 단계입니다.
6. 이름을 와보랑께 개발 서버 등으로 지정하고, [승인된 리디렉션 URI]에 아래 주소를 추가합니다.
7. 만들기를 누른 뒤 클라이언트 ID와 클라이언트 보안 비밀번호를 각각 .env에 복사합니다. 보안 비밀번호는 생성 화면에서 바로 안전하게 보관합니다.

    https://qualification-excitement-flight-industry.trycloudflare.com/auth/social/google/callback

현재 서버 방식에는 승인된 JavaScript 원본을 추가할 필요가 없습니다.
Google Maps 유료 API를 활성화할 필요는 없습니다.

    GOOGLE_LOGIN_ENABLED=false
    GOOGLE_OAUTH_CLIENT_ID=
    GOOGLE_OAUTH_CLIENT_SECRET=

승인된 리디렉션 URI: PUBLIC_APP_URL + /auth/social/google/callback
테스트 모드라면 팀원을 OAuth 테스트 사용자로 등록하고, 준비되면 GOOGLE_LOGIN_ENABLED=true로 설정합니다.
서버 재시작 후 앱의 구글 로그인 → 인증 창 열기 → 로그인 → 앱으로 돌아오기 순서로 확인합니다.
클라이언트 시크릿은 서버에만 보관하며 토큰을 URL에 넣지 않습니다.

공식 문서: https://developers.google.com/identity/protocols/oauth2/web-server
클라이언트 생성/관리: https://support.google.com/cloud/answer/15549257?hl=ko
대상/테스트 사용자: https://support.google.com/cloud/answer/15549945?hl=ko

## 새 디자인의 웹과 Android/iOS

    pnpm web

웹은 http://127.0.0.1:5173 에서 확인합니다.

    pnpm app:dev

Android/iOS는 기존 Expo 프로젝트를 유지하면서 web/src/App.tsx를 Expo DOM component로 함께 사용합니다.
네이티브 API 요청은 제한된 Expo 네이티브 통신 함수로 전달하므로 파일 기반 WebView의 CORS를 전체 허용하지 않습니다.
UI 리소스는 앱 번들에 포함됩니다. 추천·지도·날씨·로그인은 API 서버 연결이 필요합니다.
Expo Go 개발 확인 시 PC와 휴대폰을 같은 Wi-Fi에 연결합니다. API 주소와 팀 암호는 스크립트가 로컬 설정에서 읽습니다.

팀원이 볼 웹 변경을 공유하려면:

    pnpm team:build
    pnpm team:restart
    pnpm team:status

공유 주소/암호는 .runtime/TEAM_ACCESS.md에 있습니다.
서버 이용료 없이 PC를 개발 서버로 사용하지만 전기·인터넷 및 항상 켜두는 운영 부담은 있습니다.
Google Play 개발자 등록과 최종 상시 운영 서버는 이 무료 개발 서버 구축과 별개입니다.

## 출시 전 필요

- Google Play 개발자 계정 생성, 해당 계정의 테스트/출시 요건 확인
- 고정 HTTPS 운영 API 주소와 운영 DB, Ollama 운영 방식
- SUPPORT_EMAIL과 최종 개인정보 처리방침·외부 계정 삭제 주소 확정
- Android 실기 테스트, 서명된 AAB 생성 및 Play Console 검사
- 카카오·구글 소셜 로그인 실계정 검증

production EAS 설정은 AAB를 지정하고 로컬 주소, 임시 터널 주소, 팀 접속 암호가 포함된 출시 빌드를 거부합니다.
아직 유료 클라우드 빌드, Play 업로드, GitHub push는 실행하지 않았습니다.
