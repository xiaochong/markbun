import { execSync } from 'child_process';
import { existsSync, readdirSync, renameSync, unlinkSync, rmSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve, basename } from 'path';

// macOS-only post-build steps: create wrapper app, and package DMG
if (process.platform === 'darwin') {
  execSync('bash scripts/create-wrapper.sh', { stdio: 'inherit' });
  execSync('bash scripts/create-dmg.sh', { stdio: 'inherit' });

  // Copy DMG to artifacts directory
  const dmgPath = resolve('build', 'MarkBun.dmg');
  const artifactDir = resolve('artifacts');
  if (existsSync(dmgPath)) {
    if (!existsSync(artifactDir)) mkdirSync(artifactDir, { recursive: true });
    copyFileSync(dmgPath, join(artifactDir, 'macos-arm64-MarkBun.dmg'));
    console.log('[post-build] Copied MarkBun.dmg to artifacts/macos-arm64-MarkBun.dmg');
  } else {
    console.warn('[post-build] DMG not found at', dmgPath);
  }
}

// Windows: Electrobun build may fail to embed icons via rcedit (bun.exe too large, path issues).
// Workaround: extract tar.zst, embed icons into exe files, re-package tar.zst, embed icon into Setup.exe.
if (process.platform === 'win32') {
  const rcedit = require('rcedit');
  const iconPath = resolve('icon.iconset/icon.ico');
  if (!existsSync(iconPath)) {
    console.warn('[post-build] Icon file not found:', iconPath);
  } else {
    const buildDir = resolve('build', 'stable-win-x64');
    const zstdExe = resolve('node_modules/electrobun/dist-win-x64/zig-zstd.exe');
    const zstName = 'MarkBun-Setup.tar.zst';
    const setupExe = join(buildDir, 'MarkBun-Setup.exe');

    // Step 1: Extract the original tar.zst, embed icons, re-package
    const absZstPath = join(buildDir, zstName);
    if (existsSync(absZstPath) && existsSync(zstdExe)) {
      const stagingDir = join(buildDir, '.icon-staging');
      if (existsSync(stagingDir)) rmSync(stagingDir, { recursive: true });
      mkdirSync(stagingDir, { recursive: true });

      try {
        // Decompress zst -> tar (absolute paths)
        const absTarPath = join(stagingDir, 'MarkBun-Setup.tar');
        execSync(`"${zstdExe}" decompress -i "${absZstPath}" -o "${absTarPath}"`, { stdio: 'pipe' });
        console.log('[post-build] Decompressed tar.zst');

        // Extract tar (use relative path, bsdtar on Windows can't handle drive letters in absolute paths)
        execSync(`tar -xf MarkBun-Setup.tar`, { cwd: stagingDir, stdio: 'pipe' });
        console.log('[post-build] Extracted tar');

        // Rename launcher/bun -> .exe if needed, then embed icons
        const binDir = join(stagingDir, 'MarkBun', 'bin');
        if (existsSync(binDir)) {
          for (const f of readdirSync(binDir)) {
            if (!f.endsWith('.exe') && (f === 'launcher' || f === 'bun')) {
              const src = join(binDir, f);
              const dst = join(binDir, f + '.exe');
              if (!existsSync(dst)) {
                renameSync(src, dst);
                console.log(`[post-build] Renamed ${f} -> ${f}.exe`);
              }
            }
          }
          for (const exe of readdirSync(binDir).filter(f => f.endsWith('.exe'))) {
            try {
              await rcedit(join(binDir, exe), { icon: iconPath });
              console.log(`[post-build] Icon embedded into ${exe}`);
            } catch (e: any) {
              console.warn(`[post-build] Failed to embed icon into ${exe}:`, e.message);
            }
          }
        }

        // Re-create tar (relative paths to avoid Windows bsdtar drive-letter issues)
        const newTarName = 'MarkBun-new.tar';
        if (existsSync(join(stagingDir, newTarName))) unlinkSync(join(stagingDir, newTarName));
        execSync(`tar -cf "${newTarName}" MarkBun`, { cwd: stagingDir, stdio: 'pipe' });
        console.log('[post-build] Re-created tar archive');

        // Re-compress to zst (absolute paths)
        const absNewTarPath = join(stagingDir, newTarName);
        unlinkSync(absZstPath);
        const absNewZstPath = join(stagingDir, zstName);
        execSync(`"${zstdExe}" compress -i "${absNewTarPath}" -o "${absNewZstPath}" --threads max`, { stdio: 'pipe' });
        // Move from staging to build dir
        renameSync(absNewZstPath, absZstPath);
        console.log('[post-build] Re-created tar.zst archive');

        // Cleanup staging
        rmSync(stagingDir, { recursive: true });
      } catch (e: any) {
        console.warn('[post-build] Failed to re-package tar.zst:', e.message);
        if (existsSync(stagingDir)) rmSync(stagingDir, { recursive: true });
      }
    }

    // Step 2: Embed icon into Setup.exe
    if (existsSync(setupExe)) {
      try {
        await rcedit(setupExe, { icon: iconPath });
        console.log('[post-build] Icon embedded into MarkBun-Setup.exe');
      } catch (e: any) {
        console.warn('[post-build] Failed to embed icon into Setup.exe:', e.message);
      }
    }

    // Step 3: Refresh artifacts zip with modified files
    const artifactDir = resolve('artifacts');
    const zipName = 'stable-win-x64-MarkBun-Setup.zip';
    const artifactZip = join(artifactDir, zipName);
    if (existsSync(artifactZip) && existsSync(setupExe) && existsSync(absZstPath)) {
      try {
        const zipStaging = join(buildDir, '.zip-staging');
        if (existsSync(zipStaging)) rmSync(zipStaging, { recursive: true });
        mkdirSync(join(zipStaging, '.installer'), { recursive: true });

        // Copy Setup.exe to staging root
        copyFileSync(setupExe, join(zipStaging, basename(setupExe)));
        // Copy tar.zst to .installer/
        copyFileSync(absZstPath, join(zipStaging, '.installer', zstName));
        // Copy or generate metadata.json
        const metadataSrc = join(buildDir, 'MarkBun-Setup.metadata.json');
        if (existsSync(metadataSrc)) {
          copyFileSync(metadataSrc, join(zipStaging, '.installer', basename(metadataSrc)));
        }

        // Delete old zip and create new one
        unlinkSync(artifactZip);
        // Use PowerShell Compress-Archive (same as Electrobun)
        execSync(
          `powershell -command "Compress-Archive -Path '${zipStaging}\\\\*' -DestinationPath '${artifactZip}' -Force"`,
          { stdio: 'pipe' },
        );
        console.log(`[post-build] Refreshed artifacts/${zipName}`);

        // Cleanup
        rmSync(zipStaging, { recursive: true });
      } catch (e: any) {
        console.warn('[post-build] Failed to refresh artifacts zip:', e.message);
        const zipStaging = join(buildDir, '.zip-staging');
        if (existsSync(zipStaging)) rmSync(zipStaging, { recursive: true });
      }
    }

    // Step 4: Rename artifacts zip to win-x64-MarkBun-Setup.zip
    const renamedZip = join(artifactDir, 'win-x64-MarkBun-Setup.zip');
    if (existsSync(artifactZip)) {
      if (existsSync(renamedZip)) unlinkSync(renamedZip);
      renameSync(artifactZip, renamedZip);
      console.log('[post-build] Renamed artifacts zip to win-x64-MarkBun-Setup.zip');
    }
  }
}
