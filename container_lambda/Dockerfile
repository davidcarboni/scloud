# Based on: https://docs.aws.amazon.com/lambda/latest/dg/images-create.html#images-create-1


# Lint, test and bundle

FROM node:24-alpine as build

WORKDIR /build
COPY lambda-bundle ./lambda-bundle
COPY container_lambda ./container_lambda

WORKDIR /build/container_lambda
RUN npm install
RUN npm run lint
RUN npm run test
RUN npm run package


# Package

FROM amazon/aws-lambda-nodejs

# Store the current commit, if provided:
ARG COMMIT_HASH
ENV COMMIT_HASH=${COMMIT_HASH}

# Copy bundled handler (no node_modules needed — dependencies are bundled)
COPY --from=build /build/container_lambda/dist/lambda.js ./
COPY --from=build /build/container_lambda/dist/COMMIT_HASH ./

CMD [ "lambda.handler" ]
