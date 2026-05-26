FROM node:lts-alpine3.23

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY server.js .

EXPOSE 8081

CMD ["node", "server.js"]
