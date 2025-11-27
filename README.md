# eagle-public

Public facing site for the Environmental Assessment Office (EAO) EPIC application.

## Related Projects

Eagle is a revision name of the EAO EPIC application suite.

These projects comprise EAO EPIC:

- [eagle-api](https://github.com/bcgov/eagle-api)
- [eagle-public](https://github.com/bcgov/eagle-public)
- [eagle-admin](https://github.com/bcgov/eagle-admin)
- [eagle-mobile-inspections](https://github.com/bcgov/eagle-mobile-inspections)
- [eagle-reports](https://github.com/bcgov/eagle-reports)
- [eagle-helper-pods](https://github.com/bcgov/eagle-helper-pods)
- [eagle-dev-guides](https://github.com/bcgov/eagle-dev-guides)

## Prerequisites

**Note:** The following commands work in macOS bash (not zsh which is now default in Catalina). The scripts are currently not fully working in Windows and Linux, so you may need to look at the source of the scripts and manually apply the commands in the correct order.

Run the following scripts to set up your environment:

```bash
./install_prerequisites.sh
./setup_project.sh
```

## Build and Run

1. After installing Node and Yarn, clone or download this repository.
2. Run `npm start` to start the development server on port 4300.

   Navigate to <http://localhost:4300> to verify that the application is running.

   💡 **Tip:** To change the default port, modify the `defaults.serve.port` value in `.angular-cli.json`.

3. Run `npm run build` to build the project. The build artifacts will be stored in the `dist/` directory. Use the `--prod` flag for a production build: `npm run build -- --prod`
4. Run `npm run lint` to lint your code using TSLint.

## CI/CD Pipeline

The EPIC project has moved away from PR based pipeline due to complexity and reliability concerns of the PR based pipeline implementation. The current CI/CD pipeline utilizes Github Actions to build Docker images and push them back into the BC Gov OpenShift Docker registry.

A full description and guide to the EPIC pipeline and branching strategy is available in the [eagle-dev-guides](https://github.com/bcgov/eagle-dev-guides/blob/master/dev_guides/github_action_pipeline.md) repository.

## Angular Code scaffolding

A brief guide to Angular CLI's code scaffolding can be found in [eagle-dev-guides](https://github.com/bcgov/eagle-dev-guides/blob/master/dev_guides/angular_scaffolding.md)

## Testing

An overview of the EPIC test stack can be found in our documentation guides: [EPIC Test Stack](https://github.com/bcgov/eagle-dev-guides/blob/master/dev_guides/testing_components.md).

Instructions on how running tests unit tests and end-to-end tests can be found in our [test documentation](https://github.com/bcgov/eagle-dev-guides/blob/master/dev_guides/angular_scaffolding.md#running-tests).

## How to Contribute

Feel free to create pull requests from the default "develop" branch, click here to create one automatically: <https://github.com/bcgov/eagle-public/pull/new/develop>
