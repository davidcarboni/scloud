import {
  Stack,
} from 'aws-cdk-lib';
import { DnsValidatedCertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { RestApiOrigin, S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import {
  AllowedMethods, CachePolicy, Distribution,
  DistributionProps,
  ErrorResponse,
  OriginRequestPolicy,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import {
  LambdaRestApi,
} from 'aws-cdk-lib/aws-apigateway';
import { Function } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { ARecord, IHostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { githubActions } from './GithubActions';
import { PrivateBucket } from './PrivateBucket';

/**
 * @param lambda The function which will respond to incoming request events.
 * @param zone The DNS zone for this web app.
 * @param domainName Optional: by default the zone name will be used (e.g. 'example.com') a different domain here (e.g. 'subdomain.example.com').
 * @param distributionProps Optional: If you want to add additional properties to the Cloudfront distribution, you can pass them here.
 * @param errorResponses Optional: If you want to add custom error responses to the Cloudfront distribution, you can pass them here.
 */
export interface WebApiProps {
  lambda: Function,
  zone: IHostedZone,
  domainName?: string,
  distributionProps?: Partial<DistributionProps>,
  errorResponses?: ErrorResponse[],
}

/**
 * Builds a web API, backed by a single Lambda function - a kind of "Lambda-lith" (https://github.com/cdk-patterns/serverless/blob/main/the-lambda-trilogy/README.md)
 *
 * This construct sends requests that don't have a file extension to the Lambda. Static content is handled by routing requests that match *.* (eg *.js. *.css) to an S3 bucket.
 * Dumping requests with file expensions means the majority of spam requests will not invoke your Lambda.
 * Typically spam requests are probing for wordpress *.xml files, *.php files, .env files etc.
 */
export class WebApi extends Construct {
  lambda: Function;

  bucket: Bucket;

  distribution: Distribution;

  api: LambdaRestApi;

  certificate: DnsValidatedCertificate;

  constructor(
    scope: Construct,
    id: string,
    props: WebApiProps,
  ) {
    super(scope, `${id}WebApi`);

    const domainName = props.domainName || `${props.zone.zoneName}`;

    // Static content
    this.bucket = PrivateBucket.expendable(scope, `${id}Static`);
    githubActions(scope).addGhaBucket(id, this.bucket);

    // Web app handler - default values can be overridden using lambdaProps
    this.lambda = props.lambda;

    this.api = new LambdaRestApi(scope, `${id}ApiGateway`, {
      handler: this.lambda,
      proxy: true,
      description: `${Stack.of(scope).stackName} ${id}`,
      binaryMediaTypes: ['multipart/form-data'],
    });

    this.certificate = new DnsValidatedCertificate(scope, `${id}Certificate`, {
      domainName,
      hostedZone: props.zone,
      region: 'us-east-1',
    });

    // This enables us to separate out the defaultBehavior props (if any) from the distributionProps (if provided)
    // See https://stackoverflow.com/a/34710102/723506 for an explanation of this destructuring
    const { defaultBehavior, additionalBehaviors, ...distributionProps } = props.distributionProps || ({} as Partial<DistributionProps>);
    this.distribution = new Distribution(scope, `${id}Distribution`, {
      domainNames: [domainName],
      comment: domainName,
      defaultBehavior: {
        origin: new RestApiOrigin(this.api),
        allowedMethods: AllowedMethods.ALLOW_ALL,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: CachePolicy.CACHING_DISABLED, // Assume dynamic content
        originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        ...defaultBehavior,
      },
      // All requests for something with a file extension go to s3 (actually, any path that contains a period).
      // The aim is to route *.css, *.js, *.jpeg, etc)
      additionalBehaviors: {
        '*.*': {
          origin: S3BucketOrigin.withOriginAccessControl(this.bucket),
          allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          compress: true,
        },
        ...additionalBehaviors,
      },
      certificate: this.certificate,
      errorResponses: props.errorResponses,
      ...distributionProps,
    });
    githubActions(scope).addGhaDistribution(id, this.distribution);

    // DNS record for the Cloudfront distribution
    new ARecord(scope, `${id}ARecord`, {
      recordName: domainName,
      target: RecordTarget.fromAlias(new CloudFrontTarget(this.distribution)),
      zone: props.zone,
    });
  }
}
