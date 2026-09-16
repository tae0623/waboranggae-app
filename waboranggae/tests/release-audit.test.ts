import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { attributionHtml } from '../server/src/legalContent';
describe('pre-release safety and attribution', () => {
  it('binds legacy local DB and unauthenticated Ollama ports to loopback', () => {
    const compose = readFileSync('docker-compose.yml', 'utf8');
    expect(compose).toContain('127.0.0.1:5432:5432');
    expect(compose).toContain('127.0.0.1:11434:11434');
    expect(compose).not.toMatch(/"(?:5432:5432|11434:11434)"/);
  });
  it('disables backup on pre-Android-12 devices too', () => {
    const manifest = readFileSync('android-native/app/src/main/AndroidManifest.xml', 'utf8');
    expect(manifest).toContain('android:allowBackup="false"');
    expect(manifest).toContain('android:fullBackupContent="false"');
  });
  it('states the institution as source, not only the API product name', () => {
    expect(attributionHtml).toContain('출처: ⓒ한국관광공사');
    expect(attributionHtml).not.toContain('여행일 예보가 아닙니다');
    expect(readFileSync('android-native/app/src/main/java/kr/co/waboranggae/nativepilot/ui/AccountScreens.kt','utf8')).toContain('한국관광공사 TourAPI');
    expect(readFileSync('web/src/AppInfo.tsx','utf8')).toContain('한국관광공사');
  });
});
