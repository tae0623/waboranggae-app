import { domainToASCII } from 'node:url';
import domains from './disposable-email-data/domains.json';
import overrides from './disposable-email-data/overrides.json';

const blockedDomains = new Set([...domains, ...overrides.block]);
const allowedDomains = new Set(overrides.allow);

// Run after email syntax validation. No email, DNS lookup or API request leaves this process.
// Allow exceptions are exact domains; subdomains do not inherit an exception.
export function isDisposableEmail(email: string): boolean {
  const address = email.trim();
  const domain = domainToASCII(address.slice(address.lastIndexOf('@') + 1).toLowerCase());
  if (!domain || allowedDomains.has(domain)) return false;
  const labels = domain.split('.');
  for (let index = 0; index < labels.length - 1; index++) {
    if (blockedDomains.has(labels.slice(index).join('.'))) return true;
  }
  return false;
}

export const DISPOSABLE_EMAIL_MESSAGE = '일회용 이메일로는 가입할 수 없어요. 계속 사용할 이메일 주소를 입력해 주세요.';
