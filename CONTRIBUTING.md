# Contributing to THRAG

We welcome contributions to THRAG! This document provides guidelines for contributing to the project.

## 🚀 Getting Started

### Prerequisites

- Node.js 18 or higher
- AWS CLI configured with appropriate permissions
- AWS CDK installed globally
- Docker (for local testing)

### Development Setup

1. **Fork and clone the repository**
```bash
git clone https://github.com/yourusername/thrag-threat-hunting.git
cd thrag-threat-hunting
```

2. **Install dependencies**
```bash
npm install
```

3. **Build the project**
```bash
npm run build
```

4. **Run tests**
```bash
npm test
```

## 📋 Development Guidelines

### Code Style

- Use TypeScript for all new code
- Follow existing code formatting and naming conventions
- Add JSDoc comments for public APIs
- Use meaningful variable and function names

### Commit Messages

Follow conventional commit format:
```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test additions or modifications
- `chore`: Build process or auxiliary tool changes

Examples:
```
feat(agents): add new forensics investigation capabilities
fix(rag): resolve knowledge base retrieval timeout issue
docs(readme): update deployment instructions
```

### Branch Naming

- `feature/description` - New features
- `bugfix/description` - Bug fixes
- `hotfix/description` - Critical fixes
- `docs/description` - Documentation updates

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- --testPathPattern=threat-hunter
```

### Writing Tests

- Write unit tests for all new functions and classes
- Use descriptive test names
- Include both positive and negative test cases
- Mock external dependencies

Example test structure:
```typescript
describe('ThreatHunter', () => {
  describe('generateHuntQueries', () => {
    it('should generate valid hunt queries for given hypothesis', async () => {
      // Test implementation
    });

    it('should handle empty hypothesis gracefully', async () => {
      // Test implementation
    });
  });
});
```

## 🏗️ Architecture Guidelines

### Adding New Agents

1. Create agent class in `src/agents/`
2. Implement required interfaces
3. Add agent to orchestration system
4. Update infrastructure stack
5. Add tests and documentation

### Adding New Data Sources

1. Create ingester in `src/data-ingestion/`
2. Implement standardized document format
3. Add to data ingestion stack
4. Update knowledge base configuration
5. Add monitoring and error handling

### Infrastructure Changes

- Use AWS CDK for all infrastructure
- Follow least privilege principle for IAM
- Add proper monitoring and logging
- Document resource costs and scaling considerations

## 📝 Documentation

### Code Documentation

- Add JSDoc comments for all public APIs
- Include usage examples in documentation
- Document complex algorithms and business logic
- Keep README files up to date

### Architecture Documentation

- Update architecture diagrams for significant changes
- Document design decisions and trade-offs
- Include deployment and operational guides
- Maintain troubleshooting documentation

## 🔒 Security Guidelines

### Security Best Practices

- Never commit secrets or API keys
- Use AWS Secrets Manager for sensitive data
- Follow OWASP security guidelines
- Implement proper input validation
- Use least privilege access controls

### Security Review Process

- All security-related changes require review
- Run security scans before merging
- Document security implications
- Update threat model if necessary

## 🚀 Deployment

### Development Environment

```bash
# Deploy to development
export ENVIRONMENT=development
npm run deploy-complete
```

### Production Deployment

- All production deployments go through CI/CD
- Requires approval from maintainers
- Must pass all tests and security scans
- Includes rollback plan

## 📊 Performance Guidelines

### Performance Considerations

- Monitor Lambda function duration and memory usage
- Optimize DynamoDB queries and indexes
- Consider caching for frequently accessed data
- Monitor Bedrock API usage and costs

### Benchmarking

- Include performance tests for critical paths
- Monitor key metrics (latency, throughput, error rates)
- Set up alerts for performance degradation
- Document performance requirements

## 🐛 Bug Reports

### Reporting Bugs

Use the GitHub issue template and include:

- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details (AWS region, versions, etc.)
- Relevant logs or error messages
- Screenshots if applicable

### Bug Fix Process

1. Create issue with bug report
2. Create branch from main: `bugfix/issue-description`
3. Implement fix with tests
4. Update documentation if needed
5. Submit pull request with issue reference

## ✨ Feature Requests

### Proposing Features

1. Check existing issues and discussions
2. Create detailed feature request issue
3. Discuss with maintainers and community
4. Create design document for complex features
5. Implement with tests and documentation

### Feature Development Process

1. Create feature branch: `feature/feature-name`
2. Implement feature with comprehensive tests
3. Update documentation and examples
4. Submit pull request with detailed description
5. Address review feedback

## 👥 Pull Request Process

### Before Submitting

- [ ] Code follows project style guidelines
- [ ] All tests pass locally
- [ ] Documentation is updated
- [ ] Commit messages follow convention
- [ ] No merge conflicts with main branch

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
```

### Review Process

1. Automated checks must pass
2. At least one maintainer review required
3. Address all review feedback
4. Squash commits before merging
5. Delete feature branch after merge

## 🏷️ Release Process

### Versioning

We use [Semantic Versioning](https://semver.org/):
- MAJOR: Breaking changes
- MINOR: New features (backward compatible)
- PATCH: Bug fixes (backward compatible)

### Release Checklist

- [ ] Update version in package.json
- [ ] Update CHANGELOG.md
- [ ] Create release notes
- [ ] Tag release in Git
- [ ] Deploy to production
- [ ] Announce release

## 🤝 Community Guidelines

### Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help newcomers get started
- Follow GitHub community guidelines

### Getting Help

- Check existing documentation first
- Search existing issues and discussions
- Ask questions in GitHub Discussions
- Join community chat (if available)

### Recognition

Contributors will be recognized in:
- README contributors section
- Release notes
- Annual contributor highlights

## 📞 Contact

- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions
- **Security**: security@thrag.ai
- **Maintainers**: @maintainer1, @maintainer2

Thank you for contributing to THRAG! 🛡️