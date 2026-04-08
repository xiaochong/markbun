import { execSync } from 'child_process';
import { existsSync, readdirSync, unlinkSync, rmSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join, resolve, dirname, basename } from 'path';

// ─── macOS: create wrapper app and DMG ───
if (process.platform === 'darwin') {
  execSync('bash scripts/create-wrapper.sh', { stdio: 'inherit' });
  execSync('bash scripts/create-dmg.sh', { stdio: 'inherit' });

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

// ─── Windows: build NSIS installer ───
if (process.platform === 'win32') {
  const rcedit = require('rcedit');

  // Config (must match electrobun.config.ts top-level fields)
  const appName = 'MarkBun';
  const appVersion = '0.1.0';
  const appAuthor = 'MarkBun';
  const projectRoot = resolve('.');
  const buildRoot = resolve('build', 'stable-win-x64');
  const iconSource = resolve('icon.iconset', 'icon.ico');
  const distDir = resolve('dist');

  // Step 1: Check makensis dependency
  let makensisPath: string | null = null;
  try {
    makensisPath = execSync('where makensis', { stdio: 'pipe' }).toString().trim().split('\n')[0].trim();
  } catch {}
  if (!makensisPath) {
    // Check standard install paths
    const standardPaths = [
      'C:\\Program Files (x86)\\NSIS\\makensis.exe',
      'C:\\Program Files\\NSIS\\makensis.exe',
    ];
    for (const p of standardPaths) {
      if (existsSync(p)) { makensisPath = p; break; }
    }
  }
  if (!makensisPath) {
    console.error('[post-build] makensis not found. Install NSIS: https://nsis.sourceforge.io/Download');
    process.exit(1);
  }
  console.log(`[post-build] Using makensis: ${makensisPath}`);

  // Step 2: Determine build source directory
  const appSubDir = join(buildRoot, appName);
  const buildSourceDir = existsSync(appSubDir) ? appSubDir : buildRoot;
  if (!existsSync(buildSourceDir)) {
    console.error('[post-build] Build directory not found:', buildSourceDir);
    console.error('[post-build] Run "electrobun build --env=stable" first');
    process.exit(1);
  }

  // Step 3: Place executables and DLLs from electrobun into bin/
  const electrobunDist = resolve('node_modules', 'electrobun', 'dist-win-x64');
  const binDir = join(buildSourceDir, 'bin');
  if (!existsSync(binDir)) mkdirSync(binDir, { recursive: true });

  const filesToCopy = [
    { src: 'bun.exe', dest: 'bun.exe' },
    { src: 'launcher.exe', dest: 'launcher.exe' },
    { src: 'libNativeWrapper.dll', dest: 'libNativeWrapper.dll' },
    { src: 'WebView2Loader.dll', dest: 'WebView2Loader.dll' },
    { src: 'd3dcompiler_47.dll', dest: 'd3dcompiler_47.dll' },
    { src: 'webgpu_dawn.dll', dest: 'webgpu_dawn.dll' },
  ];
  for (const { src, dest } of filesToCopy) {
    const srcPath = join(electrobunDist, src);
    const destPath = join(binDir, dest);
    if (existsSync(srcPath) && !existsSync(destPath)) {
      copyFileSync(srcPath, destPath);
      console.log(`[post-build] Placed ${dest}`);
    }
  }

  // Remove extensionless launcher/bun from electrobun build (causes confusion on Windows)
  for (const name of ['launcher', 'bun']) {
    const noExt = join(binDir, name);
    if (existsSync(noExt)) {
      unlinkSync(noExt);
      console.log(`[post-build] Removed extensionless ${name}`);
    }
  }

  // Copy icon to build root
  if (existsSync(iconSource)) {
    const iconDest = join(buildSourceDir, 'icon.ico');
    if (!existsSync(iconDest)) {
      copyFileSync(iconSource, iconDest);
      console.log('[post-build] Placed icon.ico');
    }
  }

  // Step 4: Decompress tar.zst in Resources (so launcher finds flat files)
  const resourcesDir = join(buildSourceDir, 'Resources');
  const appFolderPath = join(resourcesDir, 'app');
  if (existsSync(resourcesDir) && !existsSync(appFolderPath)) {
    const tarZstFile = readdirSync(resourcesDir).find(f => f.endsWith('.tar.zst'));
    if (tarZstFile) {
      const zstdExe = join(electrobunDist, 'zig-zstd.exe');
      const tarZstPath = join(resourcesDir, tarZstFile);
      const tarFile = tarZstFile.replace('.zst', '');
      const tarPath = join(resourcesDir, tarFile);

      try {
        console.log(`[post-build] Decompressing ${tarZstFile}...`);
        execSync(`"${zstdExe}" decompress -i "${tarZstPath}" -o "${tarPath}"`, { stdio: 'pipe' });
        console.log('[post-build] Extracting tar...');
        // Tar contains MarkBun/... — extract to parent of buildSourceDir so contents merge
        const extractDir = dirname(buildSourceDir);
        execSync(`tar -xf "${tarPath}" -C "${extractDir}"`, { stdio: 'pipe' });
        // Clean up
        if (existsSync(tarPath)) unlinkSync(tarPath);
        if (existsSync(tarZstPath)) unlinkSync(tarZstPath);
        console.log('[post-build] Decompressed and cleaned up archive');
      } catch (e: any) {
        console.warn('[post-build] Failed to decompress archive:', e.message);
      }
    }
  }

  // Step 5: Embed icons and version info into executables
  const launcherExePath = join(binDir, 'launcher.exe');
  if (existsSync(launcherExePath) && existsSync(iconSource)) {
    try {
      await rcedit(launcherExePath, {
        icon: iconSource,
        'product-version': appVersion,
        'file-version': appVersion,
        'version-string': {
          CompanyName: appAuthor,
          ProductName: appName,
          FileDescription: appName,
          InternalName: appName,
          OriginalFilename: `${appName}.exe`,
          LegalCopyright: `Copyright © ${new Date().getFullYear()} ${appAuthor}`,
        },
      });
      console.log('[post-build] Embedded icon and version info into launcher.exe');
    } catch (e: any) {
      console.warn('[post-build] Failed to embed resources into launcher.exe:', e.message);
    }
  }

  // Step 6: Calculate folder size for NSIS
  const getFolderSize = (dir: string): number => {
    let size = 0;
    for (const file of readdirSync(dir)) {
      const filePath = join(dir, file);
      const stats = statSync(filePath);
      size += stats.isDirectory() ? getFolderSize(filePath) : stats.size;
    }
    return size;
  };
  const totalSizeKB = Math.round(getFolderSize(buildSourceDir) / 1024);

  // Step 7: Generate NSIS script from template
  const templatePath = resolve('scripts', 'templates', 'installer.nsi.template');
  if (!existsSync(templatePath)) {
    console.error('[post-build] NSIS template not found:', templatePath);
    process.exit(1);
  }

  let nsiContent = readFileSync(templatePath, 'utf-8');
  const iconAbsPath = existsSync(iconSource) ? iconSource : '';
  const replacements: Record<string, string> = {
    '{{APP_NAME}}': appName,
    '{{APP_VERSION}}': appVersion,
    '{{PRODUCT_ID}}': appName,
    '{{EXE_NAME}}': `${appName}-setup.exe`,
    '{{INSTALL_DIR}}': appName,
    '{{PUBLISHER}}': appAuthor,
    '{{ICON_PATH}}': iconAbsPath,
    '{{ICON_FILENAME}}': 'icon.ico',
    '{{LANGUAGE_NAME}}': 'English',
    '{{BUILD_SOURCE_DIR}}': buildSourceDir,
    '{{ESTIMATED_SIZE}}': totalSizeKB.toString(),
  };
  for (const [key, value] of Object.entries(replacements)) {
    // @ts-ignore
    nsiContent = nsiContent.replaceAll(key, value);
  }

  if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true });
  const nsiPath = join(distDir, 'installer.nsi');
  // UTF-8 BOM for makensis to handle characters correctly
  writeFileSync(nsiPath, '\uFEFF' + nsiContent, 'utf-8');
  console.log('[post-build] Generated NSIS script:', nsiPath);

  // Step 8: Compile NSIS installer
  try {
    console.log('[post-build] Compiling NSIS installer...');
    execSync(`"${makensisPath}" "${nsiPath}"`, { stdio: 'inherit' });
    console.log('[post-build] NSIS installer compiled successfully');
  } catch (e: any) {
    console.error('[post-build] makensis failed');
    process.exit(1);
  }

  // Step 9: Copy installer to artifacts
  const setupExe = join(distDir, `${appName}-setup.exe`);
  const artifactDir = resolve('artifacts');
  if (existsSync(setupExe)) {
    if (!existsSync(artifactDir)) mkdirSync(artifactDir, { recursive: true });
    const artifactPath = join(artifactDir, `win-x64-${appName}-Setup.exe`);
    copyFileSync(setupExe, artifactPath);
    console.log(`[post-build] Copied installer to artifacts/win-x64-${appName}-Setup.exe`);
  } else {
    console.error('[post-build] Installer not found at', setupExe);
  }
}
