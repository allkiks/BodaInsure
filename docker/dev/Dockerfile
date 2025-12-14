# BodaInsure API Development Dockerfile
# Optimized for development with hot-reload support

FROM node:20-alpine

# Install development tools
RUN apk add --no-cache git

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies)
RUN npm ci

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Start in development mode with hot-reload
CMD ["npm", "run", "start:dev"]
