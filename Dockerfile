# =============================================================================
# Eagle-Public Multi-Stage Dockerfile
# =============================================================================
# Simplified deployment: Single Dockerfile with embedded nginx configuration.
# App fetches runtime config from /api/config (configEndpoint=true).
#
# Build: docker build -t eagle-public .
# Run:   docker run -p 8080:8080 eagle-public
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Build Angular Application
# -----------------------------------------------------------------------------
FROM node:24-alpine AS builder

WORKDIR /app

# Copy package files and yarn configuration
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn

# Install dependencies (uses node-modules linker per .yarnrc.yml)
RUN corepack enable && yarn install --immutable

# Copy source code (node_modules already exists from previous layer)
COPY . .

# Configure env.js for deployed environment:
# - configEndpoint=true: App fetches config from /api/config at runtime
# - API_LOCATION cleared: Forces use of relative paths (nginx handles routing)
# - logLevel=4: Only show errors in production (not debug/info logs)
# - ANALYTICS_DEBUG=false: Disable analytics debug logs in production
# - All other config (ENVIRONMENT, ANALYTICS_API_URL, etc.) comes from API
RUN sed -i 's/configEndpoint = false/configEndpoint = true/' src/env.js && \
    sed -i "s/window.__env.API_LOCATION = .*/window.__env.API_LOCATION = null;/" src/env.js && \
    sed -i 's/window.__env.logLevel = 0/window.__env.logLevel = 4/' src/env.js && \
    sed -i 's/window.__env.ANALYTICS_DEBUG = true/window.__env.ANALYTICS_DEBUG = false/' src/env.js

# Build production bundle
RUN yarn build

# -----------------------------------------------------------------------------
# Stage 2: Production nginx Server
# -----------------------------------------------------------------------------
FROM nginx:1.27-alpine

# Update Alpine packages to latest security patches
RUN apk upgrade --no-cache

# Labels for OpenShift compatibility
LABEL io.openshift.expose-services="8080:http" \
      io.openshift.tags="nginx,angular,eagle-public"

# Create nginx config directory and set permissions for OpenShift
RUN mkdir -p /var/cache/nginx /var/run /tmp/app/dist/eagle-public/browser && \
    chown -R nginx:0 /var/cache/nginx /var/run /var/log/nginx /tmp/app && \
    chmod -R g+rwx /var/cache/nginx /var/run /var/log/nginx /tmp/app

# Copy nginx configuration
COPY <<'EOF' /etc/nginx/nginx.conf
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript 
               application/xml application/xml+rss text/javascript application/wasm;

    include /etc/nginx/conf.d/*.conf;
}
EOF

# Security headers, in an include rather than inline.
#
# `add_header` DOES NOT INHERIT ONCE A BLOCK DECLARES ITS OWN. nginx replaces the whole inherited
# set, so the `add_header Cache-Control` in the caching locations below silently discarded every
# security header. That is not theoretical: the dev pod served `/` with two Cache-Control headers
# and NO Content-Security-Policy at all, because `/` renders index.html and matches the
# `\.(html|json)$` location. The header existed in this file and reached nobody.
#
# There is no "append" form, so the only fix is to repeat the set in every block that adds a header
# of its own — hence the include, so the list exists once.
#
# `https://unpkg.com` is part of the policy, not an afterthought: index.html loads Leaflet and its
# marker-cluster plugin from there (only their @types are npm dependencies). Fixing the delivery
# without this would enforce a policy that blocks the map library and white-screen the site.
COPY <<'EOF' /etc/nginx/security-headers.conf
add_header Content-Security-Policy "default-src 'self' https://*.gov.bc.ca; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com; style-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.gov.bc.ca; frame-ancestors 'none';" always;
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "browsing-topics=(), run-ad-auction=(), join-ad-interest-group=(), private-state-token-redemption=(), private-state-token-issuance=(), private-aggregation=(), attribution-reporting=()" always;
EOF

# Copy server configuration
COPY <<'EOF' /etc/nginx/conf.d/default.conf
server {
    listen 8080 default_server;
    server_name localhost;

    include /etc/nginx/security-headers.conf;

    # Health check endpoint
    location /health {
        access_log off;
        return 200 'healthy';
        include /etc/nginx/security-headers.conf;
        add_header Content-Type text/plain;
    }

    # Proxy config requests to the main rproxy service to get test env config
    location = /api/config {
        proxy_pass http://rproxy:8080/api/config;
        proxy_pass_request_headers on;
    }

    # Proxy API requests to eagle-api
    location /api {
        proxy_pass http://eagle-api:3000;
        proxy_pass_request_headers on;
    }

    # Proxy Analytics requests to penguin-analytics-api
    location /analytics {
        proxy_pass http://penguin-analytics-api:3000/analytics;
        proxy_pass_request_headers on;
    }

    # Angular SPA - serve static files with fallback to index.html
    # Note: /api/* requests are handled by rproxy (eao-nginx) which routes directly to eagle-api
    location / {
        root /tmp/app/dist/eagle-public/browser;
        index index.html;
        try_files $uri $uri/ /index.html;

        # Runtime config — must never be cached (changes between deployments)
        location = /env.js {
            expires -1;
            include /etc/nginx/security-headers.conf;
            add_header Cache-Control "no-cache, no-store, must-revalidate";
        }

        # Cache static assets (hashed filenames safe to cache long-term)
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            include /etc/nginx/security-headers.conf;
            add_header Cache-Control "public, immutable";
        }

        # Don't cache HTML or config files
        location ~* \.(html|json)$ {
            expires -1;
            include /etc/nginx/security-headers.conf;
            add_header Cache-Control "no-cache, no-store, must-revalidate";
        }
    }

    # Error pages
    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}
EOF

# Copy built Angular application
COPY --from=builder /app/dist/eagle-public/browser /tmp/app/dist/eagle-public/browser

# Use non-root user for OpenShift compatibility
USER nginx

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q --spider http://localhost:8080/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
