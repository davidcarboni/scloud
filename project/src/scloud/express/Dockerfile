
FROM node:alpine

WORKDIR /hello-world

# Dependencies
RUN npm init -y
RUN npm install express

# Minimal index file
RUN echo "const express = require('express')" >> index.js
RUN echo "const app = express()" >> index.js
RUN echo "app.get('/', (req, res) => res.send('Hello World!'))" >> index.js
RUN echo "app.listen(3000, () => console.log('Server ready'))" >> index.js

CMD [ "index.js" ]