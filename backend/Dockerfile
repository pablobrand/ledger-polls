FROM node:24.5.0-alpine
RUN apk add --no-cache openssl1.1 || apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npx prisma generate
EXPOSE 4000
CMD ["npm", "run", "start"]
