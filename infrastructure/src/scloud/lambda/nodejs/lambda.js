exports.handler = async (event) => {
  console.log('Placeholder function code.');
  const input = JSON.stringify(event);
  console.log(input);
  return {
    status: 200,
    body: input,
  };
};
