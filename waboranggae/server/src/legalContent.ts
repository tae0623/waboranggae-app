import { publicPrivacyHtml } from '../../src/domain/privacyPolicy';
import { PRIVACY_OPERATOR_NAME, SUPPORT_EMAIL } from '../../src/domain/privacyNotice';
export { SUPPORT_EMAIL } from '../../src/domain/privacyNotice';
export const privacyOperatorName = () => process.env.PRIVACY_OPERATOR_NAME?.trim() || PRIVACY_OPERATOR_NAME;
export function privacyHtml() { return publicPrivacyHtml(privacyOperatorName()); }
export const attributionHtml=`<p>출처: ⓒ한국관광공사(관광정보·관광사진, TourAPI 및 포토코리아). 장소 검색·추천 후보 보완: 카카오 로컬 API. 카카오 검색 결과는 맛집 인증이나 영업 여부 확인을 뜻하지 않습니다. 사진별 원 저작자와 이용조건을 확인해야 하며, 일괄 자유 이용으로 간주하지 않습니다.</p>
<ul><li><a href="https://www.data.go.kr/data/15101578/openapi.do">한국관광공사 국문 관광정보 API</a>: 관광사진에 공공누리 제1유형 또는 제3유형 조건이 적용될 수 있습니다.</li>
<li><a href="https://phoko.visitkorea.or.kr/">포토코리아 원 제공처</a> · <a href="https://www.kogl.or.kr/info/license.do">공공누리 유형 안내</a>. 제3유형은 변경 금지 조건입니다. 메타데이터가 없는 사진은 출시 전 권리 확인 대상입니다.</li>
<li><a href="https://www.data.go.kr/data/15084084/openapi.do">기상청 단기예보 조회서비스</a>: 선택한 여행일·시간의 예보를 제공하며, 발표 범위를 벗어난 날짜는 예보 미제공으로 안내합니다.</li>
<li><a href="https://developers.kakao.com/">카카오 지도·장소 검색</a>: 지도 SDK 로고·저작권 표시 유지. 길찾기는 실제 제공자 또는 추정 여부를 표시합니다.</li>
<li><a href="https://github.com/googlefonts/noto-emoji">기존 보관 자산: Google Noto Emoji</a> SVG (Copyright Google, Apache License 2.0), 현재 네이티브 런처·홈 아이콘에는 사용하지 않습니다. <a href="https://www.apache.org/licenses/LICENSE-2.0">전체 라이선스</a>.</li>
<li><a href="https://github.com/orioncactus/pretendard">Pretendard</a>: SIL Open Font License 1.1. 원 라이선스를 앱 자산에 동봉.</li></ul>
<p>현재 앱 아이콘은 기존 로딩 지도 도형과 발자국 도형을 조합했습니다. 지도·발자국 그림과 선형 UI 아이콘은 기존 웹 프로젝트에서 이전했습니다. 지도·발자국 및 홈·로그인 배경의 배포 권한은 운영팀이 확인했습니다. 출처 표기 자체가 저작권 허락을 대신하지 않습니다.</p>`;
