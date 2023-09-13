import { RemovalPolicy, Stack } from 'aws-cdk-lib';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

/**
 * Builds a LogGroup with a default two year .
 * @param stack Parent CDK stack
 * @param category Used to build up the logGroupName: /stackName/categpry/name
 * @param name Name (and base for an ID) for the logGroup
 * @param retention Defaults to RetentionDays.TWO_YEARS
 */
export class LogGroupTwoYears extends LogGroup {
  constructor(scope: Construct, id: string, category: string, retention: RetentionDays = RetentionDays.TWO_YEARS) {
    super(scope, `${id}LogGroup`, {
      // Ensure the log group is deleted when the stack is deleted
      // and that logs aren't retained indefinitely
      logGroupName: `/${Stack.of(scope).stackName}/${category}/${id}`,
      removalPolicy: RemovalPolicy.DESTROY,
      retention,
    });
  }
}
