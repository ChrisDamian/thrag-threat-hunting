import { BedrockAgentRuntimeClient, InvokeAgentCommand } from '@aws-sdk/client-bedrock-agent-runtime';
import { DynamoDBClient, QueryCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { KnowledgeManager, RetrievalQuery } from '../rag-system/knowledge-manager';

export interface HuntQuery {
  id: string;
  name: string;
  description: string;
  query: string;
  dataSource: string[];
  createdBy: 'AGENT' | 'HUMAN';
  basedOnThreatIntel: string[];
  mitreTechniques: string[];
  confidence: number;
  executionHistory: HuntExecution[];
}

export interface HuntExecution {
  timestamp: Date;
  results: number;
  findings: HuntFinding[];
  executionTime: number;
  dataSourcesQueried: string[];
}

export interface HuntFinding {
  id: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  indicators: string[];
  mitreTechniques: string[];
  affectedAssets: string[];
  confidence: number;
  evidence: Evidence[];
  recommendations: string[];
}

export interface Evidence {
  type: 'log' | 'network' | 'file' | 'registry' | 'process';
  source: string;
  timestamp: Date;
  data: Record<string, any>;
  relevanceScore: number;
}

export interface ThreatHypothesis {
  id: string;
  title: string;
  description: string;
  mitreTechniques: string[];
  threatActors: string[];
  indicators: string[];
  confidence: number;
  basedOnIntelligence: string[];
  huntQueries: string[];
  status: 'ACTIVE' | 'VALIDATED' | 'DISMISSED';
}

export class EnhancedThreatHunter {
  private bedrockClient: BedrockAgentRuntimeClient;
  private dynamoClient: DynamoDBClient;
  private knowledgeManager: KnowledgeManager;
  private agentId: string;
  private huntQueriesTable: string;

  constructor(
    agentId: string,
    huntQueriesTable: string,
    knowledgeBaseId: string,
    vectorStoreEndpoint: string
  ) {
    this.bedrockClient = new BedrockAgentRuntimeClient({});
    this.dynamoClient = new DynamoDBClient({});
    this.knowledgeManager = new KnowledgeManager(knowledgeBaseId, vectorStoreEndpoint);
    this.agentId = agentId;
    this.huntQueriesTable = huntQueriesTable;
  }

  /**
   * Generate threat hunting hypotheses based on current threat landscape
   */
  async generateThreatHypotheses(context?: string): Promise<ThreatHypothesis[]> {
    try {
      console.log('Generating threat hunting hypotheses...');

      // Retrieve recent threat intelligence
      const threatIntelQuery: RetrievalQuery = {
        query: context || 'recent threat campaigns attack techniques indicators',
        filters: {
          confidence_min: 0.7,
          date_range: {
            start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
            end: new Date()
          }
        },
        maxResults: 10
      };

      const threatIntel = await this.knowledgeManager.retrieveDocuments(threatIntelQuery);

      // Generate hypotheses using the agent
      const prompt = this.buildHypothesisPrompt(threatIntel, context);
      const agentResponse = await this.invokeAgent(prompt);

      // Parse and structure the hypotheses
      const hypotheses = this.parseHypotheses(agentResponse, threatIntel);

      console.log(`Generated ${hypotheses.length} threat hunting hypotheses`);
      return hypotheses;

    } catch (error) {
      console.error('Error generating threat hypotheses:', error);
      throw new Error(`Failed to generate threat hypotheses: ${error.message}`);
    }
  }

  /**
   * Generate sophisticated hunt queries based on threat intelligence
   */
  async generateHuntQueries(
    hypothesis: ThreatHypothesis,
    dataSources: string[] = ['logs', 'network', 'endpoint']
  ): Promise<HuntQuery[]> {
    try {
      console.log(`Generating hunt queries for hypothesis: ${hypothesis.title}`);

      // Retrieve specific threat intelligence for the hypothesis
      const specificIntel = await this.knowledgeManager.retrieveDocuments({
        query: `${hypothesis.description} ${hypothesis.mitreTechniques.join(' ')} ${hypothesis.threatActors.join(' ')}`,
        filters: {
          confidence_min: 0.6,
          tags: [...hypothesis.mitreTechniques, ...hypothesis.threatActors]
        },
        maxResults: 5
      });

      // Generate queries for each data source
      const queries: HuntQuery[] = [];

      for (const dataSource of dataSources) {
        const query = await this.generateDataSourceQuery(hypothesis, dataSource, specificIntel);
        if (query) {
          queries.push(query);
        }
      }

      // Store queries in DynamoDB
      for (const query of queries) {
        await this.storeHuntQuery(query);
      }

      console.log(`Generated ${queries.length} hunt queries`);
      return queries;

    } catch (error) {
      console.error('Error generating hunt queries:', error);
      throw new Error(`Failed to generate hunt queries: ${error.message}`);
    }
  }

  /**
   * Execute hunt query and analyze results
   */
  async executeHuntQuery(queryId: string): Promise<HuntExecution> {
    try {
      console.log(`Executing hunt query: ${queryId}`);

      // Retrieve query from DynamoDB
      const query = await this.getHuntQuery(queryId);
      if (!query) {
        throw new Error(`Hunt query not found: ${queryId}`);
      }

      const startTime = Date.now();

      // Execute query against data sources (mock implementation)
      const rawResults = await this.executeQuery(query);

      // Analyze results using threat intelligence
      const findings = await this.analyzeHuntResults(rawResults, query);

      const execution: HuntExecution = {
        timestamp: new Date(),
        results: rawResults.length,
        findings,
        executionTime: Date.now() - startTime,
        dataSourcesQueried: query.dataSource
      };

      // Update query execution history
      await this.updateQueryHistory(queryId, execution);

      console.log(`Hunt query executed: ${findings.length} findings identified`);
      return execution;

    } catch (error) {
      console.error(`Error executing hunt query ${queryId}:`, error);
      throw new Error(`Hunt query execution failed: ${error.message}`);
    }
  }

  /**
   * Correlate hunt findings with threat intelligence
   */
  async correlateFindings(findings: HuntFinding[]): Promise<{
    correlatedFindings: HuntFinding[];
    threatCampaigns: string[];
    recommendedActions: string[];
  }> {
    try {
      console.log(`Correlating ${findings.length} hunt findings...`);

      const correlatedFindings: HuntFinding[] = [];
      const threatCampaigns: Set<string> = new Set();
      const recommendedActions: Set<string> = new Set();

      for (const finding of findings) {
        // Retrieve threat intelligence for each finding
        const correlationQuery: RetrievalQuery = {
          query: `${finding.description} ${finding.mitreTechniques.join(' ')} ${finding.indicators.join(' ')}`,
          filters: {
            confidence_min: 0.5
          },
          maxResults: 3
        };

        const threatIntel = await this.knowledgeManager.retrieveDocuments(correlationQuery);

        if (threatIntel.length > 0) {
          // Enhance finding with threat intelligence
          const enhancedFinding = await this.enhanceFindingWithIntel(finding, threatIntel);
          correlatedFindings.push(enhancedFinding);

          // Extract threat campaigns and recommendations
          threatIntel.forEach(intel => {
            if (intel.metadata.tags.some(tag => tag.includes('campaign') || tag.includes('apt'))) {
              threatCampaigns.add(intel.metadata.title);
            }
          });

          // Generate recommendations based on MITRE techniques
          const recommendations = this.generateTechniqueRecommendations(finding.mitreTechniques);
          recommendations.forEach(rec => recommendedActions.add(rec));
        } else {
          correlatedFindings.push(finding);
        }
      }

      return {
        correlatedFindings,
        threatCampaigns: Array.from(threatCampaigns),
        recommendedActions: Array.from(recommendedActions)
      };

    } catch (error) {
      console.error('Error correlating findings:', error);
      throw new Error(`Finding correlation failed: ${error.message}`);
    }
  }

  /**
   * Generate proactive hunt recommendations
   */
  async generateHuntRecommendations(): Promise<{
    priorityHunts: ThreatHypothesis[];
    emergingThreats: string[];
    coverageGaps: string[];
  }> {
    try {
      console.log('Generating proactive hunt recommendations...');

      // Analyze recent threat intelligence for emerging threats
      const emergingThreatsQuery: RetrievalQuery = {
        query: 'emerging threats new attack techniques recent campaigns',
        filters: {
          confidence_min: 0.8,
          date_range: {
            start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
            end: new Date()
          }
        },
        maxResults: 15
      };

      const recentIntel = await this.knowledgeManager.retrieveDocuments(emergingThreatsQuery);

      // Generate priority hunt hypotheses
      const priorityHunts = await this.generateThreatHypotheses('emerging threats recent campaigns');

      // Identify emerging threat patterns
      const emergingThreats = this.extractEmergingThreats(recentIntel);

      // Analyze coverage gaps
      const coverageGaps = await this.analyzeCoverageGaps();

      return {
        priorityHunts: priorityHunts.slice(0, 5), // Top 5 priority hunts
        emergingThreats,
        coverageGaps
      };

    } catch (error) {
      console.error('Error generating hunt recommendations:', error);
      throw new Error(`Hunt recommendations generation failed: ${error.message}`);
    }
  }

  // Private helper methods

  private async invokeAgent(prompt: string): Promise<string> {
    const command = new InvokeAgentCommand({
      agentId: this.agentId,
      agentAliasId: 'TSTALIASID',
      sessionId: `hunt-session-${Date.now()}`,
      inputText: prompt
    });

    const response = await this.bedrockClient.send(command);
    
    let result = '';
    if (response.completion) {
      for await (const event of response.completion) {
        if (event.chunk?.bytes) {
          result += new TextDecoder().decode(event.chunk.bytes);
        }
      }
    }

    return result;
  }

  private buildHypothesisPrompt(threatIntel: any[], context?: string): string {
    const intelSummary = threatIntel.map(intel => 
      `- ${intel.metadata.source}: ${intel.metadata.title} (Confidence: ${intel.metadata.confidence})`
    ).join('\n');

    return `
Based on the following recent threat intelligence, generate 3-5 threat hunting hypotheses:

${intelSummary}

${context ? `Additional context: ${context}` : ''}

For each hypothesis, provide:
1. Title (concise description)
2. Description (detailed explanation)
3. MITRE ATT&CK techniques involved
4. Potential threat actors
5. Key indicators to hunt for
6. Confidence level (0-1)

Format as JSON array with the following structure:
[
  {
    "title": "Hypothesis title",
    "description": "Detailed description",
    "mitreTechniques": ["T1234", "T5678"],
    "threatActors": ["APT29", "Lazarus"],
    "indicators": ["indicator1", "indicator2"],
    "confidence": 0.8
  }
]
`;
  }

  private parseHypotheses(agentResponse: string, threatIntel: any[]): ThreatHypothesis[] {
    try {
      // Extract JSON from agent response
      const jsonMatch = agentResponse.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in agent response');
      }

      const hypothesesData = JSON.parse(jsonMatch[0]);
      
      return hypothesesData.map((data: any, index: number) => ({
        id: `hypothesis-${Date.now()}-${index}`,
        title: data.title || 'Untitled Hypothesis',
        description: data.description || '',
        mitreTechniques: data.mitreTechniques || [],
        threatActors: data.threatActors || [],
        indicators: data.indicators || [],
        confidence: data.confidence || 0.5,
        basedOnIntelligence: threatIntel.map(intel => intel.id),
        huntQueries: [],
        status: 'ACTIVE' as const
      }));

    } catch (error) {
      console.error('Error parsing hypotheses:', error);
      // Return default hypothesis if parsing fails
      return [{
        id: `hypothesis-${Date.now()}`,
        title: 'Generic Threat Hunt',
        description: 'Hunt for suspicious activities based on recent threat intelligence',
        mitreTechniques: ['T1059', 'T1071'],
        threatActors: [],
        indicators: [],
        confidence: 0.5,
        basedOnIntelligence: threatIntel.map(intel => intel.id),
        huntQueries: [],
        status: 'ACTIVE'
      }];
    }
  }

  private async generateDataSourceQuery(
    hypothesis: ThreatHypothesis,
    dataSource: string,
    threatIntel: any[]
  ): Promise<HuntQuery | null> {
    const prompt = `
Generate a ${dataSource} hunt query for the following threat hypothesis:

Title: ${hypothesis.title}
Description: ${hypothesis.description}
MITRE Techniques: ${hypothesis.mitreTechniques.join(', ')}
Threat Actors: ${hypothesis.threatActors.join(', ')}
Indicators: ${hypothesis.indicators.join(', ')}

Supporting threat intelligence:
${threatIntel.map(intel => `- ${intel.content.substring(0, 200)}...`).join('\n')}

Generate a specific ${dataSource} query that would detect this threat. Include:
1. Query name
2. Query description
3. Actual query syntax (SQL, KQL, or similar)
4. Expected indicators to look for

Format as JSON:
{
  "name": "Query name",
  "description": "Query description",
  "query": "Actual query syntax",
  "indicators": ["indicator1", "indicator2"]
}
`;

    try {
      const response = await this.invokeAgent(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        return null;
      }

      const queryData = JSON.parse(jsonMatch[0]);

      return {
        id: `query-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: queryData.name || `${hypothesis.title} - ${dataSource}`,
        description: queryData.description || '',
        query: queryData.query || '',
        dataSource: [dataSource],
        createdBy: 'AGENT',
        basedOnThreatIntel: threatIntel.map(intel => intel.id),
        mitreTechniques: hypothesis.mitreTechniques,
        confidence: hypothesis.confidence,
        executionHistory: []
      };

    } catch (error) {
      console.error(`Error generating ${dataSource} query:`, error);
      return null;
    }
  }

  private async executeQuery(query: HuntQuery): Promise<any[]> {
    // Mock implementation - would integrate with actual data sources
    console.log(`Executing query: ${query.name}`);
    
    // Simulate query results based on query content
    const mockResults = [];
    const resultCount = Math.floor(Math.random() * 10) + 1;

    for (let i = 0; i < resultCount; i++) {
      mockResults.push({
        id: `result-${i}`,
        timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
        source: query.dataSource[0],
        data: {
          sourceIp: `192.168.1.${Math.floor(Math.random() * 255)}`,
          process: 'suspicious_process.exe',
          command: 'powershell.exe -enc <base64>',
          user: 'admin'
        }
      });
    }

    return mockResults;
  }

  private async analyzeHuntResults(rawResults: any[], query: HuntQuery): Promise<HuntFinding[]> {
    const findings: HuntFinding[] = [];

    // Group results by similarity
    const groupedResults = this.groupSimilarResults(rawResults);

    for (const group of groupedResults) {
      if (group.length === 0) continue;

      // Analyze each group for potential threats
      const finding = await this.createFindingFromGroup(group, query);
      if (finding) {
        findings.push(finding);
      }
    }

    return findings;
  }

  private groupSimilarResults(results: any[]): any[][] {
    // Simple grouping by source IP
    const groups = new Map<string, any[]>();

    for (const result of results) {
      const key = result.data?.sourceIp || 'unknown';
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(result);
    }

    return Array.from(groups.values());
  }

  private async createFindingFromGroup(group: any[], query: HuntQuery): Promise<HuntFinding | null> {
    if (group.length === 0) return null;

    const severity = this.calculateFindingSeverity(group, query);
    
    return {
      id: `finding-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      severity,
      title: `Suspicious Activity Detected - ${query.name}`,
      description: `Hunt query "${query.name}" identified ${group.length} related events that match threat patterns`,
      indicators: this.extractIndicatorsFromGroup(group),
      mitreTechniques: query.mitreTechniques,
      affectedAssets: this.extractAffectedAssets(group),
      confidence: Math.min(query.confidence + (group.length * 0.1), 1.0),
      evidence: group.map(result => ({
        type: 'log' as const,
        source: result.source,
        timestamp: new Date(result.timestamp),
        data: result.data,
        relevanceScore: 0.8
      })),
      recommendations: this.generateFindingRecommendations(query.mitreTechniques, severity)
    };
  }

  private calculateFindingSeverity(group: any[], query: HuntQuery): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    let score = 0;

    // Base score from query confidence
    score += query.confidence * 0.4;

    // Adjust based on event count
    score += Math.min(group.length * 0.1, 0.3);

    // Adjust based on MITRE techniques
    const criticalTechniques = ['T1055', 'T1059', 'T1003', 'T1078'];
    const hasCritical = query.mitreTechniques.some(t => criticalTechniques.includes(t));
    if (hasCritical) score += 0.3;

    if (score >= 0.8) return 'CRITICAL';
    if (score >= 0.6) return 'HIGH';
    if (score >= 0.4) return 'MEDIUM';
    return 'LOW';
  }

  private extractIndicatorsFromGroup(group: any[]): string[] {
    const indicators: Set<string> = new Set();

    for (const result of group) {
      if (result.data?.sourceIp) {
        indicators.add(`ip:${result.data.sourceIp}`);
      }
      if (result.data?.process) {
        indicators.add(`process:${result.data.process}`);
      }
      if (result.data?.command) {
        indicators.add(`command:${result.data.command}`);
      }
    }

    return Array.from(indicators);
  }

  private extractAffectedAssets(group: any[]): string[] {
    const assets: Set<string> = new Set();

    for (const result of group) {
      if (result.data?.hostname) {
        assets.add(result.data.hostname);
      }
      if (result.data?.sourceIp) {
        assets.add(result.data.sourceIp);
      }
    }

    return Array.from(assets);
  }

  private generateFindingRecommendations(techniques: string[], severity: string): string[] {
    const recommendations: string[] = [
      'Investigate the identified indicators across the environment',
      'Review related security events in the same timeframe'
    ];

    if (severity === 'CRITICAL' || severity === 'HIGH') {
      recommendations.push('Consider immediate containment of affected assets');
      recommendations.push('Escalate to incident response team');
    }

    if (techniques.includes('T1003')) {
      recommendations.push('Force password resets for potentially compromised accounts');
    }

    if (techniques.includes('T1055')) {
      recommendations.push('Analyze process injection artifacts and memory dumps');
    }

    if (techniques.includes('T1071')) {
      recommendations.push('Monitor network traffic for command and control communications');
    }

    return recommendations;
  }

  private async enhanceFindingWithIntel(finding: HuntFinding, threatIntel: any[]): Promise<HuntFinding> {
    // Enhance finding with additional context from threat intelligence
    const enhancedFinding = { ...finding };

    const additionalContext = threatIntel.map(intel => 
      `Related threat intelligence: ${intel.metadata.title} (${intel.metadata.source})`
    );

    enhancedFinding.description += `\n\nThreat Intelligence Context:\n${additionalContext.join('\n')}`;
    
    // Increase confidence if correlated with high-confidence threat intel
    const avgIntelConfidence = threatIntel.reduce((sum, intel) => sum + intel.metadata.confidence, 0) / threatIntel.length;
    enhancedFinding.confidence = Math.min(enhancedFinding.confidence + (avgIntelConfidence * 0.2), 1.0);

    return enhancedFinding;
  }

  private generateTechniqueRecommendations(techniques: string[]): string[] {
    const recommendations: string[] = [];

    const techniqueRecommendations: Record<string, string[]> = {
      'T1055': ['Monitor for process injection', 'Analyze memory artifacts'],
      'T1059': ['Monitor command-line execution', 'Review script execution logs'],
      'T1003': ['Monitor credential access', 'Review authentication logs'],
      'T1071': ['Monitor network communications', 'Analyze C2 traffic patterns'],
      'T1078': ['Review account usage patterns', 'Monitor privileged account access']
    };

    for (const technique of techniques) {
      const recs = techniqueRecommendations[technique];
      if (recs) {
        recommendations.push(...recs);
      }
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }

  private extractEmergingThreats(threatIntel: any[]): string[] {
    const threats: Set<string> = new Set();

    for (const intel of threatIntel) {
      // Extract threat names from titles and tags
      if (intel.metadata.title.toLowerCase().includes('apt')) {
        threats.add(intel.metadata.title);
      }

      for (const tag of intel.metadata.tags) {
        if (tag.includes('apt') || tag.includes('campaign') || tag.includes('group')) {
          threats.add(tag);
        }
      }
    }

    return Array.from(threats).slice(0, 10); // Top 10 emerging threats
  }

  private async analyzeCoverageGaps(): Promise<string[]> {
    // Analyze what MITRE techniques are not being hunted for
    const allTechniques = [
      'T1055', 'T1059', 'T1003', 'T1071', 'T1078', 'T1105', 'T1112',
      'T1027', 'T1036', 'T1053', 'T1082', 'T1083', 'T1087', 'T1135'
    ];

    // Get existing hunt queries
    const existingQueries = await this.getAllHuntQueries();
    const coveredTechniques = new Set<string>();

    for (const query of existingQueries) {
      query.mitreTechniques.forEach(t => coveredTechniques.add(t));
    }

    const gaps = allTechniques.filter(t => !coveredTechniques.has(t));
    
    return gaps.map(technique => `MITRE ATT&CK ${technique} not covered by current hunt queries`);
  }

  // DynamoDB operations

  private async storeHuntQuery(query: HuntQuery): Promise<void> {
    const item = marshall(query);
    
    const command = new PutItemCommand({
      TableName: this.huntQueriesTable,
      Item: item
    });

    await this.dynamoClient.send(command);
  }

  private async getHuntQuery(queryId: string): Promise<HuntQuery | null> {
    const command = new QueryCommand({
      TableName: this.huntQueriesTable,
      KeyConditionExpression: 'id = :id',
      ExpressionAttributeValues: marshall({ ':id': queryId })
    });

    const response = await this.dynamoClient.send(command);
    
    if (response.Items && response.Items.length > 0) {
      return unmarshall(response.Items[0]) as HuntQuery;
    }

    return null;
  }

  private async updateQueryHistory(queryId: string, execution: HuntExecution): Promise<void> {
    // This would update the execution history in DynamoDB
    // Simplified implementation
    console.log(`Updated execution history for query ${queryId}`);
  }

  private async getAllHuntQueries(): Promise<HuntQuery[]> {
    // This would scan the DynamoDB table for all queries
    // Simplified implementation returns empty array
    return [];
  }
}