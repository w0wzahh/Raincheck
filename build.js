#!/usr/bin/env node
/**
 * RainCheck Build Script
 * Obfuscates JS, minifies CSS & HTML, copies assets to dist/
 */

const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');
const CleanCSS = require('clean-css');
const { minify: minifyHTML } = require('html-minifier-terser');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');

// Clean dist
if (fs.existsSync(DIST)) {
    fs.rmSync(DIST, { recursive: true, force: true });
}
fs.mkdirSync(DIST, { recursive: true });

// ── 1. Obfuscate JavaScript ──
console.log('[BUILD] Obfuscating script.js...');
const jsSource = fs.readFileSync(path.join(ROOT, 'script.js'), 'utf8');
const obfuscated = JavaScriptObfuscator.obfuscate(jsSource, {
    // Medium-high obfuscation with good performance balance
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.75,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.15,
    debugProtection: true,
    debugProtectionInterval: 2000,
    disableConsoleOutput: false, // We want our warning to show
    domainLock: ['.netlify.app', '.raincheck.', 'localhost'],
    domainLockRedirectUrl: 'about:blank',
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: true,
    renameGlobals: false,
    selfDefending: true,
    simplify: true,
    splitStrings: true,
    splitStringsChunkLength: 8,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayCallsTransformThreshold: 0.6,
    stringArrayEncoding: ['base64', 'rc4'],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 3,
    stringArrayWrappersChainedCalls: true,
    stringArrayWrappersParametersMaxCount: 4,
    stringArrayWrappersType: 'function',
    stringArrayThreshold: 0.8,
    target: 'browser',
    transformObjectKeys: true,
    unicodeEscapeSequence: false
});
fs.writeFileSync(path.join(DIST, 'script.js'), obfuscated.getObfuscatedCode());
console.log('[BUILD] script.js obfuscated.');

// ── 2. Obfuscate Service Worker ──
console.log('[BUILD] Obfuscating sw.js...');
const swSource = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const swObf = JavaScriptObfuscator.obfuscate(swSource, {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.5,
    debugProtection: false,
    identifierNamesGenerator: 'hexadecimal',
    numbersToExpressions: true,
    selfDefending: false, // SW runs in worker scope, selfDefending can break it
    simplify: true,
    splitStrings: true,
    splitStringsChunkLength: 10,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayThreshold: 0.75,
    target: 'browser',
    unicodeEscapeSequence: false
});
fs.writeFileSync(path.join(DIST, 'sw.js'), swObf.getObfuscatedCode());
console.log('[BUILD] sw.js obfuscated.');

// ── 3. Minify CSS ──
console.log('[BUILD] Minifying styles.css...');
const cssSource = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
const cssResult = new CleanCSS({
    level: 2,
    compatibility: '*'
}).minify(cssSource);
if (cssResult.errors.length > 0) {
    console.error('[BUILD] CSS errors:', cssResult.errors);
    process.exit(1);
}
fs.writeFileSync(path.join(DIST, 'styles.css'), cssResult.styles);
console.log('[BUILD] styles.css minified.');

// ── 4. Minify HTML ──
console.log('[BUILD] Minifying index.html...');
const htmlSource = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
(async () => {
    const minifiedHTML = await minifyHTML(htmlSource, {
        collapseWhitespace: true,
        removeComments: true,
        removeRedundantAttributes: true,
        removeScriptTypeAttributes: true,
        removeStyleLinkTypeAttributes: true,
        minifyCSS: true,
        minifyJS: false, // Inline JS is minimal, don't break it
        useShortDoctype: true,
        sortAttributes: true,
        sortClassName: true
    });
    fs.writeFileSync(path.join(DIST, 'index.html'), minifiedHTML);
    console.log('[BUILD] index.html minified.');

    // ── 5. Copy static assets ──
    console.log('[BUILD] Copying static assets...');

    // manifest.json
    fs.copyFileSync(path.join(ROOT, 'manifest.json'), path.join(DIST, 'manifest.json'));

    // icons/
    const iconsDir = path.join(ROOT, 'icons');
    const distIcons = path.join(DIST, 'icons');
    fs.mkdirSync(distIcons, { recursive: true });
    for (const file of fs.readdirSync(iconsDir)) {
        fs.copyFileSync(path.join(iconsDir, file), path.join(distIcons, file));
    }

    // .well-known/
    const wellKnownDir = path.join(ROOT, '.well-known');
    if (fs.existsSync(wellKnownDir)) {
        const distWellKnown = path.join(DIST, '.well-known');
        fs.mkdirSync(distWellKnown, { recursive: true });
        for (const file of fs.readdirSync(wellKnownDir)) {
            fs.copyFileSync(path.join(wellKnownDir, file), path.join(distWellKnown, file));
        }
    }

    // README.md — not needed in dist, skip it
    console.log('[BUILD] ✅ Build complete! Output in dist/');

    // Print sizes
    const origJS = Buffer.byteLength(jsSource);
    const obfJS = fs.statSync(path.join(DIST, 'script.js')).size;
    const origCSS = Buffer.byteLength(cssSource);
    const minCSS = fs.statSync(path.join(DIST, 'styles.css')).size;
    const origHTML = Buffer.byteLength(htmlSource);
    const minHTML = fs.statSync(path.join(DIST, 'index.html')).size;

    console.log(`\n[SIZE] script.js:  ${(origJS/1024).toFixed(1)}KB → ${(obfJS/1024).toFixed(1)}KB`);
    console.log(`[SIZE] styles.css: ${(origCSS/1024).toFixed(1)}KB → ${(minCSS/1024).toFixed(1)}KB`);
    console.log(`[SIZE] index.html: ${(origHTML/1024).toFixed(1)}KB → ${(minHTML/1024).toFixed(1)}KB`);
})();
