#!/usr/bin/env node
/* Preflight check for the local Android SDK install.
 *
 * cordova-android 15 shells out to `apkanalyzer` (from cmdline-tools) during
 * the build to read the manifest's target SDK, and to `adb` (from
 * platform-tools) for `cordova run android`. Both have to be on PATH for
 * those commands to succeed. A fresh Android Studio install on Windows
 * frequently has neither -- "Android SDK Command-line Tools (latest)" is
 * not selected by default -- so the build dies with the unhelpful message:
 *
 *   Android SDK is missing cmdline-tools directory.
 *   'apkanalyzer' is not recognized as an internal or external command...
 *
 * This script catches that case before cordova runs and prints actionable,
 * OS-aware fix instructions instead.
 */
'use strict';

const fs   = require('node:fs');
const os   = require('node:os');
const path = require('node:path');

const IS_WINDOWS = process.platform === 'win32';
const EXE = IS_WINDOWS ? '.exe' : '';
const BAT = IS_WINDOWS ? '.bat' : '';

function resolveSdkRoot() {
  const candidates = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT];
  if (IS_WINDOWS && process.env.LOCALAPPDATA) {
    candidates.push(path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk'));
    candidates.push(path.join(process.env.LOCALAPPDATA, 'Android', 'sdk'));
  } else if (process.platform === 'darwin') {
    candidates.push(path.join(os.homedir(), 'Library', 'Android', 'sdk'));
  } else {
    candidates.push(path.join(os.homedir(), 'Android', 'Sdk'));
  }
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return null;
}

function exists(p) {
  try { return fs.existsSync(p); } catch (_) { return false; }
}

function findCmdlineToolsBin(sdkRoot) {
  // Modern layout: cmdline-tools/<channel>/bin (typically "latest").
  const ctRoot = path.join(sdkRoot, 'cmdline-tools');
  if (!exists(ctRoot)) return null;
  let entries;
  try { entries = fs.readdirSync(ctRoot); } catch (_) { return null; }
  // Prefer "latest", else the highest-versioned channel that has bin/.
  const order = entries
    .filter(e => exists(path.join(ctRoot, e, 'bin')))
    .sort((a, b) => (a === 'latest' ? -1 : b === 'latest' ? 1 : a.localeCompare(b)));
  if (!order.length) return null;
  return path.join(ctRoot, order[0], 'bin');
}

function findBuildTools(sdkRoot) {
  const root = path.join(sdkRoot, 'build-tools');
  if (!exists(root)) return [];
  try {
    return fs.readdirSync(root).filter(e => exists(path.join(root, e)));
  } catch (_) { return []; }
}

function bullet(s) { return '  - ' + s; }

(function main() {
  const problems = [];
  const sdkRoot = resolveSdkRoot();

  if (!sdkRoot) {
    problems.push(
      'ANDROID_HOME / ANDROID_SDK_ROOT is not set and no SDK was found at the default location.',
      bullet('Install Android Studio and let it download the SDK, or install the standalone command-line tools.'),
      bullet(IS_WINDOWS
        ? 'Then set ANDROID_HOME to e.g. C:\\Users\\<you>\\AppData\\Local\\Android\\Sdk (System Properties -> Environment Variables).'
        : 'Then export ANDROID_HOME in your shell profile (e.g. ~/.zshrc or ~/.bashrc).')
    );
  } else {
    console.log('check-android-sdk: using SDK at', sdkRoot);

    const ctBin = findCmdlineToolsBin(sdkRoot);
    if (!ctBin) {
      problems.push(
        `Missing "${path.join('cmdline-tools', 'latest', 'bin')}" under ${sdkRoot}.`,
        bullet('cordova-android needs `apkanalyzer` from this directory to read the APK manifest at build time.'),
        bullet('Install via Android Studio: Settings -> Languages & Frameworks -> Android SDK -> SDK Tools -> check "Android SDK Command-line Tools (latest)" -> Apply.'),
        bullet('Or via sdkmanager (if you already have an older cmdline-tools install):'),
        bullet('    sdkmanager "cmdline-tools;latest" "platform-tools" "platforms;android-35" "build-tools;35.0.0"')
      );
    } else {
      const apkAnalyzer = path.join(ctBin, 'apkanalyzer' + BAT);
      if (!exists(apkAnalyzer)) {
        problems.push(`Found cmdline-tools at ${ctBin} but apkanalyzer${BAT} is missing -- the install looks incomplete.`);
      }
    }

    const adb = path.join(sdkRoot, 'platform-tools', 'adb' + EXE);
    if (!exists(adb)) {
      problems.push(
        `Missing "platform-tools/adb${EXE}" under ${sdkRoot}.`,
        bullet('`cordova run android` and ad-hoc `adb install app-debug.apk` both need this.'),
        bullet('Install via Android Studio SDK Manager (SDK Tools tab -> "Android SDK Platform-Tools") or `sdkmanager "platform-tools"`.')
      );
    }

    const platforms = path.join(sdkRoot, 'platforms', 'android-35');
    if (!exists(platforms)) {
      problems.push(
        `Missing "platforms/android-35" under ${sdkRoot}.`,
        bullet('Install with: sdkmanager "platforms;android-35"')
      );
    }

    const bts = findBuildTools(sdkRoot);
    if (!bts.some(v => v.startsWith('35.'))) {
      problems.push(
        `Missing "build-tools/35.x" under ${sdkRoot} (found: ${bts.join(', ') || 'none'}).`,
        bullet('Install with: sdkmanager "build-tools;35.0.0"')
      );
    }
  }

  if (!problems.length) {
    console.log('check-android-sdk: OK');
    return;
  }

  console.error('');
  console.error('check-android-sdk: local Android SDK is not ready for a Cordova build:');
  console.error('');
  for (const line of problems) console.error(line);
  console.error('');
  if (IS_WINDOWS) {
    console.error('After installing, make sure these are on PATH (System Properties -> Environment Variables -> Path):');
    console.error(bullet('%ANDROID_HOME%\\cmdline-tools\\latest\\bin'));
    console.error(bullet('%ANDROID_HOME%\\platform-tools'));
    console.error('Then open a NEW terminal so PATH changes take effect.');
  } else {
    console.error('After installing, add these to PATH in your shell profile:');
    console.error(bullet('$ANDROID_HOME/cmdline-tools/latest/bin'));
    console.error(bullet('$ANDROID_HOME/platform-tools'));
  }
  console.error('');
  process.exit(1);
})();
