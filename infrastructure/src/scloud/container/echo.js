exports.handler = async (event) => ({
  status: 200,
  body: JSON.stringify(event),
});
