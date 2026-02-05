# EaglePublic

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.0.2.

## Deployment

### Automated Deployments

The application uses GitHub Actions for CI/CD with Helm deployments to OpenShift:

**Development (6cdc9e-dev)**
- **Trigger**: Automatic on push to `develop` branch
- **Workflow**: `.github/workflows/build_and_promote.yaml`
- **Process**: Builds Docker image → Tags as `dev` and `<commit-sha>` → Deploys via Helm
- **URL**: https://eagle-dev.apps.silver.devops.gov.bc.ca

**Test (6cdc9e-test)**
- **Trigger**: Manual via GitHub Actions UI
- **Workflow**: `.github/workflows/deploy-to-test.yaml`
- **Process**: 
  1. Go to Actions → "Deploy to Test" → "Run workflow"
  2. Enter image tag (default: `dev`) or specific commit SHA
  3. Workflow tags image as `test` and deploys via Helm
- **URL**: https://eagle-test.apps.silver.devops.gov.bc.ca

**Production (6cdc9e-prod)**
- **Trigger**: Manual via GitHub Actions UI
- **Workflow**: `.github/workflows/deploy-to-prod.yaml`
- **Process**:
  1. Go to Actions → "Deploy to Prod" → "Run workflow"
  2. Enter image tag (default: `test`) or specific commit SHA
  3. Workflow tags image as `prod` and deploys via Helm
- **URL**: https://eagle.gov.bc.ca

### Deployment Flow Example

```bash
# 1. Push to develop → auto-deploys to dev with tag abc1234
git push origin develop

# 2. Manually promote to test (via GitHub UI)
#    - Select "Deploy to Test" workflow
#    - Input: abc1234 (or leave default "dev")
#    - Click "Run workflow"

# 3. Manually promote to production (via GitHub UI)
#    - Select "Deploy to Prod" workflow
#    - Input: abc1234 (or leave default "test")
#    - Click "Run workflow"
```

### Helm Charts

The application is deployed using Helm charts located in `helm/eagle-public/`:
- `values-dev.yaml` - Development configuration
- `values-test.yaml` - Test configuration
- `values-prod.yaml` - Production configuration

To deploy locally:
```bash
helm upgrade --install eagle-public ./helm/eagle-public \
  --namespace 6cdc9e-dev \
  --values ./helm/eagle-public/values-dev.yaml \
  --set image.tag=latest
```

## Development server

To start a local development server, run:

```bash
npm start
# or
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
