import { Stack, StackProps } from 'aws-cdk-lib';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { queueLambda } from '../src/scloud/queueLambda';

export default class ProjectStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.slack();
  }

  /**
   * Infrastructure for metrics/event collection.
   */
  slack(): Queue {
    // Metric message handler
    const { queue } = queueLambda(this, 'slack', {
      SLACK_WEBHOOK: process.env.SLACK_WEBHOOK || '',
    });
    return queue;
  }
}
