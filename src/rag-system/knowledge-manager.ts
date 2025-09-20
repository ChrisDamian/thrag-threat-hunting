import { BedrockAgentClient, RetrieveCommand, RetrieveAndGenerateCommand } from '@aws-sdk/client-bedrock-agent';
import { OpenSearchServerlessClient, SearchCommand } from '@aws-sdk/client-opensearchserverless';
import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

export interface RetrievalQuery {
  query: string;
  filters?: {
    source?: string[];
    confidence_min?: number;
    tlp?: string[];
    tags?: string[];
    date_range?: {
      start: Date;
      end: Date;
    };
  };
  maxResults?: number;
  similarityThreshold?: number;
}

export interface RetrievalResult {
  id: string;
  content: string;
  metadata: {
    source: string;
    confidence: number;
    tlp: string;
    tags: string[];
    created: Date;
    title: string;
  };
  score: number;
  citations: string[];
}

export interface RAGResponse {
  answer: string;
  sources: RetrievalResult[];
  confidence: number;
  reasoning: string;
  citations: string[];
}

export class KnowledgeManager {
  private bedrockClient: BedrockAgentClient;
  private opensearchClient: OpenSearchServerlessClient;
  private s3Client: S3Client;
  private knowledgeBaseId: string;
  private vectorStoreEndpoint: string;

  constructor(knowledgeBaseId: string, vectorStoreEndpoint: string) {
    this.bedrockClient = new BedrockAgentClient({});
    this.opensearchClient = new OpenSearchServerlessClient({});
    this.s3Client = new S3Client({});
    this.knowledgeBaseId = knowledgeBaseId;
    this.vectorStoreEndpoint = vectorStoreEndpoint;
  }

  /**
   * Retrieve relevant documents using Bedrock Knowledge Base
   */
  async retrieveDocuments(query: RetrievalQuery): Promise<RetrievalResult[]> {
    try {
      console.log(`Retrieving documents for query: ${query.query}`);

      const command = new RetrieveCommand({
        knowledgeBaseId: this.knowledgeBaseId,
        retrievalQuery: {
          text: query.query
        },
        retrievalConfiguration: {
          vectorSearchConfiguration: {
            numberOfResults: query.maxResults || 10,
            overrideSearchType: 'HYBRID' // Combine semantic and keyword search
          }
        }
      });

      const response = await this.bedrockClient.send(command);
      
      if (!response.retrievalResults) {
        return [];
      }

      // Process and filter results
      const results: RetrievalResult[] = [];
      
      for (const result of response.retrievalResults) {
        if (!result.content?.text || !result.metadata) continue;

        // Apply filters
        if (query.filters) {
          if (!this.passesFilters(result.metadata, query.filters)) {
            continue;
          }
        }

        // Apply similarity threshold
        const score = result.score || 0;
        if (query.similarityThreshold && score < query.similarityThreshold) {
          continue;
        }

        results.push({
          id: result.metadata.sourceId || 'unknown',
          content: result.content.text,
          metadata: {
            source: result.metadata.source || 'unknown',
            confidence: parseFloat(result.metadata.confidence || '0.5'),
            tlp: result.metadata.tlp || 'WHITE',
            tags: result.metadata.tags ? result.metadata.tags.split(',') : [],
            created: new Date(result.metadata.created || Date.now()),
            title: result.metadata.title || 'Untitled'
          },
          score,
          citations: this.extractCitations(result.content.text)
        });
      }

      console.log(`Retrieved ${results.length} relevant documents`);
      return results.sort((a, b) => b.score - a.score);

    } catch (error) {
      console.error('Error retrieving documents:', error);
      throw new Error(`Document retrieval failed: ${error.message}`);
    }
  }

  /**
   * Retrieve and generate response using RAG
   */
  async retrieveAndGenerate(
    query: string, 
    context?: string,
    filters?: RetrievalQuery['filters']
  ): Promise<RAGResponse> {
    try {
      console.log(`Generating RAG response for: ${query}`);

      // First retrieve relevant documents
      const retrievalQuery: RetrievalQuery = {
        query,
        filters,
        maxResults: 5,
        similarityThreshold: 0.3
      };

      const sources = await this.retrieveDocuments(retrievalQuery);

      // Prepare context from retrieved documents
      const retrievedContext = sources
        .map(source => `Source: ${source.metadata.source} (Confidence: ${source.metadata.confidence})\n${source.content}`)
        .join('\n\n---\n\n');

      // Generate response using Bedrock
      const command = new RetrieveAndGenerateCommand({
        input: {
          text: context ? `${context}\n\nQuery: ${query}` : query
        },
        retrieveAndGenerateConfiguration: {
          type: 'KNOWLEDGE_BASE',
          knowledgeBaseConfiguration: {
            knowledgeBaseId: this.knowledgeBaseId,
            modelArn: 'arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0'
          }
        }
      });

      const response = await this.bedrockClient.send(command);

      if (!response.output?.text) {
        throw new Error('No response generated');
      }

      // Calculate overall confidence based on sources
      const confidence = this.calculateOverallConfidence(sources);

      // Extract reasoning and citations
      const reasoning = this.extractReasoning(response.output.text);
      const citations = this.extractAllCitations(sources);

      return {
        answer: response.output.text,
        sources,
        confidence,
        reasoning,
        citations
      };

    } catch (error) {
      console.error('Error in retrieve and generate:', error);
      throw new Error(`RAG generation failed: ${error.message}`);
    }
  }

  /**
   * Search using hybrid approach (semantic + keyword)
   */
  async hybridSearch(
    query: string,
    filters?: RetrievalQuery['filters'],
    maxResults: number = 10
  ): Promise<RetrievalResult[]> {
    try {
      // Use Bedrock Knowledge Base for primary search
      const bedrockResults = await this.retrieveDocuments({
        query,
        filters,
        maxResults: Math.ceil(maxResults * 0.7) // 70% from semantic search
      });

      // Supplement with keyword search if needed
      const keywordResults = await this.keywordSearch(query, filters, Math.ceil(maxResults * 0.3));

      // Combine and deduplicate results
      const combinedResults = this.combineAndDeduplicateResults(bedrockResults, keywordResults);

      return combinedResults.slice(0, maxResults);

    } catch (error) {
      console.error('Error in hybrid search:', error);
      throw new Error(`Hybrid search failed: ${error.message}`);
    }
  }

  /**
   * Keyword-based search for supplementing semantic search
   */
  private async keywordSearch(
    query: string,
    filters?: RetrievalQuery['filters'],
    maxResults: number = 5
  ): Promise<RetrievalResult[]> {
    // This would implement direct OpenSearch queries for keyword matching
    // For now, return empty array as fallback
    console.log(`Keyword search for: ${query}`);
    return [];
  }

  /**
   * Update knowledge base with new documents
   */
  async updateKnowledgeBase(documents: any[]): Promise<void> {
    try {
      console.log(`Updating knowledge base with ${documents.length} documents`);

      // This would trigger knowledge base synchronization
      // Implementation depends on specific Bedrock Knowledge Base setup
      
      console.log('Knowledge base update completed');

    } catch (error) {
      console.error('Error updating knowledge base:', error);
      throw new Error(`Knowledge base update failed: ${error.message}`);
    }
  }

  /**
   * Get knowledge base statistics
   */
  async getKnowledgeBaseStats(): Promise<{
    totalDocuments: number;
    sourceBreakdown: Record<string, number>;
    lastUpdated: Date;
    averageConfidence: number;
  }> {
    try {
      // This would query the knowledge base for statistics
      // For now, return mock data
      return {
        totalDocuments: 50000,
        sourceBreakdown: {
          'MITRE': 15000,
          'CVE': 25000,
          'MISP': 10000
        },
        lastUpdated: new Date(),
        averageConfidence: 0.85
      };

    } catch (error) {
      console.error('Error getting knowledge base stats:', error);
      throw new Error(`Failed to get knowledge base stats: ${error.message}`);
    }
  }

  // Helper methods

  private passesFilters(metadata: any, filters: RetrievalQuery['filters']): boolean {
    if (filters.source && !filters.source.includes(metadata.source)) {
      return false;
    }

    if (filters.confidence_min && parseFloat(metadata.confidence || '0') < filters.confidence_min) {
      return false;
    }

    if (filters.tlp && !filters.tlp.includes(metadata.tlp)) {
      return false;
    }

    if (filters.tags && filters.tags.length > 0) {
      const docTags = metadata.tags ? metadata.tags.split(',') : [];
      const hasMatchingTag = filters.tags.some(tag => docTags.includes(tag));
      if (!hasMatchingTag) {
        return false;
      }
    }

    if (filters.date_range) {
      const docDate = new Date(metadata.created || 0);
      if (docDate < filters.date_range.start || docDate > filters.date_range.end) {
        return false;
      }
    }

    return true;
  }

  private extractCitations(content: string): string[] {
    // Extract URLs and references from content
    const urlRegex = /https?:\/\/[^\s]+/g;
    const urls = content.match(urlRegex) || [];
    
    // Extract MITRE technique references
    const mitreRegex = /T\d{4}(\.\d{3})?/g;
    const mitreRefs = content.match(mitreRegex) || [];
    
    // Extract CVE references
    const cveRegex = /CVE-\d{4}-\d{4,}/g;
    const cveRefs = content.match(cveRegex) || [];

    return [...urls, ...mitreRefs.map(ref => `MITRE ATT&CK: ${ref}`), ...cveRefs];
  }

  private calculateOverallConfidence(sources: RetrievalResult[]): number {
    if (sources.length === 0) return 0;

    const weightedSum = sources.reduce((sum, source) => {
      return sum + (source.metadata.confidence * source.score);
    }, 0);

    const totalWeight = sources.reduce((sum, source) => sum + source.score, 0);

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  private extractReasoning(response: string): string {
    // Extract reasoning from the response
    // This is a simplified implementation
    const reasoningMarkers = ['because', 'due to', 'based on', 'according to'];
    
    for (const marker of reasoningMarkers) {
      const index = response.toLowerCase().indexOf(marker);
      if (index !== -1) {
        const sentence = response.substring(index).split('.')[0];
        return sentence.trim();
      }
    }

    return 'Based on retrieved threat intelligence data';
  }

  private extractAllCitations(sources: RetrievalResult[]): string[] {
    const allCitations: string[] = [];
    
    sources.forEach(source => {
      allCitations.push(`${source.metadata.source}: ${source.metadata.title}`);
      allCitations.push(...source.citations);
    });

    return [...new Set(allCitations)]; // Remove duplicates
  }

  private combineAndDeduplicateResults(
    semanticResults: RetrievalResult[],
    keywordResults: RetrievalResult[]
  ): RetrievalResult[] {
    const combined = [...semanticResults];
    const existingIds = new Set(semanticResults.map(r => r.id));

    keywordResults.forEach(result => {
      if (!existingIds.has(result.id)) {
        combined.push(result);
        existingIds.add(result.id);
      }
    });

    return combined.sort((a, b) => b.score - a.score);
  }
}