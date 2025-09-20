import { Handler } from 'aws-lambda';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { Readable } from 'stream';

interface EmbeddingRequest {
  documentId: string;
  bucketName: string;
  objectKey: string;
  chunkSize?: number;
  overlapSize?: number;
}

interface DocumentChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  metadata: {
    source: string;
    confidence: number;
    tags: string[];
    startPosition: number;
    endPosition: number;
  };
}

interface EmbeddingResult {
  chunkId: string;
  embedding: number[];
  metadata: any;
}

const s3Client = new S3Client({});
const bedrockClient = new BedrockRuntimeClient({});

export const handler: Handler = async (event, context) => {
  console.log('Embedding Generator started', JSON.stringify(event));

  try {
    // Handle S3 event or direct invocation
    const requests: EmbeddingRequest[] = [];
    
    if (event.Records) {
      // S3 event trigger
      for (const record of event.Records) {
        if (record.eventSource === 'aws:s3' && record.eventName.startsWith('ObjectCreated')) {
          requests.push({
            documentId: record.s3.object.key.split('/').pop()?.replace('.json', '') || 'unknown',
            bucketName: record.s3.bucket.name,
            objectKey: decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '))
          });
        }
      }
    } else {
      // Direct invocation
      requests.push(event as EmbeddingRequest);
    }

    const results: EmbeddingResult[] = [];

    for (const request of requests) {
      try {
        console.log(`Processing document: ${request.documentId}`);
        
        // Download document from S3
        const document = await downloadDocument(request.bucketName, request.objectKey);
        
        // Chunk the document
        const chunks = await chunkDocument(document, request.chunkSize, request.overlapSize);
        console.log(`Created ${chunks.length} chunks for document ${request.documentId}`);
        
        // Generate embeddings for each chunk
        for (const chunk of chunks) {
          try {
            const embedding = await generateEmbedding(chunk.content);
            
            const result: EmbeddingResult = {
              chunkId: chunk.id,
              embedding,
              metadata: {
                ...chunk.metadata,
                chunkIndex: chunk.chunkIndex,
                documentId: chunk.documentId,
                content: chunk.content
              }
            };
            
            results.push(result);
            
            // Store embedding result
            await storeEmbedding(request.bucketName, result);
            
          } catch (error) {
            console.error(`Error generating embedding for chunk ${chunk.id}:`, error);
          }
        }
        
      } catch (error) {
        console.error(`Error processing document ${request.documentId}:`, error);
      }
    }

    console.log(`Successfully generated ${results.length} embeddings`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Embedding generation completed',
        processed: results.length,
        embeddings: results.map(r => ({ chunkId: r.chunkId, documentId: r.metadata.documentId }))
      })
    };

  } catch (error) {
    console.error('Embedding generation failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Embedding generation failed', details: error.message })
    };
  }
};

async function downloadDocument(bucketName: string, objectKey: string): Promise<any> {
  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: objectKey
    });
    
    const response = await s3Client.send(command);
    
    if (!response.Body) {
      throw new Error('Empty response body');
    }
    
    // Convert stream to string
    const chunks: Buffer[] = [];
    const readable = response.Body as Readable;
    
    for await (const chunk of readable) {
      chunks.push(chunk);
    }
    
    const content = Buffer.concat(chunks).toString('utf-8');
    return JSON.parse(content);
    
  } catch (error) {
    console.error(`Error downloading document ${objectKey}:`, error);
    throw new Error(`Failed to download document: ${error.message}`);
  }
}

async function chunkDocument(
  document: any, 
  chunkSize: number = 512, 
  overlapSize: number = 50
): Promise<DocumentChunk[]> {
  const content = document.content || '';
  const chunks: DocumentChunk[] = [];
  
  // Simple sentence-based chunking with overlap
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  let currentChunk = '';
  let chunkIndex = 0;
  let startPosition = 0;
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim() + '.';
    
    // Check if adding this sentence would exceed chunk size
    if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
      // Create chunk
      const chunk: DocumentChunk = {
        id: `${document.id}-chunk-${chunkIndex}`,
        documentId: document.id,
        chunkIndex,
        content: currentChunk.trim(),
        metadata: {
          source: document.source,
          confidence: document.metadata.confidence,
          tags: document.metadata.tags || [],
          startPosition,
          endPosition: startPosition + currentChunk.length
        }
      };
      
      chunks.push(chunk);
      
      // Start new chunk with overlap
      const overlapSentences = sentences.slice(Math.max(0, i - Math.floor(overlapSize / 50)), i);
      currentChunk = overlapSentences.join(' ') + ' ';
      startPosition += currentChunk.length - (overlapSentences.join(' ').length + 1);
      chunkIndex++;
    }
    
    currentChunk += sentence + ' ';
  }
  
  // Add final chunk if there's remaining content
  if (currentChunk.trim().length > 0) {
    const chunk: DocumentChunk = {
      id: `${document.id}-chunk-${chunkIndex}`,
      documentId: document.id,
      chunkIndex,
      content: currentChunk.trim(),
      metadata: {
        source: document.source,
        confidence: document.metadata.confidence,
        tags: document.metadata.tags || [],
        startPosition,
        endPosition: startPosition + currentChunk.length
      }
    };
    
    chunks.push(chunk);
  }
  
  return chunks;
}

async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const modelId = 'amazon.titan-embed-text-v1';
    
    const requestBody = {
      inputText: text.substring(0, 8000) // Titan has 8k token limit
    };
    
    const command = new InvokeModelCommand({
      modelId,
      body: JSON.stringify(requestBody),
      contentType: 'application/json',
      accept: 'application/json'
    });
    
    const response = await bedrockClient.send(command);
    
    if (!response.body) {
      throw new Error('Empty response body from Bedrock');
    }
    
    // Convert Uint8Array to string and parse JSON
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    if (!responseBody.embedding) {
      throw new Error('No embedding in response');
    }
    
    return responseBody.embedding;
    
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error(`Failed to generate embedding: ${error.message}`);
  }
}

async function storeEmbedding(bucketName: string, result: EmbeddingResult): Promise<void> {
  try {
    const key = `embeddings/${result.metadata.documentId}/${result.chunkId}.json`;
    
    const embeddingDocument = {
      chunkId: result.chunkId,
      documentId: result.metadata.documentId,
      embedding: result.embedding,
      metadata: result.metadata,
      timestamp: new Date().toISOString()
    };
    
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: JSON.stringify(embeddingDocument, null, 2),
      ContentType: 'application/json',
      Metadata: {
        chunk_id: result.chunkId,
        document_id: result.metadata.documentId,
        source: result.metadata.source,
        confidence: result.metadata.confidence.toString()
      }
    });
    
    await s3Client.send(command);
    console.log(`Stored embedding for chunk ${result.chunkId} in S3: ${key}`);
    
  } catch (error) {
    console.error(`Error storing embedding for chunk ${result.chunkId}:`, error);
    throw error;
  }
}

// Utility function for batch processing
export async function processEmbeddingBatch(documents: any[]): Promise<EmbeddingResult[]> {
  const results: EmbeddingResult[] = [];
  
  for (const document of documents) {
    try {
      const chunks = await chunkDocument(document);
      
      for (const chunk of chunks) {
        const embedding = await generateEmbedding(chunk.content);
        
        results.push({
          chunkId: chunk.id,
          embedding,
          metadata: chunk.metadata
        });
      }
    } catch (error) {
      console.error(`Error processing document ${document.id}:`, error);
    }
  }
  
  return results;
}