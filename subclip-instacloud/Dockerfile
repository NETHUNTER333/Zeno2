FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.mjs ./
EXPOSE 8080
ENV PORT=8080
ENV INSTACLOUD_PROJECT_ID=0d8d285e-6ac2-4b38-b313-449dc5694cc2
CMD ["node", "server.mjs"]
