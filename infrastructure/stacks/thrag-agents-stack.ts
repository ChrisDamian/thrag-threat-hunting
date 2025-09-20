import * as cdk from 'aws-cdk-lib';
import * as bedrock from '@aws-cdk/aws-bedrock-alpha';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { DataProcessingResources } from './thrag-data-stack';

export interface ThragAgentsStackProps extends cdk.StackProps {
  knowledgeBase: bedrock.KnowledgeBase;
  dataProcessingResources: DataProcessingResources;
}

export interface ThragAgents {
  threatHunterAgent: bedrock.Agent;
  intelligenceAnalystAgent: bedrock.Agent;
  incidentCommanderAgent: bedrock.Agent;
  forensicsInvestigatorAgent: bedrock.Agent;
  complianceAdvisorAgent: bedrock.Agent;
  communicationSpecialistAgent: bedrock.Agent;
}

export class ThragAgentsStack extends cdk.Stack {
  public readonly agents: ThragAgents;

  constructor(scope: Construct, id: string, props: ThragAgentsStackProps) {
    super(scope, id, props);

    // IAM role for Bedrock agents
    const agentRole = new iam.Role(this, 'BedrockAgentRole', {
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
      description: 'Service role for THRAG Bedrock agents',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonBedrockFullAccess'),
      ],
    });

    // Grant access to data processing resources
    props.dataProcessingResources.securityEventsTable.grantReadWriteData(agentRole);
    props.dataProcessingResources.threatIndicatorsTable.grantReadWriteData(agentRole);
    props.dataProcessingResources.huntQueriesTable.grantReadWriteData(agentRole);
    props.dataProcessingResources.incidentPlaybooksTable.grantReadWriteData(agentRole);

    // Lambda function for threat hunting actions
    const threatHuntingFunction = new lambda.Function(this, 'ThreatHuntingFunction', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
import json
import boto3
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def handler(event, context):
    """
    Threat hunting action group handler
    """
    logger.info(f"Received event: {json.dumps(event)}")
    
    action = event.get('actionGroup', '')
    function = event.get('function', '')
    parameters = event.get('parameters', {})
    
    if action == 'threat-hunting':
        if function == 'generate_hunt_query':
            return generate_hunt_query(parameters)
        elif function == 'execute_hunt_query':
            return execute_hunt_query(parameters)
        elif function == 'correlate_findings':
            return correlate_findings(parameters)
    
    return {
        'statusCode': 400,
        'body': json.dumps({'error': 'Unknown action or function'})
    }

def generate_hunt_query(parameters):
    """Generate hunt query based on threat intelligence"""
    threat_type = parameters.get('threat_type', '')
    data_sources = parameters.get('data_sources', [])
    
    # Placeholder implementation
    query = f"SELECT * FROM security_events WHERE threat_type = '{threat_type}'"
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'query': query,
            'data_sources': data_sources,
            'confidence': 0.85
        })
    }

def execute_hunt_query(parameters):
    """Execute hunt query across data sources"""
    query = parameters.get('query', '')
    
    # Placeholder implementation
    results = [
        {'event_id': '12345', 'severity': 'HIGH', 'source_ip': '192.168.1.100'},
        {'event_id': '12346', 'severity': 'MEDIUM', 'source_ip': '10.0.0.50'}
    ]
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'results': results,
            'total_matches': len(results)
        })
    }

def correlate_findings(parameters):
    """Correlate hunt findings with threat intelligence"""
    findings = parameters.get('findings', [])
    
    # Placeholder implementation
    correlations = [
        {
            'finding_id': '12345',
            'threat_actor': 'APT29',
            'technique': 'T1055',
            'confidence': 0.92
        }
    ]
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'correlations': correlations
        })
    }
      `),
      timeout: cdk.Duration.minutes(5),
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Grant Lambda permissions
    props.dataProcessingResources.securityEventsTable.grantReadWriteData(threatHuntingFunction);
    props.dataProcessingResources.huntQueriesTable.grantReadWriteData(threatHuntingFunction);

    // Threat Hunter Agent
    const threatHunterAgent = new bedrock.Agent(this, 'ThreatHunterAgent', {
      name: 'thrag-threat-hunter',
      description: 'AI agent specialized in generating hunt hypotheses and executing complex security queries',
      foundationModel: bedrock.BedrockFoundationModel.ANTHROPIC_CLAUDE_3_5_SONNET_20241022_V2_0,
      instruction: `You are a specialized threat hunting agent with expertise in cybersecurity analysis and threat detection. Your primary responsibilities include:

1. Generate sophisticated hunt queries based on emerging threat intelligence
2. Execute complex queries across multiple security data sources
3. Correlate findings using threat actor behaviors and TTPs from MITRE ATT&CK
4. Provide detailed analysis of potential threats with confidence scores

When generating hunt queries, consider:
- Current threat landscape and emerging attack patterns
- Historical attack data and adversary behaviors
- Specific indicators of compromise (IoCs)
- MITRE ATT&CK techniques and tactics

Always provide reasoning for your hunt hypotheses and cite relevant threat intelligence sources.`,
      knowledgeBases: [props.knowledgeBase],
      shouldPrepareAgent: true,
    });

    // Add action group to Threat Hunter Agent
    threatHunterAgent.addActionGroup({
      actionGroupName: 'threat-hunting',
      description: 'Actions for threat hunting operations',
      actionGroupExecutor: {
        lambda: threatHuntingFunction,
      },
      actionGroupState: 'ENABLED',
      apiSchema: bedrock.ApiSchema.fromInline({
        openapi: '3.0.0',
        info: {
          title: 'Threat Hunting API',
          version: '1.0.0',
        },
        paths: {
          '/generate_hunt_query': {
            post: {
              description: 'Generate hunt query based on threat intelligence',
              parameters: [
                {
                  name: 'threat_type',
                  in: 'query',
                  required: true,
                  schema: { type: 'string' },
                },
                {
                  name: 'data_sources',
                  in: 'query',
                  required: false,
                  schema: { type: 'array', items: { type: 'string' } },
                },
              ],
            },
          },
          '/execute_hunt_query': {
            post: {
              description: 'Execute hunt query across data sources',
              parameters: [
                {
                  name: 'query',
                  in: 'query',
                  required: true,
                  schema: { type: 'string' },
                },
              ],
            },
          },
          '/correlate_findings': {
            post: {
              description: 'Correlate hunt findings with threat intelligence',
              parameters: [
                {
                  name: 'findings',
                  in: 'query',
                  required: true,
                  schema: { type: 'array' },
                },
              ],
            },
          },
        },
      }),
    });

    // Intelligence Analyst Agent
    const intelligenceAnalystAgent = new bedrock.Agent(this, 'IntelligenceAnalystAgent', {
      name: 'thrag-intelligence-analyst',
      description: 'AI agent specialized in threat intelligence correlation and analysis',
      foundationModel: bedrock.BedrockFoundationModel.ANTHROPIC_CLAUDE_3_5_SONNET_20241022_V2_0,
      instruction: `You are a specialized threat intelligence analyst with deep expertise in cybersecurity intelligence and threat assessment. Your primary responsibilities include:

1. Correlate security findings with comprehensive threat intelligence reports
2. Synthesize information from multiple intelligence sources (MISP, CVE, MITRE ATT&CK)
3. Provide confidence scoring and source attribution for all assessments
4. Generate detailed threat assessments with actionable intelligence

When analyzing threats, consider:
- Threat actor profiles and historical campaigns
- Tactics, techniques, and procedures (TTPs)
- Indicators of compromise and their reliability
- Geopolitical context and threat landscape trends

Always provide source attribution and confidence levels for your analysis.`,
      knowledgeBases: [props.knowledgeBase],
      shouldPrepareAgent: true,
    });

    // Incident Commander Agent
    const incidentCommanderAgent = new bedrock.Agent(this, 'IncidentCommanderAgent', {
      name: 'thrag-incident-commander',
      description: 'AI agent specialized in incident response coordination and playbook generation',
      foundationModel: bedrock.BedrockFoundationModel.ANTHROPIC_CLAUDE_3_5_SONNET_20241022_V2_0,
      instruction: `You are a specialized incident response commander with expertise in cybersecurity incident management and response coordination. Your primary responsibilities include:

1. Generate custom incident response playbooks based on threat context
2. Coordinate containment, eradication, and recovery procedures
3. Adapt proven response procedures to specific threat scenarios
4. Manage incident escalation and stakeholder communication

When creating response plans, consider:
- Incident severity and potential business impact
- Available response resources and capabilities
- Regulatory and compliance requirements
- Lessons learned from previous incidents

Always provide step-by-step procedures with clear timelines and responsibilities.`,
      knowledgeBases: [props.knowledgeBase],
      shouldPrepareAgent: true,
    });

    // Forensics Investigator Agent
    const forensicsInvestigatorAgent = new bedrock.Agent(this, 'ForensicsInvestigatorAgent', {
      name: 'thrag-forensics-investigator',
      description: 'AI agent specialized in digital forensics and evidence analysis',
      foundationModel: bedrock.BedrockFoundationModel.ANTHROPIC_CLAUDE_3_5_SONNET_20241022_V2_0,
      instruction: `You are a specialized digital forensics investigator with expertise in cybersecurity forensics and evidence analysis. Your primary responsibilities include:

1. Guide evidence collection and preservation procedures
2. Automate chain of custody documentation
3. Generate forensic analysis workflows
4. Correlate evidence across multiple sources and timelines

When conducting forensic analysis, consider:
- Legal and regulatory evidence requirements
- Chain of custody best practices
- Timeline reconstruction and event correlation
- Artifact preservation and analysis techniques

Always maintain strict adherence to forensic procedures and evidence integrity.`,
      knowledgeBases: [props.knowledgeBase],
      shouldPrepareAgent: true,
    });

    // Compliance Advisor Agent
    const complianceAdvisorAgent = new bedrock.Agent(this, 'ComplianceAdvisorAgent', {
      name: 'thrag-compliance-advisor',
      description: 'AI agent specialized in regulatory compliance and security frameworks',
      foundationModel: bedrock.BedrockFoundationModel.ANTHROPIC_CLAUDE_3_5_SONNET_20241022_V2_0,
      instruction: `You are a specialized compliance advisor with expertise in cybersecurity regulations and security frameworks. Your primary responsibilities include:

1. Map security incidents to regulatory requirements
2. Generate automated compliance reports and documentation
3. Assess regulatory impact of security events
4. Provide guidance on compliance frameworks (NIST, ISO 27001, SOC 2)

When providing compliance guidance, consider:
- Applicable regulatory requirements and jurisdictions
- Industry-specific compliance standards
- Audit trail and documentation requirements
- Risk assessment and mitigation strategies

Always provide specific regulatory citations and compliance recommendations.`,
      knowledgeBases: [props.knowledgeBase],
      shouldPrepareAgent: true,
    });

    // Communication Specialist Agent
    const communicationSpecialistAgent = new bedrock.Agent(this, 'CommunicationSpecialistAgent', {
      name: 'thrag-communication-specialist',
      description: 'AI agent specialized in security communication and stakeholder reporting',
      foundationModel: bedrock.BedrockFoundationModel.ANTHROPIC_CLAUDE_3_5_SONNET_20241022_V2_0,
      instruction: `You are a specialized security communication specialist with expertise in cybersecurity reporting and stakeholder communication. Your primary responsibilities include:

1. Generate executive summaries and technical reports
2. Create stakeholder-appropriate communication materials
3. Develop notification and alerting content
4. Manage communication templates and messaging

When creating communications, consider:
- Audience technical expertise and information needs
- Urgency and severity of security events
- Regulatory notification requirements
- Clear, actionable messaging without technical jargon

Always tailor communications to the specific audience and maintain appropriate urgency levels.`,
      knowledgeBases: [props.knowledgeBase],
      shouldPrepareAgent: true,
    });

    this.agents = {
      threatHunterAgent,
      intelligenceAnalystAgent,
      incidentCommanderAgent,
      forensicsInvestigatorAgent,
      complianceAdvisorAgent,
      communicationSpecialistAgent,
    };

    // Outputs
    new cdk.CfnOutput(this, 'ThreatHunterAgentId', {
      value: threatHunterAgent.agentId,
      description: 'Threat Hunter Agent ID',
    });

    new cdk.CfnOutput(this, 'IntelligenceAnalystAgentId', {
      value: intelligenceAnalystAgent.agentId,
      description: 'Intelligence Analyst Agent ID',
    });

    new cdk.CfnOutput(this, 'IncidentCommanderAgentId', {
      value: incidentCommanderAgent.agentId,
      description: 'Incident Commander Agent ID',
    });

    new cdk.CfnOutput(this, 'ForensicsInvestigatorAgentId', {
      value: forensicsInvestigatorAgent.agentId,
      description: 'Forensics Investigator Agent ID',
    });

    new cdk.CfnOutput(this, 'ComplianceAdvisorAgentId', {
      value: complianceAdvisorAgent.agentId,
      description: 'Compliance Advisor Agent ID',
    });

    new cdk.CfnOutput(this, 'CommunicationSpecialistAgentId', {
      value: communicationSpecialistAgent.agentId,
      description: 'Communication Specialist Agent ID',
    });
  }
}