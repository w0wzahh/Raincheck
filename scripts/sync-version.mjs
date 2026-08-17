import { readFileSync, writeFileSync } from 'node:fs';

const version = readFileSync('VERSION', 'utf8').trim();
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  throw new Error(`Invalid VERSION '${version}'. Expected MAJOR.MINOR.PATCH.`);
}

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
pkg.version = version;
pkg.description = `RainCheck V${version}: refined glanceable weather widget, adaptive layouts and resilient mobile weather sync.`;
writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');

const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
lock.version = version;
if (lock.packages?.['']) lock.packages[''].version = version;
writeFileSync('package-lock.json', JSON.stringify(lock, null, 2) + '\n');

const configPath = 'src/core/config.js';
let config = readFileSync(configPath, 'utf8');
config = config.replace(/export const APP_VERSION = '[^']+';/, `export const APP_VERSION = '${version}';`);
writeFileSync(configPath, config);

console.log(`Version metadata synchronized to RainCheck V${version}.`);
