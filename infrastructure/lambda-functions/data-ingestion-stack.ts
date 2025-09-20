import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface DataIngestionStackProps extends cdk.StackProps {
  threatIntelBucket: s3.Bucket;
  threatIntelStream: string;
}

export class DataIngestionStack extends cdk.Stack {
  public readonly mispIngester: lambda.Function;
  public readonly cveIngester: lambda.Function;
  public readonly mitreIngester: lambda.Function;
  public readonly embeddingGenerator: lambda.Function;

  constructor(scope: Construct, id: string, props: DataIngestionStackProps) {
    super(scope, id, props);

    // IAM role for data ingestion Lambda functions
    const ingestionRole = new iam.Role(this, 'DataIngestionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonBedrockFullAccess'),
      ],
    });

    // Grant S3 and Kinesis permissions
    props.threatIntelBucket.grantReadWrite(ingestionRole);
    
    ingestionRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'kinesis:PutRecord',
        'kinesis:PutRecords',
        'secretsmanager:GetSecretValue'
      ],
      resources: ['*']
    }));

    // MISP Ingester Lambda
    this.mispIngester = new lambda.Function(this, 'MispIngester', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'misp-ingester.handler',
      code: lambda.Code.fromAsset('dist/src/data-ingestion'),
      role: ingestionRole,
      timeout: cdk.Duration.minutes(15),
      memorySize: 512,
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: {
        THREAT_INTEL_BUCKET: props.threatIntelBucket.bucketName,
        THREAT_INTEL_STREAM: props.threatIntelStream,
      },
    });

    // CVE Ingester Lambda
    this.cveIngester = new lambda.Function(this, 'CveIngester', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'cve-ingester.handler',
      code: lambda.Code.fromAsset('dist/src/data-ingestion'),
      role: ingestionRole,
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024,
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: {
        THREAT_INTEL_BUCKET: props.threatIntelBucket.bucketName,
        THREAT_INTEL_STREAM: props.threatIntelStream,
      },
    });

    // MITRE ATT&CK Ingester Lambda
    this.mitreIngester = new lambda.Function(this, 'MitreIngester', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'mitre-attack-ingester.handler',
      code: lambda.Code.fromAsset('dist/src/data-ingestion'),
      role: ingestionRole,
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024,
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: {
        THREAT_INTEL_BUCKET: props.threatIntelBucket.bucketName,
        THREAT_INTEL_STREAM: props.threatIntelStream,
      },
    });

    // Embedding Generator Lambda
    this.embeddingGenerator = new lambda.Function(this, 'EmbeddingGenerator', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'embedding-generator.handler',
      code: lambda.Code.fromAsset('dist/src/data-ingestion'),
      role: ingestionRole,
      timeout: cdk.Duration.minutes(15),
      memorySize: 2048,
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: {
        THREAT_INTEL_BUCKET: props.threatIntelBucket.bucketName,
      },
    });

    // S3 event notification for embedding generation
    props.threatIntelBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(this.embeddingGenerator),
      { prefix: 'misp/', suffix: '.json' }
    );

    props.threatIntelBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(this.embeddingGenerator),
      { prefix: 'cve/', suffix: '.json' }
    );

    props.threatIntelBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(this.embeddingGenerator),
      { prefix: 'mitre/', suffix: '.json' }
    );

    // EventBridge rules for scheduled ingestion
    const dailyRule = new events.Rule(this, 'DailyIngestionRule', {
      schedule: events.Schedule.cron({
        minute: '0',
        hour: '2', // 2 AM UTC
        day: '*',
        month: '*',
        year: '*'
      }),
      description: 'Daily threat intelligence ingestion'
    });

    // Add targets for daily ingestion
    dailyRule.addTarget(new targets.LambdaFunction(this.cveIngester));
    dailyRule.addTarget(new targets.LambdaFunction(this.mispIngester));

    // Weekly MITRE ATT&CK ingestion (less frequent due to slower update cycle)
    const weeklyRule = new events.Rule(this, 'WeeklyIngestionRule', {
      schedule: events.Schedule.cron({
        minute: '0',
        hour: '3', // 3 AM UTC
        day: '*',
        month: '*',
        year: '*',
        weekDay: 'SUN' // Sunday
      }),
      description: 'Weekly MITRE ATT&CK ingestion'
    });

    weeklyRule.addTarget(new targets.LambdaFunction(this.mitreIngester));

    // Manual trigger rule for immediate ingestion
    const manualRule = new events.Rule(this, 'ManualIngestionRule', {
      eventPattern: {
        source: ['thrag.ingestion'],
        detailType: ['Manual Ingestion Trigger']
      },
      description: 'Manual trigger for threat intelligence ingestion'
    });

    manualRule.addTarget(new targets.LambdaFunction(this.mispIngester));
    manualRule.addTarget(new targets.LambdaFunction(this.cveIngester));
    manualRule.addTarget(new targets.LambdaFunction(this.mitreIngester));

    // Outputs
    new cdk.CfnOutput(this, 'MispIngesterArn', {
      value: this.mispIngester.functionArn,
      description: 'MISP Ingester Lambda ARN'
    });

    new cdk.CfnOutput(this, 'CveIngesterArn', {
      value: this.cveIngester.functionArn,
      description: 'CVE Ingester Lambda ARN'
    });

    new cdk.CfnOutput(this, 'MitreIngesterArn', {
      value: this.mitreIngester.functionArn,
      description: 'MITRE ATT&CK Ingester Lambda ARN'
    });

    new cdk.CfnOutput(this, 'EmbeddingGeneratorArn', {
      value: this.embeddingGenerator.functionArn,
      description: 'Embedding Generator Lambda ARN'
    });
  }
}