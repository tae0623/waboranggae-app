# Google OAuth 브랜딩 등록 자료

작성일: 2026-09-18

- 앱 이름: 뚜버기
- Google 등록 로고: `ddubugi-logo-120.png` (120 × 120, PNG, 11,460 bytes)
- 큰 원본: `ddubugi-logo-512.png` (512 × 512, PNG)
- 앱 홈페이지: https://waboranggae-app.pages.dev/app
- 개인정보처리방침: https://waboranggae-app.pages.dev/app/privacy
- 서비스 이용약관: https://waboranggae-app.pages.dev/app/terms
- 계정 탈퇴 안내: https://waboranggae-app.pages.dev/app/delete-account
- 문의: waboranggae.help@gmail.com

로고는 기존 `web/src/assets/brand-mark.svg`의 지도·발자국 도형을 그대로 정사각형 배경에 배치한 파일입니다. Android 앱 아이콘 자체를 이번 작업에서 변경하지 않았습니다.

서비스 이용약관은 현재 무료 기능·만 14세 이상 계정·정보의 한계·탈퇴·개인정보 안내를 반영하여 게시했습니다. 운영자가 최종 내용을 검토해야 하며, 게시만으로 이용자의 약관 동의를 기록하거나 법률 검토가 완료되는 것은 아닙니다.

사용자가 Google의 프로덕션 전환 완료를 알려주었습니다. 일반 계정의 실제 로그인 성공, Google 브랜드 검증 통과, 원스토어 심사 완료는 이 사실과 별도로 확인해야 합니다.

## 확인 결과

- 공개 약관 HTTP 200, 로그인 쿠키 발급 없음
- 팀 웹 루트 HTTP 401: 비공개 보호 유지
- 관련 페이지 및 게이트 테스트: 65개 통과
- 공개 페이지 배포 ID: 830ef47b-cf06-4335-8218-193890fabb16

공식 규격: https://support.google.com/cloud/answer/15549049?hl=ko

Google은 로고를 정사각형 120px로 권장하고 1MB 이하 PNG/JPG/BMP를 지원합니다. 외부 프로덕션 앱의 이름·로고 노출에는 브랜드 검증 절차가 별도로 적용될 수 있습니다. 이 파일을 원스토어 아이콘 규격 검증의 대체물로 사용하지 마세요.
