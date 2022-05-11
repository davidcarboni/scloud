import { RemovalPolicy } from 'aws-cdk-lib';
import { DnsValidatedCertificate } from 'aws-cdk-lib/aws-certificatemanager';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import {
  AccountRecovery, UserPool, UserPoolClient,
  UserPoolDomain,
  UserPoolIdentityProviderFacebook,
  UserPoolIdentityProviderGoogle,
} from 'aws-cdk-lib/aws-cognito';
import {
  ARecord, IHostedZone, RecordTarget,
} from 'aws-cdk-lib/aws-route53';
import { UserPoolDomainTarget } from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';

export interface CognitoConstructs {
  userPool: UserPool,
  domain?: UserPoolDomain,
  development: {
    client: UserPoolClient, callbackUrl: string;
  },
  production: {
    client: UserPoolClient, callbackUrl: string;
  };
}

function env(variableName: string): string {
  const value = process.env[variableName];
  if (value) return value;
  throw new Error(`Missing environment variable: ${variableName}`);
}

export function googleIdp(construct: Construct, name: string, userPool: UserPool)
  : UserPoolIdentityProviderGoogle {
  // Google identity provider
  return new UserPoolIdentityProviderGoogle(construct, `${name}GoogleIDP`, {
    userPool,
    clientId: env('GOOGLE_CLIENT_ID'),
    clientSecret: env('GOOGLE_CLIENT_SECRET'),
    scopes: ['profile', 'email', 'openid'],
    attributeMapping: {
      email: cognito.ProviderAttribute.GOOGLE_EMAIL,
      givenName: cognito.ProviderAttribute.GOOGLE_GIVEN_NAME,
      familyName: cognito.ProviderAttribute.GOOGLE_FAMILY_NAME,
      fullname: cognito.ProviderAttribute.GOOGLE_NAME,
      profilePicture: cognito.ProviderAttribute.GOOGLE_PICTURE,
    },
    // scopes: [
    //   'https://www.googleapis.com/auth/userinfo.email',
    //   'https://www.googleapis.com/auth/userinfo.profile'],
  });
}

export function facebookIdp(construct: Construct, name: string, userPool: UserPool)
  : UserPoolIdentityProviderFacebook {
  return new UserPoolIdentityProviderFacebook(construct, `${name}FacebookIDP`, {
    userPool,
    clientId: env('FACEBOOK_APP_ID'),
    clientSecret: env('FACEBOOK_APP_SECRET'),
    scopes: ['public_profile', 'email'],
    attributeMapping: {
      email: cognito.ProviderAttribute.FACEBOOK_EMAIL,
      givenName: cognito.ProviderAttribute.FACEBOOK_FIRST_NAME,
      familyName: cognito.ProviderAttribute.FACEBOOK_LAST_NAME,
      fullname: cognito.ProviderAttribute.FACEBOOK_NAME,
    },
  });
}

/**
 * Create a Cognito User Pool Client.
 * @param environment Development or production.
 * @param callbackUrl Authentication callback URL.
 * @returns cognito.UserPoolClient
 */
export function userPoolClient(
  construct: Construct,
  name: string,
  userPool: UserPool,
  callbackDomainName: string,
  google?: UserPoolIdentityProviderGoogle,
  facebook?: UserPoolIdentityProviderFacebook,
): { client: UserPoolClient, callbackUrl: string; } {
  const environment = callbackDomainName.startsWith('localhost') ? 'develpment' : 'production';
  const protocol = callbackDomainName.startsWith('localhost') ? 'http' : 'https';
  const callbackUrl = `${protocol}://${callbackDomainName}/auth-callback`;
  const logout = `${protocol}://${callbackDomainName}/sign-out`;

  const supportedIdentityProviders = [cognito.UserPoolClientIdentityProvider.COGNITO];
  if (google) supportedIdentityProviders.push(cognito.UserPoolClientIdentityProvider.GOOGLE);
  if (facebook) supportedIdentityProviders.push(cognito.UserPoolClientIdentityProvider.FACEBOOK);

  const client = new UserPoolClient(construct, `${name}UserPoolClient-${environment}`, {
    userPool,
    userPoolClientName: `${name}-${environment.toLowerCase()}`,
    generateSecret: false,
    preventUserExistenceErrors: true,
    supportedIdentityProviders,
    oAuth: {
      callbackUrls: [callbackUrl],
      logoutUrls: [logout],
      flows: {
        authorizationCodeGrant: true,
      },
      scopes: [
        cognito.OAuthScope.EMAIL,
        cognito.OAuthScope.OPENID,
        cognito.OAuthScope.PROFILE,
      ],
    },
  });
  if (google) client.node.addDependency(google);
  if (facebook) client.node.addDependency(facebook);

  return { client, callbackUrl };
}

/**
 * Authentication setup with Cognito
 *
 * @param construct CDK construct ("this")
 * @param name The name for the user pool and related resources
 * @param domainName The base domain name - the user pool domain will be auth.${domainName}
 * @param zone The zone to create the 'auth' subdomain in
 * @param pass Whehter this is an initial pass infrastructure create, or an update
 * @returns Information about the created UserPool
 */
export function cognitoPool(
  construct: Construct,
  name: string,
  domainName: string,
  zone: IHostedZone,
  initialPass: boolean,
): CognitoConstructs {
  // Auth domain name
  const authDomainName = `auth.${domainName}`;

  // Cognito user pool
  const userPool = new UserPool(construct, 'UserPool', {
    userPoolName: name,
    selfSignUpEnabled: true,
    accountRecovery: AccountRecovery.EMAIL_ONLY,
    signInAliases: { username: false, email: true },
    removalPolicy: RemovalPolicy.DESTROY,
  });

  // Identity providers
  const google = process.env.GOOGLE_CLIENT_ID ? googleIdp(construct, name, userPool) : undefined;
  const facebook = process.env.FACEBOOK_APP_ID ? facebookIdp(construct, name, userPool) : undefined;

  // Development client
  const development = userPoolClient(construct, name, userPool, 'localhost:3000', google, facebook);

  // Production client
  const production = userPoolClient(construct, name, userPool, `${domainName}`, google, facebook);

  // Custom domain
  let domain: UserPoolDomain | undefined;
  if (!initialPass) {
    // Custom domain can only be set up after the initial pass has created an A record at the apex
    domain = new cognito.UserPoolDomain(construct, `${name}UserPoolDomain`, {
      userPool,
      customDomain: {
        domainName: authDomainName,
        certificate: new DnsValidatedCertificate(construct, `${name}UserPoolCertificate`, {
          domainName: authDomainName,
          hostedZone: zone,
          region: 'us-east-1', // Cloudfront requires this
        }),
      },
    });

    // https://stackoverflow.com/a/62075314/723506
    new ARecord(construct, 'CognitoCustomDomainARecord', {
      zone,
      recordName: authDomainName,
      target: RecordTarget.fromAlias(
        new UserPoolDomainTarget(domain),
      ),
    });
  }

  return {
    userPool,
    domain,
    development: {
      client: development.client,
      callbackUrl: development.callbackUrl,
    },
    production: {
      client: production.client,
      callbackUrl: production.callbackUrl,
    },
  };
}
