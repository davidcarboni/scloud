import * as cdk from 'aws-cdk-lib';
import { StackProps } from 'aws-cdk-lib';
import { HostedZone, IHostedZone } from 'aws-cdk-lib/aws-route53';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { webApp } from '../src/scloud/cloudfront';
import { CognitoConstructs, cognitoPool } from '../src/scloud/cognito';
import { queueLambda } from '../src/scloud/queueLambda';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export default class SalondcStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const slackQueue = this.slack();

    const zone = HostedZone.fromHostedZoneId(this, 'zone', '...');

    const cognito = this.cognito(zone);

    this.web(zone, cognito, slackQueue);
  }

  /**
   * Component to send Slack messages.
   */
  slack(): Queue {
    const { queue } = queueLambda(this, 'slack', {
      SLACK_WEBHOOK: process.env.SLACK_WEBHOOK || '',
    });
    return queue;
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
      lambda, // api, bucket, distribution,
    } = webApp(this, 'web', zone, {
      SIGNIN_URL: cognito.signInUrl || '',
      SLACK_QUEUE: slackQueue.queueUrl,
    });

    slackQueue.grantSendMessages(lambda);
  }
}
