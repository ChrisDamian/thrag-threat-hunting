import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as sagemaker from 'aws-cdk-lib/aws-sagemaker';
import { Construct } from 'constructs';

export class CloudGuardAIStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 Vectors bucket for threat intelligence storage
    const vectorStorageBucket = new s3.Bucket(this, 'ThreatIntelligenceVectors', {
      bucketName: 'cloudguard-ai-vectors',
      versioned: true,
      lifecycleRules: [{
        id: 'intelligent-tiering',
        status: s3.LifecycleRuleStatus.ENABLED,
        transitions: [{
          storageClass: s3.StorageClass.INTELLIGENT_TIERING,
          transitionAfter: cdk.Duration.days(1)
        }]
      }],
      // Enable S3 Vector support (note: this is conceptual for the new service)
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL
    });

    // Audit trail bucket with immutable storage
    const auditBucket = new s3.Bucket(this, 'AuditTrail', {
      bucketName: 'cloudguard-ai-audit',
      objectLockEnabled: true,
      objectLockDefaultRetention: {
        mode: s3.ObjectLockRetentionMode.COMPLIANCE,
        duration: cdk.Duration.days(2555) // 7 years for compliance
      },
      versioned: true
    });

    // IAM role for AgentCore runtime
    const agentCoreRole = new iam.Role(this, 'AgentCoreExecutionRole', {
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonBedrockFullAccess')
      ],
      inlinePolicies: {
        VectorStorageAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:GetObject',
                's3:PutObject',
                's3:DeleteObject',
                's3:ListBucket'
              ],
              resources: [
                vectorStorageBucket.bucketArn,
                `${vectorStorageBucket.bucketArn}/*`
              ]
            })
          ]
        }),
        AuditLogging: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:PutObject',
                's3:PutObjectLegalHold',
                's3:PutObjectRetention'
              ],
              resources: [
                `${auditBucket.bucketArn}/*`
              ]
            })
          ]
        })
      }
    });

    // Lambda function for threat detection preprocessing
    const threatDetectionFunction = new lambda.Function(this, 'ThreatDetectionPreprocessor', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
import json
import boto3
import uuid
from datetime import datetime

def handler(event, context):
    """
    Preprocess security logs for AgentCore analysis
    - Extract relevant features
    - Normalize timestamps
    - Prepare for vector embedding
    """
    
    # Initialize AWS services
    bedrock = boto3.client('bedrock-runtime')
    s3 = boto3.client('s3')
    
    # Process incoming log events
    processed_events = []
    
    for record in event.get('Records', []):
        # Parse CloudTrail/VPC Flow/GuardDuty logs
        log_data = json.loads(record.get('body', '{}'))
        
        # Extract features for ML analysis
        features = {
            'timestamp': datetime.utcnow().isoformat(),
            'source_ip': log_data.get('sourceIPAddress'),
            'user_identity': log_data.get('userIdentity', {}),
            'event_name': log_data.get('eventName'),
            'aws_region': log_data.get('awsRegion'),
            'user_agent': log_data.get('userAgent'),
            'error_code': log_data.get('errorCode'),
            'risk_score': calculate_risk_score(log_data)
        }
        
        processed_events.append(features)
    
    # Store processed events for vector embedding
    for event_data in processed_events:
        # Generate embedding using Bedrock
        embedding_response = bedrock.invoke_model(
            modelId='amazon.titan-embed-text-v1',
            body=json.dumps({
                'inputText': json.dumps(event_data)
            })
        )
        
        # Store in S3 Vectors (conceptual - using regular S3 for demo)
        vector_key = f"vectors/{datetime.utcnow().strftime('%Y/%m/%d')}/{uuid.uuid4()}.json"
        s3.put_object(
            Bucket='${vectorStorageBucket.bucketName}',
            Key=vector_key,
            Body=json.dumps({
                'metadata': event_data,
                'embedding': json.loads(embedding_response['body'])
            })
        )
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'processed_events': len(processed_events),
            'message': 'Successfully preprocessed security logs'
        })
    }

def calculate_risk_score(log_data):
    """Calculate basic risk score based on log attributes"""
    score = 0.0
    
    # Check for suspicious indicators
    if log_data.get('errorCode'):
        score += 0.3
    
    if log_data.get('eventName') in ['AssumeRole', 'GetSessionToken']:
        score += 0.2
    
    # Add more sophisticated risk scoring logic here
    return min(score, 1.0)
      `),
      environment: {
        'VECTOR_BUCKET': vectorStorageBucket.bucketName,
        'AUDIT_BUCKET': auditBucket.bucketName
      },
      timeout: cdk.Duration.minutes(5),
      memorySize: 512
    });

    // Grant necessary permissions
    vectorStorageBucket.grantReadWrite(threatDetectionFunction);
    auditBucket.grantWrite(threatDetectionFunction);

    // AgentCore Knowledge Base (conceptual configuration)
    const knowledgeBase = new bedrock.CfnKnowledgeBase(this, 'ThreatIntelligenceKB', {
      name: 'CloudGuard-AI-ThreatIntel',
      description: 'Threat intelligence and attack pattern knowledge base',
      roleArn: agentCoreRole.roleArn,
      knowledgeBaseConfiguration: {
        type: 'VECTOR',
        vectorKnowledgeBaseConfiguration: {
          embeddingModelArn: 'arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v1'
        }
      },
      storageConfiguration: {
        type: 'OPENSEARCH_SERVERLESS',
        opensearchServerlessConfiguration: {
          collectionArn: 'arn:aws:aoss:us-east-1:123456789012:collection/threat-intel',
          vectorIndexName: 'threat-vectors',
          fieldMapping: {
            vectorField: 'embedding',
            textField: 'content',
            metadataField: 'metadata'
          }
        }
      }
    });

    // Output important ARNs and endpoints
    new cdk.CfnOutput(this, 'VectorStorageBucket', {
      value: vectorStorageBucket.bucketName,
      description: 'S3 bucket for vector storage'
    });

    new cdk.CfnOutput(this, 'AuditBucket', {
      value: auditBucket.bucketName,
      description: 'Immutable audit trail bucket'
    });

    new cdk.CfnOutput(this, 'ThreatDetectionFunction', {
      value: threatDetectionFunction.functionArn,
      description: 'Lambda function for log preprocessing'
    });

    new cdk.CfnOutput(this, 'AgentCoreRole', {
      value: agentCoreRole.roleArn,
      description: 'IAM role for AgentCore runtime'
    });
  }
}

// CDK App
const app = new cdk.App();
new CloudGuardAIStack(app, 'CloudGuardAIStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
  }
});