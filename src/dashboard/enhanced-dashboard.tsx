import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// Types
interface ThreatMetrics {
  totalEvents: number;
  highRiskEvents: number;
  activeHunts: number;
  resolvedIncidents: number;
  threatScore: number;
  confidence: number;
}

interface SecurityEvent {
  id: string;
  timestamp: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  source: string;
  eventType: string;
  threatScore: number;
  mitreTechniques: string[];
  status: 'NEW' | 'INVESTIGATING' | 'RESOLVED';
}

interface AgentStatus {
  agentType: string;
  status: 'HEALTHY' | 'DEGRADED' | 'FAILED';
  tasksCompleted: number;
  averageResponseTime: number;
  lastActivity: string;
}

interface HuntQuery {
  id: string;
  name: string;
  status: 'ACTIVE' | 'COMPLETED' | 'FAILED';
  findings: number;
  confidence: number;
  lastRun: string;
}

interface ThreatIntelligence {
  source: string;
  title: string;
  confidence: number;
  tlp: string;
  tags: string[];
  created: string;
}

// Main Dashboard Component
export const EnhancedThreatHuntingDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<ThreatMetrics | null>(null);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [hunts, setHunts] = useState<HuntQuery[]>([]);
  const [threatIntel, setThreatIntel] = useState<ThreatIntelligence[]>([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  // API endpoints
  const API_BASE = process.env.REACT_APP_API_ENDPOINT || '/api';

  // Fetch data functions
  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/metrics?timeRange=${selectedTimeRange}`);
      const data = await response.json();
      setMetrics(data);
    } catch (error) {
      console.error('Error fetching metrics:', error);
    }
  }, [selectedTimeRange, API_BASE]);

  const fetchEvents = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/events?limit=50&timeRange=${selectedTimeRange}`);
      const data = await response.json();
      setEvents(data.events || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  }, [selectedTimeRange, API_BASE]);

  const fetchAgentStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/agents/status`);
      const data = await response.json();
      setAgents(data.agents || []);
    } catch (error) {
      console.error('Error fetching agent status:', error);
    }
  }, [API_BASE]);

  const fetchHuntQueries = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/hunts?status=active`);
      const data = await response.json();
      setHunts(data.hunts || []);
    } catch (error) {
      console.error('Error fetching hunt queries:', error);
    }
  }, [API_BASE]);

  const fetchThreatIntel = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/threat-intel?limit=20&timeRange=${selectedTimeRange}`);
      const data = await response.json();
      setThreatIntel(data.intelligence || []);
    } catch (error) {
      console.error('Error fetching threat intelligence:', error);
    }
  }, [selectedTimeRange, API_BASE]);

  // Initialize dashboard
  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      await Promise.all([
        fetchMetrics(),
        fetchEvents(),
        fetchAgentStatus(),
        fetchHuntQueries(),
        fetchThreatIntel()
      ]);
      setLoading(false);
    };

    loadDashboard();
  }, [fetchMetrics, fetchEvents, fetchAgentStatus, fetchHuntQueries, fetchThreatIntel]);

  // Auto-refresh data
  useEffect(() => {
    const interval = setInterval(() => {
      fetchMetrics();
      fetchEvents();
      fetchAgentStatus();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [fetchMetrics, fetchEvents, fetchAgentStatus]);

  // Agent interaction functions
  const invokeAgent = async (agentType: string, query: string) => {
    try {
      const response = await fetch(`${API_BASE}/agents/invoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_type: agentType,
          query,
          session_id: `dashboard-${Date.now()}`
        })
      });
      
      const result = await response.json();
      return result.response;
    } catch (error) {
      console.error('Error invoking agent:', error);
      return 'Error: Failed to invoke agent';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-white text-xl">Loading THRAG Dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-blue-400">🛡️ THRAG</h1>
            <span className="text-gray-400">Threat Hunting & Response Platform</span>
          </div>
          
          <div className="flex items-center space-x-4">
            <select
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-white"
            >
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
            
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-400">Live</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="mt-4">
          <div className="flex space-x-6">
            {['overview', 'agents', 'hunts', 'intelligence', 'events'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-2 rounded-md text-sm font-medium capitalize ${
                  activeTab === tab
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="p-6">
        {activeTab === 'overview' && (
          <OverviewTab metrics={metrics} events={events} agents={agents} />
        )}
        
        {activeTab === 'agents' && (
          <AgentsTab agents={agents} onInvokeAgent={invokeAgent} />
        )}
        
        {activeTab === 'hunts' && (
          <HuntsTab hunts={hunts} />
        )}
        
        {activeTab === 'intelligence' && (
          <IntelligenceTab threatIntel={threatIntel} />
        )}
        
        {activeTab === 'events' && (
          <EventsTab events={events} />
        )}
      </main>
    </div>
  );
};

// Overview Tab Component
const OverviewTab: React.FC<{
  metrics: ThreatMetrics | null;
  events: SecurityEvent[];
  agents: AgentStatus[];
}> = ({ metrics, events, agents }) => {
  // Prepare chart data
  const eventsByHour = events.reduce((acc, event) => {
    const hour = new Date(event.timestamp).getHours();
    acc[hour] = (acc[hour] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  const hourlyData = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    events: eventsByHour[i] || 0
  }));

  const severityData = events.reduce((acc, event) => {
    acc[event.severity] = (acc[event.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const severityChartData = Object.entries(severityData).map(([severity, count]) => ({
    name: severity,
    value: count,
    color: {
      CRITICAL: '#ef4444',
      HIGH: '#f97316',
      MEDIUM: '#eab308',
      LOW: '#22c55e'
    }[severity] || '#6b7280'
  }));

  return (
    <div className="space-y-6">
      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Events"
          value={metrics?.totalEvents || 0}
          icon="📊"
          trend="+12%"
        />
        <MetricCard
          title="High Risk Events"
          value={metrics?.highRiskEvents || 0}
          icon="⚠️"
          trend="-5%"
          trendColor="text-green-400"
        />
        <MetricCard
          title="Active Hunts"
          value={metrics?.activeHunts || 0}
          icon="🎯"
          trend="+3"
        />
        <MetricCard
          title="Threat Score"
          value={`${((metrics?.threatScore || 0) * 100).toFixed(1)}%`}
          icon="🛡️"
          trend="-2%"
          trendColor="text-green-400"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Events Timeline */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Events by Hour</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={hourlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="hour" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '6px'
                }}
              />
              <Area
                type="monotone"
                dataKey="events"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Severity Distribution */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Events by Severity</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={severityChartData}
                cx="50%"
                cy="50%"
                outerRadius={100}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {severityChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Agent Status Overview */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Agent Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {agents.map((agent) => (
            <div key={agent.agentType} className="text-center">
              <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-2 ${
                agent.status === 'HEALTHY' ? 'bg-green-600' :
                agent.status === 'DEGRADED' ? 'bg-yellow-600' : 'bg-red-600'
              }`}>
                {getAgentIcon(agent.agentType)}
              </div>
              <div className="text-sm font-medium capitalize">
                {agent.agentType.replace('_', ' ')}
              </div>
              <div className="text-xs text-gray-400">{agent.status}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Agents Tab Component
const AgentsTab: React.FC<{
  agents: AgentStatus[];
  onInvokeAgent: (agentType: string, query: string) => Promise<string>;
}> = ({ agents, onInvokeAgent }) => {
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [query, setQuery] = useState<string>('');
  const [response, setResponse] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleInvokeAgent = async () => {
    if (!selectedAgent || !query.trim()) return;

    setLoading(true);
    try {
      const result = await onInvokeAgent(selectedAgent, query);
      setResponse(result);
    } catch (error) {
      setResponse('Error: Failed to invoke agent');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Agent Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.map((agent) => (
          <div key={agent.agentType} className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  agent.status === 'HEALTHY' ? 'bg-green-600' :
                  agent.status === 'DEGRADED' ? 'bg-yellow-600' : 'bg-red-600'
                }`}>
                  {getAgentIcon(agent.agentType)}
                </div>
                <div>
                  <h3 className="font-semibold capitalize">
                    {agent.agentType.replace('_', ' ')}
                  </h3>
                  <p className="text-sm text-gray-400">{agent.status}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Tasks Completed:</span>
                <span>{agent.tasksCompleted}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Avg Response:</span>
                <span>{agent.averageResponseTime}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Last Activity:</span>
                <span>{new Date(agent.lastActivity).toLocaleTimeString()}</span>
              </div>
            </div>

            <button
              onClick={() => setSelectedAgent(agent.agentType)}
              className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md text-sm font-medium"
            >
              Interact
            </button>
          </div>
        ))}
      </div>

      {/* Agent Interaction Panel */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Agent Interaction</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Select Agent:</label>
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2"
            >
              <option value="">Choose an agent...</option>
              {agents.map((agent) => (
                <option key={agent.agentType} value={agent.agentType}>
                  {agent.agentType.replace('_', ' ').toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Query:</label>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter your security query..."
              className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 h-24 resize-none"
            />
          </div>

          <button
            onClick={handleInvokeAgent}
            disabled={!selectedAgent || !query.trim() || loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-2 px-6 rounded-md font-medium"
          >
            {loading ? 'Processing...' : 'Invoke Agent'}
          </button>

          {response && (
            <div className="mt-4">
              <label className="block text-sm font-medium mb-2">Response:</label>
              <div className="bg-gray-700 border border-gray-600 rounded-md p-4 whitespace-pre-wrap">
                {response}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Additional tab components would be implemented similarly...
// For brevity, I'll include the helper components and functions

// Helper Components
const MetricCard: React.FC<{
  title: string;
  value: string | number;
  icon: string;
  trend?: string;
  trendColor?: string;
}> = ({ title, value, icon, trend, trendColor = "text-blue-400" }) => (
  <div className="bg-gray-800 rounded-lg p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-gray-400 text-sm">{title}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
        {trend && (
          <p className={`text-sm mt-1 ${trendColor}`}>
            {trend}
          </p>
        )}
      </div>
      <div className="text-3xl">{icon}</div>
    </div>
  </div>
);

// Placeholder components for other tabs
const HuntsTab: React.FC<{ hunts: HuntQuery[] }> = ({ hunts }) => (
  <div className="bg-gray-800 rounded-lg p-6">
    <h3 className="text-lg font-semibold mb-4">Active Hunt Queries</h3>
    <div className="space-y-4">
      {hunts.map((hunt) => (
        <div key={hunt.id} className="border border-gray-700 rounded-lg p-4">
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-medium">{hunt.name}</h4>
              <p className="text-sm text-gray-400">Status: {hunt.status}</p>
              <p className="text-sm text-gray-400">Findings: {hunt.findings}</p>
            </div>
            <div className="text-right">
              <p className="text-sm">Confidence: {(hunt.confidence * 100).toFixed(1)}%</p>
              <p className="text-xs text-gray-400">{hunt.lastRun}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const IntelligenceTab: React.FC<{ threatIntel: ThreatIntelligence[] }> = ({ threatIntel }) => (
  <div className="bg-gray-800 rounded-lg p-6">
    <h3 className="text-lg font-semibold mb-4">Recent Threat Intelligence</h3>
    <div className="space-y-4">
      {threatIntel.map((intel, index) => (
        <div key={index} className="border border-gray-700 rounded-lg p-4">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h4 className="font-medium">{intel.title}</h4>
              <p className="text-sm text-gray-400">Source: {intel.source}</p>
              <div className="flex space-x-2 mt-2">
                {intel.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="bg-blue-600 text-xs px-2 py-1 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm">TLP: {intel.tlp}</p>
              <p className="text-sm">Confidence: {(intel.confidence * 100).toFixed(1)}%</p>
              <p className="text-xs text-gray-400">{intel.created}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const EventsTab: React.FC<{ events: SecurityEvent[] }> = ({ events }) => (
  <div className="bg-gray-800 rounded-lg p-6">
    <h3 className="text-lg font-semibold mb-4">Recent Security Events</h3>
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-700">
            <th className="text-left py-2">Timestamp</th>
            <th className="text-left py-2">Severity</th>
            <th className="text-left py-2">Source</th>
            <th className="text-left py-2">Type</th>
            <th className="text-left py-2">Threat Score</th>
            <th className="text-left py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id} className="border-b border-gray-700">
              <td className="py-2">{new Date(event.timestamp).toLocaleString()}</td>
              <td className="py-2">
                <span className={`px-2 py-1 rounded text-xs ${
                  event.severity === 'CRITICAL' ? 'bg-red-600' :
                  event.severity === 'HIGH' ? 'bg-orange-600' :
                  event.severity === 'MEDIUM' ? 'bg-yellow-600' : 'bg-green-600'
                }`}>
                  {event.severity}
                </span>
              </td>
              <td className="py-2">{event.source}</td>
              <td className="py-2">{event.eventType}</td>
              <td className="py-2">{(event.threatScore * 100).toFixed(1)}%</td>
              <td className="py-2">
                <span className={`px-2 py-1 rounded text-xs ${
                  event.status === 'NEW' ? 'bg-blue-600' :
                  event.status === 'INVESTIGATING' ? 'bg-yellow-600' : 'bg-green-600'
                }`}>
                  {event.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// Helper function to get agent icons
const getAgentIcon = (agentType: string): string => {
  const icons: Record<string, string> = {
    'threat_hunter': '🎯',
    'intelligence_analyst': '🔍',
    'incident_commander': '⚡',
    'forensics_investigator': '🔬',
    'compliance_advisor': '📋',
    'communication_specialist': '📢'
  };
  return icons[agentType] || '🤖';
};

export default EnhancedThreatHuntingDashboard;