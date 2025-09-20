import * as cdk from 'aws-cdk-lib';
import * as bedrock from '@aws-cdk/aws-bedrock-alpha';
import * as opensearch from 'aws-cdk-lib/aws-opensearchserverless';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export class ThragInfrastructureStack extends cdk.Stack {
  public readonly knowledgeBase: bedrock.KnowledgeBase;
  public readonly vectorStore: opensearch.CfnCollection;
  public readonly threatIntelBucket: s3.Bucket;
  public readonly bedrockRole: iam.Role;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 bucket for threat intelligence documents
    this.threatIntelBucket = new s3.Bucket(this, 'ThreatIntelBucket', {
      bucketName: `thrag-threat-intel-${this.account}-${this.region}`,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [
        {
          id: 'DeleteOldVersions',
          expiredObjectDeleteMarker: true,
          noncurrentVersionExpiration: cdk.Duration.days(30),
        },
      ],
    });

    // IAM role for Bedrock services
    this.bedrockRole = new iam.Role(this, 'BedrockServiceRole', {
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
      description: 'Service role for THRAG Bedrock operations',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonBedrockFullAccess'),
      ],
    });

    // Grant S3 access to Bedrock role
    this.threatIntelBucket.grantReadWrite(this.bedrockRole);

    // OpenSearch Serverless collection for vector storage
    const encryptionPolicy = new opensearch.CfnSecurityPolicy(this, 'VectorStoreEncryptionPolicy', {
      name: 'thrag-vector-encryption-policy',
      type: 'encryption',
      policy: JSON.stringify({
        Rules: [
          {
            ResourceType: 'collection',
            Resource: ['collection/thrag-vector-store'],
          },
        ],
        AWSOwnedKey: true,
      }),
    });

    const networkPolicy = new opensearch.CfnSecurityPolicy(this, 'VectorStoreNetworkPolicy', {
      name: 'thrag-vector-network-policy',
      type: 'network',
      policy: JSON.stringify([
        {
          Rules: [
            {
              ResourceType: 'collection',
              Resource: ['collection/thrag-vector-store'],
            },
            {
              ResourceType: 'dashboard',
              Resource: ['collection/thrag-vector-store'],
            },
          ],
          AllowFromPublic: true,
        },
      ]),
    });

    this.vectorStore = new opensearch.CfnCollection(this, 'VectorStore', {
      name: 'thrag-vector-store',
      type: 'VECTORSEARCH',
      description: 'Vector store for THRAG threat intelligence embeddings',
    });

    this.vectorStore.addDependency(encryptionPolicy);
    this.vectorStore.addDependency(networkPolicy);

    // Data access policy for OpenSearch
    const dataAccessPolicy = new opensearch.CfnAccessPolicy(this, 'VectorStoreDataAccessPolicy', {
      name: 'thrag-vector-data-access-policy',
      type: 'data',
      policy: JSON.stringify([
        {
          Rules: [
            {
              ResourceType: 'collection',
              Resource: [`collection/thrag-vector-store`],
              Permission: [
                'aoss:CreateCollectionItems',
                'aoss:DeleteCollectionItems',
                'aoss:UpdateCollectionItems',
                'aoss:DescribeCollectionItems',
              ],
            },
            {
              ResourceType: 'index',
              Resource: [`index/thrag-vector-store/*`],
              Permission: [
                'aoss:CreateIndex',
                'aoss:DeleteIndex',
                'aoss:UpdateIndex',
                'aoss:DescribeIndex',
                'aoss:ReadDocument',
                'aoss:WriteDocument',
              ],
            },
          ],
          Principal: [this.bedrockRole.roleArn, `arn:aws:iam::${this.account}:root`],
        },
      ]),
    });

    // Bedrock Knowledge Base
    this.knowledgeBase = new bedrock.KnowledgeBase(this, 'ThreatIntelKnowledgeBase', {
      name: 'thrag-threat-intelligence-kb',
      description: 'THRAG Threat Intelligence Knowledge Base with MITRE ATT&CK, CVE, and security frameworks',
      roleArn: this.bedrockRole.roleArn,
      embeddingModel: bedrock.BedrockFoundationModel.TITAN_EMBED_TEXT_V1,
      vectorStore: bedrock.VectorStore.openSearchServerless({
        collectionArn: this.vectorStore.attrArn,
        vectorIndexName: 'threat-intel-index',
        fieldMapping: {
          vectorField: 'vector',
          textField: 'text',
          metadataField: 'metadata',
        },
      }),
    });

    // Data source for the knowledge base
    const threatIntelDataSource = new bedrock.S3DataSource(this, 'ThreatIntelDataSource', {
      knowledgeBase: this.knowledgeBase,
      dataSourceName: 'threat-intelligence-documents',
      bucket: this.threatIntelBucket,
      chunkingStrategy: bedrock.ChunkingStrategy.fixedSize({
        maxTokens: 512,
        overlapPercentage: 20,
      }),
    });

    // Secrets for external API keys
    const apiKeysSecret = new secretsmanager.Secret(this, 'ExternalApiKeys', {
      secretName: 'thrag/external-api-keys',
      description: 'API keys for external threat intelligence feeds',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          virustotal_api_key: '',
          otx_api_key: '',
          misp_api_key: '',
        }),
        generateStringKey: 'placeholder',
      },
    });

    // Outputs
    new cdk.CfnOutput(this, 'KnowledgeBaseId', {
      value: this.knowledgeBase.knowledgeBaseId,
      description: 'Bedrock Knowledge Base ID',
    });

    new cdk.CfnOutput(this, 'VectorStoreEndpoint', {
      value: this.vectorStore.attrCollectionEndpoint,
      description: 'OpenSearch Serverless collection endpoint',
    });

    new cdk.CfnOutput(this, 'ThreatIntelBucketName', {
      value: this.threatIntelBucket.bucketName,
      description: 'S3 bucket for threat intelligence documents',
    });

    new cdk.CfnOutput(this, 'ApiKeysSecretArn', {
      value: apiKeysSecret.secretArn,
      description: 'ARN of the secret containing external API keys',
    });
  }
}