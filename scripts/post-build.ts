import { execSync } from 'child_process';

// macOS-only post-build steps: patch Info.plist and create AppleScript opener
if (process.platform === 'darwin') {
  execSync('bash scripts/patch-plist.sh', { stdio: 'inherit' });
  execSync('bash scripts/create-opener.sh', { stdio: 'inherit' });
}
// Windows/Linux: file associations are handled by electrobun build via electrobun.config.ts
