import React, { useState, useEffect } from 'react';
import { AlertTriangle, Shield, Activity, Clock, CheckCircle, XCircle, Brain, Zap } from 'lucide-react';

interface ThreatDashboardProps {
  onThreatLevelChange: (level: 'low' | 'medium' | 'high' | 'critical') => void;
}

export default function ThreatDashboard({ onThreatLevelChange }: ThreatDashboardProps) {
  const [alerts, setAlerts] = useState([
    {
      id: '1',
      type: 'critical',
      title: 'Multi-Stage Attack Detected',
      description: 'Lateral movement detected across 3 EC2 instances with credential harvesting attempts',
      timestamp: new Date(Date.now() - 5 * 60000),
      source: 'CloudTrail + VPC Flow Logs',
      confidence: 0.94,
      status: 'active',
      evidence: ['Unusual API calls', 'Network anomalies', 'Failed authentication spikes']
    },
    {
      id: '2',
      type: 'high',
      title: 'Data Exfiltration Attempt',
      description: 'Large S3 data transfer to unknown external IP',
      timestamp: new Date(Date.now() - 15 * 60000),
      source: 'S3 Access Logs',
      confidence: 0.87,
      status: 'investigating',
      evidence: ['Unusual transfer patterns', 'Unrecognized destination', 'Off-hours activity']
    },
    {
      id: '3',
      type: 'medium',
      title: 'Privilege Escalation',
      description: 'User attempting to assume administrative roles',
      timestamp: new Date(Date.now() - 30 * 60000),
      source: 'IAM CloudTrail',
      confidence: 0.76,
      status: 'contained',
      evidence: ['AssumeRole attempts', 'Policy modifications', 'Permission enumeration']
    }
  ]);

  const [agentActions, setAgentActions] = useState([
    {
      id: '1',
      action: 'Instance Isolation',
      target: 'i-1234567890abcdef0',
      status: 'completed',
      timestamp: new Date(Date.now() - 2 * 60000),
      reasoning: 'High-confidence lateral movement detected. Isolated instance to prevent spread.',
      approval: 'auto'
    },
    {
      id: '2',
      action: 'IP Block Request',
      target: '192.168.1.100',
      status: 'pending_approval',
      timestamp: new Date(Date.now() - 1 * 60000),
      reasoning: 'Suspicious data exfiltration destination. Recommend blocking at WAF level.',
      approval: 'manual'
    }
  ]);

  useEffect(() => {
    const criticalAlerts = alerts.filter(a => a.type === 'critical' && a.status === 'active').length;
    if (criticalAlerts > 0) {
      onThreatLevelChange('critical');
    } else if (alerts.filter(a => a.type === 'high' && a.status === 'active').length > 0) {
      onThreatLevelChange('high');
    } else if (alerts.filter(a => ['high', 'medium'].includes(a.type) && a.status === 'active').length > 0) {
      onThreatLevelChange('medium');
    } else {
      onThreatLevelChange('low');
    }
  }, [alerts, onThreatLevelChange]);

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'critical': return 'border-red-500 bg-red-950/50';
      case 'high': return 'border-orange-500 bg-orange-950/50';
      case 'medium': return 'border-yellow-500 bg-yellow-950/50';
      default: return 'border-green-500 bg-green-950/50';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-red-400';
      case 'investigating': return 'text-yellow-400';
      case 'contained': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  const formatTimeAgo = (timestamp: Date) => {
    const minutes = Math.floor((Date.now() - timestamp.getTime()) / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes === 1) return '1 minute ago';
    if (minutes < 60) return `${minutes} minutes ago`;
    const hours = Math.floor(minutes / 60);
    if (hours === 1) return '1 hour ago';
    return `${hours} hours ago`;
  };

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-slate-900 p-6 rounded-lg border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Active Threats</p>
              <p className="text-2xl font-bold text-red-400">
                {alerts.filter(a => a.status === 'active').length}
              </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
        </div>

        <div className="bg-slate-900 p-6 rounded-lg border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Systems Protected</p>
              <p className="text-2xl font-bold text-green-400">247</p>
            </div>
            <Shield className="w-8 h-8 text-green-400" />
          </div>
        </div>

        <div className="bg-slate-900 p-6 rounded-lg border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Agent Actions</p>
              <p className="text-2xl font-bold text-blue-400">
                {agentActions.filter(a => a.status === 'completed').length}
              </p>
            </div>
            <Brain className="w-8 h-8 text-blue-400" />
          </div>
        </div>

        <div className="bg-slate-900 p-6 rounded-lg border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Detection Rate</p>
              <p className="text-2xl font-bold text-purple-400">94.2%</p>
            </div>
            <Activity className="w-8 h-8 text-purple-400" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Threats */}
        <div className="bg-slate-900 rounded-lg border border-slate-700">
          <div className="p-6 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-white flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <span>Active Threats</span>
            </h2>
          </div>
          <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
            {alerts.map((alert) => (
              <div key={alert.id} className={`p-4 rounded-lg border-l-4 ${getAlertColor(alert.type)}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="font-semibold text-white">{alert.title}</h3>
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(alert.status)} bg-slate-800`}>
                        {alert.status}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300 mb-2">{alert.description}</p>
                    <div className="flex items-center space-x-4 text-xs text-slate-400">
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>{formatTimeAgo(alert.timestamp)}</span>
                      </span>
                      <span>Confidence: {Math.round(alert.confidence * 100)}%</span>
                      <span>{alert.source}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {alert.evidence.map((evidence, idx) => (
                    <span key={idx} className="px-2 py-1 text-xs bg-slate-800 text-slate-300 rounded">
                      {evidence}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Agent Actions */}
        <div className="bg-slate-900 rounded-lg border border-slate-700">
          <div className="p-6 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-white flex items-center space-x-2">
              <Brain className="w-5 h-5 text-blue-400" />
              <span>Agent Actions</span>
            </h2>
          </div>
          <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
            {agentActions.map((action) => (
              <div key={action.id} className="p-4 bg-slate-800 rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-white">{action.action}</h3>
                    <p className="text-sm text-slate-400">Target: {action.target}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {action.status === 'completed' ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : action.status === 'pending_approval' ? (
                      <Clock className="w-5 h-5 text-yellow-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400" />
                    )}
                    <span className={`text-xs px-2 py-1 rounded ${
                      action.approval === 'auto' ? 'bg-blue-900 text-blue-300' : 'bg-yellow-900 text-yellow-300'
                    }`}>
                      {action.approval === 'auto' ? 'Auto-Executed' : 'Manual Approval'}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-slate-300 mb-2">{action.reasoning}</p>
                <div className="flex items-center space-x-2 text-xs text-slate-400">
                  <Clock className="w-3 h-3" />
                  <span>{formatTimeAgo(action.timestamp)}</span>
                  {action.status === 'pending_approval' && (
                    <button className="ml-auto px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors">
                      Approve
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Real-time Activity Feed */}
      <div className="bg-slate-900 rounded-lg border border-slate-700">
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white flex items-center space-x-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            <span>Real-time Activity</span>
          </h2>
        </div>
        <div className="p-6">
          <div className="space-y-3 text-sm">
            <div className="flex items-center space-x-3 text-slate-300">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-slate-400">12:34:56</span>
              <span>Agent successfully isolated suspicious instance i-1234567890abcdef0</span>
            </div>
            <div className="flex items-center space-x-3 text-slate-300">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-slate-400">12:33:21</span>
              <span>RAG retrieval found 23 similar attack patterns in threat intelligence database</span>
            </div>
            <div className="flex items-center space-x-3 text-slate-300">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
              <span className="text-slate-400">12:32:45</span>
              <span>Anomaly model detected suspicious network traffic (confidence: 87%)</span>
            </div>
            <div className="flex items-center space-x-3 text-slate-300">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-slate-400">12:30:12</span>
              <span>Multi-stage attack progression identified across 3 cloud resources</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}