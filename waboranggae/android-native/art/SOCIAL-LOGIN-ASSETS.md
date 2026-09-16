# 소셜 로그인 공식 이미지

2026-09-16에 각 서비스의 공식 제공처에서 받았다. 재색칠·심볼 재제작 없이 로그인 기능에 사용한다.
이 자산은 해당 회사 상표/브랜드 자산이며 앱 팀의 자체 저작물이나 Public Domain으로 표시하지 않는다.

## Kakao

- 버튼: https://developers.kakao.com/tool/resource/static/img/button/login/full/ko/kakao_login_large_wide.png
- 리소스 안내: https://developers.kakao.com/tool/resource/login
- 디자인 가이드: https://developers.kakao.com/docs/ko/kakaologin/design-guide
- 로컬: app/src/main/res/drawable-nodpi/kakao_login_official.png
- SHA-256: 8ff3e7808e34a1a0a62a22034180380b4fe4c303291dc6980914b089cdef9f46
- 공식 한국어 버튼 전체를 비율 유지로 표시하고 남는 컨테이너는 #FEE500으로 채운다.
- 말풍선 대신 이모티콘이나 카카오 CI를 넣지 않는다.

## Google

- 공식 G 로고: https://developers.google.com/static/identity/images/g-logo.png
- 디자인 가이드: https://developers.google.com/identity/branding-guidelines
- 로컬: app/src/main/res/drawable-nodpi/google_signin_logo.png
- SHA-256: d1ce9c2af0b10a7333abc99bc706f9a6a199e5b65bf3e3009624f076b8638e6a
- 원본 다색 로고를 흰색 버튼에 비율 유지로 표시한다. 레이블은 “Google 로그인”.
- 스토어/OAuth 최종 심사 전 버튼 규격·서체 등 최신 브랜드 가이드 전체 적합성은 별도 확인한다.

## 버튼 배치 통일 (2026-09-16 후속 요청)

- 두 버튼 모두 전체 너비, 기본 높이 48dp, 모서리 6dp로 표시한다.
- 카카오 원본 버튼의 배치를 기준으로 왼쪽 로고 + 중앙 로그인 문구 형식을 맞춘다. 카카오 원본 전체 이미지의 비율과 Google 로고는 변경하지 않는다.
- 공식 브랜드 배경색과 Google 테두리는 유지한다. 인증 시작 콜백 및 비활성화 조건은 변경하지 않는다.
