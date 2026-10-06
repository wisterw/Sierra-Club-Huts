const { SESClient } = require('@aws-sdk/client-ses');

// Set the AWS Region.
const REGION = "us-east-2"; // ohio

// Credentials are automatically resolved using the AWS SDK credential provider chain.
// For more information, see https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/setting-credentials-node.html
// Create SES service object.
const sesClient = new SESClient({ region: REGION, maxAttempts: 1 });
module.exports = { sesClient };
