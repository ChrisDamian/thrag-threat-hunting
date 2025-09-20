import { Handler } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { KinesisClient, PutRecordCommand } from '@aws-sdk/client-kinesis';
import axios from 'axios';

interface MitreAttackObject {
  type: string;
  id: string;
  created: string;
  modified: string;
  name: string;
  description: string;
  kill_chain_phases?: Array<{
    kill_chain_name: string;
    phase_name: string;
  }>;
  external_references?: Array<{
    source_name: string;
    external_id?: string;
    url?: string;
    description?: string;
  }>;
  x_mitre_platforms?: string[];
  x_mitre_data_sources?: string[];
  x_mitre_detection?: string;
  x_mitre_version?: string;
  x_mitre_attack_spec_version?: string;
  x_mitre_domains?: string[];
  x_mitre_is_subtechnique?: boolean;
  x_mitre_permissions_required?: string[];
  x_mitre_effective_permissions?: string[];
  x_mitre_defense_bypassed?: string[];
  x_mitre_system_requirements?: string[];
  x_mitre_impact_type?: string[];
}

interface MitreBundle {
  type: string;
  id: string;
  objects: MitreAttackObject[];
}

interface ThreatIntelDocument {
  id: string;
  source: 'MITRE';
  title: string;
  content: string;
  metadata: {
    confidence: number;
    tlp: 'WHITE' | 'GREEN' | 'AMBER' | 'RED';
    tags: string[];
    created: Date;
    updated: Date;
    mitre_id?: string;
    mitre_version?: string;
    attack_type: string;
    platforms?: string[];
    tactics?: string[];
  };
  techniques: {
    mitre_id: string;
    name: string;
    tactics: string[];
    platforms: string[];
    data_sources: string[];
    is_subtechnique: boolean;
  }[];
}

const s3Client = new S3Client({});
const kinesisClient = new KinesisClient({});

export const handler: Handler = async (event, context) => {
  console.log('MITRE ATT&CK Ingester started', JSON.stringify(event));

  try {
    // Fetch MITRE ATT&CK data
    const mitreData = await fetchMitreAttackData();
    console.log(`Fetched ${mitreData.objects.length} MITRE ATT&CK objects`);

    // Filter and process different object types
    const techniques = mitreData.objects.filter(obj => obj.type === 'attack-pattern');
    const tactics = mitreData.objects.filter(obj => obj.type === 'x-mitre-tactic');
    const groups = mitreData.objects.filter(obj => obj.type === 'intrusion-set');
    const software = mitreData.objects.filter(obj => obj.type === 'malware' || obj.type === 'tool');

    console.log(`Processing: ${techniques.length} techniques, ${tactics.length} tactics, ${groups.length} groups, ${software.length} software`);

    const processedDocuments: ThreatIntelDocument[] = [];
    
    // Process techniques
    for (const technique of techniques) {
      try {
        const document = await processTechnique(technique, tactics);
        processedDocuments.push(document);
        await storeDocument(document);
        await sendToKinesis(document);
      } catch (error) {
        console.error(`Error processing technique ${technique.id}:`, error);
      }
    }

    // Process threat groups
    for (const group of groups) {
      try {
        const document = await processGroup(group, techniques);
        processedDocuments.push(document);
        await storeDocument(document);
        await sendToKinesis(document);
      } catch (error) {
        console.error(`Error processing group ${group.id}:`, error);
      }
    }

    // Process software
    for (const soft of software) {
      try {
        const document = await processSoftware(soft, techniques);
        processedDocuments.push(document);
        await storeDocument(document);
        await sendToKinesis(document);
      } catch (error) {
        console.error(`Error processing software ${soft.id}:`, error);
      }
    }

    console.log(`Successfully processed ${processedDocuments.length} MITRE ATT&CK objects`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'MITRE ATT&CK ingestion completed',
        processed: processedDocuments.length,
        breakdown: {
          techniques: techniques.length,
          tactics: tactics.length,
          groups: groups.length,
          software: software.length
        }
      })
    };

  } catch (error) {
    console.error('MITRE ATT&CK ingestion failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'MITRE ATT&CK ingestion failed', details: error.message })
    };
  }
};

async function fetchMitreAttackData(): Promise<MitreBundle> {
  try {
    const url = 'https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json';
    
    console.log('Fetching MITRE ATT&CK Enterprise data...');
    
    const response = await axios.get(url, {
      timeout: 120000, // 2 minutes timeout for large file
      headers: {
        'User-Agent': 'THRAG-MITRE-Ingester/1.0'
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error fetching MITRE ATT&CK data:', error);
    throw new Error(`Failed to fetch MITRE ATT&CK data: ${error.message}`);
  }
}

async function processTechnique(technique: MitreAttackObject, tactics: MitreAttackObject[]): Promise<ThreatIntelDocument> {
  // Extract MITRE ID
  const mitreRef = technique.external_references?.find(ref => ref.source_name === 'mitre-attack');
  const mitreId = mitreRef?.external_id || technique.id;
  
  // Extract tactics from kill chain phases
  const tacticNames = technique.kill_chain_phases?.map(phase => phase.phase_name) || [];
  
  // Extract platforms
  const platforms = technique.x_mitre_platforms || [];
  
  // Extract data sources
  const dataSources = technique.x_mitre_data_sources || [];
  
  // Generate tags
  const tags = generateTechniqueTags(technique, tacticNames, platforms);
  
  // Generate content for RAG
  const content = generateTechniqueContent(technique, mitreId, tacticNames, platforms, dataSources);
  
  // Calculate confidence (MITRE data is highly reliable)
  const confidence = 0.95;

  const document: ThreatIntelDocument = {
    id: `mitre-technique-${mitreId}-${Date.now()}`,
    source: 'MITRE',
    title: `${mitreId}: ${technique.name}`,
    content,
    metadata: {
      confidence,
      tlp: 'WHITE', // MITRE ATT&CK is public
      tags,
      created: new Date(technique.created),
      updated: new Date(technique.modified),
      mitre_id: mitreId,
      mitre_version: technique.x_mitre_version,
      attack_type: 'technique',
      platforms,
      tactics: tacticNames
    },
    techniques: [{
      mitre_id: mitreId,
      name: technique.name,
      tactics: tacticNames,
      platforms,
      data_sources: dataSources,
      is_subtechnique: technique.x_mitre_is_subtechnique || false
    }]
  };

  return document;
}

async function processGroup(group: MitreAttackObject, techniques: MitreAttackObject[]): Promise<ThreatIntelDocument> {
  // Extract MITRE ID
  const mitreRef = group.external_references?.find(ref => ref.source_name === 'mitre-attack');
  const mitreId = mitreRef?.external_id || group.id;
  
  // Generate tags
  const tags = ['threat-group', 'apt', 'mitre-attack', mitreId.toLowerCase()];
  
  // Generate content for RAG
  const content = generateGroupContent(group, mitreId);
  
  const document: ThreatIntelDocument = {
    id: `mitre-group-${mitreId}-${Date.now()}`,
    source: 'MITRE',
    title: `${mitreId}: ${group.name}`,
    content,
    metadata: {
      confidence: 0.95,
      tlp: 'WHITE',
      tags,
      created: new Date(group.created),
      updated: new Date(group.modified),
      mitre_id: mitreId,
      mitre_version: group.x_mitre_version,
      attack_type: 'group'
    },
    techniques: [] // Groups don't directly contain techniques in this structure
  };

  return document;
}

async function processSoftware(software: MitreAttackObject, techniques: MitreAttackObject[]): Promise<ThreatIntelDocument> {
  // Extract MITRE ID
  const mitreRef = software.external_references?.find(ref => ref.source_name === 'mitre-attack');
  const mitreId = mitreRef?.external_id || software.id;
  
  // Determine software type
  const softwareType = software.type === 'malware' ? 'malware' : 'tool';
  
  // Extract platforms
  const platforms = software.x_mitre_platforms || [];
  
  // Generate tags
  const tags = [softwareType, 'mitre-attack', mitreId.toLowerCase(), ...platforms.map(p => `platform-${p.toLowerCase()}`)];
  
  // Generate content for RAG
  const content = generateSoftwareContent(software, mitreId, softwareType, platforms);
  
  const document: ThreatIntelDocument = {
    id: `mitre-software-${mitreId}-${Date.now()}`,
    source: 'MITRE',
    title: `${mitreId}: ${software.name}`,
    content,
    metadata: {
      confidence: 0.95,
      tlp: 'WHITE',
      tags,
      created: new Date(software.created),
      updated: new Date(software.modified),
      mitre_id: mitreId,
      mitre_version: software.x_mitre_version,
      attack_type: softwareType,
      platforms
    },
    techniques: []
  };

  return document;
}

function generateTechniqueTags(technique: MitreAttackObject, tactics: string[], platforms: string[]): string[] {
  const tags = ['technique', 'mitre-attack'];
  
  // Add MITRE ID
  const mitreRef = technique.external_references?.find(ref => ref.source_name === 'mitre-attack');
  if (mitreRef?.external_id) {
    tags.push(mitreRef.external_id.toLowerCase());
  }
  
  // Add tactics
  tactics.forEach(tactic => tags.push(`tactic-${tactic}`));
  
  // Add platforms
  platforms.forEach(platform => tags.push(`platform-${platform.toLowerCase()}`));
  
  // Add subtechnique flag
  if (technique.x_mitre_is_subtechnique) {
    tags.push('subtechnique');
  }
  
  return [...new Set(tags)];
}

function generateTechniqueContent(
  technique: MitreAttackObject,
  mitreId: string,
  tactics: string[],
  platforms: string[],
  dataSources: string[]
): string {
  const sections = [
    `MITRE ATT&CK Technique: ${mitreId}`,
    `Name: ${technique.name}`,
    `Type: ${technique.x_mitre_is_subtechnique ? 'Sub-technique' : 'Technique'}`,
    `Created: ${new Date(technique.created).toISOString()}`,
    `Modified: ${new Date(technique.modified).toISOString()}`,
    '',
    'Description:',
    technique.description || 'No description available',
    '',
    'Tactics:',
    ...tactics.map(tactic => `- ${tactic}`),
    '',
    'Platforms:',
    ...platforms.map(platform => `- ${platform}`),
    '',
    'Data Sources:',
    ...dataSources.map(source => `- ${source}`),
    '',
    'Detection:',
    technique.x_mitre_detection || 'No specific detection guidance available',
    '',
    'Permissions Required:',
    ...(technique.x_mitre_permissions_required?.map(perm => `- ${perm}`) || ['- Not specified']),
    '',
    'Defense Bypassed:',
    ...(technique.x_mitre_defense_bypassed?.map(defense => `- ${defense}`) || ['- Not specified']),
    '',
    'System Requirements:',
    ...(technique.x_mitre_system_requirements?.map(req => `- ${req}`) || ['- Not specified']),
    '',
    'References:',
    ...(technique.external_references?.filter(ref => ref.url).map(ref => `- ${ref.url}`) || ['- No external references'])
  ];

  return sections.join('\n');
}

function generateGroupContent(group: MitreAttackObject, mitreId: string): string {
  const sections = [
    `MITRE ATT&CK Group: ${mitreId}`,
    `Name: ${group.name}`,
    `Created: ${new Date(group.created).toISOString()}`,
    `Modified: ${new Date(group.modified).toISOString()}`,
    '',
    'Description:',
    group.description || 'No description available',
    '',
    'Aliases:',
    // Extract aliases from external references
    ...(group.external_references?.filter(ref => ref.source_name !== 'mitre-attack').map(ref => `- ${ref.source_name}`) || ['- No known aliases']),
    '',
    'References:',
    ...(group.external_references?.filter(ref => ref.url).map(ref => `- ${ref.url}`) || ['- No external references'])
  ];

  return sections.join('\n');
}

function generateSoftwareContent(
  software: MitreAttackObject,
  mitreId: string,
  softwareType: string,
  platforms: string[]
): string {
  const sections = [
    `MITRE ATT&CK ${softwareType.charAt(0).toUpperCase() + softwareType.slice(1)}: ${mitreId}`,
    `Name: ${software.name}`,
    `Type: ${softwareType}`,
    `Created: ${new Date(software.created).toISOString()}`,
    `Modified: ${new Date(software.modified).toISOString()}`,
    '',
    'Description:',
    software.description || 'No description available',
    '',
    'Platforms:',
    ...platforms.map(platform => `- ${platform}`),
    '',
    'References:',
    ...(software.external_references?.filter(ref => ref.url).map(ref => `- ${ref.url}`) || ['- No external references'])
  ];

  return sections.join('\n');
}

async function storeDocument(document: ThreatIntelDocument): Promise<void> {
  const bucketName = process.env.THREAT_INTEL_BUCKET;
  if (!bucketName) {
    throw new Error('THREAT_INTEL_BUCKET environment variable not set');
  }

  const key = `mitre/${document.metadata.attack_type}/${document.id}.json`;
  
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: JSON.stringify(document, null, 2),
    ContentType: 'application/json',
    Metadata: {
      source: document.source,
      confidence: document.metadata.confidence.toString(),
      mitre_id: document.metadata.mitre_id || 'unknown',
      attack_type: document.metadata.attack_type
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
    source: 'mitre-ingester',
    timestamp: new Date().toISOString(),
    data: {
      documentId: document.id,
      source: document.source,
      title: document.title,
      confidence: document.metadata.confidence,
      mitreId: document.metadata.mitre_id,
      attackType: document.metadata.attack_type,
      platforms: document.metadata.platforms,
      tactics: document.metadata.tactics
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