import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const native = readFileSync(new URL('../android-native/app/src/main/res/drawable/ic_brand.xml', import.meta.url), 'utf8');
const svg = readFileSync(new URL('../web/src/assets/brand-mark.svg', import.meta.url), 'utf8');
const app = readFileSync(new URL('../web/src/App.tsx', import.meta.url), 'utf8');
const attributes = { fillColor: 'fill', fillType: 'fill-rule', strokeColor: 'stroke', strokeWidth: 'stroke-width',
  strokeLineJoin: 'stroke-linejoin', strokeLineCap: 'stroke-linecap', pathData: 'd' } as const;

describe('web home brand matches the native app', () => {
  it('uses the same real-map and paired-footprint paths and colours', () => {
    const nativePaths = [...native.matchAll(/<path\b([\s\S]*?)\/>/g)];
    const webPaths = [...svg.matchAll(/<path\b([\s\S]*?)\/>/g)];
    expect(webPaths).toHaveLength(nativePaths.length);
    expect(webPaths.length).toBe(6);
    nativePaths.forEach((element, index) => {
      for (const [, name, value] of element[1]!.matchAll(/android:(\w+)="([^"]*)"/g)) {
        const target = attributes[name as keyof typeof attributes];
        expect(target).toBeDefined();
        expect(webPaths[index]![1]).toContain(`${target}="${value === 'evenOdd' ? 'evenodd' : value}"`);
      }
    });
    expect(svg).toContain('viewBox="0 0 108 108"');
    expect(svg).not.toMatch(/<script|<image|href=|onload=/i);
  });

  it('loads the versioned brand asset beside the home title instead of an emoji', () => {
    expect(app).toContain("import brandMark from './assets/brand-mark.svg'");
    const header = app.split('{/* 앱 로고 */}')[1]!.split('{/* 히어로 텍스트 */}')[0]!;
    expect(header).toContain('data-testid="home-brand-mark" src={brandMark}');
    expect(header).toContain('alt="전남 지도 위 발자국"');
    expect(header).toContain('width={40} height={40}');
    expect(header).not.toContain('🚶');
  });
});
