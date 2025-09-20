import { SageMakerRuntimeClient, InvokeEndpointCommand } from '@aws-sdk/client-sagemaker-runtime';
import { DynamoDBClient, QueryCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { KnowledgeManager } from '../rag-system/knowledge-manager';

export interface ThreatScoringInput {
  eventId: string;
  eventType: string;
  source: string;
  severity: string;
  indicators: string[];
  mitreTechniques: string[];
  userContext?: {
    userId: string;
    normalBehavior: UserBehaviorProfile;
    currentBehavior: UserBehaviorProfile;
  };
  networkContext?: {
    sourceIp: string;
    destinationIp: string;
    protocol: string;
    port: number;
    geolocation?: string;
  };
  temporalContext?: {
    timestamp: Date;
    timeOfDay: number; // 0-23
    dayOfWeek: number; // 0-6
    isBusinessHours: boolean;
    isWeekend: boolean;
  };
}

export interface UserBehaviorProfile {
  loginTimes: number[]; // Hours of typical login
  accessPatterns: string[]; // Typical resources accessed
  locationPatterns: string[]; // Typical locations
  devicePatterns: string[]; // Typical devices
  riskScore: number; // 0-1 baseline risk
}

export interface ThreatScore {
  eventId: string;
  overallScore: number; // 0-1
  confidence: number; // 0-1
  components: {
    baselineScore: number;
    behavioralAnomalyScore: number;
    threatIntelligenceScore: number;
    temporalAnomalyScore: number;
    networkAnomalyScore: number;
  };
  riskFactors: RiskFactor[];
  mitigatingFactors: string[];
  recommendations: string[];
  explanation: string;
}

export interface RiskFactor {
  type: 'BEHAVIORAL' | 'TEMPORAL' | 'NETWORK' | 'THREAT_INTEL' | 'TECHNICAL';
  description: string;
  impact: number; // 0-1
  confidence: number; // 0-1
  evidence: string[];
}

export interface AnomalyDetectionResult {
  isAnomaly: boolean;
  anomalyScore: number;
  anomalyType: string;
  explanation: string;
  confidence: number;
}

export class ThreatScoringEngine {
  private sagemakerClient: SageMakerRuntimeClient;
  private dynamoClient: DynamoDBClient;
  private knowledgeManager: KnowledgeManager;
  
  private anomalyEndpoint: string;
  private behaviorEndpoint: string;
  private userProfilesTable: string;

  constructor(
    anomalyEndpoint: string,
    behaviorEndpoint: string,
    userProfilesTable: string,
    knowledgeBaseId: string,
    vectorStoreEndpoint: string
  ) {
    this.sagemakerClient = new SageMakerRuntimeClient({});
    this.dynamoClient = new DynamoDBClient({});
    this.knowledgeManager = new KnowledgeManager(knowledgeBaseId, vectorStoreEndpoint);
    
    this.anomalyEndpoint = anomalyEndpoint;
    this.behaviorEndpoint = behaviorEndpoint;
    this.userProfilesTable = userProfilesTable;
  }

  /**
   * Calculate comprehensive threat score for a security event
   */
  async calculateThreatScore(input: ThreatScoringInput): Promise<ThreatScore> {
    try {
      console.log(`Calculating threat score for event: ${input.eventId}`);

      // 1. Calculate baseline score from event properties
      const baselineScore = this.calculateBaselineScore(input);

      // 2. Detect behavioral anomalies
      const behavioralAnomalyScore = await this.detectBehavioralAnomalies(input);

      // 3. Analyze threat intelligence correlation
      const threatIntelligenceScore = await this.analyzeThreatIntelligence(input);

      // 4. Detect temporal anomalies
      const temporalAnomalyScore = this.detectTemporalAnomalies(input);

      // 5. Analyze network anomalies
      const networkAnomalyScore = await this.analyzeNetworkAnomalies(input);

      // 6. Combine scores with weighted approach
      const overallScore = this.combineScores({
        baselineScore,
        behavioralAnomalyScore,
        threatIntelligenceScore,
        temporalAnomalyScore,
        networkAnomalyScore
      });

      // 7. Calculate confidence based on available data
      const confidence = this.calculateConfidence(input);

      // 8. Identify risk factors and mitigating factors
      const riskFactors = await this.identifyRiskFactors(input, {
        baselineScore,
        behavioralAnomalyScore,
        threatIntelligenceScore,
        temporalAnomalyScore,
        networkAnomalyScore
      });

      const mitigatingFactors = this.identifyMitigatingFactors(input);

      // 9. Generate recommendations
      const recommendations = this.generateRecommendations(overallScore, riskFactors);

      // 10. Generate explanation
      const explanation = this.generateExplanation(input, overallScore, riskFactors);

      const threatScore: ThreatScore = {
        eventId: input.eventId,
        overallScore,
        confidence,
        components: {
          baselineScore,
          behavioralAnomalyScore,
          threatIntelligenceScore,
          temporalAnomalyScore,
          networkAnomalyScore
        },
        riskFactors,
        mitigatingFactors,
        recommendations,
        explanation
      };

      console.log(`Threat score calculated: ${overallScore.toFixed(3)} (confidence: ${confidence.toFixed(3)})`);
      return threatScore;

    } catch (error) {
      console.error(`Error calculating threat score for ${input.eventId}:`, error);
      throw new Error(`Threat scoring failed: ${error.message}`);
    }
  }

  /**
   * Detect behavioral anomalies using ML models
   */
  async detectBehavioralAnomalies(input: ThreatScoringInput): Promise<number> {
    if (!input.userContext) {
      return 0; // No user context available
    }

    try {
      // Prepare features for ML model
      const features = this.prepareBehavioralFeatures(input.userContext);

      // Invoke SageMaker endpoint for behavioral analysis
      const result = await this.invokeSageMakerEndpoint(this.behaviorEndpoint, features);

      return Math.min(result.anomalyScore || 0, 1.0);

    } catch (error) {
      console.error('Error detecting behavioral anomalies:', error);
      return 0; // Default to no anomaly if detection fails
    }
  }

  /**
   * Analyze threat intelligence correlation
   */
  async analyzeThreatIntelligence(input: ThreatScoringInput): Promise<number> {
    try {
      let score = 0;

      // Check indicators against threat intelligence
      if (input.indicators && input.indicators.length > 0) {
        for (const indicator of input.indicators) {
          const threatIntel = await this.knowledgeManager.retrieveDocuments({
            query: indicator,
            filters: {
              confidence_min: 0.7,
              tags: ['ioc', 'indicator', 'malicious']
            },
            maxResults: 3
          });

          if (threatIntel.length > 0) {
            // Calculate score based on threat intelligence confidence
            const avgConfidence = threatIntel.reduce((sum, intel) => sum + intel.metadata.confidence, 0) / threatIntel.length;
            score = Math.max(score, avgConfidence);
          }
        }
      }

      // Check MITRE techniques against recent campaigns
      if (input.mitreTechniques && input.mitreTechniques.length > 0) {
        const techniqueQuery = input.mitreTechniques.join(' ');
        const campaignIntel = await this.knowledgeManager.retrieveDocuments({
          query: `${techniqueQuery} campaign attack recent`,
          filters: {
            confidence_min: 0.6,
            date_range: {
              start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
              end: new Date()
            }
          },
          maxResults: 5
        });

        if (campaignIntel.length > 0) {
          score = Math.max(score, 0.7); // High score for recent campaign techniques
        }
      }

      return Math.min(score, 1.0);

    } catch (error) {
      console.error('Error analyzing threat intelligence:', error);
      return 0;
    }
  }

  /**
   * Detect temporal anomalies
   */
  detectTemporalAnomalies(input: ThreatScoringInput): number {
    if (!input.temporalContext) {
      return 0;
    }

    let score = 0;
    const temporal = input.temporalContext;

    // Off-hours activity
    if (!temporal.isBusinessHours) {
      score += 0.3;
    }

    // Weekend activity
    if (temporal.isWeekend) {
      score += 0.2;
    }

    // Very late night or very early morning (2 AM - 5 AM)
    if (temporal.timeOfDay >= 2 && temporal.timeOfDay <= 5) {
      score += 0.4;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Analyze network anomalies
   */
  async analyzeNetworkAnomalies(input: ThreatScoringInput): Promise<number> {
    if (!input.networkContext) {
      return 0;
    }

    try {
      let score = 0;
      const network = input.networkContext;

      // Check for suspicious IP addresses
      if (network.sourceIp) {
        const ipIntel = await this.checkIpReputation(network.sourceIp);
        if (ipIntel.isMalicious) {
          score += 0.8;
        } else if (ipIntel.isSuspicious) {
          score += 0.4;
        }
      }

      // Check for unusual ports
      if (network.port) {
        const unusualPorts = [4444, 5555, 6666, 7777, 8888, 9999]; // Common backdoor ports
        if (unusualPorts.includes(network.port)) {
          score += 0.3;
        }
      }

      // Check for suspicious protocols
      if (network.protocol) {
        const suspiciousProtocols = ['irc', 'p2p', 'tor'];
        if (suspiciousProtocols.includes(network.protocol.toLowerCase())) {
          score += 0.5;
        }
      }

      // Geographic anomalies
      if (network.geolocation) {
        const suspiciousCountries = ['CN', 'RU', 'KP', 'IR']; // Example high-risk countries
        if (suspiciousCountries.includes(network.geolocation)) {
          score += 0.3;
        }
      }

      return Math.min(score, 1.0);

    } catch (error) {
      console.error('Error analyzing network anomalies:', error);
      return 0;
    }
  }

  /**
   * Calculate baseline score from event properties
   */
  private calculateBaselineScore(input: ThreatScoringInput): number {
    let score = 0;

    // Severity-based scoring
    const severityScores = {
      'CRITICAL': 0.9,
      'HIGH': 0.7,
      'MEDIUM': 0.4,
      'LOW': 0.2
    };
    score += severityScores[input.severity.toUpperCase()] || 0.2;

    // Event type scoring
    const highRiskEventTypes = [
      'process_creation',
      'network_connection',
      'file_modification',
      'registry_modification',
      'authentication_failure'
    ];

    if (highRiskEventTypes.some(type => input.eventType.toLowerCase().includes(type))) {
      score += 0.2;
    }

    // MITRE technique scoring
    if (input.mitreTechniques && input.mitreTechniques.length > 0) {
      const criticalTechniques = ['T1055', 'T1059', 'T1003', 'T1078'];
      const hasCritical = input.mitreTechniques.some(t => criticalTechniques.includes(t));
      
      if (hasCritical) {
        score += 0.3;
      } else {
        score += Math.min(input.mitreTechniques.length * 0.1, 0.2);
      }
    }

    return Math.min(score, 1.0);
  }

  /**
   * Combine individual scores with weighted approach
   */
  private combineScores(scores: {
    baselineScore: number;
    behavioralAnomalyScore: number;
    threatIntelligenceScore: number;
    temporalAnomalyScore: number;
    networkAnomalyScore: number;
  }): number {
    // Weighted combination of scores
    const weights = {
      baseline: 0.3,
      behavioral: 0.25,
      threatIntel: 0.25,
      temporal: 0.1,
      network: 0.1
    };

    const weightedScore = 
      scores.baselineScore * weights.baseline +
      scores.behavioralAnomalyScore * weights.behavioral +
      scores.threatIntelligenceScore * weights.threatIntel +
      scores.temporalAnomalyScore * weights.temporal +
      scores.networkAnomalyScore * weights.network;

    return Math.min(weightedScore, 1.0);
  }

  /**
   * Calculate confidence based on available data quality
   */
  private calculateConfidence(input: ThreatScoringInput): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence based on available context
    if (input.userContext) confidence += 0.2;
    if (input.networkContext) confidence += 0.15;
    if (input.temporalContext) confidence += 0.1;
    if (input.indicators && input.indicators.length > 0) confidence += 0.1;
    if (input.mitreTechniques && input.mitreTechniques.length > 0) confidence += 0.05;

    return Math.min(confidence, 1.0);
  }

  /**
   * Identify risk factors contributing to the threat score
   */
  private async identifyRiskFactors(
    input: ThreatScoringInput,
    scores: any
  ): Promise<RiskFactor[]> {
    const riskFactors: RiskFactor[] = [];

    // Behavioral risk factors
    if (scores.behavioralAnomalyScore > 0.5) {
      riskFactors.push({
        type: 'BEHAVIORAL',
        description: 'User behavior deviates significantly from established patterns',
        impact: scores.behavioralAnomalyScore,
        confidence: 0.8,
        evidence: [
          'Unusual login times',
          'Atypical resource access patterns',
          'Abnormal location or device usage'
        ]
      });
    }

    // Threat intelligence risk factors
    if (scores.threatIntelligenceScore > 0.6) {
      riskFactors.push({
        type: 'THREAT_INTEL',
        description: 'Event correlates with known threat intelligence',
        impact: scores.threatIntelligenceScore,
        confidence: 0.9,
        evidence: [
          'Indicators match known malicious signatures',
          'Techniques associated with recent campaigns',
          'High-confidence threat intelligence correlation'
        ]
      });
    }

    // Temporal risk factors
    if (scores.temporalAnomalyScore > 0.3) {
      riskFactors.push({
        type: 'TEMPORAL',
        description: 'Activity occurred during unusual time periods',
        impact: scores.temporalAnomalyScore,
        confidence: 0.7,
        evidence: [
          input.temporalContext?.isWeekend ? 'Weekend activity' : '',
          !input.temporalContext?.isBusinessHours ? 'Off-hours activity' : '',
          'Unusual time-of-day pattern'
        ].filter(Boolean)
      });
    }

    // Network risk factors
    if (scores.networkAnomalyScore > 0.4) {
      riskFactors.push({
        type: 'NETWORK',
        description: 'Network activity shows suspicious characteristics',
        impact: scores.networkAnomalyScore,
        confidence: 0.8,
        evidence: [
          'Suspicious IP addresses involved',
          'Unusual ports or protocols',
          'Geographic anomalies detected'
        ]
      });
    }

    // Technical risk factors
    if (input.mitreTechniques && input.mitreTechniques.length > 2) {
      riskFactors.push({
        type: 'TECHNICAL',
        description: 'Multiple attack techniques detected',
        impact: Math.min(input.mitreTechniques.length * 0.2, 1.0),
        confidence: 0.9,
        evidence: input.mitreTechniques.map(t => `MITRE ATT&CK technique: ${t}`)
      });
    }

    return riskFactors;
  }

  /**
   * Identify factors that mitigate the threat score
   */
  private identifyMitigatingFactors(input: ThreatScoringInput): string[] {
    const mitigatingFactors: string[] = [];

    // Business hours activity
    if (input.temporalContext?.isBusinessHours) {
      mitigatingFactors.push('Activity occurred during normal business hours');
    }

    // Known good source
    if (input.source && ['internal_system', 'trusted_application'].includes(input.source)) {
      mitigatingFactors.push('Event originated from trusted internal source');
    }

    // Low severity
    if (input.severity === 'LOW') {
      mitigatingFactors.push('Event classified as low severity');
    }

    // Established user pattern
    if (input.userContext && input.userContext.normalBehavior.riskScore < 0.3) {
      mitigatingFactors.push('User has established low-risk behavior pattern');
    }

    return mitigatingFactors;
  }

  /**
   * Generate recommendations based on threat score and risk factors
   */
  private generateRecommendations(score: number, riskFactors: RiskFactor[]): string[] {
    const recommendations: string[] = [];

    if (score >= 0.8) {
      recommendations.push('Immediate investigation required - high threat score detected');
      recommendations.push('Consider isolating affected systems');
      recommendations.push('Escalate to incident response team');
    } else if (score >= 0.6) {
      recommendations.push('Prioritize investigation of this event');
      recommendations.push('Monitor for related activities');
      recommendations.push('Review security controls for affected assets');
    } else if (score >= 0.4) {
      recommendations.push('Include in routine security monitoring');
      recommendations.push('Correlate with other security events');
    } else {
      recommendations.push('Log for historical analysis');
      recommendations.push('Monitor for pattern development');
    }

    // Add specific recommendations based on risk factors
    for (const factor of riskFactors) {
      switch (factor.type) {
        case 'BEHAVIORAL':
          recommendations.push('Review user access patterns and permissions');
          break;
        case 'THREAT_INTEL':
          recommendations.push('Cross-reference with additional threat intelligence sources');
          break;
        case 'NETWORK':
          recommendations.push('Analyze network traffic for additional indicators');
          break;
        case 'TECHNICAL':
          recommendations.push('Execute targeted threat hunting queries');
          break;
      }
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Generate human-readable explanation of the threat score
   */
  private generateExplanation(
    input: ThreatScoringInput,
    score: number,
    riskFactors: RiskFactor[]
  ): string {
    const parts = [
      `Event ${input.eventId} received a threat score of ${score.toFixed(3)} based on multiple risk factors.`
    ];

    if (riskFactors.length > 0) {
      parts.push('Key contributing factors include:');
      riskFactors.forEach((factor, index) => {
        parts.push(`${index + 1}. ${factor.description} (impact: ${factor.impact.toFixed(2)})`);
      });
    }

    const riskLevel = score >= 0.8 ? 'CRITICAL' :
                     score >= 0.6 ? 'HIGH' :
                     score >= 0.4 ? 'MEDIUM' : 'LOW';

    parts.push(`Overall risk level: ${riskLevel}`);

    return parts.join(' ');
  }

  // Helper methods

  private prepareBehavioralFeatures(userContext: {
    userId: string;
    normalBehavior: UserBehaviorProfile;
    currentBehavior: UserBehaviorProfile;
  }): number[] {
    // Convert user behavior to feature vector for ML model
    const features: number[] = [];

    // Time-based features
    const normalLoginHours = userContext.normalBehavior.loginTimes;
    const currentLoginHours = userContext.currentBehavior.loginTimes;
    
    // Calculate deviation in login times
    const timeDeviation = this.calculateTimeDeviation(normalLoginHours, currentLoginHours);
    features.push(timeDeviation);

    // Access pattern features
    const accessDeviation = this.calculateAccessDeviation(
      userContext.normalBehavior.accessPatterns,
      userContext.currentBehavior.accessPatterns
    );
    features.push(accessDeviation);

    // Location features
    const locationDeviation = this.calculateLocationDeviation(
      userContext.normalBehavior.locationPatterns,
      userContext.currentBehavior.locationPatterns
    );
    features.push(locationDeviation);

    // Device features
    const deviceDeviation = this.calculateDeviceDeviation(
      userContext.normalBehavior.devicePatterns,
      userContext.currentBehavior.devicePatterns
    );
    features.push(deviceDeviation);

    // Risk score difference
    const riskScoreDiff = Math.abs(
      userContext.currentBehavior.riskScore - userContext.normalBehavior.riskScore
    );
    features.push(riskScoreDiff);

    return features;
  }

  private async invokeSageMakerEndpoint(endpointName: string, features: number[]): Promise<any> {
    try {
      const command = new InvokeEndpointCommand({
        EndpointName: endpointName,
        ContentType: 'application/json',
        Body: JSON.stringify({ instances: [features] })
      });

      const response = await this.sagemakerClient.send(command);
      
      if (response.Body) {
        const result = JSON.parse(new TextDecoder().decode(response.Body));
        return result.predictions?.[0] || result;
      }

      return { anomalyScore: 0 };

    } catch (error) {
      console.error(`Error invoking SageMaker endpoint ${endpointName}:`, error);
      return { anomalyScore: 0 };
    }
  }

  private async checkIpReputation(ip: string): Promise<{
    isMalicious: boolean;
    isSuspicious: boolean;
    reputation: string;
  }> {
    // Mock implementation - would integrate with threat intelligence feeds
    const mockReputation = Math.random();
    
    return {
      isMalicious: mockReputation > 0.9,
      isSuspicious: mockReputation > 0.7,
      reputation: mockReputation > 0.9 ? 'malicious' : 
                 mockReputation > 0.7 ? 'suspicious' : 'clean'
    };
  }

  private calculateTimeDeviation(normal: number[], current: number[]): number {
    if (normal.length === 0 || current.length === 0) return 0;

    // Calculate average deviation in login hours
    const normalAvg = normal.reduce((sum, hour) => sum + hour, 0) / normal.length;
    const currentAvg = current.reduce((sum, hour) => sum + hour, 0) / current.length;
    
    return Math.abs(normalAvg - currentAvg) / 24; // Normalize to 0-1
  }

  private calculateAccessDeviation(normal: string[], current: string[]): number {
    if (normal.length === 0) return current.length > 0 ? 1 : 0;

    const normalSet = new Set(normal);
    const currentSet = new Set(current);
    
    const intersection = new Set([...normalSet].filter(x => currentSet.has(x)));
    const union = new Set([...normalSet, ...currentSet]);
    
    return 1 - (intersection.size / union.size); // Jaccard distance
  }

  private calculateLocationDeviation(normal: string[], current: string[]): number {
    return this.calculateAccessDeviation(normal, current); // Same logic
  }

  private calculateDeviceDeviation(normal: string[], current: string[]): number {
    return this.calculateAccessDeviation(normal, current); // Same logic
  }
}