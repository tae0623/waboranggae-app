# 원스토어 우선 출시 준비

> 최신 통합 판정(2026-09-16): [출시 전 감사 보고서](PRE_RELEASE_AUDIT_2026-09-16.md). 아래는 단계별 작업 이력이므로 현재 상태가 다른 항목은 최신 보고서를 우선 확인하세요.

갱신: 2026-09-15 KST. 대상: ver4-review/waboranggae, Kotlin 네이티브 Android.
사용자 결정: iOS 보류, 원스토어 우선. 목표: 9월 20일 스토어 등록 링크.
**현재 제출 가능 판정은 보류입니다. 심사 승인·9월 20일 등록을 보장하지 않습니다.**

## 공개 배포 전 필수 확인: 테스트 호출 한도 (9월 16일 추가)

- [ ] 최종 테스트 종료 후 `KAKAO_DAILY_REQUEST_LIMIT`를 운영 예상 사용량에 맞게 다시 결정하고 로컬·Supabase 설정에 반영.
- [ ] 카카오 무료 쿼터 적용·유료 API 미사용 상태, 같은 키를 사용하는 다른 실행 환경의 사용량을 카카오 콘솔에서 확인.
- 사용자 요청으로 비공개 최종 테스트는 합산 **1,000회/일**을 사용합니다. 카카오 계정의 제공 한도를 증설하거나 카운터를 초기화하는 작업이 아닙니다.
- 도보·대중교통은 공식 무료 제공량이 각각 1,000회/일이지만 현재 보호 구현은 장소 검색·주소 검색·도보·대중교통을 하나로 합산합니다. 운영 예제 기본값은 200으로 유지했습니다. [공식 쿼터](https://developers.kakao.com/docs/ko/getting-started/quota)
- 개발 파일 카운터와 클라우드 DB 카운터는 서로 다릅니다. 동시 실호출을 각 1,000회까지 사용할 수 있다는 뜻이 아니므로 최종 테스트는 클라우드 API 한 곳에 집중합니다.

## 최신 상태: 9월 15일 23시 이후

아래 초기 준비 기록보다 [휴대폰 테스트 업데이트](PHONE_TEST_UPDATE.md)가 최신입니다.
Android 테스트 APK는 고정 Supabase API로 전환·S20+ 설치했으며, 서버 265개/Android 단위 40개/실기 7개 검사를 통과했습니다.
카카오·구글 서버 설정과 버튼 활성화는 완료했고 실계정 인증은 사용자 직접 확인이 남았습니다.
선택 코스의 실제 카카오 시간/경로·점수 재계산, 여행 날짜 예보, UI 정리와 종료창을 반영했습니다.
현재 APK는 9월 16일 23:32:11 KST에 만료하는 비공개 계정 테스트 키를 사용합니다. 정식 서명·공개 설정·최종 법적 안내가 완료된 출시용 APK는 아닙니다.

## 이번에 구현·검증한 부분

| 항목 | 실제 결과 | 남은 한계 |
| --- | --- | --- |
| 소셜 로그인 흐름 | 암호화 DB 저장, 5분 만료, 다른 프로세스에서 요청 복구 | 외부 공급자 인증 교환 도중 서버가 끊기면 재시도 필요. 실제 카카오/구글 로그인 검증 미완료 |
| 동시 처리 | 같은 OAuth 결과 10회 동시 수령 중 1회만 성공, 단위 테스트에서 동시 동의 1회 생성 | 갱신 토큰 회전/재사용 감지 보완은 별도 잔여 항목 |
| 비용 보호 | 운영 카카오 호출량 DB 원자적 예약. 20건 경쟁/한도 7에서 정확히 7건 허용 | 개발 파일 카운터와 운영 DB 카운터가 다름. 전환일 사용량 이관/보수적 한도 필요. 모든 API·호스팅 비용의 보장은 아님 |
| DB 정보 보호 | 앱 관련 7개 테이블 RLS, PUBLIC/anon/authenticated 권한 제거. Supabase 서버 전용 역할(6개 앱 테이블 CRUD) TLS 연결 검증 완료 | 운영 API 배포 후 권한·기능 재검증 필요 |
| 장애 감지 | /readyz: DB 연결·필수 테이블 확인, 실패/시간 초과 시 503. 로컬 200 확인 | 경로·날씨 등 모든 공급자 장애를 DB 준비 상태 하나로 판정하지 않음 |
| 선택적 LLM | 동시 1건, 기본 15초/최대 20초 제한, 연속 2회 실패 시 30초 fallback | CPU/GPU 중단 강제 보장은 아니며 모델 응답 품질/클라우드 성능 검증 아님 |
| 자동 검사 | 최신 서버 TypeScript/Vitest 250개, 웹 타입 검사·빌드 통과 | 퇴역 TMAP 모듈 전용 4개 검사 제거·회귀 검사 추가. 모든 현장 여행/실계정 동작을 보증하지 않음 |
| Android 검사 | 최신 단위 테스트 36개 통과. 이전 lint 오류 0/경고 21 | 새 APK 생성·실기 설치·스토어 서명 빌드는 아직 하지 않음 |

기존 팀 DB는 `.runtime/backups/team-before-runtime-safety-20260915-1441.dump`로 백업 후 마이그레이션했습니다.
이 파일은 Git 제외이며 기존 계정 정보가 포함될 수 있으므로 공개하면 안 됩니다. 백업 복원 훈련·암호화된 별도 보관은 아직 남았습니다.
검증용 임시 행만 정리했고 사용자 계정 수는 바뀌지 않았습니다. 기존 `.env`는 Supabase 값으로 교체하지 않았습니다.

## Supabase 현재 상태와 입력

사용자가 Free 프로젝트를 생성하고 `.env.supabase.local`에 연결 정보를 입력했습니다.
최초 `SELF_SIGNED_CERT_IN_CHAIN` 오류 후 사용자가 제공한 `G:/prod-ca-2021.crt`를 지정해 **인증서 검증 및 DB 계정 인증을 통과했습니다.**
초기 읽기 전용 검사에서 public 스키마의 테이블은 0개였습니다.
사용자의 **Data API 비활성화 완료** 확인 후 기존 마이그레이션 6개를 실행했습니다.
후속 검사: 앱 관련 테이블 7개, RLS 미적용 0개, anon/authenticated 테이블 권한 0건.
원격 DB의 빈 스키마 초기화는 완료했지만 **PC 사용자 데이터는 복사하지 않았고 앱의 API/DB 주소도 전환하지 않았습니다.**

1. Dashboard의 Database → Settings → SSL Configuration에서 CA 인증서를 내려받습니다.
2. `.env.supabase.local`의 `SUPABASE_SSL_ROOT_CERT=""`에 해당 `.crt` 파일 경로를 넣습니다.
3. 이 프로젝트 폴더에서 `node scripts/check-supabase.mjs`로 읽기 전용 TLS/권한 검사를 합니다.
4. Prisma 전용 DB로 사용할 계획이므로 원격 마이그레이션 **전** Data API 설정에서 공개 Data API를 끕니다. 앱은 자체 API를 사용하며 Supabase Auth로 자동 전환하지 않습니다.
5. 새 프로젝트에 다른 앱 데이터가 없는지 확인 후 빈 스키마를 마이그레이션하고 공개 조회 차단을 재검증합니다. 기존 PC의 실계정 데이터 이전은 별도 검토합니다.

초기화 도구: `node scripts/initialize-supabase-db.mjs`는 public 스키마의 빈 상태만 읽습니다.
공개 Data API 비활성화 확인 후 `--initialize-empty-project --data-api-disabled`를 함께 전달해야 스키마를 생성합니다.
이미 테이블이 있으면 자동 초기화/덮어쓰기를 중단합니다. 실패한 마이그레이션은 자동 reset하지 않습니다.

DB URL은 Connect → Session pooler, 포트 5432를 사용합니다. 별도 `SUPABASE_DB_PASSWORD` 값은 스크립트가 URL 인코딩합니다.
인증서 검증 끄기(`rejectUnauthorized:false`, `NODE_TLS_REJECT_UNAUTHORIZED=0`)는 사용하지 않습니다.
현재 단계에는 Supabase anon/publishable/service_role/secret API 키가 필요하지 않습니다.

Supabase DB만 준비해도 PC 의존성이 사라지는 것은 아닙니다. 현재 Express·Prisma·bcrypt API를 무료 고정 HTTPS 환경에서 실제 실행해야 합니다.
Supabase Edge 전용 호환 번들을 별도로 구현했고 로컬 Deno에서 DB 연결·회원가입·로그인·북마크·탈퇴가 통과했습니다.
Android도 함수 경로를 보존하도록 수정했습니다. **사용자 승인 후 Supabase에 비공개 검증 모드로 배포했습니다.**
클라우드 환경변수·Buffer·타이머 호환 문제를 수정했고 DB 준비, 동의 가입·로그인·저장·탈퇴, TourAPI 추천·관광 이미지·카카오 구간 경로가 통과했습니다.
실제 추천 1회 6.3초(순천 터미널 출발 6시간 코스 5개), 홈 관광 수요/축제·포토코리아·기상청도 HTTP 200 및 실제 공급자 출처 확인.
TMAP은 사용자 요청으로 호출 코드·화면 표시·환경 설정에서 제거했으며 Supabase에도 키를 전송하지 않았습니다.
일반 외부 API 요청은 검증 키 없으면 403입니다. 기존 앱의 API 주소는 아직 전환하지 않았고 공개 출시 상태는 아닙니다.
상세 실행 절차·보안 경고·잔여 항목은 [Edge 검증 기록](deployment/edge/README.md)에 기록했습니다.
DB 연결과 API 호스팅을 모두 검사했지만 1회 원격 테스트를 실계정 소셜 로그인·장시간 무중단·스토어 심사 완료로 간주하지 않습니다.
Free에는 DB/트래픽/함수 호출/휴면 제한이 있고 SLA·자동 DB 백업을 포함하지 않으므로 운영 모니터링과 별도 복구 대책이 필요합니다.

## 제출 전에 반드시 닫아야 하는 항목

- ONEconsole 개인개발자 가입·본인 확인·약관 동의: 사용자 진행. 계정 준비 상태 최종 확인 필요.
- 항상 접근 가능한 API 고정 HTTPS URL, 클라우드 DB 연결, 무료 한도/초과 동작, 장애/재시작/복구 시험.
- 고정 URL을 카카오·구글 콜백과 앱 API 주소에 반영. 모바일 데이터/Wi-Fi/PC 종료 상태에서 로그인·추천·지도·탈퇴 실계정 검사.
- Android 운영 패키지 ID·버전·사용자 보관용 서명 키 확정, 해당 카카오 Android 키 해시 등록. 현재 debug-only 빌드 차단 유지.
- 무료·인앱결제 없는 앱으로 제출할 계획. 결제 기능이나 불필요한 SDK는 임의 추가하지 않음. APK/AAB 선택과 영구 서명 키는 업로드 전에 확정.
- 개인정보 방침에서 운영 DB 지역/처리 사업자/보관·삭제·백업·연령 정책 등 실제 운영 조건 확정. 아직 개발용 방침인 상태로 정식 제출하지 않음.
- 추천 후보 전체는 추정 이동시간 기반. 선택한 코스의 실제 구간 확인과 총시간·점수 재검증을 보완. 이동시간을 확정된 현장 정보처럼 표시하지 않음.
- 갱신 토큰 회전·재사용 차단, 계정 복구/삭제 재인증, 공개 이미지·로그인 요청의 분산 부하/남용 보호 등 잔여 보안 항목 확인.
- 지도·발자국 원본 그림의 권리 확인, 사진별 저작권/공공누리 조건 확인, 출처·지도 로고 유지.
- 스토어 설명·스크린샷·개인정보 URL·필요한 심사 계정/방법 준비. 앱 안에서 다른 앱스토어 설치 링크를 유도하지 않음.

ONE store 심사는 앱 접속 실패·오류·개인정보 안내 누락 등을 검토하므로 스토어 변경만으로 서버 장애가 해결되지는 않습니다.
현재 APK는 팀 개발용 접속 키를 포함할 수 있는 디버그 시제품입니다. 기존 APK를 그대로 공개 제출하지 마세요.

## 공식 근거

- [ONE store 심사 FAQ](https://onestore-dev.gitbook.io/dev/help/faq/review): 접속 실패, 타 앱스토어 링크, 개인정보 고지·동의 등 검토.
- [ONE store AAB FAQ](https://onestore-dev.gitbook.io/dev/help/faq/apps/one-store-android-app-bundle): 복수 스토어 업데이트의 서명 키 일치, APK→AAB 변경 유의사항.
- [Supabase Prisma 연결](https://supabase.com/docs/guides/database/prisma): Session pooler 및 Data API 비활성화 권장.
- [Supabase SSL 검증](https://supabase.com/docs/guides/platform/ssl-enforcement): CA 인증서 다운로드·서버 이름 검증.
- [Supabase API 보안](https://supabase.com/docs/guides/api/securing-your-api): 권한과 RLS의 병행.
- [Supabase 무료 한도](https://supabase.com/pricing), [Edge Functions 제한](https://supabase.com/docs/guides/functions/limits).
