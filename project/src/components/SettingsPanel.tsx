import React, { useState } from 'react';
import { Settings, Shield, Bell, Database, Cloud, Key } from 'lucide-react';

export default function SettingsPanel() {
  const [activeSection, setActiveSection] = useState('general');

  const sections = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'integrations', label: 'Integrations', icon: Cloud },
    { id: 'storage', label: 'Storage', icon: Database }
  ];

  const renderGeneralSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">System Configuration</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Organization Name</label>
            <input
              type="text"
              defaultValue="CloudGuard Security Operations"
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Threat Level Threshold</label>
            <select className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white">
              <option>Critical</option>
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-400">Enable Real-time Monitoring</span>
            <button className="w-12 h-6 bg-blue-600 rounded-full p-1 transition-colors">
              <div className="w-4 h-4 bg-white rounded-full transform translate-x-6"></div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSecuritySettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">AgentCore Security</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Agent Runtime Isolation</label>
            <select className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white">
              <option>Strict (Recommended)</option>
              <option>Standard</option>
              <option>Minimal</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Identity Provider</label>
            <div className="flex items-center space-x-2">
              <Key className="w-4 h-4 text-blue-400" />
              <span className="text-white">AgentCore Identity (Active)</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-400">Require Manual Approval for High-Risk Actions</span>
            <button className="w-12 h-6 bg-blue-600 rounded-full p-1 transition-colors">
              <div className="w-4 h-4 bg-white rounded-full transform translate-x-6"></div>
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-400">Enable Audit Logging</span>
            <button className="w-12 h-6 bg-blue-600 rounded-full p-1 transition-colors">
              <div className="w-4 h-4 bg-white rounded-full transform translate-x-6"></div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderNotificationSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Alert Configuration</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-400">Critical Threats</span>
            <button className="w-12 h-6 bg-blue-600 rounded-full p-1 transition-colors">
              <div className="w-4 h-4 bg-white rounded-full transform translate-x-6"></div>
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-400">High Threats</span>
            <button className="w-12 h-6 bg-blue-600 rounded-full p-1 transition-colors">
              <div className="w-4 h-4 bg-white rounded-full transform translate-x-6"></div>
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-400">Agent Actions</span>
            <button className="w-12 h-6 bg-slate-600 rounded-full p-1 transition-colors">
              <div className="w-4 h-4 bg-white rounded-full"></div>
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Notification Channels</label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input type="checkbox" defaultChecked className="rounded" />
                <span className="text-white">Email</span>
              </div>
              <div className="flex items-center space-x-2">
                <input type="checkbox" defaultChecked className="rounded" />
                <span className="text-white">Slack</span>
              </div>
              <div className="flex items-center space-x-2">
                <input type="checkbox" className="rounded" />
                <span className="text-white">SMS</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderIntegrationSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">AWS Services</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-800 rounded-lg">
            <div>
              <span className="text-white font-medium">Amazon Bedrock AgentCore</span>
              <p className="text-sm text-slate-400">Runtime and identity management</p>
            </div>
            <span className="px-3 py-1 bg-green-900 text-green-400 rounded-full text-sm">Connected</span>
          </div>
          <div className="flex items-center justify-between p-4 bg-slate-800 rounded-lg">
            <div>
              <span className="text-white font-medium">S3 Vectors</span>
              <p className="text-sm text-slate-400">Vector storage and retrieval</p>
            </div>
            <span className="px-3 py-1 bg-green-900 text-green-400 rounded-full text-sm">Connected</span>
          </div>
          <div className="flex items-center justify-between p-4 bg-slate-800 rounded-lg">
            <div>
              <span className="text-white font-medium">SageMaker</span>
              <p className="text-sm text-slate-400">ML model deployment</p>
            </div>
            <span className="px-3 py-1 bg-green-900 text-green-400 rounded-full text-sm">Connected</span>
          </div>
          <div className="flex items-center justify-between p-4 bg-slate-800 rounded-lg">
            <div>
              <span className="text-white font-medium">GuardDuty</span>
              <p className="text-sm text-slate-400">Threat detection service</p>
            </div>
            <button className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-sm transition-colors">
              Connect
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStorageSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Data Management</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Log Retention Period</label>
            <select className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white">
              <option>30 Days</option>
              <option>90 Days</option>
              <option>1 Year</option>
              <option>7 Years (Compliance)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Vector Index Storage</label>
            <div className="p-4 bg-slate-800 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-white">S3 Vectors Storage</span>
                <span className="text-green-400">2.3 TB</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: '23%' }}></div>
              </div>
              <p className="text-xs text-slate-400 mt-1">23% of allocated storage used</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-400">Auto-Archive Old Data</span>
            <button className="w-12 h-6 bg-blue-600 rounded-full p-1 transition-colors">
              <div className="w-4 h-4 bg-white rounded-full transform translate-x-6"></div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'general': return renderGeneralSettings();
      case 'security': return renderSecuritySettings();
      case 'notifications': return renderNotificationSettings();
      case 'integrations': return renderIntegrationSettings();
      case 'storage': return renderStorageSettings();
      default: return renderGeneralSettings();
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Settings Navigation */}
      <div className="lg:col-span-1 bg-slate-900 rounded-lg border border-slate-700">
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Settings</h2>
        </div>
        <div className="p-6">
          <nav className="space-y-2">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2 text-left rounded-lg transition-colors ${
                    activeSection === section.id
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{section.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Settings Content */}
      <div className="lg:col-span-3 bg-slate-900 rounded-lg border border-slate-700">
        <div className="p-6">
          {renderActiveSection()}
          
          <div className="mt-8 pt-6 border-t border-slate-700 flex justify-end space-x-3">
            <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">
              Cancel
            </button>
            <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}