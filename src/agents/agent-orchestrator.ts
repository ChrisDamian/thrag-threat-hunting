import { BedrockAgentRuntimeClient, InvokeAgentCommand } from '@aws-sdk/client-bedrock-agent-runtime';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { DynamoDBClient, PutItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { KnowledgeManager } from '../rag-system/knowledge-manager';
import { EnhancedThreatHunter } from './enhanced-threat-hunter';

export interface AgentTask {
  id: string;
  agentType: AgentType;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  input: string;
  context?: Record<string, any>;
  requiredCapabilities: string[];
  dependencies?: string[]; // Other task IDs this depends on
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  result?: AgentResult;
  error?: string;
}

export interface AgentResult {
  agentType: AgentType;
  output: string;
  confidence: number;
  sources: string[];
  recommendations: string[];
  followUpTasks?: AgentTask[];
  metadata: Record<string, any>;
}

export interface CollaborationSession {
  id: string;
  scenario: string;
  participants: AgentType[];
  tasks: AgentTask[];
  sharedContext: Record<string, any>;
  status: 'ACTIVE' | 'COMPLETED' | 'FAILED';
  createdAt: Date;
  completedAt?: Date;
  finalResult?: string;
}

export type AgentType = 
  | 'threat_hunter'
  | 'intelligence_analyst' 
  | 'incident_commander'
  | 'forensics_investigator'
  | 'compliance_advisor'
  | 'communication_specialist';

export interface AgentCapabilities {
  [key: string]: {
    agentId: string;
    capabilities: string[];
    specializations: string[];
    averageResponseTime: number;
    successRate: number;
  };
}

export class AgentOrchestrator {
  private bedrockClient: BedrockAgentRuntimeClient;
  private eventBridgeClient: EventBridgeClient;
  private dynamoClient: DynamoDBClient;
  private knowledgeManager: KnowledgeManager;
  private threatHunter: EnhancedThreatHunter;
  
  private agentCapabilities: AgentCapabilities;
  private tasksTable: string;
  private sessionsTable: string;

  constructor(
    agentCapabilities: AgentCapabilities,
    tasksTable: string,
    sessionsTable: string,
    knowledgeBaseId: string,
    vectorStoreEndpoint: string
  ) {
    this.bedrockClient = new BedrockAgentRuntimeClient({});
    this.eventBridgeClient = new EventBridgeClient({});
    this.dynamoClient = new DynamoDBClient({});
    this.knowledgeManager = new KnowledgeManager(knowledgeBaseId, vectorStoreEndpoint);
    this.threatHunter = new EnhancedThreatHunter(
      agentCapabilities.threat_hunter.agentId,
      'hunt-queries-table',
      knowledgeBaseId,
      vectorStoreEndpoint
    );
    
    this.agentCapabilities = agentCapabilities;
    this.tasksTable = tasksTable;
    this.sessionsTable = sessionsTable;
  }

  /**
   * Orchestrate multi-agent collaboration for complex security scenarios
   */
  async orchestrateSecurityScenario(
    scenario: string,
    initialContext: Record<string, any> = {}
  ): Promise<CollaborationSession> {
    try {
      console.log(`Orchestrating security scenario: ${scenario}`);

      // Create collaboration session
      const session: CollaborationSession = {
        id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        scenario,
        participants: [],
        tasks: [],
        sharedContext: initialContext,
        status: 'ACTIVE',
        createdAt: new Date()
      };

      // Analyze scenario and determine required agents
      const requiredAgents = await this.analyzeScenarioRequirements(scenario, initialContext);
      session.participants = requiredAgents;

      // Generate initial task plan
      const taskPlan = await this.generateTaskPlan(scenario, requiredAgents, initialContext);
      session.tasks = taskPlan;

      // Store session
      await this.storeSession(session);

      // Execute task plan
      const executionResult = await this.executeTaskPlan(session);

      // Update session with results
      session.status = executionResult.success ? 'COMPLETED' : 'FAILED';
      session.completedAt = new Date();
      session.finalResult = executionResult.summary;

      await this.updateSession(session);

      console.log(`Security scenario orchestration completed: ${session.id}`);
      return session;

    } catch (error) {
      console.error('Error orchestrating security scenario:', error);
      throw new Error(`Scenario orchestration failed: ${error.message}`);
    }
  }

  /**
   * Execute a single agent task with context sharing
   */
  async executeAgentTask(
    task: AgentTask,
    sharedContext: Record<string, any> = {}
  ): Promise<AgentResult> {
    try {
      console.log(`Executing task ${task.id} with agent ${task.agentType}`);

      task.status = 'IN_PROGRESS';
      task.startedAt = new Date();
      await this.updateTask(task);

      // Prepare context for the agent
      const agentContext = this.prepareAgentContext(task, sharedContext);

      // Execute based on agent type
      let result: AgentResult;

      switch (task.agentType) {
        case 'threat_hunter':
          result = await this.executeThreatHunterTask(task, agentContext);
          break;
        case 'intelligence_analyst':
          result = await this.executeIntelligenceAnalystTask(task, agentContext);
          break;
        case 'incident_commander':
          result = await this.executeIncidentCommanderTask(task, agentContext);
          break;
        case 'forensics_investigator':
          result = await this.executeForensicsTask(task, agentContext);
          break;
        case 'compliance_advisor':
          result = await this.executeComplianceTask(task, agentContext);
          break;
        case 'communication_specialist':
          result = await this.executeCommunicationTask(task, agentContext);
          break;
        default:
          throw new Error(`Unknown agent type: ${task.agentType}`);
      }

      // Update task with result
      task.status = 'COMPLETED';
      task.completedAt = new Date();
      task.result = result;
      await this.updateTask(task);

      // Trigger follow-up tasks if any
      if (result.followUpTasks && result.followUpTasks.length > 0) {
        await this.scheduleFollowUpTasks(result.followUpTasks);
      }

      console.log(`Task ${task.id} completed successfully`);
      return result;

    } catch (error) {
      console.error(`Error executing task ${task.id}:`, error);
      
      task.status = 'FAILED';
      task.error = error.message;
      task.completedAt = new Date();
      await this.updateTask(task);

      throw error;
    }
  }

  /**
   * Handle agent coordination conflicts and prioritization
   */
  async resolveAgentConflicts(
    conflictingTasks: AgentTask[]
  ): Promise<{
    resolution: string;
    prioritizedTasks: AgentTask[];
    reasoning: string;
  }> {
    try {
      console.log(`Resolving conflicts between ${conflictingTasks.length} tasks`);

      // Sort tasks by priority and dependencies
      const prioritizedTasks = this.prioritizeTasks(conflictingTasks);

      // Generate resolution reasoning
      const reasoning = await this.generateConflictResolution(conflictingTasks, prioritizedTasks);

      return {
        resolution: 'PRIORITIZED',
        prioritizedTasks,
        reasoning
      };

    } catch (error) {
      console.error('Error resolving agent conflicts:', error);
      throw new Error(`Conflict resolution failed: ${error.message}`);
    }
  }

  /**
   * Monitor agent performance and health
   */
  async monitorAgentHealth(): Promise<{
    agentStatus: Record<AgentType, 'HEALTHY' | 'DEGRADED' | 'FAILED'>;
    performanceMetrics: Record<AgentType, {
      averageResponseTime: number;
      successRate: number;
      tasksCompleted: number;
      lastActivity: Date;
    }>;
    recommendations: string[];
  }> {
    try {
      const agentStatus: Record<AgentType, 'HEALTHY' | 'DEGRADED' | 'FAILED'> = {} as any;
      const performanceMetrics: Record<AgentType, any> = {} as any;
      const recommendations: string[] = [];

      // Check each agent's health
      for (const [agentType, capabilities] of Object.entries(this.agentCapabilities)) {
        try {
          // Test agent responsiveness
          const testResult = await this.testAgentHealth(agentType as AgentType);
          
          agentStatus[agentType as AgentType] = testResult.healthy ? 'HEALTHY' : 'DEGRADED';
          performanceMetrics[agentType as AgentType] = {
            averageResponseTime: testResult.responseTime,
            successRate: capabilities.successRate,
            tasksCompleted: testResult.tasksCompleted,
            lastActivity: testResult.lastActivity
          };

          if (!testResult.healthy) {
            recommendations.push(`Agent ${agentType} requires attention: ${testResult.issue}`);
          }

        } catch (error) {
          agentStatus[agentType as AgentType] = 'FAILED';
          recommendations.push(`Agent ${agentType} is not responding: ${error.message}`);
        }
      }

      return {
        agentStatus,
        performanceMetrics,
        recommendations
      };

    } catch (error) {
      console.error('Error monitoring agent health:', error);
      throw new Error(`Agent health monitoring failed: ${error.message}`);
    }
  }

  // Private helper methods

  private async analyzeScenarioRequirements(
    scenario: string,
    context: Record<string, any>
  ): Promise<AgentType[]> {
    // Analyze scenario to determine which agents are needed
    const requiredAgents: AgentType[] = [];

    const scenarioLower = scenario.toLowerCase();

    // Always include threat hunter for security scenarios
    requiredAgents.push('threat_hunter');

    // Add intelligence analyst for threat analysis
    if (scenarioLower.includes('threat') || scenarioLower.includes('attack') || scenarioLower.includes('malware')) {
      requiredAgents.push('intelligence_analyst');
    }

    // Add incident commander for active incidents
    if (scenarioLower.includes('incident') || scenarioLower.includes('breach') || scenarioLower.includes('compromise')) {
      requiredAgents.push('incident_commander');
    }

    // Add forensics investigator for investigation scenarios
    if (scenarioLower.includes('investigate') || scenarioLower.includes('forensic') || scenarioLower.includes('evidence')) {
      requiredAgents.push('forensics_investigator');
    }

    // Add compliance advisor for regulatory scenarios
    if (scenarioLower.includes('compliance') || scenarioLower.includes('audit') || scenarioLower.includes('regulation')) {
      requiredAgents.push('compliance_advisor');
    }

    // Add communication specialist for reporting scenarios
    if (scenarioLower.includes('report') || scenarioLower.includes('communication') || scenarioLower.includes('stakeholder')) {
      requiredAgents.push('communication_specialist');
    }

    return [...new Set(requiredAgents)]; // Remove duplicates
  }

  private async generateTaskPlan(
    scenario: string,
    agents: AgentType[],
    context: Record<string, any>
  ): Promise<AgentTask[]> {
    const tasks: AgentTask[] = [];
    let taskCounter = 0;

    // Generate tasks based on scenario and available agents
    for (const agentType of agents) {
      const agentTasks = await this.generateAgentSpecificTasks(scenario, agentType, context, taskCounter);
      tasks.push(...agentTasks);
      taskCounter += agentTasks.length;
    }

    // Set up task dependencies
    this.establishTaskDependencies(tasks);

    return tasks;
  }

  private async generateAgentSpecificTasks(
    scenario: string,
    agentType: AgentType,
    context: Record<string, any>,
    startIndex: number
  ): Promise<AgentTask[]> {
    const tasks: AgentTask[] = [];

    switch (agentType) {
      case 'threat_hunter':
        tasks.push({
          id: `task-${startIndex + 1}`,
          agentType,
          priority: 'HIGH',
          input: `Analyze the following security scenario and generate threat hunting hypotheses: ${scenario}`,
          context,
          requiredCapabilities: ['threat_analysis', 'hunt_generation'],
          status: 'PENDING',
          createdAt: new Date()
        });
        break;

      case 'intelligence_analyst':
        tasks.push({
          id: `task-${startIndex + 1}`,
          agentType,
          priority: 'HIGH',
          input: `Provide threat intelligence analysis for: ${scenario}`,
          context,
          requiredCapabilities: ['threat_intelligence', 'correlation'],
          dependencies: [`task-${startIndex}`], // Depends on threat hunter
          status: 'PENDING',
          createdAt: new Date()
        });
        break;

      case 'incident_commander':
        tasks.push({
          id: `task-${startIndex + 1}`,
          agentType,
          priority: 'CRITICAL',
          input: `Create incident response plan for: ${scenario}`,
          context,
          requiredCapabilities: ['incident_response', 'coordination'],
          status: 'PENDING',
          createdAt: new Date()
        });
        break;

      case 'forensics_investigator':
        tasks.push({
          id: `task-${startIndex + 1}`,
          agentType,
          priority: 'MEDIUM',
          input: `Provide forensic investigation guidance for: ${scenario}`,
          context,
          requiredCapabilities: ['forensics', 'evidence_collection'],
          status: 'PENDING',
          createdAt: new Date()
        });
        break;

      case 'compliance_advisor':
        tasks.push({
          id: `task-${startIndex + 1}`,
          agentType,
          priority: 'MEDIUM',
          input: `Assess compliance implications of: ${scenario}`,
          context,
          requiredCapabilities: ['compliance', 'regulatory_analysis'],
          status: 'PENDING',
          createdAt: new Date()
        });
        break;

      case 'communication_specialist':
        tasks.push({
          id: `task-${startIndex + 1}`,
          agentType,
          priority: 'LOW',
          input: `Prepare communication materials for: ${scenario}`,
          context,
          requiredCapabilities: ['communication', 'reporting'],
          dependencies: tasks.map(t => t.id), // Depends on all other tasks
          status: 'PENDING',
          createdAt: new Date()
        });
        break;
    }

    return tasks;
  }

  private establishTaskDependencies(tasks: AgentTask[]): void {
    // Set up logical dependencies between tasks
    const taskMap = new Map(tasks.map(t => [t.agentType, t]));

    // Intelligence analyst depends on threat hunter
    const intelTask = taskMap.get('intelligence_analyst');
    const huntTask = taskMap.get('threat_hunter');
    if (intelTask && huntTask) {
      intelTask.dependencies = [huntTask.id];
    }

    // Communication specialist depends on all other tasks
    const commTask = taskMap.get('communication_specialist');
    if (commTask) {
      commTask.dependencies = tasks
        .filter(t => t.agentType !== 'communication_specialist')
        .map(t => t.id);
    }
  }

  private async executeTaskPlan(session: CollaborationSession): Promise<{
    success: boolean;
    summary: string;
    results: AgentResult[];
  }> {
    const results: AgentResult[] = [];
    const completedTasks = new Set<string>();

    // Execute tasks in dependency order
    while (completedTasks.size < session.tasks.length) {
      const readyTasks = session.tasks.filter(task => 
        task.status === 'PENDING' && 
        (!task.dependencies || task.dependencies.every(dep => completedTasks.has(dep)))
      );

      if (readyTasks.length === 0) {
        // Check for circular dependencies or failed tasks
        const failedTasks = session.tasks.filter(t => t.status === 'FAILED');
        if (failedTasks.length > 0) {
          break;
        }
        
        // Wait for in-progress tasks
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      // Execute ready tasks in parallel (up to a limit)
      const parallelTasks = readyTasks.slice(0, 3); // Max 3 parallel tasks
      
      const taskPromises = parallelTasks.map(task => 
        this.executeAgentTask(task, session.sharedContext)
          .then(result => {
            results.push(result);
            completedTasks.add(task.id);
            
            // Update shared context with task results
            session.sharedContext[`${task.agentType}_result`] = result;
            
            return result;
          })
          .catch(error => {
            console.error(`Task ${task.id} failed:`, error);
            return null;
          })
      );

      await Promise.all(taskPromises);
    }

    // Generate summary
    const successfulTasks = results.filter(r => r !== null);
    const summary = await this.generateSessionSummary(session, successfulTasks);

    return {
      success: successfulTasks.length === session.tasks.length,
      summary,
      results: successfulTasks
    };
  }

  private prepareAgentContext(task: AgentTask, sharedContext: Record<string, any>): string {
    const contextParts = [
      `Task: ${task.input}`,
      `Priority: ${task.priority}`,
      `Required Capabilities: ${task.requiredCapabilities.join(', ')}`
    ];

    if (Object.keys(sharedContext).length > 0) {
      contextParts.push('Shared Context:');
      for (const [key, value] of Object.entries(sharedContext)) {
        if (typeof value === 'string') {
          contextParts.push(`${key}: ${value}`);
        } else {
          contextParts.push(`${key}: ${JSON.stringify(value)}`);
        }
      }
    }

    if (task.context && Object.keys(task.context).length > 0) {
      contextParts.push('Task-specific Context:');
      for (const [key, value] of Object.entries(task.context)) {
        contextParts.push(`${key}: ${JSON.stringify(value)}`);
      }
    }

    return contextParts.join('\n');
  }

  // Agent-specific execution methods

  private async executeThreatHunterTask(task: AgentTask, context: string): Promise<AgentResult> {
    // Use the enhanced threat hunter for complex operations
    if (task.input.toLowerCase().includes('hypothesis') || task.input.toLowerCase().includes('hunt')) {
      const hypotheses = await this.threatHunter.generateThreatHypotheses(context);
      
      return {
        agentType: 'threat_hunter',
        output: `Generated ${hypotheses.length} threat hunting hypotheses based on current threat landscape`,
        confidence: 0.85,
        sources: hypotheses.flatMap(h => h.basedOnIntelligence),
        recommendations: [
          'Execute generated hunt queries to validate hypotheses',
          'Monitor for indicators identified in the hypotheses',
          'Correlate findings with existing security events'
        ],
        metadata: { hypotheses }
      };
    }

    // Fallback to basic agent invocation
    return await this.invokeBasicAgent('threat_hunter', context);
  }

  private async executeIntelligenceAnalystTask(task: AgentTask, context: string): Promise<AgentResult> {
    // Use RAG system for intelligence analysis
    const ragResponse = await this.knowledgeManager.retrieveAndGenerate(
      task.input,
      context,
      { confidence_min: 0.6 }
    );

    return {
      agentType: 'intelligence_analyst',
      output: ragResponse.answer,
      confidence: ragResponse.confidence,
      sources: ragResponse.sources.map(s => s.id),
      recommendations: [
        'Cross-reference findings with additional intelligence sources',
        'Monitor for related indicators across the environment',
        'Update threat hunting queries based on new intelligence'
      ],
      metadata: {
        sources: ragResponse.sources,
        reasoning: ragResponse.reasoning
      }
    };
  }

  private async executeIncidentCommanderTask(task: AgentTask, context: string): Promise<AgentResult> {
    return await this.invokeBasicAgent('incident_commander', context);
  }

  private async executeForensicsTask(task: AgentTask, context: string): Promise<AgentResult> {
    return await this.invokeBasicAgent('forensics_investigator', context);
  }

  private async executeComplianceTask(task: AgentTask, context: string): Promise<AgentResult> {
    return await this.invokeBasicAgent('compliance_advisor', context);
  }

  private async executeCommunicationTask(task: AgentTask, context: string): Promise<AgentResult> {
    return await this.invokeBasicAgent('communication_specialist', context);
  }

  private async invokeBasicAgent(agentType: AgentType, context: string): Promise<AgentResult> {
    const agentId = this.agentCapabilities[agentType].agentId;
    
    const command = new InvokeAgentCommand({
      agentId,
      agentAliasId: 'TSTALIASID',
      sessionId: `orchestrator-${Date.now()}`,
      inputText: context
    });

    const response = await this.bedrockClient.send(command);
    
    let output = '';
    if (response.completion) {
      for await (const event of response.completion) {
        if (event.chunk?.bytes) {
          output += new TextDecoder().decode(event.chunk.bytes);
        }
      }
    }

    return {
      agentType,
      output,
      confidence: 0.8,
      sources: [],
      recommendations: [],
      metadata: {}
    };
  }

  private prioritizeTasks(tasks: AgentTask[]): AgentTask[] {
    return tasks.sort((a, b) => {
      // Priority order: CRITICAL > HIGH > MEDIUM > LOW
      const priorityOrder = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
      
      const aPriority = priorityOrder[a.priority];
      const bPriority = priorityOrder[b.priority];
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
      
      // If same priority, sort by creation time
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  private async generateConflictResolution(
    conflictingTasks: AgentTask[],
    prioritizedTasks: AgentTask[]
  ): Promise<string> {
    const reasoning = [
      `Resolved conflicts between ${conflictingTasks.length} tasks using priority-based scheduling.`,
      `Task execution order determined by priority levels and dependencies.`,
      `Critical and high-priority security tasks will be executed first.`
    ];

    return reasoning.join(' ');
  }

  private async testAgentHealth(agentType: AgentType): Promise<{
    healthy: boolean;
    responseTime: number;
    tasksCompleted: number;
    lastActivity: Date;
    issue?: string;
  }> {
    try {
      const startTime = Date.now();
      
      // Simple health check - invoke agent with basic query
      await this.invokeBasicAgent(agentType, 'Health check - respond with OK');
      
      const responseTime = Date.now() - startTime;
      
      return {
        healthy: responseTime < 30000, // 30 second threshold
        responseTime,
        tasksCompleted: Math.floor(Math.random() * 100), // Mock data
        lastActivity: new Date(),
        issue: responseTime >= 30000 ? 'Slow response time' : undefined
      };

    } catch (error) {
      return {
        healthy: false,
        responseTime: -1,
        tasksCompleted: 0,
        lastActivity: new Date(0),
        issue: error.message
      };
    }
  }

  private async generateSessionSummary(
    session: CollaborationSession,
    results: AgentResult[]
  ): Promise<string> {
    const summaryParts = [
      `Security scenario analysis completed for: ${session.scenario}`,
      `Involved ${session.participants.length} specialized agents: ${session.participants.join(', ')}`,
      `Executed ${results.length} tasks successfully`,
      '',
      'Key Findings:'
    ];

    results.forEach((result, index) => {
      summaryParts.push(`${index + 1}. ${result.agentType}: ${result.output.substring(0, 100)}...`);
    });

    summaryParts.push('');
    summaryParts.push('Consolidated Recommendations:');
    
    const allRecommendations = results.flatMap(r => r.recommendations);
    const uniqueRecommendations = [...new Set(allRecommendations)];
    
    uniqueRecommendations.slice(0, 5).forEach((rec, index) => {
      summaryParts.push(`${index + 1}. ${rec}`);
    });

    return summaryParts.join('\n');
  }

  private async scheduleFollowUpTasks(tasks: AgentTask[]): Promise<void> {
    for (const task of tasks) {
      await this.storeTask(task);
      
      // Trigger task execution via EventBridge
      const event = {
        Source: 'thrag.orchestrator',
        DetailType: 'Agent Task Scheduled',
        Detail: JSON.stringify({
          taskId: task.id,
          agentType: task.agentType,
          priority: task.priority
        })
      };

      await this.eventBridgeClient.send(new PutEventsCommand({
        Entries: [event]
      }));
    }
  }

  // DynamoDB operations

  private async storeSession(session: CollaborationSession): Promise<void> {
    const item = marshall(session);
    
    const command = new PutItemCommand({
      TableName: this.sessionsTable,
      Item: item
    });

    await this.dynamoClient.send(command);
  }

  private async updateSession(session: CollaborationSession): Promise<void> {
    await this.storeSession(session); // Simple implementation
  }

  private async storeTask(task: AgentTask): Promise<void> {
    const item = marshall(task);
    
    const command = new PutItemCommand({
      TableName: this.tasksTable,
      Item: item
    });

    await this.dynamoClient.send(command);
  }

  private async updateTask(task: AgentTask): Promise<void> {
    await this.storeTask(task); // Simple implementation
  }
}