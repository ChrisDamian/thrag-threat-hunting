# THRAG - Threat Hunting Retrieval Augmented Generation in the Cloud

🛡️ **AI-powered threat hunting agent that uses retrieval augmented generation to correlate security data, predict threats, and autonomously orchestrate intelligent responses.**

## Overview

THRAG (Threat Hunting Retrieval Augmented Generation) revolutionizes cybersecurity by combining the power of retrieval augmented generation with advanced ML to transform raw security telemetry into actionable threat intelligence. The system leverages Amazon Bedrock Knowledge Bases for RAG capabilities, combining structured threat intelligence with Claude-3.5 Sonnet's reasoning abilities.

### Key Features

- **RAG-Enhanced Threat Analysis**: Retrieves relevant threat intelligence from vast knowledge bases and generates contextual security insights
- **Intelligent Knowledge Synthesis**: Combines real-time security data with historical attack patterns, threat actor TTPs, and vulnerability databases
- **Autonomous Threat Hunting**: Uses RAG to generate sophisticated hunt queries based on emerging threat intelligence
- **Context-Aware Response Generation**: Creates detailed incident response playbooks by retrieving best practices and adapting them to specific threats
- **Predictive Threat Modeling**: Leverages retrieved threat intelligence to forecast attack vectors and generate preventive measures
- **Explainable Security Decisions**: Provides detailed reasoning with citations from threat intelligence sources

## Architecture

THRAG operates through a multi-layered architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│                    THRAG Architecture                           │
├─────────────────────────────────────────────────────────────────┤
│  Web Dashboard (React.js + CloudFront)                         │
├─────────────────────────────────────────────────────────────────┤
│  API Gateway + Lambda Functions                                │
├─────────────────────────────────────────────────────────────────┤
│  Multi-Agent System (Bedrock AgentCore)                        │
│  ├── Threat Hunter        ├── Intelligence Analyst             │
│  ├── Incident Commander   ├── Forensics Investigator           │
│  ├── Compliance Advisor   ├── Communication Specialist         │
├─────────────────────────────────────────────────────────────────┤
│  RAG Knowledge Layer (Bedrock KB + OpenSearch)                 │
├─────────────────────────────────────────────────────────────────┤
│  Data Processing (Kinesis + DynamoDB + SageMaker)              │
├─────────────────────────────────────────────────────────────────┤
│  Threat Intelligence Sources (MITRE ATT&CK, CVE, MISP)         │
└─────────────────────────────────────────────────────────────────┘
```

### Multi-Agent System

THRAG orchestrates 6 specialized RAG-powered agents:

1. **🎯 Threat Hunter**: Generates hunt hypotheses by retrieving relevant TTPs and IoCs
2. **🔍 Intelligence Analyst**: Correlates findings with retrieved threat intelligence reports
3. **⚡ Incident Commander**: Creates response plans by retrieving and adapting proven playbooks
4. **🔬 Forensics Investigator**: Guides evidence collection using retrieved forensic methodologies
5. **📋 Compliance Advisor**: Maps incidents to regulatory requirements via retrieved compliance frameworks
6. **📢 Communication Specialist**: Generates stakeholder reports using retrieved communication templates

## Technology Stack

### Core AI & RAG
- **Amazon Bedrock** (Claude-3.5 Sonnet) for reasoning and generation
- **Bedrock Knowledge Bases** for RAG implementation
- **Amazon Titan Text Embeddings** for semantic search
- **Amazon OpenSearch Serverless** for vector storage

### Knowledge Sources
- **MITRE ATT&CK** API integration for TTPs
- **NVD CVE** feeds for vulnerability intelligence
- **MISP** threat intelligence platform integration
- **Custom security playbook** repository in S3

### ML Platform
- **Amazon SageMaker** with custom security-focused algorithms
- **SageMaker Multi-Model Endpoints** for threat scoring
- **Automated retraining pipeline** with retrieved threat data

### Real-time Processing
- **Amazon Kinesis Data Streams** for security event ingestion
- **Kinesis Analytics** for stream processing with retrieved context
- **Amazon EventBridge** for RAG-triggered security workflows

### Data Architecture
- **Amazon S3** for threat intelligence document storage
- **Amazon DynamoDB** for real-time threat indicators with TTL
- **AWS Glue** for ETL of threat intelligence feeds

### Infrastructure
- **AWS CDK (TypeScript)** with RAG-specific constructs
- **CodePipeline** with automated knowledge base updates
- **AWS Secrets Manager** for threat feed API keys

## Prerequisites

Before deploying THRAG, ensure you have:

1. **AWS CLI** configured with appropriate permissions
2. **Node.js** (version 18 or later)
3. **AWS CDK** installed globally (`npm install -g aws-cdk`)
4. **Docker** (for Lambda function packaging)
5. **Access to Amazon Bedrock** models in your AWS region

### Required AWS Permissions

Your AWS credentials need permissions for:
- Amazon Bedrock (full access)
- Amazon OpenSearch Serverless
- Amazon S3, DynamoDB, Kinesis
- AWS Lambda, API Gateway
- Amazon SageMaker
- AWS IAM (for role creation)
- Amazon CloudFront, CloudFormation

## Quick Start Deployment

### Option 1: Complete Automated Deployment (Recommended)

```bash
# Clone the repository
git clone <repository-url>
cd thrag-threat-hunting

# Run the complete deployment script
npm run deploy-complete
```

This automated script will:
- ✅ Validate all prerequisites
- 🔨 Build and compile the project
- 🧪 Run tests (optional)
- 🏗️ Deploy all infrastructure stacks
- 🔧 Configure integrations
- 📊 Set up monitoring
- 📝 Load sample data
- ✅ Validate deployment
- 📋 Generate deployment report

### Option 2: Manual Step-by-Step Deployment

#### 1. Clone and Setup

```bash
git clone <repository-url>
cd thrag-threat-hunting
npm install
```

#### 2. Configure Environment

```bash
# Set your AWS region (Bedrock must be available)
export CDK_DEFAULT_REGION=us-east-1
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)

# Optional: Set environment name
export ENVIRONMENT=production
```

#### 3. Enable Bedrock Model Access

**IMPORTANT**: Before deployment, enable Bedrock model access:
1. Go to AWS Console → Amazon Bedrock → Model access
2. Request access to:
   - Claude 3.5 Sonnet
   - Titan Text Embeddings
   - Any other models you plan to use

#### 4. Bootstrap CDK (First time only)

```bash
cdk bootstrap
```

#### 5. Build and Deploy

```bash
# Build the project
npm run build

# Deploy all stacks in order
npm run deploy

# Or deploy individual stacks
cdk deploy ThragInfrastructureStack
cdk deploy ThragDataStack
cdk deploy ThragAgentsStack
cdk deploy ThragApiStack
```

#### 6. Configure External API Keys (Optional)

```bash
# Update the secrets with your API keys
aws secretsmanager update-secret \
  --secret-id thrag/external-api-keys \
  --secret-string '{
    "virustotal_api_key": "your-virustotal-key",
    "otx_api_key": "your-otx-key",
    "misp_api_key": "your-misp-key",
    "misp_url": "https://your-misp-instance.com"
  }'
```

#### 7. Initialize Threat Intelligence

```bash
# Trigger initial data ingestion
npm run trigger-ingestion all

# Or trigger specific sources
npm run trigger-ingestion mitre
npm run trigger-ingestion cve
```

#### 8. Access the Dashboard

After deployment, the CDK will output the web dashboard URL:

```
ThragApiStack.WebDashboardUrl = https://d1234567890.cloudfront.net
```

Visit this URL to access the THRAG web interface.

## Usage

### Web Dashboard

The enhanced web dashboard provides comprehensive threat hunting capabilities:

#### Dashboard Features:
- **📊 Real-time Metrics**: Live threat scores, event counts, and system health
- **🎯 Agent Interaction**: Direct communication with all 6 specialized agents
- **📈 Threat Analytics**: Visual charts and graphs of security events
- **🔍 Hunt Management**: Create, execute, and monitor threat hunting queries
- **🧠 Intelligence Feed**: Latest threat intelligence with confidence scoring
- **⚡ Event Timeline**: Real-time security event monitoring and analysis

#### Getting Started:
1. **Navigate to the dashboard URL** from the deployment output
2. **Explore the Overview tab** for system metrics and recent activity
3. **Use the Agents tab** to interact with specialized security agents
4. **Monitor Hunts** to track active threat hunting operations
5. **Review Intelligence** for latest threat intelligence updates

### API Usage

THRAG provides comprehensive REST APIs for programmatic access:

#### Agent Orchestration
```bash
# Orchestrate multi-agent security scenario
curl -X POST https://your-api-endpoint/orchestrate \
  -H "Content-Type: application/json" \
  -d '{
    "scenario": "Investigate potential APT campaign targeting financial data",
    "context": {
      "priority": "HIGH",
      "affected_systems": ["web-server-01", "db-server-02"],
      "initial_indicators": ["192.168.1.100", "suspicious.exe"]
    }
  }'
```

#### Threat Scoring
```bash
# Calculate threat score for security event
curl -X POST https://your-api-endpoint/scoring \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "evt-12345",
    "eventType": "process_creation",
    "severity": "HIGH",
    "indicators": ["powershell.exe", "base64_encoded_command"],
    "mitreTechniques": ["T1059.001"],
    "userContext": {
      "userId": "john.doe",
      "normalBehavior": {"loginTimes": [8,9,10,11,12,13,14,15,16,17]},
      "currentBehavior": {"loginTimes": [2]}
    }
  }'
```

#### Knowledge Retrieval
```bash
# Query threat intelligence knowledge base
curl -X POST https://your-api-endpoint/knowledge \
  -H "Content-Type: application/json" \
  -d '{
    "query": "APT29 lateral movement techniques",
    "filters": {
      "confidence_min": 0.8,
      "sources": ["MITRE", "MISP"],
      "date_range": {
        "start": "2024-01-01",
        "end": "2024-12-31"
      }
    }
  }'
```

#### Individual Agent Invocation
```bash
# Invoke specific agent
curl -X POST https://your-api-endpoint/agents/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "agent_type": "threat_hunter",
    "query": "Generate hunt queries for detecting Cobalt Strike beacons in network traffic",
    "session_id": "hunt-session-123"
  }'
```

#### Security Events Management
```bash
# Get security events with filtering
curl "https://your-api-endpoint/events?severity=HIGH&limit=50&timeRange=24h"

# Create new security event
curl -X POST https://your-api-endpoint/events \
  -H "Content-Type: application/json" \
  -d '{
    "source": "aws-guardduty",
    "eventType": "suspicious-network-activity",
    "severity": "HIGH",
    "rawData": {
      "sourceIp": "192.168.1.100",
      "destinationIp": "10.0.0.50",
      "protocol": "TCP",
      "port": 4444
    },
    "normalizedData": {
      "action": "network-connection",
      "sourceIp": "192.168.1.100",
      "destinationIp": "10.0.0.50"
    }
  }'
```

### Advanced Usage Examples

#### Multi-Agent Security Investigation
```bash
# Comprehensive security investigation workflow
curl -X POST https://your-api-endpoint/orchestrate \
  -H "Content-Type: application/json" \
  -d '{
    "scenario": "Multi-stage attack investigation",
    "context": {
      "initial_alert": "Suspicious PowerShell execution detected",
      "affected_user": "admin@company.com",
      "source_ip": "203.0.113.45",
      "timeline": "2024-01-15T14:30:00Z"
    }
  }'
```

#### Proactive Threat Hunting
```bash
# Generate and execute threat hunting campaign
curl -X POST https://your-api-endpoint/agents/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "agent_type": "threat_hunter",
    "query": "Based on recent threat intelligence, generate proactive hunt queries for detecting supply chain attacks targeting our development environment",
    "session_id": "proactive-hunt-001"
  }'
```

#### Incident Response Automation
```bash
# Generate incident response playbook
curl -X POST https://your-api-endpoint/agents/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "agent_type": "incident_commander",
    "query": "Create comprehensive incident response plan for confirmed data exfiltration involving customer PII data. Include containment, eradication, recovery, and communication steps.",
    "session_id": "incident-response-001"
  }'
```

#### Compliance Assessment
```bash
# Assess compliance implications
curl -X POST https://your-api-endpoint/agents/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "agent_type": "compliance_advisor",
    "query": "Analyze the compliance implications of a data breach affecting 10,000 customer records. Include GDPR, CCPA, and SOX requirements.",
    "session_id": "compliance-assessment-001"
  }'
```

## Data Sources and Knowledge Base

THRAG ingests threat intelligence from multiple authoritative sources:

### Included Sources
- **MITRE ATT&CK Framework** (14 tactics, 188+ techniques)
- **CVE Database** with CVSS scores and exploit availability
- **Threat actor profiles** and campaign histories
- **Security framework mappings** (NIST, ISO 27001, SOC 2)

### Adding Custom Sources

1. **Upload documents to S3**:
```bash
aws s3 cp your-threat-intel.pdf s3://thrag-threat-intel-{account}-{region}/
```

2. **Trigger knowledge base sync**:
```bash
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <kb-id> \
  --data-source-id <ds-id>
```

## Monitoring and Observability

THRAG includes comprehensive monitoring:

### CloudWatch Dashboards
- Agent performance metrics
- RAG retrieval accuracy
- Knowledge base freshness
- API response times

### Custom Metrics
- Threat detection accuracy
- False positive rates
- Agent collaboration efficiency
- Knowledge retrieval relevance

### Logs and Tracing
- X-Ray distributed tracing for request flows
- CloudWatch Logs for all components
- Custom security event logging

## Security Considerations

### Data Protection
- All data encrypted at rest and in transit
- VPC isolation for sensitive components
- IAM roles with least privilege access
- Secrets Manager for API keys

### Access Control
- API Gateway with authentication
- Role-based access to different agents
- Audit logging for all operations
- Network security groups and NACLs

### Compliance
- SOC 2 Type II compliance ready
- GDPR data handling capabilities
- Audit trail for all security decisions
- Regulatory reporting automation

## Troubleshooting

### Common Issues

**Bedrock Access Denied:**
```bash
# Enable Bedrock model access in AWS Console
# Go to Bedrock > Model access > Request access
```

**Knowledge Base Sync Failures:**
```bash
# Check S3 bucket permissions
aws s3api get-bucket-policy --bucket thrag-threat-intel-{account}-{region}

# Verify IAM role permissions
aws iam get-role --role-name ThragInfrastructureStack-BedrockServiceRole*
```

**Agent Invocation Timeouts:**
```bash
# Check CloudWatch logs
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/ThragApiStack

# Monitor agent performance
aws cloudwatch get-metric-statistics \
  --namespace AWS/Bedrock \
  --metric-name InvocationLatency
```

### Performance Optimization

**Improve RAG Performance:**
- Optimize document chunking strategies
- Tune embedding model parameters
- Implement caching for frequent queries
- Use pre-computed embeddings for static content

**Scale for High Volume:**
- Increase Kinesis shard count
- Configure DynamoDB auto-scaling
- Use SageMaker multi-model endpoints
- Implement API Gateway caching

## Cost Optimization

### Estimated Monthly Costs (US East 1)

| Component | Usage | Estimated Cost |
|-----------|-------|----------------|
| Bedrock Claude-3.5 | 1M tokens/month | $15-30 |
| OpenSearch Serverless | 10GB storage | $50-100 |
| Lambda Functions | 1M invocations | $5-10 |
| DynamoDB | 10GB + 1M reads | $10-20 |
| Kinesis | 5 shards | $50-75 |
| SageMaker | ml.t2.medium | $35-50 |
| **Total** | | **$165-285** |

### Cost Reduction Tips
- Use Bedrock Provisioned Throughput for high volume
- Implement DynamoDB TTL for automatic cleanup
- Configure S3 lifecycle policies
- Use Spot instances for SageMaker training

## Development and Customization

### Adding New Agents

1. **Create agent definition** in `thrag-agents-stack.ts`
2. **Define specialized instructions** and knowledge base access
3. **Add action groups** for custom functionality
4. **Update API orchestrator** to include new agent
5. **Add UI components** in the web dashboard

### Extending Knowledge Sources

1. **Create data ingestion Lambda** for new source
2. **Add S3 bucket integration** for document storage
3. **Configure embedding generation** pipeline
4. **Update knowledge base** data source
5. **Test retrieval accuracy** and relevance

### Custom ML Models

1. **Develop model** using SageMaker notebooks
2. **Create training pipeline** with security data
3. **Deploy to SageMaker endpoint**
4. **Integrate with agent** action groups
5. **Monitor model performance** and drift

## Contributing

We welcome contributions to THRAG! Please see our contributing guidelines:

1. **Fork the repository**
2. **Create feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit changes** (`git commit -m 'Add amazing feature'`)
4. **Push to branch** (`git push origin feature/amazing-feature`)
5. **Open Pull Request**

### Development Setup

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build TypeScript
npm run build

# Deploy to development environment
export ENVIRONMENT=development
npm run deploy
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:

- **Documentation**: Check this README and inline code comments
- **Issues**: Open GitHub issues for bugs and feature requests
- **Discussions**: Use GitHub Discussions for questions and ideas
- **Security**: Report security issues privately to security@thrag.ai

## Acknowledgments

- **Amazon Bedrock Team** for RAG capabilities
- **MITRE Corporation** for ATT&CK framework
- **NIST** for cybersecurity frameworks
- **Open source security community** for threat intelligence

---


*THRAG transforms cybersecurity from reactive to proactive by enabling AI systems to leverage the collective knowledge of the security community.*