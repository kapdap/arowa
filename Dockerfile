# Build stage
FROM node:alpine AS build

WORKDIR /build

# Cache build dependencies
COPY package.json .
RUN npm install

# Build production app
COPY . .
RUN npm run build

# Production stage
FROM node:alpine

WORKDIR /app

# Copy build artifacts
COPY --from=build /build/dist ./dist
COPY --from=build /build/package.json .
COPY --from=build /build/.env.example .
COPY --from=build /build/.env.example ./.env
COPY --from=build /build/README.md .
COPY --from=build /build/LICENSE .

# Install production dependencies only
RUN npm install --omit=dev --ignore-scripts

EXPOSE 3000

# Start the server
CMD ["npm", "start"]