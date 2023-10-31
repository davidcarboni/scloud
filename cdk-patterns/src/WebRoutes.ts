import { Construct } from 'constructs';
import { Stack } from 'aws-cdk-lib';
import { DnsValidatedCertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { RestApiOrigin, S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import {
  AllowedMethods, CachePolicy, Distribution,
  OriginAccessIdentity,
  OriginRequestPolicy,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import {
  AuthorizationType, CognitoUserPoolsAuthorizer, CorsOptions, LambdaRestApi, LambdaRestApiProps,
} from 'aws-cdk-lib/aws-apigateway';
import { Code, Function } from 'aws-cdk-lib/aws-lambda';
import { UserPool } from 'aws-cdk-lib/aws-cognito';
import { ARecord, IHostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { PrivateBucket } from './PrivateBucket';
import { githubActions } from './GithubActions';
import { RedirectWww } from './RedirectWww';
import { ZipFunction, ZipFunctionProps } from './ZipFunction';

/**
 * @param zone The DNS zone for this web app. By default the domain name is set to the zone name
 * The type IHostedZone enables lookup of the zone (IHostedZone) as well as a zone creatd in the stack (HostedZone)
 * @param domain Optional: by default the zone name will be used as the DNS name for the Cloudfront distribution (e.g. 'example.com') but you can specify a different domain here (e.g. 'subdomain.example.com').
 * @param defaultIndex Default: true. Maps a viewer request for '/' to a request for /index.html.
 * @param wwwRedirect Default: true. Redirects requests for www. to the bare domain name, e.g. www.example.com->example.com, www.sub.example.com->sub.example.com.
 */
export interface WebRoutesProps {
  zone: IHostedZone,
  domainName?: string,
  defaultIndex?: boolean,
  redirectWww?: boolean,
}

/**
 * Builds a web application, backed by Lambda functions that serve specific routes (https://github.com/cdk-patterns/serverless/blob/main/the-lambda-trilogy/README.md)
 *
 * NB This will create an s3 bucket to serve static content and the bucket will be automatically deleted, including all contents, when this construct is deleted, on the basis the contents are assumed to be produced by a CI build.
 *
 * This construct can also be used for a Web API.
 *
 * NB us-east-1 is required for Cloudfront certificates:
 * https://docs.aws.amazon.com/cdk/api/v1/docs/aws-cloudfront-readme.html
 *
 */
export class WebRoutes extends Construct {
  lambda: Function;

  bucket: Bucket;

  distribution: Distribution;

  certificate: DnsValidatedCertificate;

  routes: { [pathPattern: string]: Function; } = {};

  origins: { [id: string]: RestApiOrigin; } = {};

  apis: { [id: string]: LambdaRestApi; } = {};

  cognitoPool: UserPool;

  authorizer: CognitoUserPoolsAuthorizer;

  constructor(
    scope: Construct,
    id: string,
    props: WebRoutesProps,
  ) {
    super(scope, id);

    const domainName = props.domainName || props.zone.zoneName;

    // We consider the objects in the bucket to be expendable because
    // they're most likely static content we generate from source code (rather than user data).
    this.bucket = PrivateBucket.expendable(scope, `${id}Static`);
    githubActions(scope).addGhaBucket(id, this.bucket);

    // Permissions to access the bucket from Cloudfront
    const originAccessIdentity = new OriginAccessIdentity(scope, `${id}OAI`, {
      comment: 'Access to static bucket',
    });
    this.bucket.grantRead(originAccessIdentity);

    this.certificate = new DnsValidatedCertificate(scope, `${id}Certificate`, {
      domainName,
      hostedZone: props.zone,
      region: 'us-east-1',
      subjectAlternativeNames: props.redirectWww !== false ? [`www.${domainName}`] : undefined,
    });

    this.distribution = new Distribution(scope, `${id}Distribution`, {
      domainNames: [domainName],
      comment: domainName,
      defaultRootObject: props.defaultIndex === false ? undefined : 'index.html',
      defaultBehavior: {
        // All requests that aren't known to the API go to s3.
        // This serves static content and also handles spam traffic.
        // There are lots of probes for Wordpress installations so this largely avoids invoking lambdas in response to those.
        origin: new S3Origin(this.bucket, { originAccessIdentity }),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      certificate: this.certificate,
    });
    githubActions(scope).addGhaDistribution(id, this.distribution);

    // DNS record for the distribution
    new ARecord(scope, `${id}ARecord`, {
      zone: props.zone,
      recordName: domainName,
      target: RecordTarget.fromAlias(new CloudFrontTarget(this.distribution)),
    });

    if (props.redirectWww !== false) {
      // Redirect www -> zone root
      new RedirectWww(scope, id, { zone: props.zone, certificate: this.certificate });
    }
  }

  /**
   * Add multiple routes to the web app.
   *
   * NB AWS has a soft limit of 25 origins per distribution.
   * If you need more than this you'll need to request a quota increate wia the AWS console.
   */
  addRoutes(routes: { [path: string]: Function; }) {
    Object.keys(routes).forEach((pathPattern) => {
      this.addRoute(pathPattern, routes[pathPattern]);
    });
  }

  /**
   * Add a route to the web app.
   *
   * NB AWS has a soft limit of 25 origins per distribution.
   * If you need more than this you'll need to request a quota increate wia the AWS console.
   */
  addRoute(pathPattern: string, handler: Function, corsPreflightOptions: CorsOptions = { allowOrigins: ['*'] }) {
    // Look for an existing origin for this handler.
    // This is useful if you need to map several path patterns to the same lambda, perhaps while refactoring an application.
    // AWS has a limit on the number of origins per distribution so this helps us keep within that limit.
    let origin = this.origins[handler.node.id];

    // Create a new origin if we don't have one already
    if (!origin) {
      let lambdaRestApiProps: LambdaRestApiProps = {
        restApiName: `${Stack.of(this).stackName}-${handler.node.id}`,
        handler,
        proxy: true,
        description: `${Stack.of(this).stackName} ${handler.node.id}-${pathPattern}`,
        defaultCorsPreflightOptions: corsPreflightOptions,
      };

      // Add a Cognito authorizer, if configured
      if (this.authorizer) {
        lambdaRestApiProps = {
          ...lambdaRestApiProps,
          defaultMethodOptions: {
            authorizationType: AuthorizationType.COGNITO,
            authorizer: this.authorizer,
          },
        };
      }

      // Create the API gateway
      const api = new LambdaRestApi(this, `${handler.node.id}Handler`, lambdaRestApiProps);
      this.apis[handler.node.id] = api;

      // Create an origin for the Cloudfront distribution
      origin = new RestApiOrigin(api);
      this.origins[handler.node.id] = origin;
    }

    // TODO add a secret so only Cludfront can access APIg?
    // Add the route (pathPattern) to the distribution
    this.distribution.addBehavior(
      pathPattern,
      origin,
      {
        allowedMethods: AllowedMethods.ALLOW_ALL,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: CachePolicy.CACHING_DISABLED, // Assume dynamic content
        originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      },
    );
    this.routes[pathPattern] = handler;
  }

  /**
   * Not yet implemented!
   */
  addAuthorizer(cognitoPool: UserPool) {
    this.cognitoPool = cognitoPool;

    this.authorizer = new CognitoUserPoolsAuthorizer(this, 'auth', {
      cognitoUserPools: [cognitoPool],
    });
    // lambdaRestApiProps = {
    //   ...lambdaRestApiProps,
    //   defaultMethodOptions: {
    //     authorizationType: AuthorizationType.COGNITO,
    //     authorizer,
    //   },
    // };

    throw new Error('Not yet implemented');
  }

  /**
   * Builds a WebRoutes construct with multiple routes, based on a set of pre-built Lambda functions.
   *
   * This is useful if your routes use different runtimes, environment variables an/or function properties.
   *
   * @param defaultIndex Default: false. Maps a viewer request for '/' to a request for /index.html.
   * @param redirectWww Default: true. Redirects requests for www. to the bare domain name, e.g. www.example.com->example.com, www.subdomain.example.com->subdomain.example.com.
   */
  static routes(
    scope: Construct,
    id: string,
    routes: { [pathPattern: string]: Function; },
    zone: IHostedZone,
    domainName?: string,
    defaultIndex: boolean = false,
    redirectWww: boolean = true,
  ): WebRoutes {
    const webRoutes = new WebRoutes(scope, id, {
      zone, domainName, defaultIndex, redirectWww,
    });
    Object.keys(routes).forEach((pathPattern) => {
      webRoutes.addRoute(pathPattern, routes[pathPattern]);
    });
    return webRoutes;
  }

  /**
   * Builds a WebRoutes construct with a uniform set of Node Lambdas that will be instantiated for you
   *
   * Lanbda functions will be accessible via WebRoutes.routes
   *
   * Memory defaults to 3008 MB because this has the effest of assigning more compute resource and therefore reduces latency
   *
   * @param defaultIndex Default: false. Maps a viewer request for '/' to a request for /index.html.
   * @param redirectWww Default: true. Redirects requests for www. to the bare domain name, e.g. www.example.com->example.com, www.subdomain.example.com->subdomain.example.com.
   */
  static node(
    scope: Construct,
    id: string,
    routes: { [key: string]: { code?: Code, environment?: { [key: string]: string; }; }; },
    zone: IHostedZone,
    domainName?: string,
    defaultIndex: boolean = false,
    redirectWww: boolean = true,
    functionProps: ZipFunctionProps = {},
  ): WebRoutes {
    const webRoutes = new WebRoutes(scope, id, {
      zone, domainName, defaultIndex, redirectWww,
    });
    Object.keys(routes).forEach((pathPattern) => {
      const { code, environment } = routes[pathPattern];
      const lambda = ZipFunction.node(scope, id, {
        ...functionProps,
        functionProps: {
          code, environment, memorySize: 3008, ...functionProps?.functionProps,
        },
      });
      webRoutes.addRoute(pathPattern, lambda);
    });
    return webRoutes;
  }

  /**
   * Builds a WebRoutes construct with a uniform set of Python Lambdas that will be instantiated for you
   *
   * Lanbda functions will be accessible via WebRoutes.routes
   *
   * Memory defaults to 3008 MB because this has the effest of assigning more compute resource and therefore reduces latency
   *
   * @param defaultIndex Default: false. Maps a viewer request for '/' to a request for /index.html.
   * @param redirectWww Default: true. Redirects requests for www. to the bare domain name, e.g. www.example.com->example.com, www.subdomain.example.com->subdomain.example.com.
   */
  static python(
    scope: Construct,
    id: string,
    routes: { [key: string]: { code?: Code, environment?: { [key: string]: string; }; }; },
    zone: IHostedZone,
    domainName?: string,
    defaultIndex: boolean = false,
    redirectWww: boolean = true,
    functionProps: ZipFunctionProps = {},
  ): WebRoutes {
    const webRoutes = new WebRoutes(scope, id, {
      zone, domainName, defaultIndex, redirectWww,
    });
    Object.keys(routes).forEach((pathPattern) => {
      const { code, environment } = routes[pathPattern];
      const lambda = ZipFunction.node(scope, id, {
        ...functionProps,
        functionProps: {
          code, environment, memorySize: 3008, ...functionProps?.functionProps,
        },
      });
      webRoutes.addRoute(pathPattern, lambda);
    });
    return webRoutes;
  }
}
