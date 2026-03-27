import { execSync } from 'child_process';

// macOS-only post-build steps: create wrapper app, and package DMG
if (process.platform === 'darwin') {
  execSync('bash scripts/create-wrapper.sh', { stdio: 'inherit' });
  execSync('bash scripts/create-dmg.sh', { stdio: 'inherit' });
}
// Windows/Linux: file associations are handled by electrobun build via electrobun.config.ts
