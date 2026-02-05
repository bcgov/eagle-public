# Eagle-Public Deployment Guide

## Overview

Eagle-public uses GitHub Actions for CI/CD with Helm-based deployments to OpenShift. Deployments to test/prod are manual via `workflow_dispatch`.

## Architecture

- **Build Once, Deploy Everywhere**: Docker images built once in dev, tagged for test/prod
- **Configuration Management**: Uses `configEndpoint=true` to fetch runtime config from `/api/config`
- **Helm Deployments**: Uses Helm charts with environment-specific values files
- **Route Architecture**: All traffic goes through rproxy reverse proxy

## Deployment Workflow

### 1. Dev Environment (Automatic)

**Trigger**: Push to `develop` branch

```yaml
# .github/workflows/build_and_promote.yaml
on:
  push:
    branches: [develop]
```

**Process**:
1. Builds Docker image with nginx + Angular app
2. **Dockerfile modifies env.js**:
   ```dockerfile
   RUN sed -i 's/configEndpoint = false/configEndpoint = true/' src/env.js
   ```
3. Pushes image to OpenShift registry with tags: `dev` and `ci-<sha>`
4. Deploys to dev namespace using Helm:
   ```bash
   helm upgrade eagle-public ./helm/eagle-public \
     -f helm/eagle-public/values-dev.yaml \
     --set image.tag=dev
   ```

---

### 2. Test Environment (Manual)

**Trigger**: `workflow_dispatch` (manual via GitHub Actions UI)

```bash
# Via GitHub UI: Actions → Deploy to Test → Run workflow
```

**Process**:
1. Tags existing `dev` image as `test`
2. Deploys using Helm with test values:
   ```bash
   helm upgrade eagle-public ./helm/eagle-public \
     -f helm/eagle-public/values-test.yaml \
     --set image.tag=test
   ```

**Configuration**: `helm/eagle-public/values-test.yaml`
- 2 replicas
- SSL certificate for test.projects.eao.gov.bc.ca
- `role: frontend-public-eagle-epic` label for network policies

---

### 3. Prod Environment (Manual)

**Trigger**: `workflow_dispatch` (manual via GitHub Actions UI)

```bash
# Via GitHub UI: Actions → Deploy to Prod → Run workflow
```

**Process**:
1. Tags existing `test` image as `prod`
2. Deploys using Helm with prod values:
   ```bash
   helm upgrade eagle-public ./helm/eagle-public \
     -f helm/eagle-public/values-prod.yaml \
     --set image.tag=prod
   ```

**Configuration**: `helm/eagle-public/values-prod.yaml`
- Horizontal Pod Autoscaler (3-6 replicas)
- SSL certificate for projects.eao.gov.bc.ca
- Production resource limits

---

## Configuration System

### env.js (Modified in Dockerfile)

Located at `src/env.js`, modified during Docker build:

```javascript
// Source code (before build)
window.__env.configEndpoint = false;
window.__env.ENVIRONMENT = 'local';
window.__env.API_LOCATION = '';
window.__env.API_PATH = '/api/public';
window.__env.ANALYTICS_API_URL = 'http://localhost:3001/analytics';

// After Dockerfile sed (deployed environments)
window.__env.configEndpoint = true;  // ← Changed by Dockerfile
// Everything else stays as-is
```

**Key Dockerfile line**:
```dockerfile
RUN sed -i 's/configEndpoint = false/configEndpoint = true/' src/env.js
```

---

### Runtime Config (/api/public/config)

Served by eagle-api, loaded by `ConfigService.init()` on app startup.

**Flow**:
1. Angular app loads, `env.js` runs first
2. ConfigService sees `configEndpoint=true`
3. Fetches `/api/public/config` from eagle-api
4. Merges API response over env.js values (API wins)

**eagle-api /api/public/config response example**:
```json
{
  "ENVIRONMENT": "test",
  "BANNER_COLOUR": "green",
  "API_LOCATION": "",
  "API_PATH": "/api/public",
  "ANALYTICS_API_URL": "/analytics",
  ...
}
```

---

## Route Architecture

All traffic flows through **rproxy** (eao-nginx reverse proxy):

```
User → Route (test.projects.eao.gov.bc.ca)
         ↓
      rproxy service
         ↓
    ┌────────┼────────┐
    ↓        ↓        ↓
  /      /admin/    /api
    ↓        ↓        ↓
eagle-  eagle-   eagle-
public  admin     api
```

### rproxy Configuration

**nginx location blocks** (in eao-nginx repo):

```nginx
location / {
    proxy_pass http://eagle-public:8080/;
}

location /admin/ {
    proxy_pass http://eagle-admin:8080/admin/;
}

location /api {
    proxy_pass http://eagle-api:3000/api;
}

location /analytics {
    proxy_pass http://penguin-analytics-api:3001/analytics;
}
```

**Network Policies**: eagle-public pods require label:
```yaml
metadata:
  labels:
    role: frontend-public-eagle-epic
```

This allows rproxy to route traffic to eagle-public.

---

## Required eagle-api Environment Variables

For eagle-public to get correct config, eagle-api **must** have these env vars set:

### Dev (6cdc9e-dev)
```bash
oc set env dc/eagle-api \
  ENVIRONMENT=dev \
  BANNER_COLOUR=yellow \
  ANALYTICS_API_URL=/analytics \
  -n 6cdc9e-dev
```

### Test (6cdc9e-test)
```bash
oc set env dc/eagle-api \
  ENVIRONMENT=test \
  BANNER_COLOUR=green \
  ANALYTICS_API_URL=/analytics \
  -n 6cdc9e-test
```

### Prod (6cdc9e-prod)
```bash
oc set env dc/eagle-api \
  ENVIRONMENT=prod \
  BANNER_COLOUR= \
  ANALYTICS_API_URL=/analytics \
  -n 6cdc9e-prod
```

**Verify config endpoint**:
```bash
# Test
curl -s https://test.projects.eao.gov.bc.ca/api/public/config | jq

# Prod
curl -s https://projects.eao.gov.bc.ca/api/public/config | jq
```

---

## Helm Chart Structure

```
helm/eagle-public/
├── Chart.yaml
├── values.yaml           # Default values
├── values-dev.yaml       # Dev overrides
├── values-test.yaml      # Test overrides
├── values-prod.yaml      # Prod overrides
└── templates/
    ├── deployment.yaml   # Deployment with role label
    ├── service.yaml      # ClusterIP service
    ├── route.yaml        # OpenShift route with SSL
    └── hpa.yaml          # HorizontalPodAutoscaler (prod only)
```

**Key Helm values**:

| Value | Dev | Test | Prod |
|-------|-----|------|------|
| `image.tag` | dev | test | prod |
| `replicaCount` | 1 | 2 | 3-6 (autoscale) |
| `route.host` | eagle-dev.apps.silver.devops.gov.bc.ca | test.projects.eao.gov.bc.ca | projects.eao.gov.bc.ca |
| `route.tls.certificate` | Default | Custom cert | Custom cert |

---

## Troubleshooting

### Issue: MIME type errors (JS files return HTML)

**Symptoms**:
- Browser console: "Failed to load module script: Expected a JavaScript module script but the server responded with a MIME type of text/html"
- White screen or blank page

**Cause**: Request reaching eagle-public pod but nginx not serving files correctly, or route pointing to wrong service.

**Solution**:
1. Verify route points to eagle-public service:
   ```bash
   oc get route eagle-public -n 6cdc9e-test -o jsonpath='{.spec.to.name}'
   ```
   Should return: `rproxy` (not `eagle-public` directly)

2. Check rproxy configuration:
   ```bash
   oc exec -n 6cdc9e-test deployment/rproxy -- cat /etc/nginx/conf.d/server.conf | grep "location /"
   ```

3. Restart rproxy to clear DNS cache:
   ```bash
   oc rollout restart deployment/rproxy -n 6cdc9e-test
   ```

---

### Issue: 502 Bad Gateway

**Cause**: rproxy can't reach eagle-public service, or pods not running.

**Solution**:
1. Check eagle-public pods:
   ```bash
   oc get pods -n 6cdc9e-test -l app=eagle-public
   ```

2. Check network policy allows rproxy → eagle-public:
   ```bash
   oc get networkpolicy -n 6cdc9e-test | grep eagle
   ```

3. Verify pod has correct label:
   ```bash
   oc get pods -n 6cdc9e-test -l role=frontend-public-eagle-epic
   ```

---

### Issue: SSL certificate mismatch

**Symptoms**: Browser shows certificate warning or wrong domain.

**Solution**: Update Helm values with correct certificate:

1. Get certificate from working route:
   ```bash
   oc get route test.projects.eao.gov.bc.ca -n 6cdc9e-test -o jsonpath='{.spec.tls.certificate}' > cert.pem
   ```

2. Update `values-test.yaml`:
   ```yaml
   route:
     tls:
       certificate: |
         -----BEGIN CERTIFICATE-----
         [paste cert here]
         -----END CERTIFICATE-----
   ```

3. Redeploy:
   ```bash
   helm upgrade eagle-public ./helm/eagle-public -f helm/eagle-public/values-test.yaml -n 6cdc9e-test
   ```

---

### Issue: Analytics not working

**Verify analytics endpoint**:
```bash
# Test analytics POST
curl -X POST https://test.projects.eao.gov.bc.ca/analytics \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "test",
    "sessionId": "test123",
    "sourceApp": "eagle-public",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'"
  }'
```

**Expected response**: `201 Created` with JSON data

**If 404**: Check rproxy has `/analytics` location block (see rproxy docs)

**If 503**: Check penguin-analytics pods are running

---

### Issue: API calls failing

**Check proxy configuration**:
```bash
# Verify API is reachable
curl -s https://test.projects.eao.gov.bc.ca/api/public/projects | jq
```

**Common issues**:
- eagle-api pods not running
- rproxy misconfigured
- Network policy blocking traffic

---

## Local Development

For local development:

1. Keep `configEndpoint=false` in `src/env.js`
2. Use `yarn start` to run dev server
3. Uses `proxy.conf.json` to route `/api` to dev OpenShift API

```json
{
  "/api": {
    "target": "https://eagle-dev.apps.silver.devops.gov.bc.ca",
    "secure": false,
    "changeOrigin": true
  }
}
```

---

## Image Promotion Flow

```
develop branch push
    ↓
Docker build + push
    ↓
dev tag + deploy (Helm)
    ↓ (manual via workflow_dispatch)
test tag + deploy (Helm)
    ↓ (manual via workflow_dispatch)
prod tag + deploy (Helm)
```

---

## Best Practices

1. **Use Helm for all deployments** - ensures consistency and reproducibility
2. **Test in dev before promoting** - verify functionality before test/prod
3. **Manual test/prod deployments** - prevents accidental production changes
4. **Update SSL certificates in Helm values** - don't manually edit routes
5. **Verify `/api/public/config`** - ensure eagle-api returns correct environment config
6. **Use network policy labels** - `role: frontend-public-eagle-epic` required for rproxy routing
7. **Never bypass rproxy** - always route traffic through rproxy for consistent behavior
