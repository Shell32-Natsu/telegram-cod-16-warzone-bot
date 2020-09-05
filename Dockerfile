FROM node:12

WORKDIR /home/node

COPY . .

RUN npm install
RUN npm run build

ENTRYPOINT ["node", "dist/index.js"]