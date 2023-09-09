import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import {
  Code, Function, FunctionProps, Runtime,
} from 'aws-cdk-lib/aws-lambda';
import { addGhaLambda } from './ghaUser';

export class ZipFunction extends Function {
  /**
   * A Lambda function packaged as a zip file.
   *
   * Pythion and Node runtinmes can be configured by calling ZipFunction.python(...) and ZipFunction.node(...)
   * These are supported by default as these seem to have the lowest cold start times.
   * If you would like a different runtime this can be set using the props parameter.
   *
   * Key settings are:
   *  - runtime: defaults to Runtime.NODEJS_18_X
   *  - handler: 'src/lambda.handler' - you'll need to make sure your zip package includes a file 'src/lambda.[js|py]' containing a function named 'handler'
   *  - logRetention: default is logs.RetentionDays.TWO_YEARS
   * @param scope Parent CDK construct (typically 'this')
   * @param id A name for this function
   * @param environment Environment variables for the Lambda function
   * @param lambdaProps Override properties for the Lambda function. you may want to pass e.g. { runtime: Runtime.PYTHON_3_10 }
   */
  constructor(scope: Construct, id: string, environment?: { [key: string]: string; }, props?: Partial<FunctionProps>) {
    super(scope, id, {
      description: id, // Provides something readable in the AWS console view
      runtime: Runtime.NODEJS_18_X,
      handler: 'src/lambda.handler',
      code: Code.fromInline('Placeholder code'), // Asset(path.join(__dirname, './lambda/python')),
      logRetention: logs.RetentionDays.TWO_YEARS,
      environment,
      ...props,
    });
    addGhaLambda(scope, id, this);
  }

  static node(scope: Construct, id: string, environment?: { [key: string]: string; }, props?: Partial<FunctionProps>): ZipFunction {
    return new ZipFunction(scope, id, environment, { ...props, runtime: Runtime.NODEJS_18_X });
  }

  static python(scope: Construct, id: string, environment?: { [key: string]: string; }, props?: Partial<FunctionProps>): ZipFunction {
    return new ZipFunction(scope, id, environment, { ...props, runtime: Runtime.PYTHON_3_10 });
  }
}
