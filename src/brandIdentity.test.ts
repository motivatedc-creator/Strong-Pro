import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('Lock’d identity contract', () => {
  it('uses the exact system-safe PWA name', () => {
    expect(read('vite.config.ts')).toMatch(/manifest:\s*{\s*name:\s*['"]Lockd['"],/);
  });

  it('uses the diamond-ring mark for app chrome and alternate icons', () => {
    const iconPaths = [
      'public/brand/app-icon-master.svg',
      'public/brand/favicon.svg',
      'public/brand/symbol.svg',
      'public/favicon.svg',
      'public/icons/icon-default.svg',
      'public/icons/icon-ember.svg',
      'public/icons/icon-glacier.svg',
      'public/icons/icon-maskable.svg',
      'public/icons/icon-moss.svg',
      'public/icons/icon-violet.svg',
    ];

    for (const path of iconPaths) {
      const svg = read(path);

      expect(svg, path).toContain('aria-label="Lockd"');
      expect(svg, path).toContain('data-brand-mark="diamond-ring"');
      expect(svg, path).toContain('fill-rule="evenodd"');
      expect(svg, path).not.toMatch(/RepForge|barbell|<text\b|>L<|rx="96"/i);
    }
  });

  it('uses the current product name in the README and package metadata', () => {
    expect(read('README.md')).toMatch(/^# Lock’d$/m);

    const packageJson = JSON.parse(read('package.json')) as {
      name: string;
      description: string;
    };
    expect(packageJson.name).toBe('lockd');
    expect(packageJson.description).toMatch(/^Lock’d —/);
  });

  it('uses the current favicon filename', () => {
    expect(existsSync(resolve(root, 'public/icons/favicon-certified.svg'))).toBe(false);
    expect(existsSync(resolve(root, 'public/icons/favicon-lockd.svg'))).toBe(true);
  });
});
