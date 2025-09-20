# Security Policy

## Supported Versions

We actively support the following versions of THRAG with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of THRAG seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### How to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to: **security@thrag.ai**

Include the following information in your report:
- Type of issue (e.g. buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit the issue

### What to Expect

- **Acknowledgment**: We will acknowledge receipt of your vulnerability report within 48 hours.
- **Initial Assessment**: We will provide an initial assessment within 5 business days.
- **Regular Updates**: We will keep you informed of our progress throughout the investigation.
- **Resolution**: We aim to resolve critical vulnerabilities within 30 days.

### Responsible Disclosure

We kindly ask that you:
- Give us reasonable time to investigate and fix the issue before public disclosure
- Avoid accessing, modifying, or deleting data that doesn't belong to you
- Don't perform actions that could harm the reliability or integrity of our services
- Don't access accounts or data that don't belong to you

## Security Best Practices

### For Users

When deploying THRAG, please follow these security best practices:

#### AWS Security
- **IAM Roles**: Use least privilege principle for all IAM roles
- **Secrets Management**: Store all API keys and secrets in AWS Secrets Manager
- **Network Security**: Deploy in private subnets with proper security groups
- **Encryption**: Enable encryption at rest and in transit for all data
- **Monitoring**: Enable CloudTrail and GuardDuty for security monitoring

#### Application Security
- **API Keys**: Rotate API keys regularly
- **Access Control**: Implement proper authentication and authorization
- **Input Validation**: Validate all inputs to prevent injection attacks
- **Logging**: Enable comprehensive logging for security events
- **Updates**: Keep all dependencies and components up to date

#### Data Protection
- **Data Classification**: Classify and handle data according to sensitivity
- **Data Retention**: Implement appropriate data retention policies
- **Backup Security**: Secure all backups with encryption and access controls
- **Data Minimization**: Only collect and process necessary data

### For Developers

#### Secure Development
- **Code Review**: All code changes require security review
- **Static Analysis**: Use automated security scanning tools
- **Dependency Scanning**: Regularly scan dependencies for vulnerabilities
- **Secrets Scanning**: Never commit secrets to version control
- **Security Testing**: Include security tests in CI/CD pipeline

#### Infrastructure Security
- **Infrastructure as Code**: Use CDK/CloudFormation for all infrastructure
- **Security Groups**: Implement restrictive security group rules
- **Encryption**: Encrypt all data at rest and in transit
- **Monitoring**: Implement comprehensive security monitoring
- **Incident Response**: Have incident response procedures in place

## Security Features

THRAG includes several built-in security features:

### Authentication & Authorization
- AWS IAM integration for access control
- Role-based access to different system components
- API Gateway authentication and authorization

### Data Protection
- Encryption at rest for all stored data
- Encryption in transit for all communications
- Secure handling of threat intelligence data
- TLP (Traffic Light Protocol) compliance

### Network Security
- VPC deployment with private subnets
- Security groups with least privilege access
- WAF protection for web interfaces
- DDoS protection via CloudFront

### Monitoring & Logging
- Comprehensive CloudWatch logging
- Security event monitoring and alerting
- Audit trails for all system actions
- Integration with AWS Security Hub

### Threat Intelligence Security
- Secure ingestion of threat intelligence feeds
- Validation and sanitization of external data
- Confidence scoring and source attribution
- Secure storage and retrieval of intelligence data

## Compliance

THRAG is designed to support compliance with various security frameworks:

- **SOC 2 Type II**: Security, availability, and confidentiality controls
- **ISO 27001**: Information security management system
- **NIST Cybersecurity Framework**: Comprehensive cybersecurity controls
- **GDPR**: Data protection and privacy requirements (where applicable)

## Security Contacts

- **Security Team**: security@thrag.ai
- **General Inquiries**: info@thrag.ai
- **Emergency Contact**: Available 24/7 for critical security issues

## Acknowledgments

We would like to thank the following individuals for responsibly disclosing security vulnerabilities:

<!-- This section will be updated as we receive and resolve security reports -->

*No security vulnerabilities have been reported yet.*

---

**Note**: This security policy is subject to change. Please check back regularly for updates.