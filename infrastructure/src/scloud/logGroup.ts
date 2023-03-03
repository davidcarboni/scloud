import { RemovalPolicy, Stack } from 'aws-cdk-lib';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';

/**
 * Builds a LogGroup.
 * @param stack Parent CDK stack
 * @param category Used to build up the logGroupName: /stackName/categpry/name
 * @param name Name (and base for an ID) for the logGroup
 * @param retention Defaults to RetentionDays.ONE_MONTH
 */
export default function logGroup(
  stack: Stack,
  category: string,
  name: string,
  retention: RetentionDays = RetentionDays.EIGHTEEN_MONTHS,
) : LogGroup {
  return new LogGroup(stack, `${name}LogGroup`, {
  // Ensure the log group is deleted when the stack is deleted
  // and that logs aren't retained indefinitely
    logGroupName: `/${stack.stackName}/ecs/${name}`,
    removalPolicy: RemovalPolicy.DESTROY,
    retention,
  });
}
