// Read-only inventory. Never prints secret values and never calls an external service.
import { readFile, readdir, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { parse } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true });
const staged = process.argv.includes('--staged');
const prefix = git('rev-parse', '--show-prefix').trim();
const files = [...new Set(git('ls-files', '--cached', ...(staged ? [] : ['--others', '--exclude-standard']), '-z').split('\0').filter(Boolean))];
const secrets = new Set();
const exampleValues = parse(await readFile(path.join(root, '.env.example')));
const sharedExampleConfigKeys = [];
const envFiles = (await readdir(root)).filter(file => (/^\.env(?:\.|$)/.test(file) || /^\.dev\.vars(?:\.|$)/.test(file)) && !file.endsWith('.example'));
const settings = {};
for (const file of envFiles) {
  try {
    const values = parse(await readFile(path.join(root, file))); settings[file] = values;
    for (const [key, value] of Object.entries(values)) {
      if (/^(?:EXPO_PUBLIC_|VITE_)|KAKAO_(?:MAP_JS|NATIVE_APP)_KEY/.test(key)) continue;
      let isLocalExampleDatabase = false;
      if (key === 'DATABASE_URL' && value === exampleValues[key]) {
        try { isLocalExampleDatabase = ['localhost', '127.0.0.1', '::1', '[::1]', 'db'].includes(new URL(value).hostname); } catch {}
      }
      if (isLocalExampleDatabase || /^(?:change-this|replace-with|YOUR[_-])/i.test(value)) {
        sharedExampleConfigKeys.push({ file, key });
        continue;
      }
      if (/(?:SECRET|PASSWORD|TOKEN|ACCESS_KEY|API_KEY|DATA_GO_KR_KEY|VALIDATION_KEY|DATABASE_URL)/.test(key) && value.length >= 12) secrets.add(value);
      if (key === 'DATABASE_URL') { try { const password = decodeURIComponent(new URL(value).password); if (password.length >= 16) secrets.add(password); } catch {} }
    }
  } catch (error) { if (error.code !== 'ENOENT') throw Error('ENV_READ_FAILED'); }
}
let scanned = 0;
const matches = [];
const credentialPatterns = [];
for (const file of files) {
  if (!/\.(?:[cm]?[jt]sx?|kt|kts|json|md|xml|ya?ml|properties|sql|html|css|ps1|txt|pem|conf)$|(?:^|\/)\.env/.test(file)) continue;
  try {
    const absolute = path.join(root, file); if ((await stat(absolute)).size > 8 * 1024 * 1024) continue;
    const content = staged ? git('show', `:${prefix}${file}`) : await readFile(absolute, 'utf8'); scanned++;
    if ([...secrets].some(value => content.includes(value))) matches.push(file);
    if (/^-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/m.test(content) || /\b(?:ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{60,}|sbp_[a-f0-9]{40})\b/.test(content)) credentialPatterns.push(file);
  } catch (error) { if (error.code !== 'ENOENT') throw Error('SOURCE_READ_FAILED'); }
}
const edge = settings['.env.edge.local'] || {}, device = settings['.env.device-validation.local'] || {};
const gradle = await readFile(path.join(root, 'android-native/app/build.gradle.kts'), 'utf8');
const manifest = await readFile(path.join(root, 'android-native/app/src/main/AndroidManifest.xml'), 'utf8');
let bundle;
try { bundle = JSON.parse(await readFile(path.join(root, '.runtime/edge-bundle-report.json'), 'utf8')); } catch {}
const suspectPackages = ['uuid', 'xcode', 'deepmerge-ts', 'effect', '@prisma/config'];
const packagesInBundle = suspectPackages.filter(pkg => bundle?.inputs?.some(file => file.replaceAll('\\', '/').includes('/node_modules/' + pkg + '/')));
const privateFilesInGit = files.filter(file => /(?:^|\/)(?:\.env(?:\.(?!example$|production\.example$|.*\.example$).+)?)$|(?:^|\/)\.dev\.vars(?:\..*)?$|(?:^|\/)(?:local|release)\.properties$|(?:^|\/)\.release-private\/|\.(?:jks|keystore|p12|pfx|key|apk|aab)$/.test(file));
const result = {
  checkedAt: new Date().toISOString(), readOnly: true, sourceFilesScanned: scanned,
  staged, knownServerSecretMatches: matches, credentialPatternFiles: credentialPatterns, privateConfigFilesEligibleForCommit: privateFilesInGit, sharedExampleConfigKeys,
  config: { validationOnly: edge.EDGE_VALIDATION_MODE === 'true',
    distinctJwtKeys: Boolean(edge.JWT_SECRET && edge.JWT_REFRESH_SECRET && edge.JWT_SECRET !== edge.JWT_REFRESH_SECRET),
    databaseQuotaStore: edge.QUOTA_STORE === 'database', ollamaEnabled: edge.OLLAMA_ENABLED === 'true',
    deviceValidationExpiresAt: device.EXPIRES_AT || null },
  android: { storeReleaseGuard: gradle.includes('Store release blocked:'),
    backupDisabled: manifest.includes('android:allowBackup="false"') && manifest.includes('android:fullBackupContent="false"'),
    cleartextDisabled: manifest.includes('android:usesCleartextTraffic="false"') },
  edgeBundle: bundle ? { builtAt: bundle.createdAt, revision: bundle.revision, auditedPackagesPresent: packagesInBundle } : null,
  limitations: ['Only current known local secrets and current Git-eligible text files; not Git history or an exhaustive secret scanner.',
    'Dependency inclusion does not prove absence of all vulnerabilities. Maven dependencies need a separate CVE audit.'],
};
console.log(JSON.stringify(result, null, 2));
if (matches.length || credentialPatterns.length || privateFilesInGit.length) process.exitCode = 1;
