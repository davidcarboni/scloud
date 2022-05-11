import { existsSync, readFileSync, writeFileSync } from 'fs';

function readSecrets(): string[] {
  const cdkOuputs = '../secrets/cdk-outputs.json';
  // const awsConfig = '~/.aws/credentials';
  if (existsSync(cdkOuputs)) {
    const json = readFileSync(cdkOuputs, 'utf8').trim();
    const outputs = JSON.parse(json);
    const stackKeys = Object.keys(outputs);
    if (stackKeys.length === 1) {
      const keys = outputs[stackKeys[0]];

      const repoNames: string[] = [];

      Object.keys(keys).forEach((key) => {
        if (key.startsWith('ecr')) repoNames.push(keys[key]);
      });

      return repoNames;
    }
    throw new Error('No output keys found from CDK');
  }
  throw new Error(`Couldn't find file ${cdkOuputs}`);
}

(async () => {
  console.log('Saving ECR repo names and URIs');
  try {
    const repoNames = readSecrets();

    const repoNameList = repoNames.join('\n');

    const script = `
    repositories=(
      ${repoNameList}
    )
    `;

    writeFileSync('../secrets/ecr-repos.sh', script);
  } catch (err) {
    console.error(err);
    throw err;
  }
})();
