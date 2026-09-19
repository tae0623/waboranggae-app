# 이메일 회원가입 도메인 목록

출처: [disposable-email-domains/disposable-email-domains](https://github.com/disposable-email-domains/disposable-email-domains).
CC0-1.0 공개 자료이며 원본 고지는 `LICENSE.txt`, 고정 커밋·받은 시각·원본 SHA-256은 `metadata.json`에 있습니다.

`domains.json`은 서버에 함께 빌드됩니다. 회원가입 때 원격 목록, DNS, 유료 검증 API를 호출하지 않으며 이메일 주소를 목록 제공자에게 보내지 않습니다. 대소문자와 하위 도메인까지 검사합니다. 예를 들어 `sub.mailinator.com`은 차단하지만 `mailinator.com.example`은 같은 도메인으로 취급하지 않습니다.

적용 지점은 `POST /auth/signup`입니다. 차단 시 HTTP 400, `DISPOSABLE_EMAIL_DOMAIN` 및 사용자 안내를 반환하며 DB 조회·쓰기, 비밀번호 해싱, 봇 확인 전에 종료합니다. 웹은 API 오류 문구를 표시하고 Android는 해당 코드에 대응하는 안내를 표시합니다. 기존 회원 로그인, 소셜 로그인, 테스트용 로그인 별칭은 변경하지 않습니다.

## 팀원이 수정할 때

- 일반 목록 갱신: 프로젝트 루트에서 `pnpm email-domains:update`.
- 특정 커밋 재현: `pnpm email-domains:update --ref <40자리 upstream 커밋>`.
- 오탐 예외: `overrides.json`의 `allow`에 소문자 도메인을 추가합니다. 정확히 같은 도메인만 허용되며 하위 도메인은 자동 허용하지 않습니다.
- 추가 차단: `overrides.json`의 `block`에 소문자 도메인을 추가합니다. 하위 도메인도 차단합니다.
- 데이터 변경을 검토하고 `pnpm test` → 커밋 → API 서버 재배포 순으로 반영합니다. GitHub에 올리는 것만으로 Supabase 서버가 바뀌지는 않습니다.

갱신 도구는 같은 upstream 커밋의 데이터·라이선스만 받아 형식, 건수, 주요 정상 메일 제공자 오탐을 확인합니다. 라이선스 변경이나 비정상 응답이면 기존 목록을 교체하지 않습니다. 자동 예약 갱신은 설정하지 않았습니다.

새 도메인 누락이나 잘못 분류된 도메인이 있을 수 있습니다. 이메일 소유권 인증을 대체하지 않으며 현재 봇 확인·가입 횟수 제한과 함께 동작합니다. 사용자가 철회한 이메일 인증·복구 메일 흐름은 다시 도입하지 않았습니다.
