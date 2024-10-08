import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53patterns from 'aws-cdk-lib/aws-route53-patterns';
import {
  Duration, Stack,
} from 'aws-cdk-lib';
import { DnsValidatedCertificate, ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { RestApiOrigin, S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import {
  AllowedMethods, BehaviorOptions, CachePolicy, Distribution,
  OriginRequestCookieBehavior,
  OriginRequestHeaderBehavior,
  OriginRequestPolicy,
  OriginRequestQueryStringBehavior,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import {
  AuthorizationType, CognitoUserPoolsAuthorizer, LambdaRestApi, LambdaRestApiProps,
} from 'aws-cdk-lib/aws-apigateway';
import { Function, FunctionProps } from 'aws-cdk-lib/aws-lambda';
import { UserPool } from 'aws-cdk-lib/aws-cognito';
import { ZipFunction } from '../ZipFunction';
import { addGhaBucket, addGhaDistribution } from './ghaUserDeprecated';
import { privateBucket } from './bucket';

// Disabled for now as routing "*.*" to s3 may handle most of what we need to junk:
// export const junkPaths: string[] = ['/wp-includes/*', '/wp-admin*', '*.xml', '*.php', '*.aspx', '*.env', '/.git*', '/.remote*', '/.production*', '/.local*'];
/**
 * @deprecated Use RedirectWww instead
 */
export function redirectWww(
  construct: Construct,
  name: string,
  zone: route53.IHostedZone,
  certificate?: ICertificate,
  domain?: string,
) {
  const domainName = domain || `${zone.zoneName}`;

  new route53patterns.HttpsRedirect(construct, `${name}WwwRedirect`, {
    targetDomain: domainName,
    recordNames: [`www.${domainName}`],
    zone,
    certificate: certificate || new DnsValidatedCertificate(construct, `${name}WwwCertificate`, {
      domainName: `www.${domainName}`,
      hostedZone: zone,
      // this is required for Cloudfront certificates:
      // https://docs.aws.amazon.com/cdk/api/v1/docs/aws-cloudfront-readme.html
      region: 'us-east-1',
    }),
  });
}

/**
 * @deprecated Use WebApp instead
 *
 * Builds a dynamic web application, backed by a Lambda function.
 * @param stack The CDK stack. The name of the stack will be included in the API Gateway description to aid readability/identification in the AWS console.
 * @param name The name for the web app. This will infulence naming for Cloudfront, API Gateway, Lambda and the static bucket.
 * @param zone The DNS zone for this web app.
 * @param environment Any environment variables your lambda will need to handle requests.
 * @param domain Optional: by default the zone apex will be mapped to the Cloudfront distribution (e.g. 'example.com') but yo ucan specify a subdomain here (e.g. 'subdomain.example.com').
 * @param lambdaProps Optional: if you need to modify the properties of the Lambda function, you can use this parameter.
 * @param headers Optional: any headers you want passed through Cloudfront in addition to the defaults of User-Agent and Referer
 * @param defaultIndex Default: true. Maps a viewer request for '/' to a request for /index.html.
 * @param wwwRedirect Default: true. Redirects www requests to the bare domain name, e.g. www.example.com->example.com, www.sub.example.com->sub.example.com.
 * @returns
 */
export function webApp(
  stack: Stack,
  name: string,
  zone: route53.IHostedZone,
  environment?: { [key: string]: string; },
  domain?: string,
  lambdaProps?: Partial<FunctionProps>,
  headers?: string[],
  defaultIndex: boolean = true,
  wwwRedirect: boolean = true,
  autoDeleteObjects: boolean = true,
): { lambda: Function, api: LambdaRestApi, bucket: Bucket, distribution: Distribution; } {
  const domainName = domain || `${zone.zoneName}`;

  // Static content
  const bucket = privateBucket(stack, `${name}Static`, { autoDeleteObjects });
  addGhaBucket(stack, name, bucket);

  // Permissions to access the bucket from Cloudfront
  const originAccessIdentity = new cloudfront.OriginAccessIdentity(stack, `${name}OAI`, {
    comment: 'Access to static bucket',
  });
  bucket.grantRead(originAccessIdentity);

  // Web app handler - default values can be overridden using lambdaProps
  const lambda = new ZipFunction(stack, name, {
    functionProps: {
      environment, memorySize: 3008, timeout: Duration.seconds(10), ...lambdaProps,
    },
  });

  const api = new LambdaRestApi(stack, `${name}ApiGateway`, {
    handler: lambda,
    proxy: true,
    description: `${stack.stackName} ${name}`,
    binaryMediaTypes: ['multipart/form-data'],
  });

  const staticBehavior = {
    origin: new S3Origin(bucket),
    allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
    viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    compress: true,
  };

  const certificate = new DnsValidatedCertificate(stack, `${name}Certificate`, {
    domainName,
    subjectAlternativeNames: [`www.${domainName}`],
    hostedZone: zone,
    region: 'us-east-1',
  });

  const distribution = new Distribution(stack, `${name}Distribution`, {
    domainNames: [domainName],
    comment: domainName,
    defaultRootObject: defaultIndex ? 'index.html' : undefined,
    defaultBehavior: {
      origin: new RestApiOrigin(api),
      //   , {
      //   customHeaders: { host: '' },
      // }),
      allowedMethods: AllowedMethods.ALLOW_ALL,
      viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      compress: true,
      cachePolicy: CachePolicy.CACHING_DISABLED,
      // https://stackoverflow.com/questions/71367982/cloudfront-gives-403-when-origin-request-policy-include-all-headers-querystri
      // OriginRequestHeaderBehavior.all() gives an error so just cookie, user-agent, referer
      originRequestPolicy: new OriginRequestPolicy(stack, `${name}OriginRequestPolicy`, {
        headerBehavior: OriginRequestHeaderBehavior.allowList(...['user-agent', 'User-Agent', 'Referer', 'referer'].concat(headers || [])),
        cookieBehavior: OriginRequestCookieBehavior.all(),
        queryStringBehavior: OriginRequestQueryStringBehavior.all(),
      }),
      // originRequestPolicy: OriginRequestPolicy.USER_AGENT_REFERER_HEADERS,
      // edgeLambdas: [{
      //   functionVersion: headerFilter.currentVersion,
      //   eventType: cloudfront.LambdaEdgeEventType.ORIGIN_REQUEST,
      // }],
    },
    additionalBehaviors: {
      '*.*': staticBehavior, // All requests for something with a file extension (actually, any path that contains a period. The aim is to route *.css, *.js, *.jpeg, etc)
      // index.html direct from s3 for latency on / route? // '/': staticBehaviour'
    },
    certificate,
  });
  addGhaDistribution(stack, name, distribution);

  // Disabled for now as routing "*.*" to s3 may handle most of what we need to junk:
  // // Handle junk requests by routing to the static bucket
  // // so they don't invoke Lambda
  // const junkOptions = {
  //   allowedMethods: AllowedMethods.ALLOW_ALL,
  //   viewerProtocolPolicy: ViewerProtocolPolicy.ALLOW_ALL,
  // };
  // junkPaths.forEach((path) => distribution.addBehavior(path, new S3Origin(bucket), junkOptions));

  new route53.ARecord(stack, `${name}ARecord`, {
    recordName: domainName,
    target: route53.RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
    zone,
  });

  if (wwwRedirect) redirectWww(stack, name, zone, certificate);

  return {
    lambda, api, bucket, distribution,
  };
}

/**
 * @deprecated Use WebRoutes instead
 *
 * Builds a dynamic web application, backed by Lambda functions that serve specific routes.
 * By default a single Lambda is generated that responds to the / route.
 * Alternatively you can pass a mapping of routes to functions
 * (or map to undedfined, which means functions will be generated for you)
 * @param stack The CDK stack. The name of the stack will be included in the API Gateway description to aid readability/identification in the AWS console.
 * @param name The name for the web app. This will infulence naming for Cloudfront, API Gateway, Lambda and the static bucket.
 * @param zone The DNS zone for this web app.
 * @param routes The set of routes you would like to be handled by Lambda functions. Functions can be undefined (meaning theu will be generated for you). You can optionally request specific headers (deafult: User-Agent and Referer) to be passed through Cloudfront
 * @param domain Optional: by default the zone apex will be mapped to the Cloudfront distribution (e.g. 'example.com') but yo ucan specify a subdomain here (e.g. 'subdomain.example.com').
 * @param defaultIndex Default: true. Maps a viewer request for '/' to a request for /index.html.
 * @param wwwRedirect Default: true. Redirects www requests to the bare domain name, e.g. www.example.com->example.com, www.sub.example.com->sub.example.com.
 * @returns
 */
export function webAppRoutes(
  stack: Stack,
  name: string,
  zone: route53.IHostedZone,
  routes: { [pathPattern: string]: Function | undefined; } = { '/': undefined },
  domain: string | undefined = undefined,
  cognitoPool: UserPool | undefined = undefined,
  defaultIndex: boolean = true,
  wwwRedirect: boolean = true,
  autoDeleteObjects: boolean = true,
): { lambdas: { [path: string]: Function; }, bucket: Bucket, distribution: Distribution; } {
  const domainName = domain || `${zone.zoneName}`;

  // We consider the objects in the static bucket to be expendable because
  // they're static content we generate (rather than user data).
  const bucket = privateBucket(stack, `${name}Static`, { autoDeleteObjects });
  addGhaBucket(stack, name, bucket);

  // Permissions to access the bucket from Cloudfront
  const originAccessIdentity = new cloudfront.OriginAccessIdentity(stack, `${name}OAI`, {
    comment: 'Access to static bucket',
  });
  bucket.grantRead(originAccessIdentity);

  // Cloudfromt distribution - handle static requests
  // TODO add a secret so only Cludfront can access APIg
  const distribution = new Distribution(stack, `${name}Distribution`, {
    domainNames: [domainName],
    comment: domainName,
    defaultRootObject: defaultIndex ? 'index.html' : undefined,
    defaultBehavior: {
      // Request bin: default is to deflect all requests that aren't known to the API - mostly scripts probing for Wordpress installations
      origin: new S3Origin(bucket, { originAccessIdentity }),
      allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS, // Minimal methods - do we need Options?
      viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      cachePolicy: CachePolicy.CACHING_OPTIMIZED,
    },
    certificate: new DnsValidatedCertificate(stack, `${name}Certificate`, {
      domainName,
      hostedZone: zone,
      region: 'us-east-1',
    }),
  });
  new route53.ARecord(stack, `${name}ARecord`, {
    recordName: domainName,
    target: route53.RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
    zone,
  });

  // Handle API paths
  const lambdas: { [path: string]: Function; } = {};
  // Allowed headers:
  // https://stackoverflow.com/questions/71367982/cloudfront-gives-403-when-origin-request-policy-include-all-headers-querystri
  // OriginRequestHeaderBehavior.all() gives an error so just cookie, user-agent, referer
  // const originRequestPolicy = new OriginRequestPolicy(stack, `${name}OriginRequestPolicy`, {
  //   headerBehavior: OriginRequestHeaderBehavior.allowList(...allowedHeaders, 'user-agent', 'User-Agent', 'Referer', 'referer'),
  //   cookieBehavior: OriginRequestCookieBehavior.all(),
  //   queryStringBehavior: OriginRequestQueryStringBehavior.all(),
  // });

  // At some point we cah probably move to:
  // OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER
  // It's in the docs, but not showing up in code: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudfront.OriginRequestPolicy.html#static-all_viewer_except_host_header
  // (seems like it's not available yet? This seems like an old issue though: https://github.com/aws/aws-cdk/issues/24552)
  const originRequestPolicy = cloudfront.OriginRequestPolicy.fromOriginRequestPolicyId(stack, `${name}AllViewerExceptHostHeader`, 'b689b0a8-53d0-40ab-baf2-68738e2966ac');

  // const cachePolicy = new CachePolicy(stack, 'cache', {
  //   ...CachePolicy.CACHING_DISABLED,
  //   cookieBehavior: cloudfront.CacheCookieBehavior.all(),
  //   headerBehavior: cloudfront.CacheHeaderBehavior.allowList(...headers, ...allowedHeaders, 'Authorization'),
  //   queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
  // });
  const originMap: { [functionName: string]: RestApiOrigin; } = {};
  Object.keys(routes).forEach((pathPattern) => {
    // Use the provided function, or generate a default one:
    const lambda = routes[pathPattern] || new ZipFunction(stack, name, { functionProps: { memorySize: 3008 } });
    let origin = originMap[lambda.functionName];

    if (!origin) {
      let lambdaRestApiProps: LambdaRestApiProps = {
        handler: lambda,
        proxy: true,
        description: `${stack.stackName} ${name}-${pathPattern}`,
      };

      if (cognitoPool) {
        const authorizer = new CognitoUserPoolsAuthorizer(stack, 'auth', {
          cognitoUserPools: [cognitoPool],
        });
        lambdaRestApiProps = {
          ...lambdaRestApiProps,
          defaultMethodOptions: {
            authorizationType: AuthorizationType.COGNITO,
            authorizer,
          },
        };
      }

      const api = new LambdaRestApi(stack, `${name}${pathPattern}`, lambdaRestApiProps);

      origin = new RestApiOrigin(api);
      originMap[lambda.functionName] = origin;
    }
    distribution.addBehavior(
      pathPattern,
      origin,
      {
        allowedMethods: AllowedMethods.ALLOW_ALL,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        compress: true,
        cachePolicy: CachePolicy.CACHING_DISABLED,
        // https://stackoverflow.com/questions/71367982/cloudfront-gives-403-when-origin-request-policy-include-all-headers-querystri
        // OriginRequestHeaderBehavior.all() gives an error so just cookie, user-agent, referer
        originRequestPolicy,
      },
    );
    lambdas[pathPattern] = lambda;
  });
  addGhaDistribution(stack, name, distribution);

  // Redirect www -> zone root
  if (wwwRedirect) {
    new route53patterns.HttpsRedirect(stack, `${name}WwwRedirect`, {
      recordNames: [`www.${domainName}`],
      targetDomain: domainName,
      zone,
      certificate: new DnsValidatedCertificate(stack, `${name}CertificateWww`, {
        domainName: `www.${domainName}`,
        hostedZone: zone,
        region: 'us-east-1',
      }),
    });
  }

  return { lambdas, bucket, distribution };
}

/**
 * @deprecated Use WebFrontend instead
 *
 * A Cloudfront distribution backed by an s3 bucket.
 * NB us-east-1 is required for Cloudfront certificates:
 * https://docs.aws.amazon.com/cdk/api/v1/docs/aws-cloudfront-readme.html
 * @param construct Parent CDK construct (typically 'this')
 * @param zone DNS zone to use for the distribution - default the zone name will be used as the DNS name.
 * @param name The domain name for the distribution (and name for associated resources)
 * @param defaultBehavior By default an s3 bucket will be created, but this parameter can override that default behavior (sic.)
 * @param wwwRedirect whether a www. subdomain should be created to redirect to the main domain
 * @returns The distribution and (if created) static bucket
 */
export function cloudFront(
  stack: Stack,
  name: string,
  zone: route53.IHostedZone,
  defaultBehavior?: BehaviorOptions,
  domain: string | undefined = undefined,
  defaultIndex: boolean = true,
  wwwRedirect: boolean = true,
  autoDeleteObjects: boolean = true,
  // initialPass: boolean,
  // environment?: { [key: string]: string; },
  // apiDomain?: string,
): {
  bucket?: Bucket,
  distribution: Distribution,
} {
  const domainName = domain || zone.zoneName;

  let behavior;
  let bucket;
  if (defaultBehavior) {
    behavior = defaultBehavior;
  } else {
    // Default: Cloudfont -> bucket on domain name
    // We consider the objects in the static bucket to be expendable because
    // they're static content we generate (rather than user data).
    bucket = privateBucket(stack, `${name}Static`, { autoDeleteObjects });
    addGhaBucket(stack, name, bucket);

    // Permissions to access the bucket from Cloudfront
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(stack, `${name}OAI`, {
      comment: 'Access to static bucket',
    });

    bucket.grantRead(originAccessIdentity);
    behavior = {
      origin: new origins.S3Origin(bucket),
      allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
      viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      compress: true,
    };
  }

  const distribution = new cloudfront.Distribution(stack, `${name}Distribution`, {
    domainNames: [domainName],
    comment: domainName,
    defaultRootObject: defaultIndex ? 'index.html' : undefined,
    defaultBehavior: behavior,
    certificate: new DnsValidatedCertificate(stack, `${name}Certificate`, {
      domainName,
      hostedZone: zone,
      region: 'us-east-1',
    }),
  });
  addGhaDistribution(stack, name, distribution);

  new route53.ARecord(stack, `${name}ARecord`, {
    zone,
    recordName: domainName,
    target: route53.RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
  });

  // Redirect www -> zone root
  if (wwwRedirect) {
    new route53patterns.HttpsRedirect(stack, `${name}WwwRedirect`, {
      recordNames: [`www.${domainName}`],
      targetDomain: domainName,
      zone,
      certificate: new DnsValidatedCertificate(stack, `${name}CertificateWww`, {
        domainName: `www.${domainName}`,
        hostedZone: zone,
        region: 'us-east-1',
      }),
    });
  }

  return {
    bucket, distribution, // lambda: edgeFunction?.lambda,
  };
}

export function redirect(
  construct: Construct,
  name: string,
  zone: route53.IHostedZone,
  targetDomain: string,
) {
  new route53patterns.HttpsRedirect(construct, `${name}Redirect`, {
    targetDomain,
    recordNames: [zone.zoneName, `www.${zone.zoneName}`],
    zone,
    certificate: new DnsValidatedCertificate(construct, `${name}Certificate`, {
      domainName: zone.zoneName,
      subjectAlternativeNames: [`www.${zone.zoneName}`],
      hostedZone: zone,
      // this is required for Cloudfront certificates:
      // https://docs.aws.amazon.com/cdk/api/v1/docs/aws-cloudfront-readme.html
      region: 'us-east-1',
    }),
  });
}
