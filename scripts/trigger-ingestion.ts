#!/usr/bin/env node

/**
 * Script to manually trigger threat intelligence ingestion
 * Usage: npx ts-node scripts/trigger-ingestion.ts [source]
 * Sources: misp, cve, mitre, all (default)
 */

import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const eventBridgeClient = new EventBridgeClient({});
const lambdaClient = new LambdaClient({});

async function main() {
  const source = process.argv[2] || 'all';
  const validSources = ['misp', 'cve', 'mitre', 'all'];
  
  if (!validSources.includes(source)) {
    console.error(`Invalid source: ${source}. Valid sources: ${validSources.join(', ')}`);
    process.exit(1);
  }

  console.log(`Triggering threat intelligence ingestion for: ${source}`);

  try {
    if (source === 'all') {
      await triggerAllIngestion();
    } else {
      await triggerSpecificIngestion(source);
    }
    
    console.log('Ingestion triggered successfully');
  } catch (error) {
    console.error('Error triggering ingestion:', error);
    process.exit(1);
  }
}

async function triggerAllIngestion() {
  // Use EventBridge to trigger all ingesters
  const command = new PutEventsCommand({
    Entries: [
      {
        Source: 'thrag.ingestion',
        DetailType: 'Manual Ingestion Trigger',
        Detail: JSON.stringify({
          source: 'all',
          timestamp: new Date().toISOString(),
          triggeredBy: 'manual-script'
        })
      }
    ]
  });

  await eventBridgeClient.send(command);
  console.log('Triggered all ingesters via EventBridge');
}

async function triggerSpecificIngestion(source: string) {
  // Get function name from environment or use default pattern
  const functionName = process.env[`${source.toUpperCase()}_INGESTER_FUNCTION`] || 
                      `ThragDataStack-${source.charAt(0).toUpperCase() + source.slice(1)}Ingester`;

  const command = new InvokeCommand({
    FunctionName: functionName,
    InvocationType: 'Event', // Asynchronous invocation
    Payload: JSON.stringify({
      source: 'manual-trigger',
      timestamp: new Date().toISOString()
    })
  });

  try {
    await lambdaClient.send(command);
    console.log(`Triggered ${source} ingester: ${functionName}`);
  } catch (error) {
    console.error(`Error triggering ${source} ingester:`, error);
    
    // Fallback to EventBridge
    console.log('Falling back to EventBridge trigger...');
    const eventCommand = new PutEventsCommand({
      Entries: [
        {
          Source: 'thrag.ingestion',
          DetailType: 'Manual Ingestion Trigger',
          Detail: JSON.stringify({
            source,
            timestamp: new Date().toISOString(),
            triggeredBy: 'manual-script-fallback'
          })
        }
      ]
    });

    await eventBridgeClient.send(eventCommand);
    console.log(`Triggered ${source} ingester via EventBridge`);
  }
}

// Run the script
main().catch(console.error);