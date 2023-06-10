import * as cdk from 'aws-cdk-lib';
import { RemovalPolicy, StackProps } from 'aws-cdk-lib';
import { HostedZone, IHostedZone } from 'aws-cdk-lib/aws-route53';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Function } from 'aws-cdk-lib/aws-lambda';
import {
  webApp, CognitoConstructs, cognitoPool, ghaUser, queueLambda, apiGateway,
} from '@scloud/cdk-patterns';

const name = 'project';
const domainName = 'example.com';

function env(variableName: string): string {
  const value = process.env[variableName];
  if (value) return value;
  throw new Error(`Missing environment variable: ${variableName}`);
}
export default class ProjectStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const zone = HostedZone.fromHostedZoneAttributes(this, 'zone', {
      zoneName: domainName,
      hostedZoneId: '...',
    });

    const slackQueue = this.slack();
    const metricsQueue = this.metrics(slackQueue);
    this.accelerate(zone, metricsQueue, slackQueue);

    const cognito = this.cognito(zone);

    this.web(zone, cognito, slackQueue);

    ghaUser(this);
  }

  /**
   * Infrastructure for metrics/event collection.
   */
  slack(): Queue {
    // Metric message handler
    const { queue } = queueLambda(this, 'slack', {
      SLACK_WEBHOOK: env('SLACK_WEBHOOK'),
    });
    return queue;
  }

  /**
   * Infrastructure for metrics/event collection.
   */
  metrics(slackQueue: Queue): Queue {
    const metric = 'metric';
    const dateSort = 'dateSort';
    const ttl = 'ttl';

    // Metrics storage
    const table = new Table(this, 'metrics', {
      partitionKey: { name: metric, type: AttributeType.STRING },
      sortKey: { name: dateSort, type: AttributeType.STRING },
      timeToLiveAttribute: ttl,
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Metric message handler
    const { lambda, queue } = queueLambda(this, 'metrics', {
      PRODUCT: name,
      COMPONENT: 'metrics',
      STORAGE_TABLE: table.tableName,
      PARTITION_KEY: metric,
      SORT_KEY: dateSort,
      TTL_ATTRIBUTE: ttl,
      SLACK_QUEUE_URL: slackQueue.queueUrl,
    });

    table.grantWriteData(lambda);
    slackQueue.grantSendMessages(lambda);

    return queue;
  }

  accelerate(zone: IHostedZone, metricsQueue: Queue, slackQueue: Queue): Function {
    const environment = {
      PRODUCT: name,
      COMPONENT: 'accelerate',
      METRICS_QUEUE_URL: metricsQueue.queueUrl,
      SLACK_QUEUE_URL: slackQueue.queueUrl,
      WEBHOOK_SECRET: env('WEBHOOK_SECRET'),
    };
    const { lambda } = apiGateway(this, 'accelerate', zone, environment, `accelerate.${zone.zoneName}`);
    metricsQueue.grantSendMessages(lambda);
    slackQueue.grantSendMessages(lambda);

    return lambda;
  }

  cognito(zone: IHostedZone): CognitoConstructs {
    return cognitoPool(
      this,
      'cognito',
      `https://${zone.zoneName}/auth-callback`,
      {
        enableEmail: true,
      // facebookAppId: '...',
      // facebookAppSecret: '...',
      // googleClientId: '...',
      // googleClientSecret: '...',
      },
      zone,
    );
  }

  web(zone: IHostedZone, cognito: CognitoConstructs, slackQueue: Queue) {
    const {
      lambda, // api, distribution,
    } = webApp(this, 'web', zone, {
      PRODUCT: name,
      COMPONENT: 'web',
      SIGNIN_URL: cognito.signInUrl || '',
      SLACK_QUEUE: slackQueue.queueUrl,
    });

    slackQueue.grantSendMessages(lambda);
  }
}
