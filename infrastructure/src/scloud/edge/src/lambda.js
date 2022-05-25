exports.handler = async (event) => event.Records[0].cf.request;
