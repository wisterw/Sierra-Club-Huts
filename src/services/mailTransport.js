const fs = require('fs');

function createRelayTransport(environment = process.env) {
  const relayPath = environment.MSMTP_PATH || '/usr/bin/msmtp';
  if (!fs.existsSync(relayPath)) throw new Error('Mail relay is not configured: MSMTP_PATH is unavailable.');
  return require('nodemailer').createTransport({
    sendmail: true, newline: 'unix', path: relayPath,
    args: ['-i', '-a', environment.MSMTP_ACCOUNT || 'mail_relay_credentials', '-C', environment.MSMTP_CONFIG || '/etc/msmtprc'],
  });
}
// A timeout cannot prove that the relay did not accept the message.
async function sendAlertMail(transport, message, timeoutMs = 30000) {
  let timer;
  try {
    const info = await Promise.race([
      transport.sendMail(message),
      new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error('Relay outcome timed out'), { ambiguous: true })), timeoutMs); }),
    ]);
    if (info?.rejected?.some((email) => String(email).toLowerCase() === message.to.toLowerCase())) {
      throw Object.assign(new Error('Relay rejected recipient'), { definite: true });
    }
    if (!info || (!info.accepted?.some((email) => String(email).toLowerCase() === message.to.toLowerCase()) && !info.messageId)) {
      throw Object.assign(new Error('Relay acceptance could not be confirmed'), { ambiguous: true });
    }
    return info;
  } catch (error) {
    if (/^Sendmail (exited with code|command not found)/.test(error.message) || error.responseCode >= 400) error.definite = true;
    throw error;
  } finally { clearTimeout(timer); }
}
module.exports = { createRelayTransport, sendAlertMail };
