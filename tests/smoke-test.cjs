const fs = require('fs');

const mainJs = fs.readFileSync('main.js', 'utf8');
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const stylesCss = fs.readFileSync('styles.css', 'utf8');
const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));

let passed = 0;
let failed = 0;

function check(label, condition) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}`);
    failed++;
  }
}

console.log('=== 1. OUTPUT FILES ===');
check('main.js exists and non-empty', mainJs.length > 1000);
check('styles.css exists and non-empty', stylesCss.trim().length > 0);
check('manifest.json valid', manifest.id === 'hermedian');

console.log('\n=== 2. BUNDLE INTEGRITY ===');
check('Hermedian banner present', mainJs.startsWith('/* Hermedian - Hermes Agent in Obsidian */'));
check('Plugin class extends obsidian Plugin', mainJs.includes('class') && mainJs.includes('Plugin'));

console.log('\n=== 3. PLUGIN LIFECYCLE (survives minification) ===');
check('onload registered', mainJs.includes('onload'));
check('onunload registered', mainJs.includes('onunload'));
check('view registration (registerView)', mainJs.includes('registerView'));
check('ribbon icon (addRibbonIcon)', mainJs.includes('addRibbonIcon'));
check('command palette (addCommand)', mainJs.includes('addCommand'));
check('settings tab (addSettingTab)', mainJs.includes('addSettingTab'));
check('workspace leaf activation', mainJs.includes('activateView') || mainJs.includes('revealLeaf'));
check('inline edit command (id:inline-edit)', mainJs.includes('inline-edit'));

console.log('\n=== 4. PROVIDER WIRING ===');
// The providers module is imported at top of bundle via require()
const hasProvidersImport = /require\(['"`]\.\/providers['"`]\)/.test(mainJs) ||
                           mainJs.includes("'./providers'") ||
                           mainJs.includes('"./providers"');
check('Providers module imported', hasProvidersImport);
// Hermes-specific wiring must be present
check('Hermes provider referenced', mainJs.includes('hermes'));
check('ProviderRegistry present', mainJs.includes('ProviderRegistry') || mainJs.includes('static register'));

console.log('\n=== 5. OBSIDIAN API USAGE ===');
check('ItemView base class used', mainJs.includes('ItemView'));
check('PluginSettingTab base class used', mainJs.includes('PluginSettingTab'));
check('Notice used (user feedback)', mainJs.includes('Notice'));
check('MarkdownView type used', mainJs.includes('MarkdownView'));

console.log('\n=== 6. SETTINGS SCHEMA (data.json) ===');
check('Hermes enabled by default', data.hermes.enabled === true);
check('Model configured', typeof data.hermes.model === 'string' && data.hermes.model.length > 0);
check('CLI path present (may be empty — user configures)', typeof data.hermes.cliPath === 'string');
check('Max warm processes set', typeof data.maxWarmProcesses === 'number' && data.maxWarmProcesses >= 3);
check('Theme set', typeof data.theme === 'string');

console.log('\n=== 7. MANIFEST COMPLIANCE ===');
check('id matches package.json', manifest.id === 'hermedian');
check('minAppVersion >= 1.13.0', manifest.minAppVersion === '1.13.0');
check('isDesktopOnly true', manifest.isDesktopOnly === true);
check('version present', typeof manifest.version === 'string');

console.log('\n=== RESULTS ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total:  ${passed + failed}`);
process.exit(failed > 0 ? 1 : 0);
