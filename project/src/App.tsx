import React, { useState, useEffect } from 'react';
import { Shield, Activity, AlertTriangle, CheckCircle, Clock, Brain, Search, Users, Settings } from 'lucide-react';
import ThreatDashboard from './components/ThreatDashboard';
import InvestigationWorkbench from './components/InvestigationWorkbench';
import AgentManager from './components/AgentManager';
import SettingsPanel from './components/SettingsPanel';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [threatLevel, setThreatLevel] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');

  const tabs = [
    { id: 'dashboard', label: 'Threat Dashboard', icon: Activity },
    { id: 'investigation', label: 'Investigation', icon: Search },
    { id: 'agents', label: 'Agent Manager', icon: Brain },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  const getThreatLevelColor = () => {
    switch (threatLevel) {
      case 'critical': return 'text-red-400';
      case 'high': return 'text-orange-400';
      case 'medium': return 'text-yellow-400';
      default: return 'text-green-400';
    }
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'dashboard':
        return <ThreatDashboard onThreatLevelChange={setThreatLevel} />;
      case 'investigation':
        return <InvestigationWorkbench />;
      case 'agents':
        return <AgentManager />;
      case 'settings':
        return <SettingsPanel />;
      default:
        return <ThreatDashboard onThreatLevelChange={setThreatLevel} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 bg-blue-600 rounded-lg">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">CloudGuard AI</h1>
              <p className="text-sm text-slate-400">Security Operations Center</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${threatLevel === 'critical' ? 'bg-red-500' : threatLevel === 'high' ? 'bg-orange-500' : threatLevel === 'medium' ? 'bg-yellow-500' : 'bg-green-500'} animate-pulse`}></div>
              <span className={`text-sm font-medium ${getThreatLevelColor()}`}>
                Threat Level: {threatLevel.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center space-x-1 text-sm text-slate-400">
              <Users className="w-4 h-4" />
              <span>3 Analysts</span>
            </div>
          </div>
        </div>
        
        {/* Navigation */}
        <nav className="px-6">
          <div className="flex space-x-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium rounded-t-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-slate-800 text-white border-b-2 border-blue-500'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="p-6">
        {renderActiveTab()}
      </main>
    </div>
  );
}