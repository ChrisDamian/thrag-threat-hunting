#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ThragInfrastructureStack } from './stacks/thrag-infrastructure-stack';
import { ThragDataStack } from './stacks/thrag-data-stack';
import { ThragAgentsStack } from './stacks/thrag-agents-stack';
import { ThragApiStack } from './stacks/thrag-api-stack';

const app = new cdk.App();

// Environment configuration
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// Core infrastructure stack
const infrastructureStack = new ThragInfrastructureStack(app, 'ThragInfrastructureStack', {
  env,
  description: 'THRAG Core Infrastructure - Bedrock, OpenSearch, and foundational services',
});

// Data processing and storage stack
const dataStack = new ThragDataStack(app, 'ThragDataStack', {
  env,
  description: 'THRAG Data Processing - Kinesis, DynamoDB, and ML pipeline',
  knowledgeBase: infrastructureStack.knowledgeBase,
  vectorStore: infrastructureStack.vectorStore,
  threatIntelBucket: infrastructureStack.threatIntelBucket,
});

// AI agents and orchestration stack
const agentsStack = new ThragAgentsStack(app, 'ThragAgentsStack', {
  env,
  description: 'THRAG AI Agents - Bedrock AgentCore and specialized security agents',
  knowledgeBase: infrastructureStack.knowledgeBase,
  dataProcessingResources: dataStack.dataProcessingResources,
});

// API and web interface stack
const apiStack = new ThragApiStack(app, 'ThragApiStack', {
  env,
  description: 'THRAG API and Web Interface - API Gateway, Lambda functions, and React dashboard',
  agents: agentsStack.agents,
  dataResources: dataStack.dataProcessingResources,
});

// Add dependencies
dataStack.addDependency(infrastructureStack);
agentsStack.addDependency(dataStack);
apiStack.addDependency(agentsStack);

// Add tags to all stacks
cdk.Tags.of(app).add('Project', 'THRAG');
cdk.Tags.of(app).add('Environment', process.env.ENVIRONMENT || 'development');
cdk.Tags.of(app).add('Owner', 'SecurityTeam');