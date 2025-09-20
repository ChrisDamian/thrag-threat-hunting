import { Handler } from 'aws-lambda';
import { DynamoDBClient, PutItemCommand, QueryCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { KinesisClient, PutRecordCommand } from '@aws-sdk/client-kinesis';
import { BedrockAgentRuntimeClient, InvokeAgentCommand } from '@aws-sdk/client-bedrock-agent-runtime';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

export interface SecurityEvent {
  eventId: string;
  timestamp: number;
  source: string;
  eventType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  rawData: Record<string, any>;
  normalizedData: {
    sourceIp?: string;
    destinationIp?: string;
    userId?: string;
    action: string;
    resource: string;
    userAgent?: string;
    protocol?: string;
    port?: number;
  };
  correlationId?: string;
  threatScore?: number;
  mitreTechniques?: string[];
  indicators?: string[];
  enrichmentData?: Record<string, any>;
}

export interface ThreatCorrelation {
  correlationId: string;
  events: SecurityEvent[];
  threatScore: number;
  mitreTechniques: string[];
  threatActors: string[];
  confidence: number;
  timeline: {
    start: Date;
    end: Date;
    duration: number;
  };
  killChainPhases: string[];
  recommendations: string[];
}

export interface ProcessingResult {
  eventId: string;
  processed: boolean;
  threatScore: number;
  correlations: string[];
  enrichments: Record<string, any>;
  alerts: Alert[];
}

export interface Alert {
  id: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  mitreTechniques: string[];
  indicators: string[];
  recommendations: string[];
  confidence: number;
}

export class SecurityEventProcessor {
  private dynamoClient: DynamoDBClient;
  private kinesisClient: KinesisClient;
  private bedrockClient: BedrockAgentRuntimeClient;
  private eventsTable: string;
  private correlationsTable: string;
  private threatHunterAgentId: string;

  constructor(
    eventsTable: string,
    correlationsTable: string,
    threatHunterAgentId: string
  ) {
    this.dynamoClient = new DynamoDBClient({});
    this.kinesisClient = new KinesisClient({});
    this.bedrockClient = new BedrockAgentRuntimeClient({});
    this.eventsTable = eventsTable;
    this.correlationsTable = correlationsTable;
    this.threatHunterAgentId = threatHunterAgentId;
  }

  /**
   * Process incoming security event
   */
  async processSecurityEvent(event: SecurityEvent): Promise<ProcessingResult> {
    try {
      console.log(`Processing security event: ${event.eventId}`);

      // 1. Normalize and enrich event data
      const enrichedEvent = await this.enrichEvent(event);

      // 2. Calculate threat score
      const threatScore = await this.calculateThreatScore(enrichedEvent);
      enrichedEvent.threatScore = threatScore;

      // 3. Store event in DynamoDB
      await this.storeEvent(enrichedEvent);

      // 4. Correlate with existing events
      const correlations = await this.correlateEvents(enrichedEvent);

      // 5. Generate alerts if necessary
      const alerts = await this.generateAlerts(enrichedEvent, correlations);

      // 6. Send to real-time stream for agent processing
      await this.sendToStream(enrichedEvent, correlations, alerts);

      return {
        eventId: event.eventId,
        processed: true,
        threatScore,
        correlations: correlations.map(c => c.correlationId),
        enrichments: enrichedEvent.enrichmentData || {},
        alerts
      };

    } catch (error) {
      console.error(`Error processing event ${event.eventId}:`, error);
      throw new Error(`Event processing failed: ${error.message}`);
    }
  }

  /**
   * Enrich event with threat intelligence
   */
  private async enrichEvent(event: SecurityEvent): Promise<SecurityEvent> {
    const enrichedEvent = { ...event };
    const enrichmentData: Record<string, any> = {};

    try {
      // Enrich IP addresses
      if (event.normalizedData.sourceIp) {
        const ipIntel = await this.getIpIntelligence(event.normalizedData.sourceIp);
        enrichmentData.sourceIpIntel = ipIntel;
      }

      if (event.normalizedData.destinationIp) {
        const ipIntel = await this.getIpIntelligence(event.normalizedData.destinationIp);
        enrichmentData.destinationIpIntel = ipIntel;
      }

      // Enrich with user behavior analysis
      if (event.normalizedData.userId) {
        const userProfile = await this.getUserProfile(event.normalizedData.userId);
        enrichmentData.userProfile = userProfile;
      }

      // Extract indicators of compromise
      const indicators = this.extractIndicators(event);
      enrichedEvent.indicators = indicators;

      // Map to MITRE ATT&CK techniques
      const mitreTechniques = await this.mapToMitreTechniques(event);
      enrichedEvent.mitreTechniques = mitreTechniques;

      enrichedEvent.enrichmentData = enrichmentData;

    } catch (error) {
      console.error(`Error enriching event ${event.eventId}:`, error);
      // Continue processing even if enrichment fails
    }

    return enrichedEvent;
  }

  /**
   * Calculate threat score using ML and rules
   */
  private async calculateThreatScore(event: SecurityEvent): Promise<number> {
    let score = 0;

    // Base score from severity
    const severityScores = {
      'LOW': 0.2,
      'MEDIUM': 0.4,
      'HIGH': 0.7,
      'CRITICAL': 0.9
    };
    score += severityScores[event.severity] || 0.2;

    // Adjust based on source reputation
    if (event.enrichmentData?.sourceIpIntel?.reputation === 'malicious') {
      score += 0.3;
    } else if (event.enrichmentData?.sourceIpIntel?.reputation === 'suspicious') {
      score += 0.1;
    }

    // Adjust based on MITRE techniques
    if (event.mitreTechniques && event.mitreTechniques.length > 0) {
      score += Math.min(event.mitreTechniques.length * 0.1, 0.3);
    }

    // Adjust based on indicators
    if (event.indicators && event.indicators.length > 0) {
      score += Math.min(event.indicators.length * 0.05, 0.2);
    }

    // Adjust based on user behavior
    if (event.enrichmentData?.userProfile?.riskScore) {
      score += event.enrichmentData.userProfile.riskScore * 0.2;
    }

    // Time-based adjustments (off-hours activity)
    const eventTime = new Date(event.timestamp);
    const hour = eventTime.getHours();
    if (hour < 6 || hour > 22) { // Off-hours
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Store event in DynamoDB
   */
  private async storeEvent(event: SecurityEvent): Promise<void> {
    const item = {
      eventId: event.eventId,
      timestamp: event.timestamp,
      source: event.source,
      eventType: event.eventType,
      severity: event.severity,
      rawData: event.rawData,
      normalizedData: event.normalizedData,
      correlationId: event.correlationId,
      threatScore: event.threatScore,
      mitreTechniques: event.mitreTechniques,
      indicators: event.indicators,
      enrichmentData: event.enrichmentData,
      ttl: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days TTL
    };

    const command = new PutItemCommand({
      TableName: this.eventsTable,
      Item: marshall(item)
    });

    await this.dynamoClient.send(command);
  }

  /**
   * Correlate events to identify attack patterns
   */
  private async correlatEvents(event: SecurityEvent): Promise<ThreatCorrelation[]> {
    const correlations: ThreatCorrelation[] = [];

    try {
      // Time-based correlation (events within 1 hour)
      const timeWindow = 60 * 60 * 1000; // 1 hour
      const startTime = event.timestamp - timeWindow;
      const endTime = event.timestamp + timeWindow;

      // Query for related events
      const relatedEvents = await this.getRelatedEvents(event, startTime, endTime);

      if (relatedEvents.length > 0) {
        // Group events by correlation criteria
        const correlationGroups = this.groupEventsByCorrelation(relatedEvents, event);

        for (const group of correlationGroups) {
          const correlation = await this.createThreatCorrelation(group);
          correlations.push(correlation);
        }
      }

    } catch (error) {
      console.error(`Error correlating events for ${event.eventId}:`, error);
    }

    return correlations;
  }

  /**
   * Generate alerts based on event and correlations
   */
  private async generateAlerts(
    event: SecurityEvent,
    correlations: ThreatCorrelation[]
  ): Promise<Alert[]> {
    const alerts: Alert[] = [];

    // High threat score alert
    if (event.threatScore && event.threatScore > 0.8) {
      alerts.push({
        id: `alert-${event.eventId}-high-threat`,
        severity: 'HIGH',
        title: 'High Threat Score Detected',
        description: `Security event ${event.eventId} has a high threat score of ${event.threatScore}`,
        mitreTechniques: event.mitreTechniques || [],
        indicators: event.indicators || [],
        recommendations: [
          'Investigate the source of this activity',
          'Check for related events in the same time window',
          'Consider blocking suspicious IP addresses'
        ],
        confidence: event.threatScore
      });
    }

    // MITRE technique alerts
    if (event.mitreTechniques && event.mitreTechniques.length > 0) {
      const criticalTechniques = ['T1055', 'T1059', 'T1003', 'T1078']; // Process injection, command execution, credential dumping, valid accounts
      
      const detectedCritical = event.mitreTechniques.filter(t => criticalTechniques.includes(t));
      
      if (detectedCritical.length > 0) {
        alerts.push({
          id: `alert-${event.eventId}-mitre-critical`,
          severity: 'CRITICAL',
          title: 'Critical MITRE Technique Detected',
          description: `Critical attack techniques detected: ${detectedCritical.join(', ')}`,
          mitreTechniques: detectedCritical,
          indicators: event.indicators || [],
          recommendations: [
            'Immediate investigation required',
            'Isolate affected systems',
            'Check for lateral movement',
            'Review authentication logs'
          ],
          confidence: 0.9
        });
      }
    }

    // Correlation-based alerts
    for (const correlation of correlations) {
      if (correlation.confidence > 0.7) {
        alerts.push({
          id: `alert-${correlation.correlationId}-campaign`,
          severity: correlation.threatScore > 0.8 ? 'CRITICAL' : 'HIGH',
          title: 'Potential Attack Campaign Detected',
          description: `Correlated events suggest ongoing attack campaign involving ${correlation.events.length} events`,
          mitreTechniques: correlation.mitreTechniques,
          indicators: correlation.events.flatMap(e => e.indicators || []),
          recommendations: [
            'Investigate all correlated events',
            'Check for additional indicators across the environment',
            'Consider threat hunting based on identified TTPs',
            'Review security controls for identified attack vectors'
          ],
          confidence: correlation.confidence
        });
      }
    }

    return alerts;
  }

  /**
   * Send processed data to Kinesis stream for real-time agent processing
   */
  private async sendToStream(
    event: SecurityEvent,
    correlations: ThreatCorrelation[],
    alerts: Alert[]
  ): Promise<void> {
    const streamName = process.env.SECURITY_EVENTS_STREAM;
    if (!streamName) return;

    const record = {
      eventType: 'security-event-processed',
      timestamp: new Date().toISOString(),
      data: {
        event,
        correlations,
        alerts,
        processingMetadata: {
          processedAt: new Date().toISOString(),
          threatScore: event.threatScore,
          correlationCount: correlations.length,
          alertCount: alerts.length
        }
      }
    };

    const command = new PutRecordCommand({
      StreamName: streamName,
      Data: Buffer.from(JSON.stringify(record)),
      PartitionKey: event.eventId
    });

    await this.kinesisClient.send(command);
  }

  // Helper methods

  private async getIpIntelligence(ip: string): Promise<any> {
    // Mock implementation - would integrate with threat intelligence feeds
    const mockIntel = {
      ip,
      reputation: Math.random() > 0.9 ? 'malicious' : Math.random() > 0.7 ? 'suspicious' : 'clean',
      country: 'US',
      asn: 'AS12345',
      threatTypes: Math.random() > 0.8 ? ['botnet', 'malware'] : []
    };

    return mockIntel;
  }

  private async getUserProfile(userId: string): Promise<any> {
    // Mock implementation - would query user behavior analytics
    return {
      userId,
      riskScore: Math.random() * 0.5, // 0-0.5 range for normal users
      lastActivity: new Date(),
      normalHours: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
      normalLocations: ['office', 'home']
    };
  }

  private extractIndicators(event: SecurityEvent): string[] {
    const indicators: string[] = [];

    // Extract IP addresses
    if (event.normalizedData.sourceIp) {
      indicators.push(`ip:${event.normalizedData.sourceIp}`);
    }
    if (event.normalizedData.destinationIp) {
      indicators.push(`ip:${event.normalizedData.destinationIp}`);
    }

    // Extract domains from URLs
    const urlRegex = /https?:\/\/([^\/\s]+)/g;
    const content = JSON.stringify(event.rawData);
    let match;
    while ((match = urlRegex.exec(content)) !== null) {
      indicators.push(`domain:${match[1]}`);
    }

    // Extract file hashes
    const hashRegex = /\b[a-fA-F0-9]{32,64}\b/g;
    while ((match = hashRegex.exec(content)) !== null) {
      indicators.push(`hash:${match[0]}`);
    }

    return [...new Set(indicators)]; // Remove duplicates
  }

  private async mapToMitreTechniques(event: SecurityEvent): Promise<string[]> {
    const techniques: string[] = [];

    // Simple rule-based mapping - would be enhanced with ML
    const eventType = event.eventType.toLowerCase();
    const action = event.normalizedData.action.toLowerCase();

    if (eventType.includes('process') && action.includes('create')) {
      techniques.push('T1059'); // Command and Scripting Interpreter
    }

    if (eventType.includes('network') && action.includes('connect')) {
      techniques.push('T1071'); // Application Layer Protocol
    }

    if (eventType.includes('file') && action.includes('create')) {
      techniques.push('T1105'); // Ingress Tool Transfer
    }

    if (eventType.includes('registry') && action.includes('modify')) {
      techniques.push('T1112'); // Modify Registry
    }

    if (eventType.includes('login') || action.includes('authenticate')) {
      techniques.push('T1078'); // Valid Accounts
    }

    return techniques;
  }

  private async getRelatedEvents(
    event: SecurityEvent,
    startTime: number,
    endTime: number
  ): Promise<SecurityEvent[]> {
    // Query DynamoDB for events in time window
    // This is a simplified implementation
    return [];
  }

  private groupEventsByCorrelation(
    events: SecurityEvent[],
    currentEvent: SecurityEvent
  ): SecurityEvent[][] {
    // Group events by correlation criteria (IP, user, etc.)
    const groups: SecurityEvent[][] = [];
    
    // Simple grouping by source IP
    const ipGroups = new Map<string, SecurityEvent[]>();
    
    for (const event of [...events, currentEvent]) {
      const sourceIp = event.normalizedData.sourceIp;
      if (sourceIp) {
        if (!ipGroups.has(sourceIp)) {
          ipGroups.set(sourceIp, []);
        }
        ipGroups.get(sourceIp)!.push(event);
      }
    }

    // Only include groups with multiple events
    for (const group of ipGroups.values()) {
      if (group.length > 1) {
        groups.push(group);
      }
    }

    return groups;
  }

  private async createThreatCorrelation(events: SecurityEvent[]): Promise<ThreatCorrelation> {
    const correlationId = `corr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Calculate aggregate threat score
    const threatScore = events.reduce((sum, event) => sum + (event.threatScore || 0), 0) / events.length;
    
    // Collect all MITRE techniques
    const mitreTechniques = [...new Set(events.flatMap(e => e.mitreTechniques || []))];
    
    // Calculate timeline
    const timestamps = events.map(e => e.timestamp);
    const start = new Date(Math.min(...timestamps));
    const end = new Date(Math.max(...timestamps));
    
    return {
      correlationId,
      events,
      threatScore,
      mitreTechniques,
      threatActors: [], // Would be populated by threat intelligence
      confidence: Math.min(threatScore + (mitreTechniques.length * 0.1), 1.0),
      timeline: {
        start,
        end,
        duration: end.getTime() - start.getTime()
      },
      killChainPhases: this.mapToKillChain(mitreTechniques),
      recommendations: this.generateRecommendations(mitreTechniques, threatScore)
    };
  }

  private mapToKillChain(techniques: string[]): string[] {
    // Map MITRE techniques to kill chain phases
    const killChainMap: Record<string, string> = {
      'T1078': 'initial-access',
      'T1059': 'execution',
      'T1055': 'defense-evasion',
      'T1003': 'credential-access',
      'T1071': 'command-and-control',
      'T1105': 'lateral-movement'
    };

    return [...new Set(techniques.map(t => killChainMap[t]).filter(Boolean))];
  }

  private generateRecommendations(techniques: string[], threatScore: number): string[] {
    const recommendations: string[] = [
      'Investigate all related events in the correlation',
      'Check for additional indicators across the environment'
    ];

    if (threatScore > 0.8) {
      recommendations.push('Consider immediate containment actions');
      recommendations.push('Escalate to incident response team');
    }

    if (techniques.includes('T1003')) {
      recommendations.push('Force password resets for potentially compromised accounts');
      recommendations.push('Review privileged account access');
    }

    if (techniques.includes('T1071')) {
      recommendations.push('Monitor network traffic for C2 communications');
      recommendations.push('Consider blocking suspicious domains/IPs');
    }

    return recommendations;
  }
}

// Lambda handler for processing security events
export const handler: Handler = async (event, context) => {
  const processor = new SecurityEventProcessor(
    process.env.SECURITY_EVENTS_TABLE!,
    process.env.CORRELATIONS_TABLE!,
    process.env.THREAT_HUNTER_AGENT_ID!
  );

  const results = [];

  for (const record of event.Records) {
    try {
      let securityEvent: SecurityEvent;

      if (record.eventSource === 'aws:kinesis') {
        // Process Kinesis record
        const data = Buffer.from(record.kinesis.data, 'base64').toString();
        securityEvent = JSON.parse(data);
      } else {
        // Direct invocation
        securityEvent = record;
      }

      const result = await processor.processSecurityEvent(securityEvent);
      results.push(result);

    } catch (error) {
      console.error('Error processing record:', error);
      results.push({
        eventId: record.eventId || 'unknown',
        processed: false,
        error: error.message
      });
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Security events processed',
      results
    })
  };
};