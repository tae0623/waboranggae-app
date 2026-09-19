# 뚜버기 Android 앱

현재 Android 앱은 Kotlin + Jetpack Compose로 구현되어 있습니다. 웹·이전 Expo 소스와 별도이며 웹 변경이 자동으로 옮겨지지 않습니다.
[팀 개발 안내](../TEAM_HANDOFF.md)에서 전체 구조를 먼저 확인하세요.

## 개발 설정

1. Android Studio에서 이 폴더를 엽니다. SDK 36, Build Tools 36.0.0, Gradle 8.13 및 호환 JDK를 사용합니다. 검증 PC는 JDK 22를 사용했습니다.
2. local.properties.example을 local.properties로 복사하고 본인 SDK 경로, 테스트할 HTTPS API 주소, 카카오 네이티브 앱 키를 설정합니다.
3. 공개 앱 API에서는 DEV_ACCESS_KEY를 빈 값으로 둡니다. 팀 웹 로그인 암호나 서버 비밀키를 넣지 않습니다.
4. 카카오 지도는 해당 개발 빌드의 패키지명·서명 키 해시를 카카오에 등록해야 합니다. 운영 앱 등록을 지우지 않습니다.

| 빌드 | 패키지 | 서명 |
|---|---|---|
| debug | kr.co.waboranggae.nativepilot | 개발자 PC의 디버그 키 |
| release | kr.co.ddubugi.app | 운영자의 정식 서명키 |

local.properties와 release.properties 및 서명키는 Git에서 제외됩니다. 팀원은 정식 서명키 없이 debug 개발이 가능합니다.
현재 ABI는 ARM64이며, 아이폰에는 APK를 설치할 수 없습니다. ARM64 Android 기기 또는 호환 에뮬레이터가 필요합니다.

## 검증

Android Studio의 Gradle 창 또는 설치된 Gradle 8.13으로 testDebugUnitTest, assembleDebug를 실행합니다.
단위 테스트 결과는 app/build/reports/tests/testDebugUnitTest/index.html에 생성됩니다.
지도·위치 권한·소셜 로그인 후 복귀·뒤로가기·저장 후 동선 이동은 Android 실기기에서도 확인합니다.

기존 tools/configure.mjs 및 build.ps1은 과거 임시 터널/기기 검증 설정에 의존하는 부분이 있으므로, 새 팀원 PC에서는 위 local.properties 방식으로 설정하세요. 비밀키 파일을 복사해서 해결하지 않습니다.

## 배포

release는 정식 서명과 출시 검증 파일을 요구합니다. 운영자가 관리하는 키로 업데이트해야 하며, 다음 스토어 업데이트에는 versionCode를 증가시켜야 합니다. 테스트 APK를 정식 업데이트로 제출하지 않습니다.

auth/signup의 DISPOSABLE_EMAIL_DOMAIN 응답을 받으면 일회용 이메일 차단 안내를 표시합니다. 이 UI를 출시 앱에 반영하려면 새 Android 버전 배포가 필요합니다. 서버 차단 자체는 API 재배포 후 기존 APK에도 적용됩니다.
