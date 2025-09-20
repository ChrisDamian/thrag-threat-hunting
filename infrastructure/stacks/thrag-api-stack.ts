import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import { ThragAgents } from './thrag-agents-stack';
import { DataProcessingResources } from './thrag-data-stack';

export interface ThragApiStackProps extends cdk.StackProps {
  agents: ThragAgents;
  dataResources: DataProcessingResources;
}

export class ThragApiStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  public readonly webDistribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: ThragApiStackProps) {
    super(scope, id, props);

    // IAM role for API Lambda functions
    const apiLambdaRole = new iam.Role(this, 'ApiLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonBedrockFullAccess'),
      ],
    });

    // Grant access to data resources
    props.dataResources.securityEventsTable.grantReadWriteData(apiLambdaRole);
    props.dataResources.threatIndicatorsTable.grantReadWriteData(apiLambdaRole);
    props.dataResources.huntQueriesTable.grantReadWriteData(apiLambdaRole);
    props.dataResources.incidentPlaybooksTable.grantReadWriteData(apiLambdaRole);

    // Lambda function for enhanced agent orchestration
    const agentOrchestratorFunction = new lambda.Function(this, 'AgentOrchestratorFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'agent-orchestrator.handler',
      role: apiLambdaRole,
      code: lambda.Code.fromAsset('dist/src/agents'),
      timeout: cdk.Duration.minutes(15),
      memorySize: 2048,
      environment: {
        KNOWLEDGE_BASE_ID: props.agents.threatHunterAgent.knowledgeBaseId || '',
        VECTOR_STORE_ENDPOINT: process.env.VECTOR_STORE_ENDPOINT || '',
        TASKS_TABLE: 'thrag-agent-tasks',
        SESSIONS_TABLE: 'thrag-collaboration-sessions',
        THREAT_HUNTER_AGENT_ID: props.agents.threatHunterAgent.agentId,
        INTELLIGENCE_ANALYST_AGENT_ID: props.agents.intelligenceAnalystAgent.agentId,
        INCIDENT_COMMANDER_AGENT_ID: props.agents.incidentCommanderAgent.agentId,
        FORENSICS_INVESTIGATOR_AGENT_ID: props.agents.forensicsInvestigatorAgent.agentId,
        COMPLIANCE_ADVISOR_AGENT_ID: props.agents.complianceAdvisorAgent.agentId,
        COMMUNICATION_SPECIALIST_AGENT_ID: props.agents.communicationSpecialistAgent.agentId,
      },
    });

    // Lambda function for security event processing
    const securityEventProcessor = new lambda.Function(this, 'SecurityEventProcessor', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'event-processor.handler',
      role: apiLambdaRole,
      code: lambda.Code.fromAsset('dist/src/security-processing'),
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
      environment: {
        SECURITY_EVENTS_TABLE: props.dataResources.securityEventsTable.tableName,
        CORRELATIONS_TABLE: 'thrag-correlations',
        THREAT_HUNTER_AGENT_ID: props.agents.threatHunterAgent.agentId,
        SECURITY_EVENTS_STREAM: props.dataResources.securityEventsStream.streamName,
      },
    });

    // Lambda function for threat scoring
    const threatScoringFunction = new lambda.Function(this, 'ThreatScoringFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'threat-scoring.handler',
      role: apiLambdaRole,
      code: lambda.Code.fromAsset('dist/src/ml-pipeline'),
      timeout: cdk.Duration.minutes(10),
      memorySize: 2048,
      environment: {
        ANOMALY_ENDPOINT: 'thrag-anomaly-detection',
        BEHAVIOR_ENDPOINT: 'thrag-behavior-analysis',
        USER_PROFILES_TABLE: 'thrag-user-profiles',
        KNOWLEDGE_BASE_ID: props.agents.threatHunterAgent.knowledgeBaseId || '',
        VECTOR_STORE_ENDPOINT: process.env.VECTOR_STORE_ENDPOINT || '',
      },
    });

    // Lambda function for RAG knowledge management
    const knowledgeManagerFunction = new lambda.Function(this, 'KnowledgeManagerFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'knowledge-manager.handler',
      role: apiLambdaRole,
      code: lambda.Code.fromAsset('dist/src/rag-system'),
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
      environment: {
        KNOWLEDGE_BASE_ID: props.agents.threatHunterAgent.knowledgeBaseId || '',
        VECTOR_STORE_ENDPOINT: process.env.VECTOR_STORE_ENDPOINT || '',
      },
    });

    // Legacy Python function for backward compatibility
    const legacyAgentFunction = new lambda.Function(this, 'LegacyAgentFunction', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      role: apiLambdaRole,
      code: lambda.Code.fromInline(`
import json
import boto3
import logging
from typing import Dict, Any

logger = logging.getLogger()
logger.setLevel(logging.INFO)

bedrock_agent = boto3.client('bedrock-agent-runtime')

def handler(event, context):
    """
    Agent orchestrator for THRAG multi-agent system
    """
    try:
        logger.info(f"Received event: {json.dumps(event)}")
        
        # Parse request
        body = json.loads(event.get('body', '{}'))
        agent_type = body.get('agent_type')
        query = body.get('query')
        session_id = body.get('session_id', 'default-session')
        
        if not agent_type or not query:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({'error': 'Missing agent_type or query'})
            }
        
        # Map agent types to agent IDs
        agent_mapping = {
            'threat_hunter': '${props.agents.threatHunterAgent.agentId}',
            'intelligence_analyst': '${props.agents.intelligenceAnalystAgent.agentId}',
            'incident_commander': '${props.agents.incidentCommanderAgent.agentId}',
            'forensics_investigator': '${props.agents.forensicsInvestigatorAgent.agentId}',
            'compliance_advisor': '${props.agents.complianceAdvisorAgent.agentId}',
            'communication_specialist': '${props.agents.communicationSpecialistAgent.agentId}'
        }
        
        agent_id = agent_mapping.get(agent_type)
        if not agent_id:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({'error': f'Unknown agent type: {agent_type}'})
            }
        
        # Invoke Bedrock agent
        response = bedrock_agent.invoke_agent(
            agentId=agent_id,
            agentAliasId='TSTALIASID',
            sessionId=session_id,
            inputText=query
        )
        
        # Process response
        result = ''
        for event in response['completion']:
            if 'chunk' in event:
                chunk = event['chunk']
                if 'bytes' in chunk:
                    result += chunk['bytes'].decode('utf-8')
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
            'body': json.dumps({
                'agent_type': agent_type,
                'response': result,
                'session_id': session_id
            })
        }
        
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Internal server error'})
        }
      `),
      timeout: cdk.Duration.minutes(5),
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: {
        'SECURITY_EVENTS_TABLE': props.dataResources.securityEventsTable.tableName,
        'THREAT_INDICATORS_TABLE': props.dataResources.threatIndicatorsTable.tableName,
        'HUNT_QUERIES_TABLE': props.dataResources.huntQueriesTable.tableName,
        'INCIDENT_PLAYBOOKS_TABLE': props.dataResources.incidentPlaybooksTable.tableName,
      },
    });

    // Lambda function for security events API
    const securityEventsFunction = new lambda.Function(this, 'SecurityEventsFunction', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      role: apiLambdaRole,
      code: lambda.Code.fromInline(`
import json
import boto3
import logging
from datetime import datetime
import uuid

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource('dynamodb')
events_table = dynamodb.Table('${props.dataResources.securityEventsTable.tableName}')

def handler(event, context):
    """
    Security events API handler
    """
    try:
        http_method = event.get('httpMethod')
        path_parameters = event.get('pathParameters') or {}
        query_parameters = event.get('queryStringParameters') or {}
        
        if http_method == 'GET':
            return get_security_events(query_parameters)
        elif http_method == 'POST':
            body = json.loads(event.get('body', '{}'))
            return create_security_event(body)
        else:
            return {
                'statusCode': 405,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({'error': 'Method not allowed'})
            }
            
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Internal server error'})
        }

def get_security_events(query_params):
    """Get security events with optional filtering"""
    try:
        # Basic scan with limit
        limit = int(query_params.get('limit', 50))
        
        response = events_table.scan(Limit=limit)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'events': response['Items'],
                'count': len(response['Items'])
            }, default=str)
        }
        
    except Exception as e:
        logger.error(f"Error getting events: {str(e)}")
        raise

def create_security_event(event_data):
    """Create a new security event"""
    try:
        event_id = str(uuid.uuid4())
        timestamp = int(datetime.now().timestamp() * 1000)
        
        item = {
            'eventId': event_id,
            'timestamp': timestamp,
            'source': event_data.get('source', 'unknown'),
            'eventType': event_data.get('eventType', 'generic'),
            'severity': event_data.get('severity', 'MEDIUM'),
            'rawData': event_data.get('rawData', {}),
            'normalizedData': event_data.get('normalizedData', {}),
            'ttl': timestamp + (7 * 24 * 60 * 60 * 1000)  # 7 days TTL
        }
        
        events_table.put_item(Item=item)
        
        return {
            'statusCode': 201,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'eventId': event_id,
                'message': 'Security event created successfully'
            })
        }
        
    except Exception as e:
        logger.error(f"Error creating event: {str(e)}")
        raise
      `),
      timeout: cdk.Duration.minutes(2),
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // REST API Gateway
    this.api = new apigateway.RestApi(this, 'ThragApi', {
      restApiName: 'THRAG Security API',
      description: 'API for THRAG threat hunting and security operations',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // API resources and methods
    const agentsResource = this.api.root.addResource('agents');
    const invokeResource = agentsResource.addResource('invoke');
    
    invokeResource.addMethod('POST', new apigateway.LambdaIntegration(legacyAgentFunction), {
      requestValidator: new apigateway.RequestValidator(this, 'AgentRequestValidator', {
        restApi: this.api,
        validateRequestBody: true,
        requestValidatorName: 'agent-request-validator',
      }),
    });

    // Enhanced API resources
    const eventsResource = this.api.root.addResource('events');
    eventsResource.addMethod('GET', new apigateway.LambdaIntegration(securityEventsFunction));
    eventsResource.addMethod('POST', new apigateway.LambdaIntegration(securityEventsFunction));

    // Orchestration endpoints
    const orchestrateResource = this.api.root.addResource('orchestrate');
    orchestrateResource.addMethod('POST', new apigateway.LambdaIntegration(agentOrchestratorFunction));

    // Threat scoring endpoints
    const scoringResource = this.api.root.addResource('scoring');
    scoringResource.addMethod('POST', new apigateway.LambdaIntegration(threatScoringFunction));

    // Knowledge management endpoints
    const knowledgeResource = this.api.root.addResource('knowledge');
    knowledgeResource.addMethod('POST', new apigateway.LambdaIntegration(knowledgeManagerFunction));

    // Metrics and monitoring endpoints
    const metricsResource = this.api.root.addResource('metrics');
    metricsResource.addMethod('GET', new apigateway.LambdaIntegration(securityEventsFunction));

    // Agent status endpoints
    const agentStatusResource = agentsResource.addResource('status');
    agentStatusResource.addMethod('GET', new apigateway.LambdaIntegration(agentOrchestratorFunction));

    // Hunt queries endpoints
    const huntsResource = this.api.root.addResource('hunts');
    huntsResource.addMethod('GET', new apigateway.LambdaIntegration(agentOrchestratorFunction));
    huntsResource.addMethod('POST', new apigateway.LambdaIntegration(agentOrchestratorFunction));

    // Threat intelligence endpoints
    const threatIntelResource = this.api.root.addResource('threat-intel');
    threatIntelResource.addMethod('GET', new apigateway.LambdaIntegration(knowledgeManagerFunction));

    // S3 bucket for web dashboard
    const webBucket = new s3.Bucket(this, 'WebDashboardBucket', {
      bucketName: `thrag-web-dashboard-${this.account}-${this.region}`,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'error.html',
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // CloudFront distribution for web dashboard
    this.webDistribution = new cloudfront.Distribution(this, 'WebDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(webBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
    });

    // Deploy basic web dashboard
    new s3deploy.BucketDeployment(this, 'WebDashboardDeployment', {
      sources: [
        s3deploy.Source.data('index.html', `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>THRAG - Threat Hunting Dashboard</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: #2c3e50; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .card { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .agent-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .agent-card { border-left: 4px solid #3498db; }
        .agent-card h3 { margin-top: 0; color: #2c3e50; }
        .query-form { margin-top: 20px; }
        .query-input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 10px; }
        .query-button { background: #3498db; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
        .query-button:hover { background: #2980b9; }
        .response-area { background: #f8f9fa; padding: 15px; border-radius: 4px; margin-top: 10px; min-height: 100px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🛡️ THRAG - Threat Hunting Retrieval Augmented Generation</h1>
            <p>AI-powered threat hunting and security intelligence platform</p>
        </div>
        
        <div class="card">
            <h2>System Status</h2>
            <p>✅ All agents operational</p>
            <p>✅ Knowledge base synchronized</p>
            <p>✅ Real-time processing active</p>
        </div>
        
        <div class="card">
            <h2>AI Security Agents</h2>
            <div class="agent-grid">
                <div class="agent-card card">
                    <h3>🎯 Threat Hunter</h3>
                    <p>Generates sophisticated hunt queries and executes threat detection across security data sources.</p>
                    <div class="query-form">
                        <input type="text" class="query-input" placeholder="Enter threat hunting query..." id="threat-hunter-input">
                        <button class="query-button" onclick="queryAgent('threat_hunter', 'threat-hunter-input', 'threat-hunter-response')">Hunt Threats</button>
                        <div class="response-area" id="threat-hunter-response">Response will appear here...</div>
                    </div>
                </div>
                
                <div class="agent-card card">
                    <h3>🔍 Intelligence Analyst</h3>
                    <p>Correlates findings with threat intelligence and provides detailed threat assessments.</p>
                    <div class="query-form">
                        <input type="text" class="query-input" placeholder="Enter intelligence query..." id="intel-analyst-input">
                        <button class="query-button" onclick="queryAgent('intelligence_analyst', 'intel-analyst-input', 'intel-analyst-response')">Analyze Intelligence</button>
                        <div class="response-area" id="intel-analyst-response">Response will appear here...</div>
                    </div>
                </div>
                
                <div class="agent-card card">
                    <h3>⚡ Incident Commander</h3>
                    <p>Creates custom incident response playbooks and coordinates security operations.</p>
                    <div class="query-form">
                        <input type="text" class="query-input" placeholder="Describe security incident..." id="incident-commander-input">
                        <button class="query-button" onclick="queryAgent('incident_commander', 'incident-commander-input', 'incident-commander-response')">Generate Response Plan</button>
                        <div class="response-area" id="incident-commander-response">Response will appear here...</div>
                    </div>
                </div>
                
                <div class="agent-card card">
                    <h3>🔬 Forensics Investigator</h3>
                    <p>Guides evidence collection and provides forensic analysis workflows.</p>
                    <div class="query-form">
                        <input type="text" class="query-input" placeholder="Describe forensic investigation..." id="forensics-input">
                        <button class="query-button" onclick="queryAgent('forensics_investigator', 'forensics-input', 'forensics-response')">Investigate Evidence</button>
                        <div class="response-area" id="forensics-response">Response will appear here...</div>
                    </div>
                </div>
                
                <div class="agent-card card">
                    <h3>📋 Compliance Advisor</h3>
                    <p>Maps incidents to regulatory requirements and generates compliance reports.</p>
                    <div class="query-form">
                        <input type="text" class="query-input" placeholder="Enter compliance question..." id="compliance-input">
                        <button class="query-button" onclick="queryAgent('compliance_advisor', 'compliance-input', 'compliance-response')">Check Compliance</button>
                        <div class="response-area" id="compliance-response">Response will appear here...</div>
                    </div>
                </div>
                
                <div class="agent-card card">
                    <h3>📢 Communication Specialist</h3>
                    <p>Generates stakeholder reports and security communication materials.</p>
                    <div class="query-form">
                        <input type="text" class="query-input" placeholder="Describe communication need..." id="communication-input">
                        <button class="query-button" onclick="queryAgent('communication_specialist', 'communication-input', 'communication-response')">Create Communication</button>
                        <div class="response-area" id="communication-response">Response will appear here...</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <script>
        const API_ENDPOINT = '${this.api.url}';
        
        async function queryAgent(agentType, inputId, responseId) {
            const input = document.getElementById(inputId);
            const responseDiv = document.getElementById(responseId);
            const query = input.value.trim();
            
            if (!query) {
                alert('Please enter a query');
                return;
            }
            
            responseDiv.innerHTML = 'Processing query...';
            
            try {
                const response = await fetch(API_ENDPOINT + 'agents/invoke', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        agent_type: agentType,
                        query: query,
                        session_id: 'web-session-' + Date.now()
                    })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    responseDiv.innerHTML = '<strong>Agent Response:</strong><br>' + data.response.replace(/\\n/g, '<br>');
                } else {
                    responseDiv.innerHTML = '<strong>Error:</strong> ' + (data.error || 'Unknown error');
                }
            } catch (error) {
                responseDiv.innerHTML = '<strong>Error:</strong> ' + error.message;
            }
        }
    </script>
</body>
</html>
        `),
      ],
      destinationBucket: webBucket,
      distribution: this.webDistribution,
      distributionPaths: ['/*'],
    });

    // Outputs
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: this.api.url,
      description: 'THRAG API Gateway endpoint',
    });

    new cdk.CfnOutput(this, 'WebDashboardUrl', {
      value: `https://${this.webDistribution.distributionDomainName}`,
      description: 'THRAG Web Dashboard URL',
    });

    new cdk.CfnOutput(this, 'AgentInvokeEndpoint', {
      value: `${this.api.url}agents/invoke`,
      description: 'Agent invocation endpoint',
    });

    new cdk.CfnOutput(this, 'SecurityEventsEndpoint', {
      value: `${this.api.url}events`,
      description: 'Security events API endpoint',
    });
  }
}