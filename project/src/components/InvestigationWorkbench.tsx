import React, { useState } from 'react';
import { Search, FileText, Link, Eye, Brain, Clock, Shield, AlertTriangle } from 'lucide-react';

export default function InvestigationWorkbench() {
  const [selectedEvidence, setSelectedEvidence] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const evidenceItems = [
    {
      id: '1',
      type: 'log',
      source: 'CloudTrail',
      timestamp: '2024-01-15 12:30:45',
      content: 'AssumeRole operation from unusual IP 192.168.1.100',
      confidence: 0.94,
      relevance: 'high',
      tags: ['authentication', 'privilege-escalation']
    },
    {
      id: '2',
      type: 'network',
      source: 'VPC Flow Logs',
      timestamp: '2024-01-15 12:31:22',
      content: 'Large data transfer to external IP: 45.67.89.123 (2.3GB)',
      confidence: 0.87,
      relevance: 'high',
      tags: ['data-exfiltration', 'network-anomaly']
    },
    {
      id: '3',
      type: 'behavior',
      source: 'ML Anomaly Detection',
      timestamp: '2024-01-15 12:32:15',
      content: 'Unusual API call pattern detected - 340% above baseline',
      confidence: 0.91,
      relevance: 'medium',
      tags: ['anomaly', 'api-abuse']
    }
  ];

  const ragResults = [
    {
      id: '1',
      title: 'Similar Attack Pattern: APT-2023-001',
      snippet: 'Multi-stage attack using lateral movement and credential harvesting...',
      source: 'Threat Intelligence DB',
      similarity: 0.89,
      date: '2023-08-15'
    },
    {
      id: '2',
      title: 'MITRE ATT&CK: T1078 - Valid Accounts',
      snippet: 'Adversaries may obtain and abuse credentials of existing accounts...',
      source: 'MITRE Framework',
      similarity: 0.82,
      date: '2024-01-10'
    },
    {
      id: '3',
      title: 'IOC Report: Suspicious IP Ranges',
      snippet: '45.67.89.0/24 associated with known threat actor group...',
      source: 'Threat Feed',
      similarity: 0.76,
      date: '2024-01-12'
    }
  ];

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'log': return <FileText className="w-4 h-4" />;
      case 'network': return <Link className="w-4 h-4" />;
      case 'behavior': return <Brain className="w-4 h-4" />;
      default: return <Eye className="w-4 h-4" />;
    }
  };

  const getRelevanceColor = (relevance: string) => {
    switch (relevance) {
      case 'high': return 'text-red-400 bg-red-950';
      case 'medium': return 'text-yellow-400 bg-yellow-950';
      case 'low': return 'text-green-400 bg-green-950';
      default: return 'text-gray-400 bg-gray-950';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
      {/* Evidence Panel */}
      <div className="lg:col-span-1 bg-slate-900 rounded-lg border border-slate-700">
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white flex items-center space-x-2">
            <Shield className="w-5 h-5 text-blue-400" />
            <span>Evidence Collection</span>
          </h2>
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search evidence..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
        
        <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
          {evidenceItems.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedEvidence(item.id)}
              className={`p-4 rounded-lg border cursor-pointer transition-all ${
                selectedEvidence === item.id
                  ? 'border-blue-500 bg-blue-950/50'
                  : 'border-slate-700 bg-slate-800 hover:border-slate-600'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-2">
                  {getTypeIcon(item.type)}
                  <span className="text-sm font-medium text-white">{item.source}</span>
                </div>
                <span className={`px-2 py-1 text-xs rounded ${getRelevanceColor(item.relevance)}`}>
                  {item.relevance}
                </span>
              </div>
              
              <p className="text-sm text-slate-300 mb-3">{item.content}</p>
              
              <div className="flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>{item.timestamp}</span>
                </div>
                <span>Confidence: {Math.round(item.confidence * 100)}%</span>
              </div>
              
              <div className="mt-2 flex flex-wrap gap-1">
                {item.tags.map((tag) => (
                  <span key={tag} className="px-2 py-1 text-xs bg-slate-700 text-slate-300 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Analysis Panel */}
      <div className="lg:col-span-1 bg-slate-900 rounded-lg border border-slate-700">
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white flex items-center space-x-2">
            <Brain className="w-5 h-5 text-purple-400" />
            <span>AI Analysis</span>
          </h2>
        </div>
        
        <div className="p-6">
          {selectedEvidence ? (
            <div className="space-y-4">
              <div className="p-4 bg-slate-800 rounded-lg">
                <h3 className="text-sm font-semibold text-white mb-2">Attack Vector Analysis</h3>
                <p className="text-sm text-slate-300">
                  The evidence suggests a multi-stage attack involving initial access through compromised credentials, 
                  lateral movement across EC2 instances, and potential data exfiltration. The attacker appears to be 
                  following techniques documented in MITRE ATT&CK framework.
                </p>
              </div>
              
              <div className="p-4 bg-slate-800 rounded-lg">
                <h3 className="text-sm font-semibold text-white mb-2">Threat Actor Attribution</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">APT Group Match</span>
                    <span className="text-green-400">78% likely</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Known TTP Overlap</span>
                    <span className="text-yellow-400">5 techniques</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Infrastructure Reuse</span>
                    <span className="text-red-400">High confidence</span>
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-slate-800 rounded-lg">
                <h3 className="text-sm font-semibold text-white mb-2">Recommended Actions</h3>
                <ul className="space-y-1 text-sm text-slate-300">
                  <li>• Isolate affected instances immediately</li>
                  <li>• Reset all potentially compromised credentials</li>
                  <li>• Block malicious IP ranges at network perimeter</li>
                  <li>• Collect memory dumps for forensic analysis</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-slate-400">
              <div className="text-center">
                <Eye className="w-12 h-12 mx-auto mb-4 text-slate-600" />
                <p>Select evidence item to view analysis</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RAG Results Panel */}
      <div className="lg:col-span-1 bg-slate-900 rounded-lg border border-slate-700">
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white flex items-center space-x-2">
            <Search className="w-5 h-5 text-green-400" />
            <span>Knowledge Base</span>
          </h2>
          <p className="text-sm text-slate-400 mt-1">Similar patterns & threat intelligence</p>
        </div>
        
        <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
          {ragResults.map((result) => (
            <div key={result.id} className="p-4 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors cursor-pointer">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-sm font-semibold text-white">{result.title}</h3>
                <span className="text-xs text-green-400 bg-green-950 px-2 py-1 rounded">
                  {Math.round(result.similarity * 100)}%
                </span>
              </div>
              
              <p className="text-sm text-slate-300 mb-3">{result.snippet}</p>
              
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{result.source}</span>
                <span>{result.date}</span>
              </div>
            </div>
          ))}
        </div>
        
        <div className="p-6 border-t border-slate-700">
          <button className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
            Search More Results
          </button>
        </div>
      </div>
    </div>
  );
}