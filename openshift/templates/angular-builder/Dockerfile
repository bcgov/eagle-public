# Angular 21 Builder Image for OpenShift S2I
# Uses Node.js 24+ for building Angular application

FROM registry.access.redhat.com/ubi9/nodejs-24:latest

# Set working directory
WORKDIR /opt/app-root/src

# Enable Corepack for Yarn support
USER 0
RUN corepack enable && corepack prepare yarn@4.5.3 --activate
RUN yarn global add @angular/cli@21.0.0

# Switch back to default user
USER 1001

# The S2I assemble script will handle:
# - yarn install --immutable
# - ng build

# S2I scripts are provided by the base image
# Build output will be in dist/eagle-public/browser/
