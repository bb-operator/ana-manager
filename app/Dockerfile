FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY public ./public
COPY src ./src

ENV PORT=8080

EXPOSE 8080

CMD ["npm", "start"]

