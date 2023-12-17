import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';
import * as route53patterns from 'aws-cdk-lib/aws-route53-patterns';
import { Certificate, DnsValidatedCertificate } from 'aws-cdk-lib/aws-certificatemanager';

/**
 * @param zone The Route53 hosted zone of the domain
 * @param certificate (optional) A certificate to use for the www subdomain (you may want to use the domain apex certificate with a subject alternative name of www)
 * @param domain (optional) the domain name to redirect to, e.g. 'subdomain.example.com' would redirect 'www.subdomain.example.com' to 'subdomain.example.com' (defaults to the zone name)
 */
export interface RedirectWwwProps {
  zone: route53.IHostedZone,
  certificate?: Certificate,
  domainName?: string;
}

/**
 * Creates a redirect from a www. subdomain to the non-www domain.
 * E.g. from www.example.com -> example.com
 *
 */
export class RedirectWww extends route53patterns.HttpsRedirect {
  constructor(scope: Construct, id: string, props: RedirectWwwProps) {
    const domain = props.domainName || `${props.zone.zoneName}`;
    super(scope, `${id}WwwRedirect`, {
      targetDomain: domain,
      recordNames: [`www.${domain}`],
      zone: props.zone,
      certificate: props.certificate || new DnsValidatedCertificate(scope, `${id}WwwCertificate`, {
        domainName: `www.${domain}`,
        hostedZone: props.zone,
        // this is required for Cloudfront certificates:
        // https://docs.aws.amazon.com/cdk/api/v1/docs/aws-cloudfront-readme.html
        region: 'us-east-1',
      }),
    });
  }
}
