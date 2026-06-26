import {
  APIGatewayProxyEvent,
  APIGatewayProxyEventV2,
  APIGatewayProxyResult,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';

export type ApiGatewayProxyEventAny = APIGatewayProxyEvent | APIGatewayProxyEventV2;

/** Result type that matches the incoming API Gateway / Function URL event format. */
export type ApiGatewayProxyResultFor<E extends ApiGatewayProxyEventAny> =
  E extends APIGatewayProxyEventV2 ? APIGatewayProxyStructuredResultV2 : APIGatewayProxyResult;

/**
 * Lambda Function URLs and HTTP APIs (payload format 2.0) use `rawPath`.
 * REST API / CloudFront proxy integrations use `path`.
 */
export function isApiGatewayEventV2(event: ApiGatewayProxyEventAny): event is APIGatewayProxyEventV2 {
  return typeof (event as APIGatewayProxyEventV2).rawPath === 'string';
}
