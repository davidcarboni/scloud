# Based on: https://docs.aws.amazon.com/lambda/latest/dg/images-create.html#images-create-1


# Lint and test

FROM node:lts-alpine as build

WORKDIR /build
ADD . .

RUN npm install
RUN npm run lint
RUN npm run test
RUN npm run compile


# Package

FROM amazon/aws-lambda-nodejs as package

# Store the current commit, if provided:
ARG COMMIT_HASH
ENV COMMIT_HASH=${COMMIT_HASH}

# Copy in compiled JS and install dependencies
COPY --from=build /build/js/* /build/package*.json ./
RUN npm ci

CMD [ "lambda.handler" ]