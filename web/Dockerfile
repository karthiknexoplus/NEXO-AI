FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server.mjs ./
COPY server ./server
COPY --from=build /app/dist ./dist
RUN mkdir -p workspace
ENV PORT=3000
ENV OLLAMA_HOST=http://ollama:11434
EXPOSE 3000
CMD ["node", "server.mjs"]
