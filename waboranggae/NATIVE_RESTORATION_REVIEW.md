# 네이티브 기능 복원·민감 정보 검토 (2026-09-15)

기존 앱을 삭제하거나 GitHub에 올리지 않았습니다. 작업 위치는 ver4-review의 waboranggae입니다.
전체 운영 서비스 완성본이 아니라, 기존 웹 기능을 추가 이식하여 실기 검증한 디버그 시제품입니다.

## 복원한 기능

로그인/가입/게스트, 카카오·구글 인증 연결, 내 여행(저장·이력·이름 수정·삭제·로그아웃),
코스 상세/일정/점수, AI 추가 설명, 현재 날씨, 실제 장소 순서 편집 및 서버 재검증,
여러 날·숙소·아침/점심/저녁·부모님/아이 동행 선택을 추가했습니다.
상세에서 동선 확인, 두 번째 코스 전환 및 선택 해제도 지원합니다.
자세한 화면별 범위는 [DESIGN_PARITY.md](android-native/DESIGN_PARITY.md)를 참조하세요.

## 개인정보

- 문의 주소: **waboranggae.help@gmail.com** (사용자 지정).
- 운영 주체명: **뚜버기 Team (administrator: Taeyoung Ko)** (사용자 확정).
- 회원가입·소셜 로그인 동의 버전/시각을 DB에 기록합니다. 기존 사용자에게 소급 동의 기록하지 않습니다.
- 여행 조건은 자동 기록하지 않고, 저장할 때 출발지·좌표 포함 및 보관 기간을 고지합니다.
- 기존 데이터 유지. 팀 개발 DB 127.0.0.1:55432의 waboranggae_dev에 동의 컬럼 2개만 추가했습니다.
- 네이티브 로그인 저장 암호화, 로그인 화면 캡처 차단, 개인정보성 내부 오류 로그 축소,
  이미지 프록시 리다이렉트/호스트/파일 크기 보호를 적용했습니다.
- 상세 정책·남은 위험: [개인정보 안내](PRIVACY_POLICY.md), [보안 검토](docs/SECURITY.md).

## 권리 검토

Samsung 시스템 이모지를 렌더링한 설치 이미지의 재배포 허락이 확인되지 않아
같은 걷는 사람을 나타내는 **Google Noto Emoji SVG (Apache2.0)**로 바꿨습니다.
지도·발자국은 기존 웹 그림을 유지했으며 팀 원저작물 여부 확인이 필요합니다.
Pretendard OFL 원문, Noto 저작권·라이선스·NOTICE를 앱에 동봉했습니다.

TourAPI 사진에 공공누리 제1·제3유형이 적용될 수 있고, 포토코리아도 작품별 조건이 다릅니다.
출처 표시만으로 허가가 완결되지는 않습니다. 사진별 권리 메타데이터 누락은 출시 전 확인 항목입니다.
네이티브는 원본 비율로 표시하며 실제 장소와 무관한 고정 사진 대체를 줄였습니다.

## 사용자 확인이 필요한 항목

1. 확정 운영자명·문의 이메일을 Play 계정의 법적 신원 정보와 구분해 설정하고 문의 대응 절차 마련.
2. 팀의 지도·발자국·선형 아이콘 원본 제작/허락 증빙.
3. 실제 카카오·구글 로그인, 취소·재접속·계정 삭제 테스트 (비밀번호는 직접 입력).
4. 사진별 이용 조건, 영구 개인정보/계정삭제 URL, 국외 처리·백업 파기·아동 정책.
5. 고정 서버, 이메일 본인 확인/복구, 삭제 직전 재인증·갱신 토큰 재사용 방지, Play 데이터 보안 양식과 서명.

실제 푸시 알림과 정식 출시 배포는 미완료입니다. 릴리스 빌드 차단은 유지했습니다.
무료 API 연결 자체와 앱 기능 구현을 개인정보/저작권·보안 심사 완료로 혼동하면 안 됩니다.

## 확인된 기능 한계

32시간 순천 1박 2일 시험은 둘째 날 식사 검증 오류 수정 후에도 환승 제한을 만족하는 후보가 없었습니다.
여러 날 기능은 입력/API 연결을 복원한 **시험 기능**이며, 정상 코스 생성 완료로 보고하지 않습니다.
AI 설명은 첫 호출 CUDA 오류(기본 설명), 재시도 약 29.6초에 Ollama 응답 성공입니다. 안정성·내용 품질 검증은 남습니다.
최초 동의/재로그인 분기 및 무료 출시 준비 항목은 [출시 준비 계획](RELEASE_READINESS_PLAN.md)에 정리했습니다.
구체적인 검사 수치와 화면 캡처는 [검증 기록](android-native/VALIDATION.md)에 있습니다.

## 공식 참고

- [Google 개발자명과 실명 공개](https://support.google.com/googleplay/android-developer/answer/13628312?hl=ko): 표시용 개발자명은 실명과 달라도 되나 개인 계정 실명은 별도 공개 대상.
- [Google 사용자 데이터 정책](https://support.google.com/googleplay/android-developer/answer/10144311?hl=ko) · [계정 삭제](https://support.google.com/googleplay/android-developer/answer/13327111?hl=ko).
- [한국관광공사 관광정보 API](https://www.data.go.kr/data/15101578/openapi.do) · [공공누리 유형](https://www.kogl.or.kr/info/license.do) · [포토코리아](https://phoko.visitkorea.or.kr/).
- [Noto Emoji](https://github.com/googlefonts/noto-emoji) · [SVG 라이선스](https://raw.githubusercontent.com/googlefonts/noto-emoji/main/svg/LICENSE) · [Pretendard](https://github.com/orioncactus/pretendard).
