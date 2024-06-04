import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import {
  Code, Function, FunctionProps, Runtime,
} from 'aws-cdk-lib/aws-lambda';
import { Duration } from 'aws-cdk-lib';
import { githubActions } from './GithubActions';

/**
 * @param environment Optional: Environment variables for the Lambda function
 * @param memorySize Default 256: the amount of memory to allocate to the Lambda function
 * @param timeout Default 10 seconds: the amount of time the Lambda function has to run before it times out
 * @param handler Default 'src/lambda.handler': the name of the lambda handler function
 * @param functionProps Optional: If you need to specify any detailed properties for the Lambda function, you can do so here and they will override any defaults e.g. { runtime: Runtime.PYTHON_3_10 }
 */
export interface ZipFunctionProps {
  environment?: { [key: string]: string; },
  memorySize?: number,
  timeout?: Duration,
  handler?: string,
  functionProps?: Partial<FunctionProps>;
}

/**
 * A Lambda function packaged as a zip file.
 *
 * This construct automatically adds itself to the list of resources Github Actions needs to access.
 *
 * Pythion and Node runtinmes can be configured by calling ZipFunction.python(...) and ZipFunction.node(...)
 * These are supported by default as these seem to have the lowest cold start times.
 * If you would like a different runtime this can be set using the props parameter.
 *
 * Key settings are:
 *  - runtime: defaults to Runtime.NODEJS_18_X
 *  - handler: 'src/lambda.handler' - you'll need to make sure your zip package includes a file 'src/lambda.[js|py]' and contains a function named 'handler'
 *  - logRetention: default is logs.RetentionDays.TWO_YEARS
 *
 * @param scope Parent CDK construct (typically 'this')
 * @param id A name for this function
 */
export class ZipFunction extends Function {
  constructor(scope: Construct, id: string, props?: ZipFunctionProps) {
    super(scope, id, {
      environment: props?.environment,
      memorySize: props?.memorySize || 256,
      timeout: props?.timeout || Duration.seconds(30),
      description: id, // Provides something readable in the AWS console view
      runtime: Runtime.NODEJS_18_X,
      handler: props?.handler || 'src/lambda.handler',
      code: Code.fromInline('Placeholder code'), // Asset(path.join(__dirname, './lambda/python')),
      logRetention: logs.RetentionDays.TWO_YEARS,
      ...props?.functionProps,
    });
    githubActions(scope).addGhaLambda(id, this);
  }

  static node(scope: Construct, id: string, props?: ZipFunctionProps): ZipFunction {
    return new ZipFunction(scope, id, { ...props, functionProps: { runtime: Runtime.NODEJS_LATEST, ...props?.functionProps } });
  }

  static python(scope: Construct, id: string, props?: ZipFunctionProps): ZipFunction {
    return new ZipFunction(scope, id, { ...props, functionProps: { runtime: Runtime.PYTHON_3_12, ...props?.functionProps } });
  }
}
