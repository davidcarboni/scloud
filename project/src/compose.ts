import * as fs from 'fs';

function readSecrets(): { [key: string]: string; } {
  const cdkOuputs = '../secrets/cdk-outputs.json';

  if (fs.existsSync(cdkOuputs)) {
    const json = fs.readFileSync(cdkOuputs, 'utf8').trim();
    const outputs = JSON.parse(json);
    const stackKeys = Object.keys(outputs);
    if (stackKeys.length === 1) {
      const keys = outputs[stackKeys[0]];

      // Compose environment
      return {
        DOMAIN: keys.Domain,
        USER_POOL_ID: keys.DevelopmentUserPoolId,
        USER_POOL_DOMAIN: keys.DevelopmentUserPoolDomain,
        USER_POOL_CLIENT_ID: keys.DevelopmentUserPoolClientId,
        REDIRECT_URL: keys.DevelopmentUserPoolClientRedirectUrl,
        SIGN_IN_URL: keys.DevelopmentUserPoolClientSignInUrl,
        SIGN_OUT_URL: keys.DevelopmentUserPoolClientSignOutUrl,
        AWS_PROFILE: 'carboni', // Use the right credentials when connecting from local dev
      };
    }
    throw new Error('No output from CDK');
  }
  throw new Error(`Couldn't find file ${cdkOuputs}`);
}

(async () => {
  // Parse the input json
  const compose = readSecrets();

  // Compose environment
  console.log('Writing Compose environment file');
  let content = '';
  Object.keys(compose).forEach((key) => {
    content += `${key}=${compose[key]}\n`;
  });
  try {
    fs.writeFileSync('../docker-compose.env', content);
  } catch (err) {
    console.error(err);
  }
})();
