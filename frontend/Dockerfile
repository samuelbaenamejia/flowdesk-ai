FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json ./
RUN npm install

FROM base AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./
COPY --from=build /app/next.config.js ./
EXPOSE 3000
CMD ["npm", "start"]
