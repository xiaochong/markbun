import { describe, test, expect } from 'bun:test';
import { homedir as osHomedir } from 'os';

describe('homedir wrapper', () => {
  test('returns process.env.MARKBUN_E2E_HOME when set', async () => {
    const original = process.env.MARKBUN_E2E_HOME;
    process.env.MARKBUN_E2E_HOME = '/tmp/e2e-home';

    // re-import to pick up the new env value
    const { homedir } = await import('../../../../src/bun/services/homedir');
    expect(homedir()).toBe('/tmp/e2e-home');

    process.env.MARKBUN_E2E_HOME = original;
  });

  test('falls back to os.homedir() when MARKBUN_E2E_HOME is unset', async () => {
    const original = process.env.MARKBUN_E2E_HOME;
    delete process.env.MARKBUN_E2E_HOME;

    const { homedir } = await import('../../../../src/bun/services/homedir');
    expect(homedir()).toBe(osHomedir());

    process.env.MARKBUN_E2E_HOME = original;
  });

  test('exports the homedir function', async () => {
    const mod = await import('../../../../src/bun/services/homedir');
    expect(typeof mod.homedir).toBe('function');
  });
});
