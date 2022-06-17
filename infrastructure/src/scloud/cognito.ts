import { RemovalPolicy } from 'aws-cdk-lib';
import { DnsValidatedCertificate } from 'aws-cdk-lib/aws-certificatemanager';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import {
  AccountRecovery, CfnUserPoolIdentityProvider, UserPool, UserPoolClient,
  UserPoolClientIdentityProvider,
  UserPoolDomain,
  UserPoolIdentityProviderFacebook,
  UserPoolIdentityProviderGoogle,
} from 'aws-cdk-lib/aws-cognito';
import {
  ARecord, IHostedZone, RecordTarget,
} from 'aws-cdk-lib/aws-route53';
import { UserPoolDomainTarget } from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';

export interface IdpConfig {
  enableEmail?: boolean, // Allow email sign-up/in
  googleClientId?: string,
  googleClientSecret?: string,
  facebookAppId?: string,
  facebookAppSecret?: string,
  SamlProviderName?: string, // Name in the Cognito hosted UI under "Sign in with your corporate ID"
  FederationMetadataUrl?: string, // SAML XML URL (e.g. Azure)
  FederationMetadataXml?: string, // SAML metadata XML (e.g. Google Workspace)
}

export interface CognitoConstructs {
  userPool: UserPool,
  domain?: UserPoolDomain,
  production: {
    client: UserPoolClient, callbackUrl: string;
  };
}

export function googleIdp(
  construct: Construct,
  name: string,
  userPool: UserPool,
  idpConfig: IdpConfig,
)
  : UserPoolIdentityProviderGoogle {
  // Google identity provider
  return new UserPoolIdentityProviderGoogle(construct, `${name}GoogleIDP`, {
    userPool,
    clientId: idpConfig.googleClientId || '',
    clientSecret: idpConfig.googleClientSecret || '',
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

export function facebookIdp(
  construct: Construct,
  name: string,
  userPool: UserPool,
  idpConfig: IdpConfig,
)
  : UserPoolIdentityProviderFacebook {
  return new UserPoolIdentityProviderFacebook(construct, `${name}FacebookIDP`, {
    userPool,
    clientId: idpConfig.facebookAppId || '',
    clientSecret: idpConfig.facebookAppSecret || '',
    scopes: ['public_profile', 'email'],
    attributeMapping: {
      email: cognito.ProviderAttribute.FACEBOOK_EMAIL,
      givenName: cognito.ProviderAttribute.FACEBOOK_FIRST_NAME,
      familyName: cognito.ProviderAttribute.FACEBOOK_LAST_NAME,
      fullname: cognito.ProviderAttribute.FACEBOOK_NAME,
    },
  });
}

export function samlIdp(
  construct: Construct,
  name: string,
  userPool: UserPool,
  idpConfig: IdpConfig,
)
  : CfnUserPoolIdentityProvider {
  // https://docs.aws.amazon.com/cdk/api/latest/docs/aws-cdk-lib_aws-cognito.CfnUserPoolIdentityProvider.html
  // https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-cognito-userpoolidentityprovider.html

  const providerDetails: { [key: string]: string; } = {};
  if (idpConfig.FederationMetadataUrl) {
    providerDetails.MetadataURL = idpConfig.FederationMetadataUrl;
  }
  if (idpConfig.FederationMetadataXml) {
    providerDetails.MetadataFile = idpConfig.FederationMetadataXml;
  }

  return new CfnUserPoolIdentityProvider(construct, `${name}SamlIDP`, {
    userPoolId: userPool.userPoolId,
    providerName: idpConfig.SamlProviderName || name,
    providerType: 'SAML',
    attributeMapping: {
      // https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-attributes.html
      given_name: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
      family_name: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
      email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
    },
    providerDetails,
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
  enableEmail?: boolean,
  google?: UserPoolIdentityProviderGoogle,
  facebook?: UserPoolIdentityProviderFacebook,
  saml?: CfnUserPoolIdentityProvider,
): { client: UserPoolClient, callbackUrl: string; } {
  const environment = callbackDomainName.startsWith('localhost') ? 'develpment' : 'production';
  const protocol = callbackDomainName.startsWith('localhost') ? 'http' : 'https';
  const callbackUrl = `${protocol}://${callbackDomainName}/auth-callback`;
  const logout = `${protocol}://${callbackDomainName}/sign-out`;

  const identityProviders: cognito.UserPoolClientIdentityProvider[] = [];
  if (enableEmail) identityProviders.push(UserPoolClientIdentityProvider.COGNITO);
  if (google) identityProviders.push(UserPoolClientIdentityProvider.GOOGLE);
  if (facebook) identityProviders.push(UserPoolClientIdentityProvider.FACEBOOK);
  if (saml) identityProviders.push(UserPoolClientIdentityProvider.custom(saml.providerName));

  const client = new UserPoolClient(construct, `${name}UserPoolClient-${environment}`, {
    userPool,
    userPoolClientName: `${name}-${environment.toLowerCase()}`,
    generateSecret: false,
    preventUserExistenceErrors: true,
    supportedIdentityProviders: identityProviders,
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
  if (saml) client.node.addDependency(saml);

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
  zone: IHostedZone,
  initialPass: boolean,
  idpConfig: IdpConfig,
  domainName?: string,
): CognitoConstructs {
  // Auth domain name:
  // AWS recommends auth.<domain> for custom domains
  // NB at the time of writing there's a hard limit of 4 custom Cognito domains.
  // const authDomainName = domainName || `auth.${zone.zoneName}`;
  const authDomainName = `auth.${domainName || zone.zoneName}`;

  // Cognito user pool
  const userPool = new UserPool(construct, `${name}UserPool`, {
    userPoolName: name,
    selfSignUpEnabled: true,
    accountRecovery: AccountRecovery.EMAIL_ONLY,
    signInAliases: { username: false, email: true },
    removalPolicy: RemovalPolicy.DESTROY,
  });

  // Identity providers
  const google = idpConfig.googleClientId
    ? googleIdp(construct, name, userPool, idpConfig) : undefined;
  const facebook = idpConfig.facebookAppId
    ? facebookIdp(construct, name, userPool, idpConfig) : undefined;
  const saml = idpConfig.FederationMetadataUrl || idpConfig.FederationMetadataXml
    ? samlIdp(construct, name, userPool, idpConfig) : undefined;

  // Production client
  const production = userPoolClient(construct, name, userPool, `${domainName || zone.zoneName}`, idpConfig.enableEmail, google, facebook, saml);

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
    new ARecord(construct, `${name}CognitoCustomDomainARecord`, {
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
    production: {
      client: production.client,
      callbackUrl: production.callbackUrl,
    },
  };
}
