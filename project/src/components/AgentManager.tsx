import React, { useState } from 'react';
import { Brain, Activity, Pause, Play, Settings, AlertCircle, CheckCircle, Clock } from 'lucide-react';

export default function AgentManager() {
  const [agents, setAgents] = useState([
    {
      id: 'agent-001',
      name: 'Threat Hunter Alpha',
      type: 'detection',
      status: 'active',
      performance: 0.94,
      lastAction: 'Detected lateral movement pattern',
      actionsToday: 23,
      uptime: '99.7%',
      confidence: 0.87
    },
    {
      id: 'agent-002',
      name: 'Response Coordinator',
      type: 'response',
      status: 'active',
      performance: 0.91,
      lastAction: 'Isolated compromised instance',
      actionsToday: 8,
      uptime: '99.9%',
      confidence: 0.93
    },
    {
      id: 'agent-003',
      name: 'Intelligence Analyst',
      type: 'intelligence',
      status: 'idle',
      performance: 0.88,
      lastAction: 'Updated threat actor profiles',
      actionsToday: 12,
      uptime: '98.2%',
      confidence: 0.79
    }
  ]);

  const [selectedAgent, setSelectedAgent] = useState(agents[0]);

  const toggleAgent = (agentId: string) => {
    setAgents(prev => prev.map(agent => 
      agent.id === agentId 
        ? { ...agent, status: agent.status === 'active' ? 'paused' : 'active' }
        : agent
    ));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400 bg-green-950';
      case 'paused': return 'text-yellow-400 bg-yellow-950';
      case 'idle': return 'text-blue-400 bg-blue-950';
      default: return 'text-gray-400 bg-gray-950';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-4 h-4" />;
      case 'paused': return <Pause className="w-4 h-4" />;
      case 'idle': return <Clock className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Agent List */}
      <div className="lg:col-span-1 bg-slate-900 rounded-lg border border-slate-700">
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white flex items-center space-x-2">
            <Brain className="w-5 h-5 text-blue-400" />
            <span>Active Agents</span>
          </h2>
        </div>
        
        <div className="p-6 space-y-4">
          {agents.map((agent) => (
            <div
              key={agent.id}
              onClick={() => setSelectedAgent(agent)}
              className={`p-4 rounded-lg border cursor-pointer transition-all ${
                selectedAgent.id === agent.id
                  ? 'border-blue-500 bg-blue-950/50'
                  : 'border-slate-700 bg-slate-800 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-white">{agent.name}</h3>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 text-xs rounded flex items-center space-x-1 ${getStatusColor(agent.status)}`}>
                    {getStatusIcon(agent.status)}
                    <span>{agent.status}</span>
                  </span>
                </div>
              </div>
              
              <p className="text-sm text-slate-400 mb-3 capitalize">{agent.type} Agent</p>
              
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Performance: {Math.round(agent.performance * 100)}%</span>
                <span>{agent.actionsToday} actions today</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Agent Details */}
      <div className="lg:col-span-2 bg-slate-900 rounded-lg border border-slate-700">
        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">{selectedAgent.name}</h2>
            <p className="text-sm text-slate-400">Agent ID: {selectedAgent.id}</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => toggleAgent(selectedAgent.id)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                selectedAgent.status === 'active'
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {selectedAgent.status === 'active' ? (
                <>
                  <Pause className="w-4 h-4 inline mr-2" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 inline mr-2" />
                  Resume
                </>
              )}
            </button>
            <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">
              <Settings className="w-4 h-4 inline mr-2" />
              Configure
            </button>
          </div>
        </div>
        
        <div className="p-6">
          {/* Performance Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-slate-800 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Performance Score</p>
                  <p className="text-2xl font-bold text-green-400">
                    {Math.round(selectedAgent.performance * 100)}%
                  </p>
                </div>
                <Activity className="w-8 h-8 text-green-400" />
              </div>
            </div>

            <div className="bg-slate-800 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Uptime</p>
                  <p className="text-2xl font-bold text-blue-400">{selectedAgent.uptime}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-blue-400" />
              </div>
            </div>

            <div className="bg-slate-800 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Actions Today</p>
                  <p className="text-2xl font-bold text-purple-400">{selectedAgent.actionsToday}</p>
                </div>
                <Brain className="w-8 h-8 text-purple-400" />
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-slate-800 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2 animate-pulse"></div>
                <div>
                  <p className="text-sm text-white">{selectedAgent.lastAction}</p>
                  <p className="text-xs text-slate-400">2 minutes ago • Confidence: {Math.round(selectedAgent.confidence * 100)}%</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                <div>
                  <p className="text-sm text-white">Analyzed 1,247 log entries for anomalies</p>
                  <p className="text-xs text-slate-400">15 minutes ago • 3 anomalies detected</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                <div>
                  <p className="text-sm text-white">Updated threat intelligence database</p>
                  <p className="text-xs text-slate-400">1 hour ago • 47 new indicators</p>
                </div>
              </div>
            </div>
          </div>

          {/* Agent Configuration */}
          <div className="mt-6 bg-slate-800 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-white mb-4">Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Detection Sensitivity</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  defaultValue="85"
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>Low</span>
                  <span>High</span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Auto-Response</label>
                <select className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white">
                  <option>Low Risk Only</option>
                  <option>Medium + Low Risk</option>
                  <option>All Actions (Requires Approval)</option>
                  <option>Disabled</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}