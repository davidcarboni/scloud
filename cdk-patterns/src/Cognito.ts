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

/**
 * Authentication setup with Cognito.
 *
 * This construct offers a couple convenience static methods for typical use cases:
 *  - Cognito.withSSO()
 *  - Cognito.withSocialLogins()
 *
 * To customise this construct, you'll need to call these methods in the following oprder:
 * - new Cognito()
 * - addGoogleIdp() (optional)
 * - addFacebookIdp() (optional)
 * - addSamlIdp() (optional, can be called more than once)
 * - createUserPoolClient()
 * - addCustomDomain() / addDomainPrefix()
 *
 * Once set up, you can call signInUrl() to get a URL for the hosted UI sign-in page.
 *
 * NB: IF you want to use a custom domain, there's an unexpected error where the CDK deployment
 * will fail unless there's an A record at the zone apex (at the time of writing) so you need to
 * add a record at the apex before you attempt to create a custom domain.
 *
 * @returns Information about the created UserPool
 */
export class Cognito extends Construct {
  id: string;

  userPool: UserPool;

  domain: UserPoolDomain | undefined;

  userPoolClient: UserPoolClient;

  googleIdp: cognito.UserPoolIdentityProviderGoogle | undefined;

  facebookIdp: cognito.UserPoolIdentityProviderFacebook | undefined;

  samlIdps: cognito.CfnUserPoolIdentityProvider[] = [];

  /** Typically there's only one callback URL */
  callbackUrl: string;

  /** All callback URLs, including any alternative URL will be visible in this properly */
  callbackUrls: string[] = [];

  /** Optional logout URL */
  logoutUrl: string | undefined;

  constructor(
    scope: Construct,
    id: string,
    props?: Partial<cognito.UserPoolProps>,
  ) {
    super(scope, `${id}Cognito`);

    // Store the ID so we can it in methods:
    this.id = id;

    // Cognito user pool
    this.userPool = new UserPool(scope, `${id}UserPool`, {
      userPoolName: id,
      selfSignUpEnabled: true,
      accountRecovery: AccountRecovery.EMAIL_ONLY,
      signInAliases: { username: false, email: true },
      removalPolicy: RemovalPolicy.DESTROY,
      ...props,
    });
  }

  addGoogleIdp(
    googleClientId: string,
    googleClientSecret: string,
  ): UserPoolIdentityProviderGoogle {
    if (this.googleIdp) throw new Error(`Google identity provider has already been created for ${this.id}. You'll need to call addGoogleIdp before creating the client.`);
    if (this.userPoolClient) throw new Error(`User pool client has already been created for ${this.id}. You'll need to call addGoogleIdp before creating the client.`);

    // Google identity provider
    this.googleIdp = new UserPoolIdentityProviderGoogle(this, `${this.id}GoogleIDP`, {
      userPool: this.userPool,
      clientId: googleClientId,
      clientSecret: googleClientSecret,
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

    return this.googleIdp;
  }

  addFacebookIdp(
    facebookAppId: string,
    facebookAppSecret: string,
  ): UserPoolIdentityProviderFacebook {
    if (this.googleIdp) throw new Error(`Facebook identity provider has already been created for ${this.id}. You'll need to call addGoogleIdp before creating the client.`);
    if (this.userPoolClient) throw new Error(`User pool client has already been created for ${this.id}. You'll need to call addFacebookIdp before creating the client.`);
    this.facebookIdp = new UserPoolIdentityProviderFacebook(this, `${this.id}FacebookIDP`, {
      userPool: this.userPool,
      clientId: facebookAppId,
      clientSecret: facebookAppSecret,
      scopes: ['public_profile', 'email'],
      attributeMapping: {
        email: cognito.ProviderAttribute.FACEBOOK_EMAIL,
        givenName: cognito.ProviderAttribute.FACEBOOK_FIRST_NAME,
        familyName: cognito.ProviderAttribute.FACEBOOK_LAST_NAME,
        fullname: cognito.ProviderAttribute.FACEBOOK_NAME,
      },
    });

    return this.facebookIdp;
  }

  /**
   * Add a SAML sso identity provider.
   *
   * You can call this method more than once to add multiple SAML providers.
   *
   * @param SamlProviderName Name in the Cognito hosted UI under "Sign in with your corporate ID"
   * @param FederationMetadataUrl SAML XML URL (e.g. Azure)
   * @param FederationMetadataXml SAML metadata XML (e.g. Google Workspace)
   */
  addSamlIdp(
    SamlProviderName: string,
    FederationMetadataUrl?: string,
    FederationMetadataXml?: string,
  ): CfnUserPoolIdentityProvider {
    // https://docs.aws.amazon.com/cdk/api/latest/docs/aws-cdk-lib_aws-cognito.CfnUserPoolIdentityProvider.html
    // https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-cognito-userpoolidentityprovider.html

    if (this.userPoolClient) throw new Error(`User pool client has already been created for ${this.id}. You'll need to call addSamlIdp before creating the client.`);

    const providerDetails: { [key: string]: string; } = {};
    if (FederationMetadataUrl) {
      providerDetails.MetadataURL = FederationMetadataUrl;
    }
    if (FederationMetadataXml) {
      providerDetails.MetadataFile = FederationMetadataXml;
    }

    const samlIdp = new CfnUserPoolIdentityProvider(this, `${this.id}SamlIDP${SamlProviderName}`, {
      userPoolId: this.userPool.userPoolId,
      providerName: SamlProviderName || this.id,
      providerType: 'SAML',
      attributeMapping: {
        // https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-attributes.html
        given_name: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
        family_name: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
        email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
      },
      providerDetails,
    });
    this.samlIdps.push(samlIdp);

    return samlIdp;
  }

  /**
   * Create a Cognito User Pool Client.
   *
   * If you want to add identity providers such as Google, Facebook or saml sso you'll need to call addGoogleIdp(), addFacebookIdp() and/or addSamlIdp() first.
   *
   * @param enableEmail Whether to enable email as a sign-up/sign-in method.
   * @param callbackUrl Allowed callback URL on your app to receive an authentication code (?code=...)
   * @param alternativeCallbackUrls Zero or more additonal authorized callback URL, for example if you wneed to allow localhost in a development environment.
   * @returns cognito.UserPoolClient
   */
  createUserPoolClient(
    callbackUrl: string,
    enableEmail?: boolean,
    logoutUrl?: string,
    ...alternativeCallbackUrls: string[]
  ): UserPoolClient {
    if (this.userPoolClient) throw new Error(`User pool client has already been created for ${this.id}`);

    const identityProviders: cognito.UserPoolClientIdentityProvider[] = [];
    if (enableEmail) identityProviders.push(UserPoolClientIdentityProvider.COGNITO);
    if (this.googleIdp) identityProviders.push(UserPoolClientIdentityProvider.GOOGLE);
    if (this.facebookIdp) identityProviders.push(UserPoolClientIdentityProvider.FACEBOOK);
    this.samlIdps.forEach((saml) => {
      identityProviders.push(UserPoolClientIdentityProvider.custom(saml.providerName));
    });

    this.callbackUrl = callbackUrl;
    this.callbackUrls = [callbackUrl];
    this.callbackUrls.push(...alternativeCallbackUrls);
    this.logoutUrl = logoutUrl;
    const userPoolClient = new UserPoolClient(this, `${this.id}UserPoolClient`, {
      userPool: this.userPool,
      userPoolClientName: this.id,
      generateSecret: false,
      preventUserExistenceErrors: true,
      supportedIdentityProviders: identityProviders,
      oAuth: {
        callbackUrls: this.callbackUrls,
        logoutUrls: this.logoutUrl ? [this.logoutUrl] : undefined,
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

    // These dependencies seemed to be needed at the time of writing:
    if (this.googleIdp) userPoolClient.node.addDependency(this.googleIdp);
    if (this.facebookIdp) userPoolClient.node.addDependency(this.facebookIdp);
    if (this.samlIdps) {
      this.samlIdps.forEach((samlIdp) => userPoolClient.node.addDependency(samlIdp));
    }

    this.userPoolClient = userPoolClient;
    return this.userPoolClient;
  }

  /**
   * Add a custom domain name to the Cognito User Pool.
   * 
   * NOTE: there's a Cognito quirk where it seems that an A record at the zone apex must exist 
   * (even for a delegated subdomain) otherwise you can't create a custom user pool domain.
   * @see https://stackoverflow.com/questions/79833464/aws-cognito-custom-domain-fails-to-create-invalid-request-provided-awscogn/79833465#79833465
   *
   * AWS recommends auth.<domain> for custom domains, so this is the default if you don't pass a value for domainName.
   *
   * NB at the time of writing there's a hard limit of 4 custom Cognito domains per AWS account.
   *
   * You can add either a custom domain or a domain prefix, but not both.
   * 
   * A domain prefix must be globally unique across all AWS accounts.
   *
   * @param zone The HostedZone in which to create an alias record for the user pool.
   * @param domainName Leave this out to use the recommended `auth.<domain>`, or pass a fully qualified domain name.
   */
  addCustomDomain(zone: IHostedZone, domainName?: string) {
    if (this.domain) throw new Error(`A domain has already been created for ${this.id}`);

    // NB at the time of writing there's a hard limit of 4 custom Cognito domains.
    const authDomainName = domainName || `auth.${zone.zoneName}`;

    // AWS-managed certificate (auto-renews)
    const certificate = new DnsValidatedCertificate(this, `${this.id}UserPoolCertificate`, {
      domainName: authDomainName,
      hostedZone: zone,
      region: 'us-east-1', // Cloudfront requires this
    });

    // NB a custom domain can only be set up after an A record has been created at the zone apex
    this.domain = new cognito.UserPoolDomain(this, `${this.id}UserPoolDomain`, {
      userPool: this.userPool,
      customDomain: {
        domainName: authDomainName,
        certificate,
      },
    });

    // https://stackoverflow.com/a/62075314/723506
    new ARecord(this, `${this.id}CognitoCustomDomainARecord`, {
      zone,
      recordName: authDomainName,
      target: RecordTarget.fromAlias(
        new UserPoolDomainTarget(this.domain),
      ),
    });
  }

  /**
   * Set a domain prefix for the URL of the Cognito User Pool.
   *
   * This will set the user pool URL to https://<domainPrefix>.auth.<region>.amazoncognito.com
   *
   * You don't have to set a custom domain prefix. If you don't, the prefix will be generated by AWS.
   *
   * If can set a custom domain prefix, or a custom domain, but not both.
   *
   * @param domainPrefix Leave this out to use the recommended `auth.<domain>`, or pass a fully qualified domain name.
   */
  addDomainPrefix(domainPrefix: string) {
    if (this.domain) throw new Error(`A domain has already been created for ${this.id}`);

    this.domain = new cognito.UserPoolDomain(this, `${this.id}UserPoolDomain`, {
      userPool: this.userPool,
      cognitoDomain: {
        domainPrefix,
      },
    });
  }

  /**
   * Constructs a URL for the hosted UI sign-in page.
   *
   * You'll need to call either addCustomDomain() or addDomainPrefix() first.
   *
   * @param callbackUrl Optional: defaults to the this.callbackUrl.
   */
  signInUrl(callbackUrl?: string) {
    if (!this.domain) throw new Error(`You must call addCustomDomain() or addDomainPrefix() before calling signInUrl() for ${this.id}`);
    if (!this.userPoolClient) throw new Error(`You must call createUserPoolClient() before calling signInUrl() for ${this.id}`);
    return this.domain?.signInUrl(this.userPoolClient, { redirectUri: callbackUrl || this.callbackUrl });
  }

  /**
   * @deprecated Use withSSOMetadataUrl() or withSSOMetadataXml() instead.
   *
   * Creates a Cognito instance configured for SAML sso (e.g. Azure or Google Workspace).
   *
   * You'll need to pass either a federationMetadataUrl or a federationMetadataXml.
   *
   * You'll want to pass either a domain prefix (creates https://<prefix>.auth.<region>.amazoncognito.com) or a
   * zone (and optionally domainName) if you don't pass a domainName the user pool url will be https://auth.<zoneName>
   *
   * NB at the time of writing AWS has a hard limit of 4 custom Cognito domains so if you're running multiple user pools
   * in a single AWS account you may need to use domain prefixes.
   */
  static withSSO(
    scope: Construct,
    id: string,
    callbackUrl: string,
    samlProviderName: string,
    federationMetadataUrl?: string | undefined,
    federationMetadataXml?: string | undefined,
    zone?: IHostedZone,
    domainName?: string,
    domainPrefix?: string,
    logoutUrl?: string,
    ...alternativeCallbackUrls: string[]
  ): Cognito {
    const sso = new Cognito(scope, id);
    sso.addSamlIdp(samlProviderName, federationMetadataUrl, federationMetadataXml);
    sso.createUserPoolClient(callbackUrl, false, logoutUrl, ...alternativeCallbackUrls);
    if (domainPrefix) sso.addDomainPrefix(domainPrefix);
    else if (zone) sso.addCustomDomain(zone, domainName || `auth.${zone.zoneName}`);
    return sso;
  }

  /**
   * Creates a Cognito instance configured for email login.
   *
   * You'll want to pass either a domain prefix (creates https://<prefix>.auth.<region>.amazoncognito.com) or a
   * zone (and optionally domainName) if you don't pass a domainName the user pool url will be https://auth.<zoneName>
   *
   * NB at the time of writing AWS has a hard limit of 4 custom Cognito domains so if you're running multiple user pools
   * in a single AWS account you may need to use domain prefixes.
   */
  static withEmailLogin(
    scope: Construct,
    id: string,
    callbackUrl: string,
    zone?: IHostedZone,
    domainName?: string,
    domainPrefix?: string,
    logoutUrl?: string,
    ...alternativeCallbackUrls: string[]
  ): Cognito {
    const email = new Cognito(scope, id);
    email.createUserPoolClient(callbackUrl, true, logoutUrl, ...alternativeCallbackUrls);
    if (domainPrefix) email.addDomainPrefix(domainPrefix);
    else if (zone) email.addCustomDomain(zone, domainName || `auth.${zone.zoneName}`);
    return email;
  }

  /**
   * Creates a Cognito instance configured for Social logins (Google and Facebook) and optionally email.
   *
   * You'll want to pass either a domain prefix (creates https://<prefix>.auth.<region>.amazoncognito.com) or a
   * zone (and optionally domainName) if you don't pass a domainName the user pool url will be https://auth.<zoneName>
   *
   * NB at the time of writing AWS has a hard limit of 4 custom Cognito domains so if you're running multiple user pools
   * in a single AWS account you may need to use domain prefixes.
   */
  static withSocialLogins(
    scope: Construct,
    id: string,
    callbackUrl: string,
    googleClientId?: string,
    googleClientSecret?: string,
    facebookAppId?: string,
    facebookAppSecret?: string,
    enableEmailLogin?: boolean,
    zone?: IHostedZone,
    domainName?: string,
    domainPrefix?: string,
    logoutUrl?: string,
    ...alternativeCallbackUrls: string[]
  ): Cognito {
    const social = new Cognito(scope, id);
    if (googleClientId && googleClientSecret) social.addGoogleIdp(googleClientId, googleClientSecret);
    if (facebookAppId && facebookAppSecret) social.addFacebookIdp(facebookAppId, facebookAppSecret);
    social.createUserPoolClient(callbackUrl, enableEmailLogin, logoutUrl, ...alternativeCallbackUrls);
    if (domainPrefix) social.addDomainPrefix(domainPrefix);
    else if (zone) social.addCustomDomain(zone, domainName || `auth.${zone.zoneName}`);
    return social;
  }

  /**
   * Creates a Cognito instance configured for SAML sso where you have a metadata URL (e.g. Azure).
   *
   * You'll need to pass a federationMetadataUrl (e.g. provided by Azure).
   *
   * If configuring an 'Enerprise Application' in Azure, the "Identifier (Entity ID)" will be:
   *
   *  urn:amazon:cognito:sp:<user pool id> (e.g. <region>_XyZaBcD1E)
   *
   * The "Reply URL (Assertion Consumer Service URL)" will be:
   *
   * https://<Your user pool domain>/saml2/idpresponse
   *
   * With an Amazon Cognito domain prefix:
   *  https://<yourDomainPrefix>.auth.<region>.amazoncognito.com/saml2/idpresponse
   * With a custom domain:
   *  https://<Your custom domain>/saml2/idpresponse
   *
   * see: https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-saml-idp.html
   *
   * You'll want to pass either a domain prefix (creates https://<prefix>.auth.<region>.amazoncognito.com) or a
   * zone (and optionally domainName) if you don't pass a domainName the user pool url will be https://auth.<zoneName>
   *
   * NB at the time of writing AWS has a hard limit of 4 custom Cognito domains so if you're running multiple user pools
   * in a single AWS account you may need to use domain prefixes.
   */
  static withSSOMetadataUrl(
    scope: Construct,
    id: string,
    callbackUrl: string,
    samlProviderName: string,
    federationMetadataUrl?: string | undefined,
    zone?: IHostedZone,
    domainName?: string,
    domainPrefix?: string,
    logoutUrl?: string,
    ...alternativeCallbackUrls: string[]
  ): Cognito {
    const sso = new Cognito(scope, id);
    sso.addSamlIdp(samlProviderName, federationMetadataUrl, undefined);
    sso.createUserPoolClient(callbackUrl, false, logoutUrl, ...alternativeCallbackUrls);
    if (domainPrefix) sso.addDomainPrefix(domainPrefix);
    else if (zone) sso.addCustomDomain(zone, domainName || `auth.${zone.zoneName}`);
    return sso;
  }

  /**
   * Creates a Cognito instance configured for SAML sso where you have a metadata XML file (e.g. Google Workspace).
   *
   * You'll need to pass federationMetadataXml data as a string (e.g. downloaded from your Google Workspace).
   *
   * If configuring an 'App' in Google Workspace (under "Apps/Web and mobile apps" in the admin console) the "ACS URL" will be:
   *
   * https://<Your user pool domain>/saml2/idpresponse
   *
   * With an Amazon Cognito domain prefix:
   *  https://<yourDomainPrefix>.auth.<region>.amazoncognito.com/saml2/idpresponse
   * With a custom domain:
   *  https://<Your custom domain>/saml2/idpresponse
   *
   * The "Enitiy ID" will be:
   *
   *  urn:amazon:cognito:sp:<user pool id> (e.g. <region>_XyZaBcD1E)
   *
   * see: https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-saml-idp.html
   *
   * In Google Workspace you'll need to set "Use access" to e.g. "ON for everyone" (oe select an organisational unit).
   * NB it's usually best to test Google Worspace sso in incognito mode as if you're already signed in you may get a 403 error.
   * This is possibly because your local cached credentials haven't yet updated with access to the App.
   *
   * You'll want to pass either a domain prefix (creates https://<prefix>.auth.<region>.amazoncognito.com) or a
   * zone (and optionally domainName) if you don't pass a domainName the user pool url will be https://auth.<zoneName>
   *
   * NB at the time of writing AWS has a hard limit of 4 custom Cognito domains so if you're running multiple user pools
   * in a single AWS account you may need to use domain prefixes.
   */
  static withSSOMetadataXml(
    scope: Construct,
    id: string,
    callbackUrl: string,
    samlProviderName: string,
    federationMetadataXml?: string | undefined,
    zone?: IHostedZone,
    domainName?: string,
    domainPrefix?: string,
    logoutUrl?: string,
    ...alternativeCallbackUrls: string[]
  ): Cognito {
    const sso = new Cognito(scope, id);
    sso.addSamlIdp(samlProviderName, undefined, federationMetadataXml);
    sso.createUserPoolClient(callbackUrl, false, logoutUrl, ...alternativeCallbackUrls);
    if (domainPrefix) sso.addDomainPrefix(domainPrefix);
    else if (zone) sso.addCustomDomain(zone, domainName || `auth.${zone.zoneName}`);
    return sso;
  }
}
