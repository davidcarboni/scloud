# Based on: https://docs.aws.amazon.com/lambda/latest/dg/images-create.html#images-create-1


# Lint and test

FROM node:alpine as build

WORKDIR /build
ADD . .

# dependencies
RUN npm ci

# verify
RUN npm run lint
RUN npm run test

# build
RUN npm run compile


# Package

FROM amazon/aws-lambda-nodejs as package
RUN npm install -g npm  # Trying to fix "npm ERR! fsevents not accessible from chokidar"

# Store the current commit, if provided:
ARG COMMIT_HASH
ENV COMMIT_HASH=${COMMIT_HASH}

# Copy in compiled JS and install dependencies
COPY --from=build /build/dist/* /build/package*.json ${LAMBDA_TASK_ROOT}/
RUN npm ci --production

CMD [ "src/lambda.handler" ]
