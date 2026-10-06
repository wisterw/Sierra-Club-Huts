const EMAIL_FROM = 'noreply@tahoe-ski-huts.rsvp';

function mailMode(environment = process.env) {
  const mode = environment.MAIL_TRANSPORT ?? (environment.NODE_ENV === 'production' ? 'ses' : 'console');
  if (!['ses', 'console'].includes(mode)) throw new Error('MAIL_TRANSPORT must be ses or console.');
  if (environment.NODE_ENV === 'production' && mode === 'console') throw new Error('MAIL_TRANSPORT=console is unavailable in production.');
  return mode;
}

function createSesTransport(environment = process.env, options = {}) {
  if (mailMode(environment) !== 'ses') throw new Error('SES mail transport is required for sending contention alerts; console mode cannot send mail.');
  const { SendEmailCommand } = require('@aws-sdk/client-ses');
  const client = options.client || require('../../libs/ses.Client').sesClient;
  return { async sendMail(message) {
    const body = { Text: { Data: message.text, Charset: 'UTF-8' } };
    if (message.html !== undefined) body.Html = { Data: message.html, Charset: 'UTF-8' };
    try {
      const result = await client.send(new SendEmailCommand({
        Source: EMAIL_FROM, Destination: { ToAddresses: [message.to] },
        Message: { Subject: { Data: message.subject, Charset: 'UTF-8' }, Body: body },
      }));
      if (!result?.MessageId) throw Object.assign(new Error('SES acceptance could not be confirmed'), { ambiguous: true });
      return { messageId: result.MessageId, accepted: [message.to], rejected: [] };
    } catch (error) {
      // SES server errors can occur after acceptance. Only explicit client-side
      // service rejection (or credentials failing before sending) is definite.
      const status = error.$metadata?.httpStatusCode;
      if ((status >= 400 && status < 500) || error.name === 'CredentialsProviderError') error.definite = true;
      else error.ambiguous = true;
      throw error;
    }
  } };
}
// A timeout cannot prove that the provider did not accept the message.
async function sendAlertMail(transport, message, timeoutMs = 30000) {
  let timer;
  try {
    const info = await Promise.race([
      transport.sendMail(message),
      new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error('Mail outcome timed out'), { ambiguous: true })), timeoutMs); }),
    ]);
    if (info?.rejected?.some((email) => String(email).toLowerCase() === message.to.toLowerCase())) {
      throw Object.assign(new Error('Mail provider rejected recipient'), { definite: true });
    }
    if (!info || (!info.accepted?.some((email) => String(email).toLowerCase() === message.to.toLowerCase()) && !info.messageId)) {
      throw Object.assign(new Error('Mail acceptance could not be confirmed'), { ambiguous: true });
    }
    return info;
  } finally { clearTimeout(timer); }
}
module.exports = { EMAIL_FROM, mailMode, createSesTransport, sendAlertMail };
