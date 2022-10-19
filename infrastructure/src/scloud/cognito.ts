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

export interface SamlProvider {
  FederationMetadataUrl?: string, // SAML XML URL (e.g. Azure)
  FederationMetadataXml?: string, // SAML metadata XML (e.g. Google Workspace)
  SamlProviderName?: string, // Name in the Cognito hosted UI under "Sign in with your corporate ID"
}

export interface IdpConfig {
  enableEmail?: boolean, // Allow email sign-up/in
  googleClientId?: string,
  googleClientSecret?: string,
  facebookAppId?: string,
  facebookAppSecret?: string,
  SamlProviders?: SamlProvider[],
  FederationMetadataUrl?: string, // SAML XML URL (e.g. Azure)
  FederationMetadataXml?: string, // SAML metadata XML (e.g. Google Workspace)
  SamlProviderName?: string, // Name in the Cognito hosted UI under "Sign in with your corporate ID"
}

export interface CognitoConstructs {
  userPool: UserPool,
  domain?: UserPoolDomain,
  client: UserPoolClient,
  callbackUrl: string,
  signInUrl?: string,
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
  samlProvider: SamlProvider,
): CfnUserPoolIdentityProvider {
  // https://docs.aws.amazon.com/cdk/api/latest/docs/aws-cdk-lib_aws-cognito.CfnUserPoolIdentityProvider.html
  // https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-cognito-userpoolidentityprovider.html

  const providerDetails: { [key: string]: string; } = {};
  if (samlProvider.FederationMetadataUrl) {
    providerDetails.MetadataURL = samlProvider.FederationMetadataUrl;
  }
  if (samlProvider.FederationMetadataXml) {
    providerDetails.MetadataFile = samlProvider.FederationMetadataXml;
  }

  return new CfnUserPoolIdentityProvider(construct, `${name}SamlIDP${samlProvider.SamlProviderName}`, {
    userPoolId: userPool.userPoolId,
    providerName: samlProvider.SamlProviderName || name,
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
 * @param callbackUrl Authentication callback URL.
 * @returns cognito.UserPoolClient
 */
export function userPoolClient(
  construct: Construct,
  name: string,
  userPool: UserPool,
  callbackUrl: string,
  enableEmail?: boolean,
  google?: UserPoolIdentityProviderGoogle,
  facebook?: UserPoolIdentityProviderFacebook,
  samls?: CfnUserPoolIdentityProvider[],
  alternativeCallbackUrl?: string,
): UserPoolClient {
  const identityProviders: cognito.UserPoolClientIdentityProvider[] = [];
  if (enableEmail) identityProviders.push(UserPoolClientIdentityProvider.COGNITO);
  if (google) identityProviders.push(UserPoolClientIdentityProvider.GOOGLE);
  if (facebook) identityProviders.push(UserPoolClientIdentityProvider.FACEBOOK);
  if (samls) {
    samls.forEach((saml) => {
      identityProviders.push(UserPoolClientIdentityProvider.custom(saml.providerName));
    });
  }

  const callbackUrls = [callbackUrl];
  if (alternativeCallbackUrl) callbackUrls.push(alternativeCallbackUrl);
  const client = new UserPoolClient(construct, `${name}UserPoolClient`, {
    userPool,
    userPoolClientName: name,
    generateSecret: false,
    preventUserExistenceErrors: true,
    supportedIdentityProviders: identityProviders,
    oAuth: {
      callbackUrls,
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
  if (samls) {
    samls.forEach((saml) => client.node.addDependency(saml));
  }

  return client;
}

/**
 * Authentication setup with Cognito.
 *
 * NB: IF you want to use a custom domain, the CDK deployment
 * will fail unless there's an A record at the zone apex.
 *
 * @param construct CDK construct ("this")
 * @param name The name for the user pool and related resources
 * @param callbackUrl Allowed callback URL
 * @param idpConfig Identity provider configuration
 * @param zone If you want a custom domain, pass the zone to create it in
 * @param domainName If you're passing a zone, you can pass a domain name,
 * or leave out for a recommended `auth.${zone.zoneName}`.
 * If not passing a zone, this will be used as a Cognito domain prefix.
 * @returns Information about the created UserPool
 */
export function cognitoPool(
  construct: Construct,
  name: string,
  callbackUrl: string,
  idpConfig: IdpConfig,
  zone?: IHostedZone,
  domainName?: string,
  alternativeCallbackUrl? : string,
): CognitoConstructs {
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
  const saml = [];

  if (idpConfig.FederationMetadataUrl || idpConfig.FederationMetadataXml) {
    saml.push(samlIdp(construct, name, userPool, idpConfig));
  }
  if (idpConfig.SamlProviders) {
    idpConfig.SamlProviders.forEach((samlProvider) => {
      saml.push(samlIdp(
        construct,
        name,
        userPool,
        samlProvider,
      ));
    });
  }
  // Production client
  const client = userPoolClient(
    construct,
    name,
    userPool,
    callbackUrl,
    idpConfig.enableEmail,
    google,
    facebook,
    saml,
    alternativeCallbackUrl,
  );

  // Custom domain
  let domain: UserPoolDomain | undefined;
  let signInUrl: string | undefined;
  if (zone) {
    // Auth domain name:
    // AWS recommends auth.<domain> for custom domains
    // NB at the time of writing there's a hard limit of 4 custom Cognito domains.
    const authDomainName = domainName || `auth.${zone.zoneName}`;

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
  } else if (domainName) {
    // Customise the domain prefix
    domain = new cognito.UserPoolDomain(construct, `${name}UserPoolDomain`, {
      userPool,
      cognitoDomain: {
        domainPrefix: domainName,
      },
    });
  }

  if (domain) signInUrl = domain?.signInUrl(client, { redirectUri: callbackUrl });

  return {
    userPool,
    domain,
    client,
    callbackUrl,
    signInUrl,
  };
}
