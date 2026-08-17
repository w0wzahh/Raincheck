import { readFileSync } from 'node:fs';

const files = {
  version: readFileSync('VERSION', 'utf8').trim(),
  config: readFileSync('src/core/config.js', 'utf8'),
  pkg: JSON.parse(readFileSync('package.json', 'utf8')),
  index: readFileSync('index.html', 'utf8'),
  activity: readFileSync('android/app/src/main/java/com/w0wzahh/raincheck/MainActivity.java', 'utf8'),
  plugin: readFileSync('android/app/src/main/java/com/w0wzahh/raincheck/RainCheckWidgetPlugin.java', 'utf8'),
  app: readFileSync('src/app.js', 'utf8'),
  gradle: readFileSync('android/app/build.gradle', 'utf8'),
};

const version = files.version;
const checks = [
  [files.config.includes(`APP_VERSION = '${version}'`), 'VERSION matches src/core/config.js'],
  [files.pkg.version === version, 'VERSION matches package.json'],
  [files.index.includes(`src/app.js?v=${version}`), 'index.html uses current cache-buster'],
  [files.activity.includes('registerPlugin(RainCheckWidgetPlugin.class);'), 'Android manually registers RainCheckWidget'],
  [files.plugin.includes('@CapacitorPlugin(name = "RainCheckWidget")'), 'native plugin name matches JS name'],
  [files.plugin.includes('public void updateWidget(PluginCall call)'), 'native updateWidget method exists'],
  [files.plugin.includes('public void getWidgetState(PluginCall call)'), 'native diagnostic method exists'],
  [files.app.includes('NativeCapacitor.Plugins?.RainCheckWidget'), 'JS resolves the native plugin from Capacitor.Plugins'],
  [files.gradle.includes('versionName appVersion') && files.gradle.includes('versionCode appVersionCode'), 'Android versionName/versionCode derive from VERSION'],
  [files.gradle.includes('output.outputFileName = "Raincheck.apk"'), 'release APK output is Raincheck.apk'],
  [files.plugin.includes('effectiveTheme'), 'native widget diagnostic exposes effective theme'],
  [files.activity.includes('registerPlugin(RainCheckWidgetPlugin.class);'), 'Android plugin registration remains explicit'],
  [files.app.includes('prefers-color-scheme: dark'), 'Automatic theme follows system color scheme'],
  [!files.activity.includes('super.onCreate(savedInstanceState);\n        registerPlugin'), 'plugin registration happens before BridgeActivity initialization'],
];

let failed = false;
for (const [ok, label] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
console.log(`RainCheck ${version} release verification passed.`);
