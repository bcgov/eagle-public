# OpenShift Deployment Configuration

This directory contains OpenShift templates and configuration for deploying the Eagle Public application (Angular 21).

## Overview

The Eagle Public application uses a multi-stage build process:

1. **Angular Builder** - Builds the Angular 21 application using Node.js 20+
2. **Nginx Runtime** - Serves the built application using nginx

## Prerequisites

- OpenShift 4.x cluster access
- Project namespaces: tools, dev, test, prod
- Jenkins pipeline configured
- GitHub repository access

## Build Process

The application uses Source-to-Image (S2I) builds:

### Stage 1: Angular Builder
- Base image: Node.js 20+ Alpine
- Installs npm dependencies
- Runs `ng build` to create production bundle
- Output: `/app/dist/eagle-public/browser`

### Stage 2: Nginx Runtime
- Base image: nginx-runtime (BC Gov custom image)
- Copies built artifacts from Stage 1
- Serves static files via nginx
- Configured for OpenShift routing

## Deployment Environments

### Tools
- Builds and image storage
- Jenkins pipeline execution
- Image tagging and promotion

### Dev
- Development environment
- Deployed from `develop` branch
- Auto-deployed on successful build

### Test
- QA/Testing environment
- Promoted from Dev via Jenkins pipeline
- Triggered from `test` branch

### Prod
- Production environment
- Promoted from Test via Jenkins pipeline
- Triggered from `master` branch
- Requires approval

## Configuration

### Environment Variables

Set via `publicServerEnvironmentSettings.js`:

```javascript
window.localStorage.setItem('from_public_server--remote_api_path', 'https://eagle-api.apps.silver.devops.gov.bc.ca/api');
window.localStorage.setItem('from_public_server--remote_public_path', 'https://eagle-public.apps.silver.devops.gov.bc.ca');
```

### Build Configuration

The build uses:
- **Node.js**: 20.19.6+
- **npm**: 10.9.2+
- **Angular CLI**: 21.0.0
- **Build tool**: esbuild (via @angular/build)
- **TypeScript**: 5.9.2

## Templates

Templates are located in `templates/` directory:

- `angular-builder/` - S2I builder configuration
- `angular-on-nginx/` - Deployment configuration
- `nginx-runtime/` - Runtime image configuration
- `pipeline/` - Jenkins pipeline templates

## Deployment Commands

### Manual Build Trigger
```bash
oc start-build eagle-public-angular-builder -n 6cdc9e-tools
```

### Tag Image for Deployment
```bash
# Dev
oc tag 6cdc9e-tools/eagle-public:latest 6cdc9e-tools/eagle-public:dev

# Test
oc tag 6cdc9e-tools/eagle-public:dev 6cdc9e-tools/eagle-public:test

# Prod
oc tag 6cdc9e-tools/eagle-public:test 6cdc9e-tools/eagle-public:prod
```

### Check Build Status
```bash
oc get builds -n 6cdc9e-tools | grep eagle-public
```

### View Deployment Status
```bash
oc get dc eagle-public -n 6cdc9e-dev
oc rollout status dc/eagle-public -n 6cdc9e-dev
```

## Troubleshooting

### Build Fails
1. Check build logs: `oc logs -f bc/eagle-public-angular-builder`
2. Verify Node.js version compatibility
3. Check npm dependency versions
4. Ensure build has enough memory/CPU

### Deployment Fails
1. Check deployment logs: `oc logs -f dc/eagle-public`
2. Verify image exists in registry
3. Check nginx configuration
4. Verify routes and services

### Application Issues
1. Check pod logs: `oc logs -f <pod-name>`
2. Verify environment variables in localStorage
3. Check API connectivity
4. Verify assets loaded correctly

## Migration Notes

### Angular 10 → Angular 21 Changes

Key differences from the old deployment:

1. **Node Version**: 12 → 20+
2. **Build Tool**: webpack → esbuild (10x faster)
3. **Bundle Size**: ~1.5MB → ~500KB (gzipped: 125KB)
4. **Build Time**: 30-60s → 5-10s
5. **Architecture**: NgModules → Standalone components

### Compatibility

The new deployment maintains compatibility with:
- Existing API endpoints
- OpenShift routing
- Environment configuration pattern
- Nginx serving configuration

## Resources

- [BC Gov OpenShift 4](https://developer.gov.bc.ca/docs/default/component/bc-developer-guide/openshift-projects-and-access/provision-a-project-set/)
- [S2I Extended Builds](https://github.com/bcgov/eagle-dev-guides/blob/master/dev_guides/s2i_extended_builds.md)
- [Angular Build Guide](https://angular.dev/tools/cli/build)

## Support

For issues or questions:
- Create issue in GitHub repository
- Contact DevOps team for OpenShift issues
- Check Jenkins pipeline logs for build failures
