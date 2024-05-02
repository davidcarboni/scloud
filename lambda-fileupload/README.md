# Lambda / API Gateway file uploads

There's a limit to the request size you can send to API Gateway (10M) and Lanbda (6M). This means you can't upload / download files where the size might be greater than this limit.

Even if files are smaller, you'll need to do some work to configure binary media types and base-64 encode the data. See https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-payload-encodings.html

If you've done some Googling, you'll likely have come across the concept of pre-signed URLs, which allow your application to upload/download directly to/from s3. This package aims to make implementing that pattern as easy as possible.

There's no magic here, these are straightforward wrapper functions that eliminate complexity and give you what you're likely to need.

This is intended to provide you with the operations you'll mostly need most of the time and, if you have an edge-case, example code you can reuse that helps you get what you need done more easily.

## Release notes

 * `0.0.7`: Fix default validity windows of `getUrl` and `putUrl` to match the documentation.

## Functions

This package offers 3 functions, `GET`/`PUT` (good for programmatic access) and `POST` (which is good for HTML forms, but a little more involved)

### GET/PUT

Most useful for programmatic assess:

```
import { getUrl, putUrl } from '@scloud/lambda-fileupload';

// Upload
const put = await putUrl('mybucket', 'key/of/destination/file.png');
const fileData = await // Read in your file
await axios.put(put, fileData);

// Download
const get = await getUrl('mybucket', 'key/of/destination/file.png');
const response = await axios.get(get);
const imageData = response.data; // Handle downloaded content

```

### POST

Most useful for HTML forms:

```
import { postUrl } 'from @scloud/lambda-fileupload'

// Form field values
const post = await postUrl('mybucket', 'key/of/destination/file.png');

console.log(post.url);
// https://mybucket.s3.eu-west-2.amazonaws.com/

console.log(post.fields);
// {
//   bucket: 'mybucket',
//   'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
//   'X-Amz-Credential': '...',
//   'X-Amz-Date': '20230813T115102Z',
//   key: 'key/of/destination/file.png',
//   Policy: '...',
//   'X-Amz-Signature': '...'
}
```

The URL goes in the form action and the fields need to be added as hidden fields in the form, with the 'file' field at the end.

For more detail on using a pre-signed post see: https://www.npmjs.com/package/@aws-sdk/s3-presigned-post#user-content-post-file-using-html-form