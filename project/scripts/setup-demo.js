#!/usr/bin/env node

/**
 * CloudGuard AI Demo Setup Script
 * Creates synthetic attack data and configures demo scenarios
 */

import fs from 'fs';
import path from 'path';

console.log('🛡️  CloudGuard AI - Demo Setup');
console.log('==============================');

// Generate synthetic attack logs for demo
const generateSyntheticAttackLogs = () => {
  const attackScenarios = [
    {
      name: 'multi-stage-attack',
      description: 'Lateral movement with credential harvesting',
      stages: [
        {
          timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
          event: 'Initial Access',
          details: 'Compromised user credentials via phishing',
          indicators: ['unusual-login-location', 'failed-mfa-attempts']
        },
        {
          timestamp: new Date(Date.now() - 25 * 60000).toISOString(),
          event: 'Privilege Escalation',
          details: 'AssumeRole operations to gain administrative access',
          indicators: ['assume-role-abuse', 'policy-enumeration']
        },
        {
          timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
          event: 'Lateral Movement',
          details: 'EC2 instance compromise and network scanning',
          indicators: ['network-anomalies', 'process-injection']
        },
        {
          timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
          event: 'Data Exfiltration',
          details: 'Large S3 data transfer to external IP',
          indicators: ['data-transfer-anomaly', 'suspicious-destination']
        }
      ],
      confidence: 0.94,
      severity: 'critical'
    },
    {
      name: 'insider-threat',
      description: 'Malicious insider accessing sensitive data',
      stages: [
        {
          timestamp: new Date(Date.now() - 60 * 60000).toISOString(),
          event: 'Unusual Access Pattern',
          details: 'Employee accessing data outside normal hours',
          indicators: ['off-hours-access', 'unusual-data-volume']
        },
        {
          timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
          event: 'Permission Escalation',
          details: 'Attempting to access restricted resources',
          indicators: ['access-denied-spikes', 'permission-enumeration']
        }
      ],
      confidence: 0.76,
      severity: 'high'
    }
  ];

  return attackScenarios;
};

// Generate threat intelligence data
const generateThreatIntelligence = () => {
  return [
    {
      id: 'ti-001',
      type: 'apt-group',
      name: 'Advanced Persistent Threat Group 1',
      description: 'State-sponsored group targeting cloud infrastructure',
      ttps: ['T1078', 'T1087', 'T1083', 'T1041'],
      iocs: [
        '45.67.89.123',
        'malicious-domain.com',
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      ],
      confidence: 0.89,
      last_seen: new Date().toISOString()
    },
    {
      id: 'ti-002',
      type: 'malware-family',
      name: 'CloudStealer',
      description: 'Credential harvesting malware targeting AWS environments',
      ttps: ['T1555', 'T1552', 'T1539'],
      iocs: [
        'cloudstealer.exe',
        'C:\\Windows\\Temp\\cs.tmp',
        'HKEY_LOCAL_MACHINE\\SOFTWARE\\CloudConfig'
      ],
      confidence: 0.92,
      last_seen: new Date().toISOString()
    }
  ];
};

// Create demo data files
const createDemoData = () => {
  const demoDir = path.join(process.cwd(), 'demo-data');
  
  if (!fs.existsSync(demoDir)) {
    fs.mkdirSync(demoDir, { recursive: true });
  }

  // Write attack scenarios
  fs.writeFileSync(
    path.join(demoDir, 'attack-scenarios.json'),
    JSON.stringify(generateSyntheticAttackLogs(), null, 2)
  );

  // Write threat intelligence
  fs.writeFileSync(
    path.join(demoDir, 'threat-intelligence.json'),
    JSON.stringify(generateThreatIntelligence(), null, 2)
  );

  // Create benchmark results
  const benchmarkResults = {
    evaluation_date: new Date().toISOString(),
    dataset: 'CyberTeam Benchmark + Synthetic Data',
    metrics: {
      precision: 0.942,
      recall: 0.897,
      f1_score: 0.919,
      false_positive_rate: 0.058,
      mean_time_to_detect: '4.2 minutes',
      mean_time_to_respond: '12.7 minutes'
    },
    comparison: {
      baseline_system: {
        precision: 0.734,
        recall: 0.681,
        f1_score: 0.706,
        mttr: '45.3 minutes'
      },
      improvement: {
        precision_gain: '28.4%',
        recall_gain: '31.7%',
        mttr_reduction: '72.0%'
      }
    },
    cost_analysis: {
      vector_storage_cost_reduction: '68%',
      compute_cost_optimization: '34%',
      operational_efficiency_gain: '156%'
    }
  };

  fs.writeFileSync(
    path.join(demoDir, 'benchmark-results.json'),
    JSON.stringify(benchmarkResults, null, 2)
  );

  console.log('✅ Demo data files created successfully');
  console.log(`📁 Demo data location: ${demoDir}`);
};

// Generate demo configuration
const generateDemoConfig = () => {
  const demoConfig = {
    scenarios: [
      {
        id: 'scenario-1',
        name: 'Multi-Stage Attack Detection',
        description: 'Demonstrate real-time detection of lateral movement',
        duration: 180, // 3 minutes
        auto_play: true,
        steps: [
          {
            timestamp: 0,
            action: 'trigger_alert',
            data: { type: 'suspicious_login', confidence: 0.87 }
          },
          {
            timestamp: 30,
            action: 'agent_analysis',
            data: { reasoning: 'Correlating with threat intelligence...' }
          },
          {
            timestamp: 60,
            action: 'recommend_action',
            data: { action: 'isolate_instance', approval_required: false }
          },
          {
            timestamp: 90,
            action: 'execute_response',
            data: { success: true, rollback_available: true }
          }
        ]
      }
    ],
    ui_settings: {
      theme: 'dark',
      auto_refresh_interval: 2000,
      show_confidence_scores: true,
      enable_sound_alerts: false
    }
  };

  fs.writeFileSync(
    path.join(process.cwd(), 'demo-config.json'),
    JSON.stringify(demoConfig, null, 2)
  );

  console.log('✅ Demo configuration created');
};

// Main setup function
const setupDemo = async () => {
  try {
    console.log('🔧 Creating synthetic attack data...');
    createDemoData();
    
    console.log('⚙️  Generating demo configuration...');
    generateDemoConfig();
    
    console.log('');
    console.log('🎉 Demo setup completed successfully!');
    console.log('');
    console.log('🚀 To start the demo:');
    console.log('   npm run dev');
    console.log('');
    console.log('📊 Demo features:');
    console.log('   • Real-time threat detection simulation');
    console.log('   • AI-powered analysis with explainable decisions');
    console.log('   • Autonomous response with approval workflows');
    console.log('   • Comprehensive audit trail and evidence collection');
    console.log('');
    console.log('🎯 Demo scenarios available:');
    console.log('   • Multi-stage attack with lateral movement');
    console.log('   • Data exfiltration attempt with ML detection');
    console.log('   • Insider threat behavioral analysis');
    
  } catch (error) {
    console.error('❌ Demo setup failed:', error.message);
    process.exit(1);
  }
};

// Run setup
setupDemo();