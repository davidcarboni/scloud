import { DnsValidatedCertificate } from 'aws-cdk-lib/aws-certificatemanager';
import {
  Distribution, OriginAccessIdentity, ViewerProtocolPolicy,
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
 * A Cloudfront distribution backed by an s3 bucket.
 *
 * NB us-east-1 is required for Cloudfront certificates:
 * https://docs.aws.amazon.com/cdk/api/v1/docs/aws-cloudfront-readme.html
 *
 * @param zone The DNS zone for this web app. By default the domain name is set to the zone name
 * The type IHostedZone enables lookup of the zone (IHostedZone) as well as a zone creatd in the stack (HostedZone)
 * @param domain Optional: by default the zone name will be mapped to the Cloudfront distribution (e.g. 'example.com') but you can specify a different domain here (e.g. 'subdomain.example.com').
 * @param defaultIndex Default: true. Maps a viewer request for '/' to a request for /index.html.
 * @param wwwRedirect Default: true. Redirects www requests to the bare domain name, e.g. www.example.com->example.com, www.sub.example.com->sub.example.com.
 * @param autoDeleteObjects Default: true. If true, the static bucket will be configured to delete all objects when the stack is deleted, on the basis these files are most lifkely produced by a CI build. Pass false to leave the bucket intact.
 */
export class WebFrontend extends Construct {
  bucket: Bucket;

  distribution: Distribution;

  certificate: DnsValidatedCertificate;

  constructor(
    scope: Construct,
    id: string,
    zone: IHostedZone,
    domain?: string,
    defaultIndex: boolean = true,
    redirectWww: boolean = true,
    autoDeleteObjects: boolean = true,
  ) {
    super(scope, `${id}WebFrontend`);

    const domainName = domain || zone.zoneName;

    // We consider the objects in the bucket ot be expendable because
    // they're most likely static content we generate from source code (rather than user data).
    this.bucket = new PrivateBucket(scope, `${id}Static`, { autoDeleteObjects });
    githubActions(scope).addGhaBucket(id, this.bucket);

    // Permissions to access the bucket from Cloudfront
    const originAccessIdentity = new OriginAccessIdentity(scope, `${id}OAI`, {
      comment: 'Access to static bucket',
    });
    this.bucket.grantRead(originAccessIdentity);

    this.certificate = new DnsValidatedCertificate(scope, `${id}Certificate`, {
      domainName,
      hostedZone: zone,
      region: 'us-east-1',
    });

    this.distribution = new Distribution(scope, `${id}Distribution`, {
      domainNames: [domainName],
      comment: domainName,
      defaultRootObject: defaultIndex ? 'index.html' : undefined,
      defaultBehavior: {
        origin: new S3Origin(this.bucket, { originAccessIdentity }),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      certificate: this.certificate,
    });
    githubActions(scope).addGhaDistribution(id, this.distribution);

    // DNS record for the distribution
    new ARecord(scope, `${id}ARecord`, {
      zone,
      recordName: domainName,
      target: RecordTarget.fromAlias(new CloudFrontTarget(this.distribution)),
    });

    if (redirectWww) {
      // Redirect www -> zone root
      new RedirectWww(scope, id, zone, this.certificate);
    }
  }
}
