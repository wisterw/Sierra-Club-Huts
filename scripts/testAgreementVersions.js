async function testAgreementVersions(apiBase) {
  const response = await fetch(`${apiBase}/agreements`);
  if (!response.ok) throw new Error('Could not load agreement metadata for test login.');
  const metadata = await response.json();
  return { termsOfUse: metadata.termsOfUse.version, privacyPolicy: metadata.privacyPolicy.version };
}

module.exports = { testAgreementVersions };
