# ver4 홈 API 호출 복구 및 개발 서버 검증

검증일: 2026-09-15 (한국 시간)

## 기준과 보존 범위

GitHub `ver4`를 다시 fetch하여 최신 커밋 `983c023`을 확인했다. 해당 버전에도 존재하지 않는 `TatsStayngService1`, `TatsCnsmrService1`, `PhotoGalleryService2` 주소가 남아 있었다.

- ver4의 **지역별 체류·소비 값 산술평균 → 지역 순위 → TourAPI 장소 선택** 흐름을 유지했다.
- 축제 3개와 지역 대표 관광지를 합치는 방식, TourAPI 사진 우선/Photo Korea 보완, 숲 배경 선택 방식은 유지했다.
- 여행 코스 추천/뚜벅이 점수/LLM 모델/DB 스키마를 이번 수정에서 변경하지 않았다.
- 기존 미커밋 작업을 보존했다. GitHub commit/push는 하지 않았다. `.env`의 비밀키는 변경하지 않았다.

## 호출부 수정

| 기능 | 공식 서비스/오퍼레이션 | 필수 보정 |
| --- | --- | --- |
| 체류 강도 | `AreaTarDemDsService/areaTarSjrnDsList` | `tarSjrnDsIxCd=21`, `tarSjrnDsIxVal` 사용 |
| 소비 강도 | `AreaTarDemDsService/areaTarExpDsList` | `tarExpDsIxCd=22`, `tarExpDsIxVal` 사용 |
| 관광사진 | `PhotoGalleryService1/gallerySearchList1` | 2가 아닌 1 버전, 촬영자/사진 ID 유지 |

공통 주소 접두사는 `https://apis.data.go.kr/B551011/`이다. 기존 `DATA_GO_KR_KEY`를 그대로 사용한다.
이전 `.env.example`의 잘못된 기본 주소가 개인 설정에 남아 있어도 알려진 오타 주소는 공식 주소로 호환 처리한다.

동일한 월의 체류·소비 **종합 지표**가 모두 있는 시군만 평균을 낸다. 연월/지역 코드를 점수로 추정하는 로직을 제거했다. 도 전체 합계는 개별 시군 순위에서 제외하고, 0점은 유효값으로 유지하되 누락·비수치·범위 밖 값은 사용하지 않는다.

직전 월부터 최대 12개월을 찾아 최근 데이터가 있는 동일 월을 사용한다. 인증/통신 실패는 빈 월로 취급하지 않고 탐색을 중단한다. 조회 전체 시간은 최대 20초로 제한하고, 지역 순위는 6시간 캐시/동시 요청 병합, 실패는 5분 캐시한다. Photo Korea 숲 사진도 동시 요청을 병합하고 실패 시 반복 호출을 제한한다. 캐시는 서버 메모리이며 프로세스 재시작 시 초기화된다.

기존 방문자 API 대체 경로는 보존했다. 해당 서비스의 별도 권한 오류는 해결 대상으로 확장하지 않았으며, 이번 정상 수요 응답에서는 대체 경로가 호출되지 않는다.

## 실제 검증 결과

- `202608`, `202607`: HTTP 200/정상 코드지만 조회 데이터 없음.
- `202606`: 체류·소비 각 23개 행(도 전체 1개 + 시군 22개), 앱 순위에 22개 시군 사용.
- 여수: `(83.27 + 65.38) / 2 = 74.325`, 기존 반올림 규칙에 따라 화면 74점.
- 함평 71.395점, 장성 70.8점. 홈에 각각 71점 표시.
- `/api/hot-places`: `source=demand`, 축제 3개 + 관광지 3개, 기준 월 및 계산 설명 포함.
- `/api/login-photo`: `source=photokorea`. 직접 사진 검색도 사진 ID/작가 정보 수신.
- 홈 6개 카드 + 배경 1개: **이미지 7개 모두 HTTP 200, image/jpeg 또는 image/png, 본문 수신**.
- 캐시된 로컬 API 샘플: 홈 35ms, 배경 14ms. 단일 PC 측정이며 최초 호출/운영 서버 성능 보장은 아님.
- 브라우저 `http://127.0.0.1:5173/`: 게스트 홈의 실제 사진, 새 지역 순위, 상세의 기준 월/계산 설명을 직접 확인.
- 서버/웹 TypeScript 검사 통과. Vitest 27개 파일 **200개 통과**.
- 웹 공유용 빌드 성공. 기존 번들 크기 경고(500kB 이상)는 남아 있음.
- Android Kotlin 컴파일 및 `:app:testDebugUnitTest --offline` **31개 통과**. 이번에는 휴대폰 연결·실기 검사·APK 설치를 하지 않았다. 네이티브 상세의 설명 문구는 다음 APK 빌드/설치 후 반영되고, 서버 데이터와 기존 `metricLabel`은 현재 앱에서도 수신 가능하다.

화면에는 `지역 수요 2026.06`처럼 기준 월을 표시한다. 값은 앱의 **지역 비교 점수**이며 개별 관광지의 방문자 수나 실시간 인기도가 아니다. API의 `visitors` 필드는 기존 클라이언트 호환 때문에 유지하되 `source`, `metricLabel`, `demand` 정보를 함께 제공한다.

## 재검사

프로젝트 루트에서 실행:

```powershell
node --import tsx scripts/check-home-integrations.mjs --assert-live
pnpm test
pnpm typecheck
pnpm web:typecheck
```

실제 API 검사는 API 키/개발 서버 연결이 필요하며 무료 호출량을 사용한다. `--assert-live`는 대체 정보가 아닌 실제 세 API 연결을 요구하므로 공급자 장애나 승인 문제 시 의도적으로 실패한다. 응답 기록은 `.runtime/home-audit/integrations.json`에 저장하며 키는 기록하지 않는다.

공식 근거: [관광 수요 강도 명세](https://www.data.go.kr/data/15151868/openapi.do), [관광사진 명세](https://www.data.go.kr/data/15101914/openapi.do).
