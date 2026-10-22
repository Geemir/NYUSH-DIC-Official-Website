# The DIC API on any server with Docker (e.g. a small cloud server in Hong
# Kong): docker build -t nyushdic-api . && docker run -d --env-file .env \
#   -v nyushdic-data:/app/data -p 8787:8787 nyushdic-api
FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY schema.sql ./
COPY src ./src
ENV HOST=0.0.0.0 PORT=8787 DATABASE_PATH=/app/data/dic.sqlite
RUN mkdir -p /app/data && chown node:node /app/data
VOLUME /app/data
EXPOSE 8787
USER node
CMD ["node", "src/node.js"]
