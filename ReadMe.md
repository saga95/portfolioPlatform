# Portfolio Platform

Portfolio platform allows developers to build, manage, and deploy their portfolios. The system is designed as a monorepo including both the frontend and backend, and leverages AWS CDK for managing infrastructure.

## Features

- AWS S3 for static website hosting and blog articles
- DynamoDB for storing contact form responses
- AWS Lambda functions for serverless operations
- Custom domain setup with AWS Route 53
- Admin dashboard for content management

## Getting Started

Before you begin, make sure you have the following prerequisites:

- An AWS Account
- Node.js installed locally
- AWS CDK installed and configured
- A GitHub account

Clone this repository to your local machine.

```sh
git clone https://github.com/{your-username}/portfolio-platform.git
```

Navigate to the backend directory, install dependencies and bootstrap the CDK:

`cd portfolio-platform/infrastrucutre/cdk
npm install
cdk bootstrap
`

Navigate to the frontend directory, install dependencies:

`cd ../packages/frontend
npm install
`
## Usage

Once all the services are running, you can visit http://localhost:3000 to view the portfolio platform.

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

[MIT](https://choosealicense.com/licenses/mit/)

Please replace `{your-username}` with your actual GitHub username in the clone URL. As you make progress with your project, be sure to keep your README up-to-date, adding specific instructions for running your app, tests, and any other important information for users and contributors.
