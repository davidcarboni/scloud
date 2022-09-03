# CDK project setup suggestions

NB: See `dependencies.sh` for commands to install linter and libraries for interacting with Github

## SSO Configuration

If you're going to be using a SAML SSO configuration, here are the values you're going to need:

 * ACS URL: `https://auth.<zone name>/saml2/idpresponse`
 * Entity ID: `urn:amazon:cognito:sp:<user pool ID>`

## Install AWS CDK for Typescript

    npm install -g typescript aws-cdk

### Run in a clean environment (optional)

    docker run -it --rm --entrypoint bash node
    git config --global user.email "you@example.com"
    git config --global init.defaultBranch nain

## Initialise our project

    mkdir project && cd project
    cdk init app --language=typescript

Check the versions of any dependencies (e.g. `aws-cdk`) and either switch to `*` or make sure there's a `^` in front of them to avoid confusing errors that trace back to slightly mismatched dependencies.

## Configure linting

    npm install --save-dev \
      @typescript-eslint/eslint-plugin \
      @typescript-eslint/parser \
      eslint \
      eslint-config-airbnb-base \
      eslint-plugin-import

 You'll need to add an `!.eslintrc.js` line to the generated `.gitignore` file (at the time of writing it specifies to ignore `*.js`).

`.eslintrc.js`:

````
module.exports = {
  env: {
    es2021: true,
    node: true,
  },
  extends: [
    'airbnb-base',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
  },
  plugins: [
    '@typescript-eslint',
  ],
  rules: {
    'import/extensions': [
      'error',
      'ignorePackages',
      {
        js: 'never',
        ts: 'never',
      },
    ],
    quotes: [2, 'single', 'avoid-escape'],
    'no-new': 'off', // Because CDK likes to 'new' things
    'no-console': 'off', // Because we want to print some things out about the stack.
  },
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js', '.ts'],
      },
    },
  },
};
````

`package.json`

````
...
  "scripts": {
    ...,
    "lint": "eslint --fix --ext ts bin lib"
  },
...
````

Running `npm run lint` will likely give you the following errors for `project-stack.ts`:

  5:1  error  Prefer default export  import/prefer-default-export
  6:3  error  Useless constructor    no-useless-constructor

The former is resolved by adding `default` to line 5:

    export default class ProjectStack extends Stack {

The latter is resolved when you start building your stack. For now you can clear it with a `console.log()` if you want.

## Configure Typescript

You may want to make the following changes to the `compilerOptions` section of `tsconfig.json`:

 * Add `"outDir": "js"` to avoid generating .js files in amongst your Typescript source
 * Add `"esModuleInterop": true` - hard to say why but it occasionally seems to help

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template
