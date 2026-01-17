# Multi-stage build for Angular 21 with Node 24+
# Stage 1: Build the Angular application
FROM node:24-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies
RUN corepack enable && yarn install --immutable

# Copy application source
COPY . .

# Build the application for production
RUN yarn run build

# Stage 2: Serve with nginx
FROM nginx:alpine

# Copy custom nginx configuration if needed
# COPY nginx.conf /etc/nginx/nginx.conf

# Copy built application from builder stage
COPY --from=builder /app/dist/eagle-public/browser /usr/share/nginx/html

# Copy environment settings that can be configured at runtime
COPY src/publicServerEnvironmentSettings.js /usr/share/nginx/html/

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
