# 네이티브 화면 후속 수정 · 2026-09-16

> 이후 로그인·길찾기·여행지 디자인 후속 변경 및 최신 APK는 [최신 변경 기록](NATIVE_LOGIN_DIRECTIONS_REVIEW_2026-09-16.md)을 참조한다. 아래 수치는 이 문서 작성 당시 기록이다.

대상: ver4-review의 Android 네이티브 앱. 기존 웹/Expo 소스와 저장 데이터는 삭제하지 않았다.
이 문서는 같은 날 작성한 NATIVE_WIZARD_REVIEW_2026-09-16.md의 후속 변경 기록이다.

## 요청별 반영

| 요청 | 반영 내용 |
| --- | --- |
| 1. 지도 육지 가운데 | 기존 실제 전남 경계 데이터의 가장 큰 육지 폴리곤만 렌더링. 섬을 아트에서 제외하고 육지의 경계 상자를 기준으로 중앙 배치. 아이콘·홈 아이콘·로딩 지도에 같은 생성기 적용. 원본 GeoJSON은 유지. |
| 2. 홈 상단 사진 채우기 | ver4의 기존 배경 사진 유지. 홈 배경만 Crop 방식으로 영역을 채워 Fit 여백의 녹색 선 제거. 관광지 사진은 기존 표시 방식을 유지. |
| 3. 정확도 우선 검색 | 정확한 명칭/주소 일치, 검색어 포함·토큰 일치 등 관련도 그룹을 먼저 비교하고 같은 그룹에서만 단말기 내 거리순 정렬. 위치 미허용/확인 실패 시 제공처 정확도 순서 유지. |
| 4. 오전·오후 시간 | 오전/오후 + 1~12시 + 0~59분 입력. 화면도 12시간 표시. API는 기존 HH:mm 24시간 형식 유지. 오전 12시는 00시, 오후 12시는 12시로 변환. |
| 5. 여러 날 제거 | 여행 날짜 하나와 같은 날 시작·종료 시간만 제공. 숙소 입력도 제거. 날짜를 넘기는 조건은 허용하지 않음. |
| 6. 동행자 제거 | 동행자 선택 UI 삭제. 예전 저장 조건을 복원할 때 동행자 보너스가 다시 활성화되지 않도록 API 기본값으로 정규화. |
| 7. 소제목 교체 | “가고 싶은 곳과 식사 계획을 골라주세요” |
| 8. 목적 안내 | “취향에 맞는 코스를 찾아드려요. 이동 거리와 시간에 따라 일부 목적은 포함되지 않을 수 있어요.” |
| 9. 사진 옵션 제거 | 사진 선택 삭제. 자연 명소·맛집 탐방·카페·역사·문화·시장·골목의 다섯 카테고리는 후보 선정 및 선호 점수에 사용되므로 유지. |
| 10. 식사 안내 | “방문 전 가게의 영업시간을 확인해 주세요.” 식당이 영업 중이라고 자동 확정하는 기능은 추가하지 않음. |
| 11. 제목 말줄임 제거 | 서버의 대표 장소명 길이 제한 및 네이티브 코스 카드·동선 제목의 말줄임 삭제. 긴 이름과 장소 목록을 줄바꿈으로 표시. |

## 검색 정확도와 개인정보

- 카카오가 숫자형 정확도 점수를 제공하는 것은 아니다. 앱에서 검색어와 명칭·주소의 일치 관계를 그룹화한다.
- 정확히 “순천역”인 먼 후보가 가까운 “순천역 카페”보다 앞선다. 비슷한 명칭 일치 그룹은 거리순으로 정렬한다.
- 주소 숫자는 별도 토큰으로 비교하여 65와 650을 같은 번호로 취급하지 않는다.
- 현재 위치는 단말기 안에서 거리 계산에만 사용한다. 서버·카카오·ViewModel·저장소로 전달하지 않는다.
- 지도에는 사용자가 검색하거나 선택한 장소만 전달한다. 기기 거리순 정렬로 고른 후보를 자동 지도 중심으로 보내지 않는다.
- 선택한 출발 장소의 좌표는 기존과 같이 추천·지도·길찾기 API에 사용된다. 모든 장소 좌표가 미전송이라는 의미는 아니다.
- 위치 허용이 없거나 위치가 확인되지 않았을 때도 검색 자체는 이용할 수 있다.

## 호환성

네이티브 새 입력과 저장 조건 복원에서는 endDate·lodging·photo 옵션을 제거한다.
사진만 선택했던 예전 조건은 자연 명소로 정규화한다.
companion은 기존 API의 중립 기본값 “혼자”로 보내며 별도의 동행자 선호는 적용하지 않는다.
공유 서버의 예전 웹/저장 데이터 호환 필드는 유지했다. DB 마이그레이션·데이터 삭제는 하지 않았다.
새로운 네이티브 추천은 당일 일정만 보낸다.

## 검증 결과

- 서버: 40개 파일, 336개 테스트 통과.
- TypeScript: --noEmit 통과.
- Android: 단위 테스트 62개 통과, APK/테스트 APK 빌드 성공.
- Android lint: 오류 0개, 경고 21개. 경고가 모두 해소된 상태는 아니다.
- Galaxy S20+: BrandAssetTest 1개 + ClockWizardUiTest 5개 + LiveFlowTest 1개, 최종 7개 모두 통과(41.727초).
- UI 검증: 빈 출발지, 제거된 옵션, 12시간 입력의 정오/잘못된 13시, 1.3배 글꼴 달력, 긴 제목의 실제 줄바꿈/ellipsis 없음.
- 실제 API: 2026-09-19 순천 공개 출발 장소 기준 09:15~15:40. 385분 코스 3개, routeSource=kakao, 조건 위반 없음. 요청 약 13.5초.
- 실제 휴대폰 흐름: 홈 실제 이미지 → 출발지 검색/선택 → 조건 → 실제 추천 → 두 번째 코스 선택 → 카카오 지도 타일·장소 이미지 확인.
- 첫 긴 제목 UI 검사는 테스트의 merged semantics 탐색 때문에 실패했다. 카드 내부 텍스트를 unmerged tree로 검사하도록 수정 후 다시 실행하여 통과했다.
- Supabase 기존 비공개 테스트 함수: version 32 ACTIVE. 새 비밀값 업로드 및 인증 설정 변경 없음. 인증 없는 API 요청은 HTTP 403 유지.
- APK 서버 비밀값 검사: 발견 0건. arm64 네이티브 라이브러리 16KB 정렬 확인.
- 육지 중심 아이콘, 홈 사진 채움, 오전·오후 입력, 안내문, 실제 코스·지도, 긴 제목 테스트 화면을 직접 확인했다.

## 설치 파일과 범위

S20+에 기존 데이터 유지 업데이트 설치 완료.
APK: android-native/app/build/outputs/apk/debug/app-debug.apk
SHA-256: cf615453bff644e8ab35f0e7d45a82e3bb8a383cac25d2fb0297e59cb70f57ae
크기: 36,849,126 bytes.

이 APK는 비공개 디버그 테스트용이다. 만료되는 기기 검증 키와 네이티브 앱 키를 포함한다.
기기 검증 키 만료: 2026-09-16 23:32:11 KST.
스토어에 그대로 제출하면 안 된다. 출시 서명·운영 설정·보호 한도 조정은 별도 절차다.
GitHub 커밋/푸시·스토어 제출·유료 서비스 가입·쿼터 초기화는 하지 않았다.
카카오 보호 한도는 기존 일 합산 1,000회를 유지했다.

## 주요 파일과 증빙

- android-native/tools/jeonnam-art.mjs, art/BOUNDARY-SOURCE.md
- android-native/app/src/main/java/kr/co/waboranggae/nativepilot/ui/WebHome.kt
- android-native/app/src/main/java/kr/co/waboranggae/nativepilot/ui/DeviceOnlyLocation.kt
- android-native/app/src/main/java/kr/co/waboranggae/nativepilot/ui/NearbyDepartureCandidates.kt
- android-native/app/src/main/java/kr/co/waboranggae/nativepilot/ui/TravelPickers.kt
- android-native/app/src/main/java/kr/co/waboranggae/nativepilot/ui/WebWizard.kt
- android-native/app/src/main/java/kr/co/waboranggae/nativepilot/data/Models.kt
- android-native/app/src/main/java/kr/co/waboranggae/nativepilot/ui/TravelViewModel.kt
- android-native/app/src/main/java/kr/co/waboranggae/nativepilot/ui/WebCourses.kt, TravelApp.kt
- server/src/modules/recommendation/planner.ts
- .runtime/clock-window-live.json
- .runtime/design-review/launcher-icon-preview.png, web-map-render.png
- .runtime/design-review/01-home.png, 13-clock-window.png, 14-meal-selection.png
- .runtime/design-review/16-twelve-hour-picker.png, 17-full-course-title.png
- .runtime/design-review/03-results.png, 04-second-course-map.png

관광정보 출처 및 사진 이용조건은 기존 하단 표기를 유지한다.
전남 경계 원본 라이선스와 출처는 art/BOUNDARY-SOURCE.md에 유지했다.
