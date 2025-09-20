#!/bin/bash

# CloudGuard AI Infrastructure Deployment Script
# Uses AWS CDK to deploy AgentCore + S3 Vectors + SageMaker stack

set -e

echo "🛡️  CloudGuard AI - Infrastructure Deployment"
echo "=============================================="

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please install AWS CLI."
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please install npm."
    exit 1
fi

echo "✅ Prerequisites check passed"

# Install CDK dependencies
echo "📦 Installing CDK dependencies..."
npm install -g aws-cdk
cd infrastructure
npm install

# Bootstrap CDK (if not already done)
echo "🚀 Bootstrapping CDK..."
cdk bootstrap

# Deploy the stack
echo "🏗️  Deploying CloudGuard AI stack..."
cdk deploy --require-approval never

echo ""
echo "🎉 Deployment completed successfully!"
echo ""
echo "📊 Next steps:"
echo "1. Configure AgentCore agents in the AWS console"
echo "2. Set up data ingestion pipelines (CloudTrail, VPC Flow Logs)"
echo "3. Configure alert thresholds and response playbooks"
echo "4. Test the demo scenarios"
echo ""
echo "🔗 Useful links:"
echo "- AgentCore Console: https://console.aws.amazon.com/bedrock/home#/agentcore"
echo "- S3 Vectors: https://console.aws.amazon.com/s3/"
echo "- SageMaker: https://console.aws.amazon.com/sagemaker/"
echo ""
echo "For demo setup, run: npm run demo:setup"