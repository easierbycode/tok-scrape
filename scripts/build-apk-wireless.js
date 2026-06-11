#!/usr/bin/env node
'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const APP_ROOT = process.cwd();
const IS_WINDOWS = process.platform === 'win32';
const ADB_PORT = process.env.ADB_PORT || '5555';
const APK_ROOT = path.join(APP_ROOT, 'platforms', 'android', 'app', 'build', 'outputs', 'apk');

function fail(message) {
  console.error(`build-apk-wireless: ${message}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const label = [command].concat(args).join(' ');
  console.log(`build-apk-wireless: ${label}`);
  const result = childProcess.spawnSync(command, args, {
    cwd: APP_ROOT,
    env: process.env,
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    shell: IS_WINDOWS,
  });

  if (result.error) fail(`${label} failed: ${result.error.message}`);
  if (result.status !== 0) {
    if (options.capture) {
      if (result.stdout) process.stdout.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
    }
    fail(`${label} exited with status ${result.status}`);
  }

  return result.stdout || '';
}

function pathOnPath(name) {
  const searchPath = process.env.PATH || process.env.Path || '';
  const exts = IS_WINDOWS
    ? (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean)
    : [''];

  for (const dir of searchPath.split(path.delimiter).filter(Boolean)) {
    for (const ext of exts) {
      const candidate = path.join(dir, name + ext);
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  return null;
}

function resolveAdb() {
  if (process.env.ADB) return process.env.ADB;

  const fromPath = pathOnPath('adb');
  if (fromPath) return fromPath;

  const sdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (sdkRoot) {
    const candidate = path.join(sdkRoot, 'platform-tools', `adb${IS_WINDOWS ? '.exe' : ''}`);
    if (fs.existsSync(candidate)) return candidate;
  }

  fail('adb was not found. Add Android SDK platform-tools to PATH, or set ADB=/path/to/adb.');
}

function normalizeTarget(value) {
  if (!value) return '';
  const target = value.trim();
  if (!target) return '';
  return target.includes(':') ? target : `${target}:${ADB_PORT}`;
}

function configuredTarget() {
  return normalizeTarget(
    process.env.ADB_TARGET ||
    process.env.ADB_DEVICE ||
    process.env.WIRELESS_ADB_TARGET ||
    process.env.WIRELESS_ADB_DEVICE ||
    process.env.WIRELESS_ADB_HOST ||
    process.env.ADB_HOST
  );
}

function parseDevices(output) {
  return output
    .split(/\r?\n/)
    .slice(1)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const parts = line.split(/\s+/);
      return { serial: parts[0], state: parts[1] || '' };
    });
}

function listDevices(adb) {
  return parseDevices(run(adb, ['devices'], { capture: true }));
}

function isWirelessSerial(serial) {
  return /^(?:\[[^\]]+\]|[^:\s]+):\d+$/.test(serial);
}

function assertDeviceReady(adb, serial) {
  const state = run(adb, ['-s', serial, 'get-state'], { capture: true }).trim();
  if (state !== 'device') {
    fail(`wireless ADB target ${serial} is not ready (state: ${state || 'unknown'}).`);
  }
}

function ensureWirelessDevice(adb) {
  const target = configuredTarget();
  if (target) {
    run(adb, ['connect', target]);
    assertDeviceReady(adb, target);
    return target;
  }

  if (process.env.ANDROID_SERIAL && isWirelessSerial(process.env.ANDROID_SERIAL)) {
    assertDeviceReady(adb, process.env.ANDROID_SERIAL);
    return process.env.ANDROID_SERIAL;
  }

  const wirelessDevices = listDevices(adb)
    .filter(device => device.state === 'device' && isWirelessSerial(device.serial));

  if (wirelessDevices.length === 1) return wirelessDevices[0].serial;

  if (wirelessDevices.length > 1) {
    fail(
      `multiple wireless devices are connected (${wirelessDevices.map(d => d.serial).join(', ')}). ` +
      'Set ADB_TARGET=<ip:port> or ANDROID_SERIAL=<ip:port>.'
    );
  }

  fail(
    'no wireless ADB device is connected. Run `adb connect <phone-ip>:5555`, or run this script with ' +
    '`ADB_TARGET=<phone-ip[:port]> npm run build:apk:wireless`.'
  );
}

function findApks(dir) {
  if (!fs.existsSync(dir)) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const apks = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      apks.push(...findApks(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.apk')) {
      apks.push(fullPath);
    }
  }
  return apks;
}

function findNewestApk() {
  const debugApks = findApks(path.join(APK_ROOT, 'debug'));
  const apks = debugApks.length ? debugApks : findApks(APK_ROOT);
  if (!apks.length) fail(`no APK found under ${APK_ROOT}`);

  return apks
    .map(file => ({ file, mtimeMs: fs.statSync(file).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0].file;
}

function installFlags() {
  const raw = process.env.ADB_INSTALL_FLAGS || '-r';
  return raw.split(/\s+/).filter(Boolean);
}

(function main() {
  const adb = resolveAdb();
  const serial = ensureWirelessDevice(adb);

  run('cordova', ['build', 'android', '--debug']);

  const apk = findNewestApk();
  console.log(`build-apk-wireless: APK ${path.relative(APP_ROOT, apk)}`);

  run(adb, ['-s', serial, 'install', ...installFlags(), apk]);

  console.log(`build-apk-wireless: installed ${path.basename(apk)} to ${serial}`);
})();
