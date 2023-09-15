import * as route53 from 'aws-cdk-lib/aws-route53';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import {
  Stack,
} from 'aws-cdk-lib';
import { DnsValidatedCertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { RestApiOrigin, S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import {
  AllowedMethods, CachePolicy, Distribution,
  OriginRequestCookieBehavior,
  OriginRequestHeaderBehavior,
  OriginRequestPolicy,
  OriginRequestQueryStringBehavior,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import {
  LambdaRestApi,
} from 'aws-cdk-lib/aws-apigateway';
import { Function, FunctionProps, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { RedirectWww } from './RedirectWww';
import { githubActions } from './GithubActions';
import { PrivateBucket } from './PrivateBucket';
import { ZipFunction } from './ZipFunction';

/**
 * Builds a dynamic web application, backed by a single Lambda function, also knowm as a "Lambda-lith" (https://github.com/cdk-patterns/serverless/blob/main/the-lambda-trilogy/README.md)
 *
 * This construct sends requests that don't have a file extension to the Lambda. Static content is handled by routing requests that match *.* (eg *.js. *.css) to an S3 bucket.
 *
 * @param lambda The function which will respond to incoming request events.
 * @param zone The DNS zone for this web app.
 * @param domain Optional: by default the zone name will be used (e.g. 'example.com') a different value here (e.g. 'subdomain.example.com').
 * @param headers Optional: any headers you want passed through Cloudfront in addition to the defaults of User-Agent and Referer
 * @param defaultIndex Default: false. If true, maps a viewer request for '/' to an s3 request for /index.html.
 * @param redirectWww Default: true. Redirects www requests to the bare domain name, e.g. www.example.com->example.com, www.sub.example.com->sub.example.com.
 * @returns
 */
export class WebApp extends Construct {
  lambda: Function;

  bucket: Bucket;

  distribution: Distribution;

  api: LambdaRestApi;

  certificate: DnsValidatedCertificate;

  constructor(
    scope: Construct,
    id: string,
    lambda: Function,
    zone: route53.IHostedZone,
    domain?: string,
    headers?: string[],
    defaultIndex: boolean = false,
    redirectWww: boolean = true,
    autoDeleteObjects: boolean = true,
  ) {
    super(scope, `${id}WebApp`);

    const domainName = domain || `${zone.zoneName}`;

    // Static content
    const bucket = new PrivateBucket(scope, `${id}Static`, { autoDeleteObjects });
    githubActions(scope).addGhaBucket(id, bucket);

    // Permissions to access the bucket from Cloudfront
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(scope, `${id}OAI`, {
      comment: 'Access to static bucket',
    });
    bucket.grantRead(originAccessIdentity);

    // Web app handler - default values can be overridden using lambdaProps
    this.lambda = lambda;

    this.api = new LambdaRestApi(scope, `${id}ApiGateway`, {
      handler: this.lambda,
      proxy: true,
      description: `${Stack.of(scope).stackName} ${id}`,
      binaryMediaTypes: ['multipart/form-data'],
    });

    this.certificate = new DnsValidatedCertificate(scope, `${id}Certificate`, {
      domainName,
      subjectAlternativeNames: [`www.${domainName}`],
      hostedZone: zone,
      region: 'us-east-1',
    });

    this.distribution = new Distribution(scope, `${id}Distribution`, {
      domainNames: [domainName],
      comment: domainName,
      defaultRootObject: defaultIndex ? 'index.html' : undefined,
      defaultBehavior: {
        origin: new RestApiOrigin(this.api),
        allowedMethods: AllowedMethods.ALLOW_ALL,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        compress: true,
        cachePolicy: CachePolicy.CACHING_DISABLED, // Assume dynamic content
        // https://stackoverflow.com/questions/71367982/cloudfront-gives-403-when-origin-request-policy-include-all-headers-querystri
        // OriginRequestHeaderBehavior.all() gives an error so just cookie, user-agent, referer
        originRequestPolicy: new OriginRequestPolicy(scope, `${id}OriginRequestPolicy`, {
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
      // All requests for something with a file extension go to s3 (actually, any path that contains a period).
      // The aim is to route *.css, *.js, *.jpeg, etc)
      additionalBehaviors: {
        '*.*': {
          origin: new S3Origin(bucket, { originAccessIdentity }),
          allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          compress: true,
        },
      },
      certificate: this.certificate,
    });
    githubActions(scope).addGhaDistribution(id, this.distribution);

    // DNS record for the Cloudfront distribution
    new route53.ARecord(scope, `${id}ARecord`, {
      recordName: domainName,
      target: route53.RecordTarget.fromAlias(new CloudFrontTarget(this.distribution)),
      zone,
    });

    if (redirectWww) new RedirectWww(scope, id, zone, this.certificate);
  }

  static typescript(
    scope: Construct,
    id: string,
    zone: route53.IHostedZone,
    domain?: string,
    environment?: { [key: string]: string; },
    lambdaProps?: Partial<FunctionProps>,
    headers?: string[],
    defaultIndex: boolean = false,
    redirectWww: boolean = true,
    autoDeleteObjects: boolean = true,
  ): WebApp {
    const lambda = new ZipFunction(scope, id, environment, { runtime: Runtime.NODEJS_18_X, ...lambdaProps });
    return new WebApp(scope, id, lambda, zone, domain, headers, defaultIndex, redirectWww, autoDeleteObjects);
  }

  static python(
    scope: Construct,
    id: string,
    zone: route53.IHostedZone,
    domain?: string,
    environment?: { [key: string]: string; },
    lambdaProps?: Partial<FunctionProps>,
    headers?: string[],
    defaultIndex: boolean = false,
    redirectWww: boolean = true,
    autoDeleteObjects: boolean = true,
  ): WebApp {
    const lambda = new ZipFunction(scope, id, environment, { runtime: Runtime.PYTHON_3_10, ...lambdaProps });
    return new WebApp(scope, id, lambda, zone, domain, headers, defaultIndex, redirectWww, autoDeleteObjects);
  }
}
