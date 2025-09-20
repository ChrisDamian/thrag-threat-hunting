# THRAG Data Ingestion Guide

This guide explains how THRAG ingests threat intelligence from multiple sources and processes it for RAG-enhanced analysis.

## Overview

THRAG's data ingestion pipeline automatically collects, processes, and stores threat intelligence from:

- **MISP (Malware Information Sharing Platform)**: Real-time threat intelligence feeds
- **CVE Database**: Vulnerability information from NIST NVD
- **MITRE ATT&CK**: Tactics, techniques, and procedures framework
- **Custom Sources**: Additional threat intelligence documents

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   External      │    │   Lambda        │    │   S3 Bucket     │
│   Sources       │───▶│   Ingesters     │───▶│   Storage       │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Kinesis       │    │   Embedding     │
                       │   Stream        │    │   Generator     │
                       │                 │    │                 │
                       └─────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Real-time     │    │   Knowledge     │
                       │   Processing    │    │   Base          │
                       │                 │    │                 │
                       └─────────────────┘    └─────────────────┘
```

## Data Sources

### 1. MISP Integration

**Source**: MISP threat intelligence platform
**Frequency**: Daily (configurable)
**Data Types**: 
- Threat events and campaigns
- Indicators of Compromise (IoCs)
- Threat actor profiles
- Attack patterns

**Configuration**:
```bash
# Set MISP API credentials in AWS Secrets Manager
aws secretsmanager update-secret \
  --secret-id thrag/external-api-keys \
  --secret-string '{
    "misp_api_key": "your-misp-api-key",
    "misp_url": "https://your-misp-instance.com"
  }'
```

### 2. CVE Database

**Source**: NIST National Vulnerability Database
**Frequency**: Daily
**Data Types**:
- Vulnerability descriptions
- CVSS scores and severity ratings
- Affected products (CPE)
- Weakness information (CWE)

**Features**:
- Automatic CVSS-based risk assessment
- Product impact analysis
- Remediation recommendations

### 3. MITRE ATT&CK Framework

**Source**: MITRE ATT&CK GitHub repository
**Frequency**: Weekly
**Data Types**:
- Attack techniques and sub-techniques
- Tactics and kill chain phases
- Threat groups and campaigns
- Software and tools

**Coverage**:
- Enterprise techniques
- Mobile techniques (future)
- ICS techniques (future)

## Ingestion Process

### 1. Scheduled Ingestion

Automatic ingestion runs on the following schedule:

```yaml
Daily (2 AM UTC):
  - CVE Database sync
  - MISP event collection

Weekly (Sunday 3 AM UTC):
  - MITRE ATT&CK framework update
```

### 2. Manual Ingestion

Trigger manual ingestion using the provided script:

```bash
# Trigger all sources
npm run trigger-ingestion

# Trigger specific source
npm run trigger-ingestion misp
npm run trigger-ingestion cve
npm run trigger-ingestion mitre
```

### 3. Real-time Processing

When new documents are ingested:

1. **Document Storage**: Raw data stored in S3 with metadata
2. **Embedding Generation**: Automatic text embedding creation
3. **Stream Processing**: Real-time updates sent to Kinesis
4. **Knowledge Base Sync**: Documents indexed for RAG retrieval

## Document Processing

### Document Structure

All ingested documents follow a standardized format:

```typescript
interface ThreatIntelDocument {
  id: string;                    // Unique document identifier
  source: 'MISP' | 'CVE' | 'MITRE';
  title: string;                 // Human-readable title
  content: string;               // Full text content for RAG
  metadata: {
    confidence: number;          // Confidence score (0-1)
    tlp: 'WHITE' | 'GREEN' | 'AMBER' | 'RED';
    tags: string[];              // Categorization tags
    created: Date;
    updated: Date;
    // Source-specific metadata
  };
  // Source-specific structured data
}
```

### Content Generation

Each ingester generates rich, contextual content optimized for RAG retrieval:

**MISP Events**:
- Event description and context
- IoC listings with categories
- Threat level assessment
- Recommended actions

**CVE Entries**:
- Vulnerability description
- CVSS scoring and risk assessment
- Affected products and versions
- Remediation guidance

**MITRE Techniques**:
- Technique description and detection
- Associated tactics and platforms
- Data sources and requirements
- Defense recommendations

### Embedding Generation

Documents are automatically chunked and embedded:

- **Chunk Size**: 512 tokens (configurable)
- **Overlap**: 50 tokens for context preservation
- **Model**: Amazon Titan Text Embeddings
- **Storage**: S3 with metadata for retrieval

## Monitoring and Troubleshooting

### CloudWatch Metrics

Monitor ingestion health through CloudWatch:

```bash
# View ingestion metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=ThragDataStack-MispIngester \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Average
```

### Log Analysis

Check ingestion logs for errors:

```bash
# View MISP ingester logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/ThragDataStack-MispIngester \
  --start-time $(date -d '1 hour ago' +%s)000

# View CVE ingester logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/ThragDataStack-CveIngester \
  --start-time $(date -d '1 hour ago' +%s)000
```

### Common Issues

**MISP API Rate Limiting**:
```
Error: 429 Too Many Requests
Solution: Adjust ingestion frequency or contact MISP administrator
```

**CVE API Timeouts**:
```
Error: Request timeout
Solution: Reduce batch size or increase Lambda timeout
```

**Embedding Generation Failures**:
```
Error: Token limit exceeded
Solution: Improve document chunking strategy
```

## Data Quality and Validation

### Confidence Scoring

Each document receives a confidence score based on:

- **Source reliability**: MITRE (0.95), CVE (0.7-1.0), MISP (0.5-1.0)
- **Data completeness**: More fields = higher confidence
- **Freshness**: Recent updates increase confidence
- **Validation**: Structured data validation

### Quality Checks

Automated quality validation includes:

- **Schema validation**: Ensure required fields are present
- **Content validation**: Check for meaningful content
- **Duplicate detection**: Prevent duplicate ingestion
- **Format validation**: Verify data format consistency

### Data Lineage

Track data provenance through:

- **Source attribution**: Original source and timestamp
- **Processing history**: Ingestion and transformation steps
- **Version tracking**: Document update history
- **Audit trails**: Complete processing logs

## Performance Optimization

### Batch Processing

Optimize ingestion performance:

```typescript
// Configure batch sizes
const MISP_BATCH_SIZE = 100;
const CVE_BATCH_SIZE = 500;
const MITRE_BATCH_SIZE = 1000;

// Parallel processing
const promises = batches.map(batch => processBatch(batch));
await Promise.all(promises);
```

### Caching Strategy

Implement intelligent caching:

- **API response caching**: Cache external API responses
- **Embedding caching**: Reuse embeddings for unchanged content
- **Metadata caching**: Cache frequently accessed metadata

### Resource Scaling

Auto-scaling configuration:

```yaml
Lambda Configuration:
  Memory: 512MB - 2048MB (based on source)
  Timeout: 15 minutes
  Concurrent Executions: 10

Kinesis Configuration:
  Shards: Auto-scaling based on throughput
  Retention: 7 days
```

## Security Considerations

### API Key Management

Secure credential handling:

- **AWS Secrets Manager**: Store all API keys securely
- **IAM Roles**: Least privilege access
- **Rotation**: Regular key rotation policies
- **Encryption**: All credentials encrypted at rest

### Data Classification

Handle sensitive data appropriately:

- **TLP Classification**: Respect Traffic Light Protocol
- **Access Controls**: Role-based data access
- **Retention Policies**: Automatic data lifecycle management
- **Audit Logging**: Complete access audit trails

### Network Security

Secure data transmission:

- **VPC Endpoints**: Private API access where possible
- **TLS Encryption**: All external communications encrypted
- **Network ACLs**: Restrict network access
- **Security Groups**: Minimal port exposure

## Future Enhancements

### Planned Improvements

1. **Additional Sources**:
   - VirusTotal integration
   - AlienVault OTX feeds
   - Commercial threat intelligence

2. **Enhanced Processing**:
   - Machine learning-based quality scoring
   - Automated IOC extraction
   - Relationship mapping

3. **Real-time Features**:
   - Streaming ingestion
   - Real-time alerting
   - Live dashboard updates

### Custom Source Integration

Add custom threat intelligence sources:

```typescript
// Example custom ingester
export class CustomIngester {
  async ingest(): Promise<ThreatIntelDocument[]> {
    // Implement custom ingestion logic
    const data = await fetchCustomData();
    return data.map(item => this.processItem(item));
  }
}
```

## Support and Maintenance

### Regular Maintenance

- **Weekly**: Review ingestion metrics and logs
- **Monthly**: Update API credentials and configurations
- **Quarterly**: Review and optimize performance
- **Annually**: Audit security and compliance

### Troubleshooting Contacts

- **Technical Issues**: Check CloudWatch logs and metrics
- **API Issues**: Contact respective API providers
- **Performance Issues**: Review Lambda and Kinesis metrics
- **Security Issues**: Follow incident response procedures