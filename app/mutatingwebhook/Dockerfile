FROM node:12

WORKDIR /usr/src/app

COPY package.json ./

RUN npm install

COPY index.js .
COPY lib/ ./lib

CMD [ "node", "index.js" ]