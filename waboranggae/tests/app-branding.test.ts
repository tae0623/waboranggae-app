import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const read = (name: string) => readFileSync(path.join(root, name), 'utf8');
const nativeUi = 'android-native/app/src/main/java/kr/co/waboranggae/nativepilot/ui/';

function sourceFiles(directory: string): string[] {
  return readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap(entry => {
    const name = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(name) : /\.(tsx?|kt|xml|html)$/.test(name) ? [name] : [];
  });
}

describe('뚜버기 display name', () => {
  it('keeps installation, splash, login and exit labels while simplifying home', () => {
    const app = JSON.parse(read('app.json')).expo;
    expect(app.name).toBe('뚜버기');
    expect(app.web.name).toBe('뚜버기');
    expect(read('android-native/app/src/main/AndroidManifest.xml')).toContain('android:label="뚜버기"');
    for (const file of ['AccountScreens.kt', 'TravelApp.kt', 'BrandIntro.kt']) {
      expect(read(nativeUi + file), file).toContain('뚜버기');
    }
    expect(read('web/index.html')).toContain('<title>뚜버기</title>');
  });

  it('leaves no previous display name in application and server source', () => {
    const previousName = '\uC640\uBCF4\uB791\uAED8';
    const files = ['app.json', 'web/index.html', ...['android-native/app/src/main', 'web/src', 'src', 'server/src'].flatMap(sourceFiles)];
    expect(files.filter(file => read(file).includes(previousName))).toEqual([]);
  });

  it('preserves the installed application identity and support address', () => {
    expect(read('android-native/app/build.gradle.kts')).toContain('applicationId = "kr.co.waboranggae.nativepilot"');
    expect(read('src/domain/privacyNotice.ts')).toContain('waboranggae.help@gmail.com');
  });
});
