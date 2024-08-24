import { DnsValidatedCertificate } from 'aws-cdk-lib/aws-certificatemanager';
import {
  Distribution, DistributionProps, OriginAccessIdentity, ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { ARecord, IHostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { githubActions } from './GithubActions';
import { PrivateBucket } from './PrivateBucket';
import { RedirectWww } from './RedirectWww';

/**
 * @param zone The DNS zone for this web app. By default the domain name is set to the zone name
 * The type IHostedZone enables lookup of the zone (IHostedZone) as well as a zone creatd in the stack (HostedZone)
 * @param domain Optional: by default the zone name will be mapped to the Cloudfront distribution (e.g. 'example.com') but you can specify a different domain here (e.g. 'subdomain.example.com').
 * @param defaultIndex Default: true. Maps a viewer request for '/' to a request for /index.html.
 * @param redirectWww Default: true. Redirects www requests to the bare domain name, e.g. www.example.com->example.com, www.sub.example.com->sub.example.com.
 * @param cnameAliases Optional: additional CNAMEs to add to the Cloudfront distribution. This allows you to use a domain name configured outside of AWS.
 */
export interface WebFrontendProps {
  zone: IHostedZone,
  domainName?: string,
  defaultIndex?: boolean,
  redirectWww?: boolean,
  cnameAliases?: string[],
  distributionProps?: Partial<DistributionProps>,
}

/**
 * A Cloudfront distribution backed by an s3 bucket.
 *
 * The bucket and contents are treated as expendable on the basis they are assumed to be generated by a CI/CD process that can rebuild the content.
 *
 * NB us-east-1 is required for Cloudfront certificates:
 * https://docs.aws.amazon.com/cdk/api/v1/docs/aws-cloudfront-readme.html
 */
export class WebFrontend extends Construct {
  bucket: Bucket;

  distribution: Distribution;

  certificate: DnsValidatedCertificate;

  constructor(
    scope: Construct,
    id: string,
    props: WebFrontendProps,
  ) {
    super(scope, `${id}WebFrontend`);

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

    // This enables us to separate out the defaultBehavior props (if any) from the distributionProps (if provided)
    // See https://stackoverflow.com/a/34710102/723506 for an explanation of this destructuring
    const { defaultBehavior, ...distributionProps } = props.distributionProps || ({} as Partial<DistributionProps>);
    this.distribution = new Distribution(scope, `${id}Distribution`, {
      domainNames: [domainName],
      comment: domainName,
      defaultRootObject: props.defaultIndex ? 'index.html' : undefined,
      defaultBehavior: {
        origin: new S3Origin(this.bucket, { originAccessIdentity }),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        ...defaultBehavior,
      },
      certificate: this.certificate,
      ...distributionProps,
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
}
