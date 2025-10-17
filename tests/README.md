# Agent Max Desktop - Test Suite

This directory contains all test files for the Agent Max Desktop project, organized by test type.

## 📁 Test Structure

```
tests/
├── electron/          # Electron-specific tests
├── scripts/          # Test scripts and verification
├── manual/           # Manual test files (HTML, debug scripts)
├── unit/             # Unit tests
├── integration/      # Integration tests
├── features.test.js  # Feature tests
└── setup.js          # Test setup configuration
```

---

## 🧪 Test Categories

### Electron Tests (`/electron/`)

Electron-specific test files for desktop functionality:

- **`test-context-selector.cjs`** - Context selector functionality tests
- **`test-integration.cjs`** - Integration between Electron and React
- **`test-migration.cjs`** - Data migration tests
- **`test-vault.cjs`** - Memory vault functionality tests
- **`test-window.cjs`** - Window management tests

**Run Electron tests:**
```bash
node electron/test-vault.cjs
node electron/test-window.cjs
# etc.
```

---

### Test Scripts (`/scripts/`)

Automated test scripts and verification tools:

- **`test_autonomous_execution.sh`** - Autonomous execution testing
- **`test_complete_app.js`** - Complete application test suite
- **`test_desktop_integration.js`** - Desktop integration tests
- **`test-history.js`** - History feature tests
- **`verify-setup.sh`** - Setup verification script
- **`verify_integration.sh`** - Integration verification
- **`test-electron-glass.sh`** - Glass effect Electron tests

**Run test scripts:**
```bash
# Verify setup
./tests/scripts/verify-setup.sh

# Test complete app
node tests/scripts/test_complete_app.js

# Test desktop integration
node tests/scripts/test_desktop_integration.js
```

---

### Manual Tests (`/manual/`)

Manual testing files and debug tools:

- **`test-glass-colorful.html`** - Colorful glass effect test page
- **`test-glass-direct.html`** - Direct glass effect test page
- **`debug-transparency.js`** - Transparency debugging script

**Use manual tests:**
```bash
# Open in browser
open tests/manual/test-glass-colorful.html

# Run debug script
node tests/manual/debug-transparency.js
```

---

### Unit Tests (`/unit/`)

Component and function-level unit tests.

**Run unit tests:**
```bash
npm test -- tests/unit/
```

---

### Integration Tests (`/integration/`)

End-to-end integration tests.

**Run integration tests:**
```bash
npm test -- tests/integration/
```

---

## 🚀 Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test File
```bash
npm test -- tests/features.test.js
```

### Run Tests in Watch Mode
```bash
npm test -- --watch
```

### Run Tests with Coverage
```bash
npm test -- --coverage
```

---

## 📝 Test Configuration

- **`setup.js`** - Global test setup and configuration
- **`../jest.config.js`** - Jest configuration (root)
- **`../vitest.config.js`** - Vitest configuration (root)

---

## 🔍 Test Documentation

For detailed test reports and test plans, see:

- **[Testing Documentation](../docs/testing/)** - Test reports and plans
- **[DEEP_TESTING_REPORT.md](../docs/testing/DEEP_TESTING_REPORT.md)** - Comprehensive testing report
- **[TESTING_STATUS_SUMMARY.md](../docs/testing/TESTING_STATUS_SUMMARY.md)** - Current testing status

---

## ✅ Testing Best Practices

1. **Write tests first** - TDD approach when possible
2. **Test behavior, not implementation** - Focus on what, not how
3. **Keep tests isolated** - Each test should be independent
4. **Use descriptive names** - Test names should explain what's being tested
5. **Mock external dependencies** - Keep tests fast and reliable
6. **Maintain test coverage** - Aim for >80% coverage on critical paths

---

## 🐛 Debugging Tests

### Debug Single Test
```bash
node --inspect-brk node_modules/.bin/jest tests/features.test.js
```

### View Test Output
```bash
npm test -- --verbose
```

### Run Tests in Debug Mode
```bash
DEBUG=* npm test
```

---

## 📊 Test Coverage

To generate and view test coverage:

```bash
npm test -- --coverage
open coverage/lcov-report/index.html
```

---

## 🔧 Continuous Integration

Tests are automatically run on:
- Pull requests
- Main branch commits
- Release builds

See `.github/workflows/` for CI configuration.

---

**Last Updated:** October 2024
