# Based on: https://docs.aws.amazon.com/lambda/latest/dg/images-create.html#images-create-1


# Lint, test and bundle

FROM node:24-alpine as build

WORKDIR /build
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run lint
RUN npm run test
RUN npm run package


# Package

FROM amazon/aws-lambda-nodejs

# Store the current commit, if provided:
ARG COMMIT_HASH
ENV COMMIT_HASH=${COMMIT_HASH}

# Copy bundled handler (no node_modules needed — dependencies are bundled)
COPY --from=build /build/dist/lambda.js ./
COPY --from=build /build/dist/COMMIT_HASH ./

CMD [ "lambda.handler" ]
