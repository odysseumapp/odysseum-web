FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Export with: docker build --output ./dist .
# This image is a static artifact, not another running service.
FROM scratch AS artifact
COPY --from=build /app/.output/public/ /
