import { CloudFrontRequest, CloudFrontRequestEvent, Context } from 'aws-lambda';

export function filterHostHeader(request: CloudFrontRequest) {
  if (Object.keys(request.headers).includes('host')) {
    console.log(`Filtering 'host' header: ${JSON.stringify(request.headers.host)}`);
  }
  delete request.headers.host;
  Object.keys(request.headers).forEach((header) => {
    if (header.toLowerCase() === 'host') {
      console.warn(`Headers still contains a key ${header}: ${JSON.stringify(request.headers[header])}`);
    }
  });
}

export async function handler(event: CloudFrontRequestEvent, context: Context)
: Promise<CloudFrontRequest> {
  console.log(`Executing ${context.functionName} to filter 'host' header`);

  const { request } = event.Records[0].cf;
  filterHostHeader(request);
  Object.keys(request.headers).forEach((header) => {
    if (header.toLowerCase() === 'host') {
      console.warn(`Recheck: headers still contains a key ${header}: ${JSON.stringify(request.headers[header])}`);
    }
  });

  return request;
}
