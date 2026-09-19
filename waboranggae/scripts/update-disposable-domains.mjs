// Download data only, pinned to one upstream commit. Never runs upstream code.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repository = 'disposable-email-domains/disposable-email-domains';
const destination = path.join(root, 'server/src/auth/disposable-email-data');
const options = process.argv.slice(2);
if (options.length && (options.length !== 2 || options[0] !== '--ref' || !/^[a-f0-9]{40}$/.test(options[1]))) {
  throw new Error('Usage: node scripts/update-disposable-domains.mjs [--ref <40-character commit SHA>]');
}
async function download(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'ddubugi-domain-list-update' },
    signal: AbortSignal.timeout(30000), redirect: 'error',
  });
  if (!response.ok) throw new Error(`List download failed: HTTP ${response.status}`);
  const reader = response.body.getReader();
  const chunks = []; let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 5_000_000) { await reader.cancel(); throw new Error('Upstream file exceeds 5 MB'); }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks).toString('utf8');
}
const commit = options[1] || JSON.parse(await download(`https://api.github.com/repos/${repository}/commits/main`)).sha;
if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Invalid upstream commit');
const base = `https://raw.githubusercontent.com/${repository}/${commit}`;
const [raw, license] = await Promise.all([
  download(`${base}/disposable_email_blocklist.conf`), download(`${base}/LICENSE.txt`),
]);
if (!license.startsWith('CC0 1.0 Universal (CC0 1.0)')) throw new Error('Upstream license changed; review before updating');
const lines = raw.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
// Upstream validates public suffixes; reject malformed/wildcard/non-domain input here.
const domainPattern = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
if (lines.some(domain => domain.length > 253 || !domainPattern.test(domain))) throw new Error('Invalid upstream domain');
const domains = [...new Set(lines)].sort();
if (domains.length < 1000 || domains.length > 100000) throw new Error('Unexpected upstream list size');
const overrides = JSON.parse(await readFile(path.join(destination, 'overrides.json'), 'utf8'));
if (![overrides.allow, overrides.block].every(list => Array.isArray(list) && list.every(domain => typeof domain === 'string' && domain.length <= 253 && domainPattern.test(domain)))) {
  throw new Error('Invalid local domain override');
}
// Local false-positive exceptions may intentionally overlap the upstream list.
// These ordinary providers are separate sentinels for a suspect upstream update.
const protectedProviders = ['gmail.com', 'naver.com', 'daum.net', 'hanmail.net', 'outlook.com', 'icloud.com', 'proton.me'];
if (protectedProviders.some(domain => domains.includes(domain))) throw new Error('Upstream blocks a protected provider; review the change before importing');
const metadata = {
  repository: `https://github.com/${repository}`, commit, retrievedAt: new Date().toISOString(),
  license: 'CC0-1.0', count: domains.length,
  sourceSha256: createHash('sha256').update(raw).digest('hex'),
};
// All downloads and validation complete before replacing the checked-in snapshot.
await mkdir(destination, { recursive: true });
await writeFile(path.join(destination, 'domains.json'), JSON.stringify(domains, null, 2) + '\n');
await writeFile(path.join(destination, 'LICENSE.txt'), license.replace(/[ \t]+$/gm, ''));
await writeFile(path.join(destination, 'metadata.json'), JSON.stringify(metadata, null, 2) + '\n');
console.log(JSON.stringify(metadata));
console.log('Review the data diff, run tests, commit, then redeploy the API. No live configuration changed.');
