FROM node:15

WORKDIR /usr/src/app

COPY lib/ ./lib

COPY package.json ./
RUN npm install

COPY index.js ./

CMD [ "node", "index.js" ]