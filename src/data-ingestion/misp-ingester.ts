import { Handler } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secretsmanager';
import { KinesisClient, PutRecordCommand } from '@aws-sdk/client-kinesis';
import axios from 'axios';
import * as crypto from 'crypto';

interface MISPEvent {
  id: string;
  info: string;
  threat_level_id: string;
  analysis: string;
  date: string;
  timestamp: string;
  Attribute: MISPAttribute[];
  Tag?: MISPTag[];
}

interface MISPAttribute {
  id: string;
  type: string;
  category: string;
  value: string;
  comment: string;
  to_ids: boolean;
  timestamp: string;
}

interface MISPTag {
  name: string;
  colour: string;
}

interface ThreatIntelDocument {
  id: string;
  source: 'MISP';
  title: string;
  content: string;
  metadata: {
    confidence: number;
    tlp: 'WHITE' | 'GREEN' | 'AMBER' | 'RED';
    tags: string[];
    created: Date;
    updated: Date;
    threat_level: string;
    analysis_status: string;
  };
  indicators: {
    type: string;
    value: string;
    category: string;
    to_ids: boolean;
  }[];
}

const s3Client = new S3Client({});
const secretsClient = new SecretsManagerClient({});
const kinesisClient = new KinesisClient({});

export const handler: Handler = async (event, context) => {
  console.log('MISP Ingester started', JSON.stringify(event));

  try {
    // Get MISP API credentials
    const secrets = await getSecrets();
    const mispApiKey = secrets.misp_api_key;
    const mispUrl = secrets.misp_url || 'https://misp.example.com';

    if (!mispApiKey) {
      console.log('MISP API key not configured, skipping ingestion');
      return { statusCode: 200, body: 'MISP API key not configured' };
    }

    // Fetch recent MISP events
    const mispEvents = await fetchMISPEvents(mispUrl, mispApiKey);
    console.log(`Fetched ${mispEvents.length} MISP events`);

    // Process each event
    const processedDocuments: ThreatIntelDocument[] = [];
    
    for (const mispEvent of mispEvents) {
      try {
        const document = await processMISPEvent(mispEvent);
        processedDocuments.push(document);
        
        // Store document in S3
        await storeDocument(document);
        
        // Send to Kinesis for real-time processing
        await sendToKinesis(document);
        
      } catch (error) {
        console.error(`Error processing MISP event ${mispEvent.id}:`, error);
      }
    }

    console.log(`Successfully processed ${processedDocuments.length} MISP events`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'MISP ingestion completed',
        processed: processedDocuments.length,
        documents: processedDocuments.map(d => ({ id: d.id, title: d.title }))
      })
    };

  } catch (error) {
    console.error('MISP ingestion failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'MISP ingestion failed', details: error.message })
    };
  }
};

async function getSecrets(): Promise<any> {
  try {
    const command = new GetSecretValueCommand({
      SecretId: 'thrag/external-api-keys'
    });
    
    const response = await secretsClient.send(command);
    return JSON.parse(response.SecretString || '{}');
  } catch (error) {
    console.error('Error getting secrets:', error);
    return {};
  }
}

async function fetchMISPEvents(mispUrl: string, apiKey: string): Promise<MISPEvent[]> {
  try {
    const response = await axios.get(`${mispUrl}/events/restSearch`, {
      headers: {
        'Authorization': apiKey,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      params: {
        limit: 100,
        page: 1,
        published: 1,
        enforceWarninglist: 1
      },
      timeout: 30000
    });

    return response.data.response || [];
  } catch (error) {
    console.error('Error fetching MISP events:', error);
    throw new Error(`Failed to fetch MISP events: ${error.message}`);
  }
}

async function processMISPEvent(mispEvent: MISPEvent): Promise<ThreatIntelDocument> {
  // Extract threat level
  const threatLevels = {
    '1': 'HIGH',
    '2': 'MEDIUM', 
    '3': 'LOW',
    '4': 'UNDEFINED'
  };
  
  const threatLevel = threatLevels[mispEvent.threat_level_id] || 'UNDEFINED';
  
  // Extract analysis status
  const analysisStatus = {
    '0': 'INITIAL',
    '1': 'ONGOING',
    '2': 'COMPLETED'
  }[mispEvent.analysis] || 'INITIAL';

  // Extract tags and determine TLP
  const tags = mispEvent.Tag?.map(tag => tag.name) || [];
  const tlp = determineTLP(tags);
  
  // Extract indicators
  const indicators = mispEvent.Attribute?.map(attr => ({
    type: attr.type,
    value: attr.value,
    category: attr.category,
    to_ids: attr.to_ids
  })) || [];

  // Generate content for RAG
  const content = generateEventContent(mispEvent, indicators, threatLevel, analysisStatus);
  
  // Calculate confidence based on analysis status and threat level
  const confidence = calculateConfidence(analysisStatus, threatLevel, indicators.length);

  const document: ThreatIntelDocument = {
    id: `misp-${mispEvent.id}-${Date.now()}`,
    source: 'MISP',
    title: mispEvent.info || `MISP Event ${mispEvent.id}`,
    content,
    metadata: {
      confidence,
      tlp,
      tags,
      created: new Date(parseInt(mispEvent.timestamp) * 1000),
      updated: new Date(),
      threat_level: threatLevel,
      analysis_status: analysisStatus
    },
    indicators
  };

  return document;
}

function determineTLP(tags: string[]): 'WHITE' | 'GREEN' | 'AMBER' | 'RED' {
  const tlpTags = tags.filter(tag => tag.toLowerCase().startsWith('tlp:'));
  
  if (tlpTags.some(tag => tag.toLowerCase().includes('red'))) return 'RED';
  if (tlpTags.some(tag => tag.toLowerCase().includes('amber'))) return 'AMBER';
  if (tlpTags.some(tag => tag.toLowerCase().includes('green'))) return 'GREEN';
  
  return 'WHITE'; // Default to most permissive
}

function generateEventContent(
  event: MISPEvent, 
  indicators: any[], 
  threatLevel: string, 
  analysisStatus: string
): string {
  const sections = [
    `MISP Event: ${event.info}`,
    `Event ID: ${event.id}`,
    `Threat Level: ${threatLevel}`,
    `Analysis Status: ${analysisStatus}`,
    `Date: ${new Date(parseInt(event.timestamp) * 1000).toISOString()}`,
    '',
    'Description:',
    event.info || 'No description available',
    '',
    'Indicators of Compromise (IoCs):',
    ...indicators.map(ind => `- ${ind.type}: ${ind.value} (Category: ${ind.category})`),
    '',
    'Additional Context:',
    `This MISP event contains ${indicators.length} indicators of compromise.`,
    `The event has been classified as ${threatLevel} threat level.`,
    `Analysis status is currently ${analysisStatus}.`,
    '',
    'Recommended Actions:',
    threatLevel === 'HIGH' ? 
      '- Immediate investigation and containment recommended' :
      '- Monitor for related indicators and assess organizational impact'
  ];

  return sections.join('\n');
}

function calculateConfidence(
  analysisStatus: string, 
  threatLevel: string, 
  indicatorCount: number
): number {
  let confidence = 0.5; // Base confidence
  
  // Adjust based on analysis status
  switch (analysisStatus) {
    case 'COMPLETED': confidence += 0.3; break;
    case 'ONGOING': confidence += 0.2; break;
    case 'INITIAL': confidence += 0.1; break;
  }
  
  // Adjust based on threat level
  switch (threatLevel) {
    case 'HIGH': confidence += 0.2; break;
    case 'MEDIUM': confidence += 0.1; break;
    case 'LOW': confidence += 0.05; break;
  }
  
  // Adjust based on indicator count
  if (indicatorCount > 10) confidence += 0.1;
  else if (indicatorCount > 5) confidence += 0.05;
  
  return Math.min(confidence, 1.0);
}

async function storeDocument(document: ThreatIntelDocument): Promise<void> {
  const bucketName = process.env.THREAT_INTEL_BUCKET;
  if (!bucketName) {
    throw new Error('THREAT_INTEL_BUCKET environment variable not set');
  }

  const key = `misp/${document.id}.json`;
  
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: JSON.stringify(document, null, 2),
    ContentType: 'application/json',
    Metadata: {
      source: document.source,
      confidence: document.metadata.confidence.toString(),
      tlp: document.metadata.tlp,
      threat_level: document.metadata.threat_level
    }
  });

  await s3Client.send(command);
  console.log(`Stored document ${document.id} in S3: ${key}`);
}

async function sendToKinesis(document: ThreatIntelDocument): Promise<void> {
  const streamName = process.env.THREAT_INTEL_STREAM;
  if (!streamName) {
    console.log('THREAT_INTEL_STREAM not configured, skipping Kinesis');
    return;
  }

  const record = {
    eventType: 'threat-intelligence-update',
    source: 'misp-ingester',
    timestamp: new Date().toISOString(),
    data: {
      documentId: document.id,
      source: document.source,
      title: document.title,
      confidence: document.metadata.confidence,
      tlp: document.metadata.tlp,
      indicatorCount: document.indicators.length,
      threatLevel: document.metadata.threat_level
    }
  };

  const command = new PutRecordCommand({
    StreamName: streamName,
    Data: Buffer.from(JSON.stringify(record)),
    PartitionKey: document.id
  });

  await kinesisClient.send(command);
  console.log(`Sent document ${document.id} to Kinesis stream ${streamName}`);
}