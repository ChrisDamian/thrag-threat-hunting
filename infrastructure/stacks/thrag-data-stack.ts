import * as cdk from 'aws-cdk-lib';
import * as kinesis from 'aws-cdk-lib/aws-kinesis';
import * as kinesisanalytics from 'aws-cdk-lib/aws-kinesisanalytics';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as sagemaker from 'aws-cdk-lib/aws-sagemaker';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as bedrock from '@aws-cdk/aws-bedrock-alpha';
import * as opensearch from 'aws-cdk-lib/aws-opensearchserverless';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { DataIngestionStack } from '../lambda-functions/data-ingestion-stack';

export interface ThragDataStackProps extends cdk.StackProps {
  knowledgeBase: bedrock.KnowledgeBase;
  vectorStore: opensearch.CfnCollection;
  threatIntelBucket: s3.Bucket;
}

export interface DataProcessingResources {
  securityEventsStream: kinesis.Stream;
  threatIntelStream: kinesis.Stream;
  securityEventsTable: dynamodb.Table;
  threatIndicatorsTable: dynamodb.Table;
  huntQueriesTable: dynamodb.Table;
  incidentPlaybooksTable: dynamodb.Table;
  eventBus: events.EventBus;
}

export class ThragDataStack extends cdk.Stack {
  public readonly dataProcessingResources: DataProcessingResources;
  public readonly dataIngestionStack: DataIngestionStack;

  constructor(scope: Construct, id: string, props: ThragDataStackProps) {
    super(scope, id, props);

    // Kinesis streams for real-time data processing
    const securityEventsStream = new kinesis.Stream(this, 'SecurityEventsStream', {
      streamName: 'thrag-security-events',
      shardCount: 5,
      retentionPeriod: cdk.Duration.days(7),
      encryption: kinesis.StreamEncryption.MANAGED,
    });

    const threatIntelStream = new kinesis.Stream(this, 'ThreatIntelStream', {
      streamName: 'thrag-threat-intel',
      shardCount: 2,
      retentionPeriod: cdk.Duration.days(7),
      encryption: kinesis.StreamEncryption.MANAGED,
    });

    // DynamoDB tables for real-time data storage
    const securityEventsTable = new dynamodb.Table(this, 'SecurityEventsTable', {
      tableName: 'thrag-security-events',
      partitionKey: { name: 'eventId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
      timeToLiveAttribute: 'ttl',
    });

    // Add GSI for querying by source and severity
    securityEventsTable.addGlobalSecondaryIndex({
      indexName: 'source-severity-index',
      partitionKey: { name: 'source', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'severity', type: dynamodb.AttributeType.STRING },
    });

    const threatIndicatorsTable = new dynamodb.Table(this, 'ThreatIndicatorsTable', {
      tableName: 'thrag-threat-indicators',
      partitionKey: { name: 'indicatorType', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'indicatorValue', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
      timeToLiveAttribute: 'ttl',
    });

    // Add GSI for querying by confidence score
    threatIndicatorsTable.addGlobalSecondaryIndex({
      indexName: 'confidence-index',
      partitionKey: { name: 'confidence', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'lastSeen', type: dynamodb.AttributeType.NUMBER },
    });

    const huntQueriesTable = new dynamodb.Table(this, 'HuntQueriesTable', {
      tableName: 'thrag-hunt-queries',
      partitionKey: { name: 'queryId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
    });

    const incidentPlaybooksTable = new dynamodb.Table(this, 'IncidentPlaybooksTable', {
      tableName: 'thrag-incident-playbooks',
      partitionKey: { name: 'playbookId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
    });

    // Add GSI for querying by incident type
    incidentPlaybooksTable.addGlobalSecondaryIndex({
      indexName: 'incident-type-index',
      partitionKey: { name: 'incidentType', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'severity', type: dynamodb.AttributeType.STRING },
    });

    // EventBridge custom event bus for THRAG events
    const eventBus = new events.EventBus(this, 'ThragEventBus', {
      eventBusName: 'thrag-security-events',
      description: 'Custom event bus for THRAG security events and workflows',
    });

    // SageMaker execution role
    const sagemakerRole = new iam.Role(this, 'SageMakerExecutionRole', {
      assumedBy: new iam.ServicePrincipal('sagemaker.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSageMakerFullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
      ],
    });

    // Grant DynamoDB access to SageMaker role
    securityEventsTable.grantReadWriteData(sagemakerRole);
    threatIndicatorsTable.grantReadWriteData(sagemakerRole);

    // SageMaker model for anomaly detection
    const anomalyDetectionModel = new sagemaker.CfnModel(this, 'AnomalyDetectionModel', {
      modelName: 'thrag-anomaly-detection',
      executionRoleArn: sagemakerRole.roleArn,
      primaryContainer: {
        image: '246618743249.dkr.ecr.us-west-2.amazonaws.com/sagemaker-scikit-learn:1.2-1-cpu-py3',
        modelDataUrl: 's3://sagemaker-sample-files/datasets/tabular/synthetic/anomaly_detection_model.tar.gz',
      },
    });

    // SageMaker endpoint configuration
    const endpointConfig = new sagemaker.CfnEndpointConfig(this, 'AnomalyDetectionEndpointConfig', {
      endpointConfigName: 'thrag-anomaly-detection-config',
      productionVariants: [
        {
          modelName: anomalyDetectionModel.modelName!,
          variantName: 'primary',
          initialInstanceCount: 1,
          instanceType: 'ml.t2.medium',
          initialVariantWeight: 1,
        },
      ],
    });

    // SageMaker endpoint
    const endpoint = new sagemaker.CfnEndpoint(this, 'AnomalyDetectionEndpoint', {
      endpointName: 'thrag-anomaly-detection',
      endpointConfigName: endpointConfig.endpointConfigName!,
    });

    endpoint.addDependency(endpointConfig);
    endpointConfig.addDependency(anomalyDetectionModel);

    // Data ingestion Lambda functions
    this.dataIngestionStack = new DataIngestionStack(this, 'DataIngestionStack', {
      threatIntelBucket: props.threatIntelBucket,
      threatIntelStream: threatIntelStream.streamName,
    });

    this.dataProcessingResources = {
      securityEventsStream,
      threatIntelStream,
      securityEventsTable,
      threatIndicatorsTable,
      huntQueriesTable,
      incidentPlaybooksTable,
      eventBus,
    };

    // Outputs
    new cdk.CfnOutput(this, 'SecurityEventsStreamName', {
      value: securityEventsStream.streamName,
      description: 'Kinesis stream for security events',
    });

    new cdk.CfnOutput(this, 'ThreatIntelStreamName', {
      value: threatIntelStream.streamName,
      description: 'Kinesis stream for threat intelligence',
    });

    new cdk.CfnOutput(this, 'SecurityEventsTableName', {
      value: securityEventsTable.tableName,
      description: 'DynamoDB table for security events',
    });

    new cdk.CfnOutput(this, 'SageMakerEndpointName', {
      value: endpoint.endpointName!,
      description: 'SageMaker endpoint for anomaly detection',
    });

    new cdk.CfnOutput(this, 'EventBusName', {
      value: eventBus.eventBusName,
      description: 'EventBridge custom event bus',
    });
  }
}