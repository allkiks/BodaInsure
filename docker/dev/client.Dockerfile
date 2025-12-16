# BodaInsure Frontend Development Dockerfile
# Optimized for development with hot-reload support

FROM node:20-alpine

# Install development tools and wget for health checks
RUN apk add --no-cache git wget

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies)
# Using npm install instead of npm ci for flexibility with lock file
RUN npm install

# Copy source code
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Start in development mode with hot-reload
# Host binding ensures container is accessible from outside
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
