FROM node:20-alpine AS builder
WORKDIR /src
COPY index.ts /src/index.ts
COPY package.json yarn.lock tsconfig.json /src/
RUN yarn
RUN yarn tsc

FROM node:20-alpine
WORKDIR /app
COPY package.json yarn.lock /app/
COPY --from=builder /src/index.js /app/index.js

CMD ["/app/index.js"]