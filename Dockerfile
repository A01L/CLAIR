FROM node:22-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci --only=production

COPY . .

EXPOSE 3000

# Start app by default, worker can be started by overriding command
CMD ["npm", "run", "dev"]
