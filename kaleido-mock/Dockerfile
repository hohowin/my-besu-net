FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY tsconfig.json ./
COPY src ./src

RUN npm install --no-save ts-node typescript

EXPOSE 5001

CMD ["npx", "ts-node", "src/index.ts"]
