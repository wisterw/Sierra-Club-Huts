const assert = require('assert');
const fs = require('fs');
const path = require('path');

const appJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');
const styles = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'styles.css'), 'utf8');

const expectedSections = [
  'application-settings',
  'manage-volunteers',
  'review-waivers',
  'download-requests',
  'efficiency-report',
  'setup-work-parties',
];

for (const section of expectedSections) {
  assert(appJs.includes(`id: '${section}'`), `expected admin section ${section}`);
  assert(appJs.includes(`data-admin-panel="${section}"`), `expected panel for ${section}`);
}

assert(appJs.includes("adminSection: 'application-settings'"), 'expected Application settings default section');
assert(appJs.includes("if (!state.me?.Admin)"), 'expected admin-only render guard');
assert(appJs.includes("data-admin-section"), 'expected admin-local section navigation');
assert(appJs.includes('Run Assignment Lottery'), 'expected lottery controls in Application settings');
assert(appJs.includes('id="app-mode"'), 'expected season mode selector');
assert(appJs.includes('id="download-joined"'), 'expected joined download action');
assert(appJs.includes('id="load-efficiency"'), 'expected efficiency report action');
assert(appJs.includes('renderAdminPlaceholder'), 'expected future workflow placeholders');

assert(styles.includes('.admin-console'), 'expected admin console styles');
assert(styles.includes('.admin-nav button.active'), 'expected active admin nav style');
assert(styles.includes('.admin-placeholder'), 'expected placeholder styles');
assert(styles.includes('@media (max-width: 620px)'), 'expected mobile-width admin navigation handling');
assert(styles.includes('flex: 1 1 180px'), 'expected wrapped mobile buttons with stable width');

console.log('admin console organization test passed.');
