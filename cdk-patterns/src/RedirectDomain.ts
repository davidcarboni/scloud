import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';
import * as route53patterns from 'aws-cdk-lib/aws-route53-patterns';
import { DnsValidatedCertificate } from 'aws-cdk-lib/aws-certificatemanager';

/**
 * Creates a redirect from one domain (including www. subdomain) to another.
 *
 * For example you could redirect from example.com to example.org:
 * - example.com -> example.org
 * - www.example.com -> example.org
 *
 * To redirect www.example.com to example.com, use RedirectWww because
 * these redirects are implemented in a different zone (example.org)
 *
 * @param zone The Route53 hosted zone of the source domain to redirect from
 * @param targetDomain The target domain to redirect to
 */
export class RedirectDomain extends route53patterns.HttpsRedirect {
  constructor(scope: Construct, id: string, zone: route53.IHostedZone, targetDomain: string) {
    super(scope, `${id}Redirect`, {
      targetDomain,
      recordNames: [zone.zoneName, `www.${zone.zoneName}`],
      zone,
      certificate: new DnsValidatedCertificate(scope, `${id}Certificate`, {
        domainName: zone.zoneName,
        subjectAlternativeNames: [`www.${zone.zoneName}`],
        hostedZone: zone,
        // this is required for Cloudfront certificates:
        // https://docs.aws.amazon.com/cdk/api/v1/docs/aws-cloudfront-readme.html
        region: 'us-east-1',
      }),
    });
  }
}
