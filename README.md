# eagle-public

Public facing site project for EPIC

## Related projects

Eagle is a revision name of the EAO EPIC application suite.

These projects comprise EAO EPIC:

* <https://github.com/bcgov/eagle-api>
* <https://github.com/bcgov/eagle-public>
* <https://github.com/bcgov/eagle-admin>
* <https://github.com/bcgov/eagle-mobile-inspections>
* <https://github.com/bcgov/eagle-reports>
* <https://github.com/bcgov/eagle-helper-pods>
* <https://github.com/bcgov/eagle-dev-guides>

## Prerequisites

Note: The following commands work in MacOS bash (not zsh which now default in Catalina). The scripts are currently not fully working in Windows and Linux, so you may need to look at the source of the scripts and manually apply the commands in a right order.

Run the following two scripts to create your environment

```bash
#!/bin/bash
.\install_prerequisites.sh
```

```bash
#!/bin/bash
.\setup_project.sh
```

## Fork, Build and Run

1. After installing Node and Yarn, you can fork or straight download a copy of this application to start your own app.
2. Run `npm start` to start the webpack server to run the application on port 4300.

    Go to <http://localhost:4300> to verify that the application is running.

    :bulb: To change the default port, open `.angular-cli.json`, change the value on `defaults.serve.port`.

3. Run `npm run build` to build the project. The build artifacts will be stored in the `dist/` directory. Use the `-prod` flag for a production build, like so: `ng serve --prod` to run in production mode.
4. Run `npm run lint` to lint your app code using `TSLint`.

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
