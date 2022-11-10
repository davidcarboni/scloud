
npm i --save-dev \
  @types/node \
  @types/aws-lambda \
  @typescript-eslint/eslint-plugin \
  @typescript-eslint/parser \
  @types/lodash \
  eslint \
  eslint-config-airbnb-base  \
  eslint-plugin-import \
  eslint-import-resolver-typescript \
  --

npm i \
  @octokit/rest \
  tweetsodium \
  aws-lambda \
  lodash \
  --

#
# package.json:
#
#   "scripts": {
#    ...,
#    "lint": "eslint --fix --ext ts bin lib",
#    "secrets": "ts-node src/github/secrets.ts"
#
# find (regex): "\^?~?\d{1,3}\.\d{1,3}\.\d{1,3}"
# replace: "*" (except package version)
#
