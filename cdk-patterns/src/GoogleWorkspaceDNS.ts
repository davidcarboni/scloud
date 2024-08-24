import { Duration } from 'aws-cdk-lib';
import {
  IHostedZone, MxRecord, TxtRecord,
} from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';

export function addGoogleWorkspaceRecords(scope: Construct, zone: IHostedZone) {
  new MxRecord(scope, 'GoogleWoekspace', {
    zone,
    values: [
      {
        hostName: 'aspmx.l.google.com.',
        priority: 1,
      },
      {
        hostName: 'alt1.aspmx.l.google.com.',
        priority: 5,
      },
      {
        hostName: 'alt2.aspmx.l.google.com.',
        priority: 5,
      },
      {
        hostName: 'alt3.aspmx.l.google.com.',
        priority: 10,
      },
      {
        hostName: 'alt4.aspmx.l.google.com.',
        priority: 10,
      },
    ],
    // the properties below are optional
    comment: 'Google workspace MX records',
    ttl: Duration.minutes(60),
  });
  new TxtRecord(scope, 'SPF', {
    values: ['v=spf1 include:_spf.google.com ~all'],
    zone,
    comment: 'SPF for Google Workspace',
  });
}
