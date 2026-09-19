import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

/**
 * 비밀번호 해싱
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * 비밀번호 검증
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // bcrypt ignores bytes after 72, including a suffix added to a valid password.
  if (Buffer.byteLength(password, 'utf8') > 72) return false;
  return bcrypt.compare(password, hash);
}

/**
 * 비밀번호 요구사항 검증
 */
export function validatePasswordRequirements(password: string): string | null {
  if (Buffer.byteLength(password, 'utf8') > 72) return '비밀번호는 UTF-8 기준 72바이트 이하여야 합니다.';
  const requirements = {
    minLength: 8,
    maxLength: 128,
    lowercase: /[a-z]/,
    digit: /\d/,
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
  };

  if (password.length < requirements.minLength) {
    return `비밀번호는 최소 ${requirements.minLength}자 이상이어야 합니다`;
  }

  if (password.length > requirements.maxLength) {
    return `비밀번호는 최대 ${requirements.maxLength}자 이하여야 합니다`;
  }

  if (!requirements.lowercase.test(password)) {
    return '비밀번호는 소문자를 포함해야 합니다';
  }

  if (!requirements.digit.test(password)) {
    return '비밀번호는 숫자를 포함해야 합니다';
  }

  if (!requirements.special.test(password)) {
    return '비밀번호는 특수문자를 포함해야 합니다';
  }

  return null;
}
