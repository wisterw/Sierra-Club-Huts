const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const { PROJECT_ROOT } = require('../config');

const AGREEMENT_DEFINITIONS = {
  termsOfUse: { title: 'Terms of Use', path: '/terms-of-use', file: 'TERMS OF USE.md' },
  privacyPolicy: { title: 'Privacy Policy', path: '/privacy-policy', file: 'PRIVACY POLICY.md' },
};

function normalizeDocument(content) {
  return content.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

function loadAgreementDocuments(directory = path.join(PROJECT_ROOT, 'openspec', 'specs')) {
  return Object.fromEntries(Object.entries(AGREEMENT_DEFINITIONS).map(([kind, definition]) => {
    let content;
    try {
      content = normalizeDocument(fs.readFileSync(path.join(directory, definition.file), 'utf8'));
    } catch (error) {
      throw new Error(`Cannot load agreement document ${definition.file}: ${error.message}`);
    }
    const lastUpdated = content.match(/^Last Updated:\s*(.+)$/m)?.[1]?.trim();
    if (!content.trim() || !lastUpdated) throw new Error(`Agreement document ${definition.file} must include content and Last Updated.`);
    return [kind, { kind, title: definition.title, path: definition.path, content, lastUpdated, version: createHash('sha256').update(content).digest('hex') }];
  }));
}

// Pages, API metadata, and acknowledgement all refer to this immutable startup snapshot.
const documents = loadAgreementDocuments();

function agreementMetadata(snapshot = documents) {
  return Object.fromEntries(Object.entries(snapshot).map(([kind, document]) => [kind, {
    title: document.title, path: document.path, lastUpdated: document.lastUpdated, version: document.version,
  }]));
}

function currentAgreementVersions() {
  return Object.fromEntries(Object.entries(documents).map(([kind, document]) => [kind, document.version]));
}

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderAgreementPage(document) {
  const lines = document.content.trim().split('\n');
  const title = escapeHtml(lines.shift());
  let inList = false;
  let body = `<h1>${title}</h1>`;
  for (const line of lines) {
    if (!line.trim()) continue;
    const bullet = line.match(/^\s*•\s*(.*)$/);
    if (bullet) {
      if (!inList) body += '<ul>';
      inList = true;
      body += `<li>${escapeHtml(bullet[1])}</li>`;
    } else {
      if (inList) body += '</ul>';
      inList = false;
      const tag = /^\d+\.\s/.test(line) ? 'h2' : 'p';
      body += `<${tag}>${escapeHtml(line)}</${tag}>`;
    }
  }
  if (inList) body += '</ul>';
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(document.title)} | Sierra Club Ski Huts</title><link rel="stylesheet" href="/css/styles.css"></head><body><div class="app-shell legal-shell"><header class="app-header"><a href="/">Sierra Club Ski Huts</a></header><main class="panel legal-document">${body}</main><footer class="app-footer"><a href="/">Return to the app</a></footer></div></body></html>`;
}

module.exports = { documents, agreementMetadata, currentAgreementVersions, loadAgreementDocuments, normalizeDocument, renderAgreementPage };
