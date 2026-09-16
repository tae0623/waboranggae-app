function validateReleaseEnvironment(env) {
  const problems = [];
  let url;
  try { url = new URL(env.EXPO_PUBLIC_API_BASE_URL || ''); } catch { problems.push('EXPO_PUBLIC_API_BASE_URL에 상시 운영 HTTPS API 주소를 입력하세요.'); }
  if (url && (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.hostname.endsWith('.trycloudflare.com') || url.hostname.endsWith('.example.com') || url.username || url.password)) {
    problems.push('출시 앱에는 로컬·임시 터널·예시 주소를 사용할 수 없습니다.');
  }
  if (env.EXPO_PUBLIC_DEV_ACCESS_KEY) problems.push('출시 빌드에 팀 개발용 접속 암호를 포함할 수 없습니다.');
  return problems;
}
module.exports = { validateReleaseEnvironment };
