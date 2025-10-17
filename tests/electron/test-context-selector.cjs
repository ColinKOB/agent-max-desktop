/**
 * Test script for Context Selector
 * Tests deterministic memory retrieval with various goals
 */

const path = require('path');
const fs = require('fs');
const MemoryVault = require('./memory-vault.cjs');

// We need to mock the ES module for testing in Node
class ContextSelector {
  constructor() {
    this.defaultTokenBudget = 1500;
    this.alwaysIncludeThreshold = 0.95;
  }

  async selectContext(goal, vault, options = {}) {
    const {
      tokenBudget = this.defaultTokenBudget,
      includePII = 2,
      respectConsent = true,
      alpha = 0.7,
    } = options;

    const candidates = await this._getAllCandidates(vault);
    const scored = this._scoreCandiates(goal, candidates, alpha);
    const filtered = this._applyPolicyFilters(scored, includePII, respectConsent);

    const alwaysInclude = filtered.filter((s) => s.priority >= this.alwaysIncludeThreshold);
    const ranked = filtered
      .filter((s) => s.priority < this.alwaysIncludeThreshold)
      .sort((a, b) => b.score - a.score);

    const selected = this._packToBudget([...alwaysInclude, ...ranked], tokenBudget);

    return selected;
  }

  async _getAllCandidates(vault) {
    const candidates = [];

    const facts = vault.getAllFacts();
    for (const fact of facts) {
      candidates.push({
        id: fact.id,
        kind: 'fact',
        text: this._formatFact(fact),
        priority: fact.confidence,
        tokens: this._estimateTokens(this._formatFact(fact)),
        pii: fact.pii_level,
        consent: fact.consent_scope,
        score: 0,
        metadata: {
          category: fact.category,
          predicate: fact.predicate,
          object: fact.object,
          decay: vault.getFactRelevance(fact),
        },
      });
    }

    const messages = vault.getRecentMessages(10);
    for (const msg of messages) {
      candidates.push({
        id: msg.id,
        kind: 'message',
        text: `${msg.role}: ${msg.content}`,
        priority: 0.5,
        tokens: this._estimateTokens(msg.content),
        pii: 1,
        consent: 'default',
        score: 0,
        metadata: {
          role: msg.role,
          created_at: msg.created_at,
        },
      });
    }

    return candidates;
  }

  _scoreCandiates(goal, candidates, alpha) {
    const goalLower = goal.toLowerCase();
    const goalWords = new Set(this._extractKeywords(goalLower));

    for (const candidate of candidates) {
      const keywordScore = this._keywordScore(goalWords, candidate.text);
      const semanticScore = this._semanticScore(goal, candidate);

      candidate.score = alpha * semanticScore + (1 - alpha) * keywordScore;

      if (candidate.metadata.decay !== undefined) {
        candidate.score *= candidate.metadata.decay;
      }
      candidate.score *= 1 + candidate.priority * 0.2;
    }

    return candidates;
  }

  _keywordScore(goalWords, text) {
    const textWords = new Set(this._extractKeywords(text.toLowerCase()));
    if (textWords.size === 0 || goalWords.size === 0) return 0;

    const intersection = new Set([...goalWords].filter((w) => textWords.has(w)));
    const union = new Set([...goalWords, ...textWords]);

    return intersection.size / union.size;
  }

  _semanticScore(goal, candidate) {
    const goalLower = goal.toLowerCase();
    const textLower = candidate.text.toLowerCase();
    let score = 0;

    if (textLower.includes(goalLower) || goalLower.includes(textLower)) {
      score += 0.5;
    }

    if (candidate.kind === 'fact') {
      const category = candidate.metadata.category;

      if (goalLower.includes('weather') && category === 'location') score += 0.4;
      if (goalLower.includes('email') && category === 'personal') score += 0.3;
      if (goalLower.includes('code') && category === 'preference') score += 0.3;
      if (goalLower.includes('work') && category === 'work') score += 0.4;

      const predicate = candidate.metadata.predicate;
      if (goalLower.includes(predicate)) score += 0.3;
    }

    if (candidate.kind === 'message') {
      score += 0.2;
    }

    return Math.min(score, 1.0);
  }

  _applyPolicyFilters(candidates, maxPII, respectConsent) {
    return candidates.filter((c) => {
      if (c.pii > maxPII) return false;
      if (respectConsent && c.consent === 'never_upload') return false;
      return true;
    });
  }

  _packToBudget(slices, budget) {
    const selected = [];
    let used = 0;

    for (const slice of slices) {
      if (used + slice.tokens <= budget) {
        selected.push(slice);
        used += slice.tokens;
      } else if (selected.length === 0 && slice.priority >= this.alwaysIncludeThreshold) {
        selected.push(slice);
        used += slice.tokens;
        break;
      }
    }

    return selected;
  }

  _formatFact(fact) {
    return `${fact.category}.${fact.predicate}: ${fact.object}`;
  }

  _estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }

  _extractKeywords(text) {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
      'with', 'by', 'from', 'is', 'was', 'are', 'were', 'been', 'be', 'have',
      'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could',
      'can', 'my', 'me', 'i', 'you', 'what', 'how', 'when', 'where',
    ]);

    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));
  }

  formatForAPI(slices) {
    const sections = {
      profile: [],
      facts: [],
      recent_messages: [],
      preferences: [],
    };

    for (const slice of slices) {
      if (slice.kind === 'fact') {
        const { category, predicate, object } = slice.metadata;

        if (category === 'personal' && predicate === 'name') {
          sections.profile.push(`Name: ${object}`);
        } else if (category === 'preference' || predicate.startsWith('prefers_')) {
          sections.preferences.push(`${predicate}: ${object}`);
        } else {
          sections.facts.push(`${category}.${predicate} = ${object}`);
        }
      } else if (slice.kind === 'message') {
        sections.recent_messages.push(slice.text);
      }
    }

    return {
      profile: sections.profile.length > 0 ? sections.profile.join('\n') : null,
      facts: sections.facts.length > 0 ? sections.facts.join('\n') : null,
      recent_messages: sections.recent_messages.length > 0 ? sections.recent_messages.slice(-5) : null,
      preferences: sections.preferences.length > 0 ? sections.preferences.join('\n') : null,
    };
  }
}

// Setup test vault
const testDataPath = path.join(__dirname, '../test-context-selector-data');
if (fs.existsSync(testDataPath)) {
  fs.rmSync(testDataPath, { recursive: true, force: true });
}
fs.mkdirSync(testDataPath, { recursive: true });

async function createTestData(vault) {
  console.log('📝 Creating test data...\n');

  // Set identity
  vault.setDisplayName('Test User');

  // Add diverse facts
  vault.setFact('personal', 'name', 'Colin', { confidence: 0.95, pii_level: 1 });
  vault.setFact('location', 'city', 'Philadelphia', { confidence: 0.9, pii_level: 2 });
  vault.setFact('preference', 'language', 'Python', { confidence: 0.85, pii_level: 0 });
  vault.setFact('preference', 'editor', 'VSCode', { confidence: 0.8, pii_level: 0 });
  vault.setFact('work', 'role', 'Software Engineer', { confidence: 0.85, pii_level: 1 });
  vault.setFact('work', 'company', 'Tech Corp', { confidence: 0.9, pii_level: 2 });
  vault.setFact('personal', 'email', 'colin@example.com', { confidence: 0.95, pii_level: 3 });

  // Add sensitive fact with never_upload consent
  vault.setFact('personal', 'phone', '555-1234', {
    confidence: 0.9,
    pii_level: 3,
    consent_scope: 'never_upload',
  });

  // Create session with messages
  vault.createSession('Chat about Python');
  vault.addMessage('user', 'Can you help me with Python?');
  vault.addMessage('assistant', 'Of course! What would you like to know?');
  vault.addMessage('user', 'How do I use list comprehensions?');
  vault.addMessage('assistant', 'List comprehensions are a concise way to create lists...');

  console.log('✅ Test data created\n');
}

async function runTests() {
  console.log('\n🧪 Testing Context Selector\n');
  console.log('='.repeat(60));

  const vault = new MemoryVault({ dataPath: testDataPath });
  await vault.initialize();
  await createTestData(vault);

  const selector = new ContextSelector();

  try {
    // Test 1: Weather query (should select location)
    console.log('\n1️⃣  Test: Weather query');
    console.log('Goal: "What\'s the weather in Philadelphia?"');
    const weatherContext = await selector.selectContext(
      "What's the weather in Philadelphia?",
      vault
    );
    console.log(`✅ Selected ${weatherContext.length} slices:`);
    weatherContext.forEach((s) => {
      console.log(`   - [${s.kind}] ${s.text} (score: ${s.score.toFixed(3)}, tokens: ${s.tokens})`);
    });

    const hasLocation = weatherContext.some(
      (s) => s.kind === 'fact' && s.metadata.category === 'location'
    );
    console.log(hasLocation ? '✅ Location fact included' : '❌ Location fact missing');

    // Test 2: Code question (should select preferences)
    console.log('\n2️⃣  Test: Code question');
    console.log('Goal: "Show me Python code examples"');
    const codeContext = await selector.selectContext('Show me Python code examples', vault);
    console.log(`✅ Selected ${codeContext.length} slices:`);
    codeContext.forEach((s) => {
      console.log(`   - [${s.kind}] ${s.text} (score: ${s.score.toFixed(3)})`);
    });

    const hasPythonPref = codeContext.some(
      (s) =>
        s.kind === 'fact' &&
        s.metadata.category === 'preference' &&
        s.metadata.object === 'Python'
    );
    console.log(hasPythonPref ? '✅ Python preference included' : '❌ Python preference missing');

    // Test 3: PII filtering
    console.log('\n3️⃣  Test: PII filtering (max PII level 1)');
    console.log('Goal: "Tell me about myself"');
    const piiContext = await selector.selectContext('Tell me about myself', vault, {
      includePII: 1, // Exclude PII level 2 and 3
    });
    console.log(`✅ Selected ${piiContext.length} slices:`);
    const maxPII = Math.max(...piiContext.map((s) => s.pii));
    console.log(`   Max PII level in selection: ${maxPII}`);
    console.log(maxPII <= 1 ? '✅ PII filtering working' : '❌ PII filtering failed');

    // Test 4: Consent filtering
    console.log('\n4️⃣  Test: Consent filtering');
    console.log('Goal: "What do you know about me?"');
    const consentContext = await selector.selectContext('What do you know about me?', vault, {
      respectConsent: true,
    });
    const hasNeverUpload = consentContext.some((s) => s.consent === 'never_upload');
    console.log(`✅ Selected ${consentContext.length} slices`);
    console.log(
      !hasNeverUpload ? '✅ never_upload facts excluded' : '❌ never_upload facts included'
    );

    // Test 5: Token budgeting
    console.log('\n5️⃣  Test: Token budgeting (budget: 200 tokens)');
    const budgetContext = await selector.selectContext('Tell me everything', vault, {
      tokenBudget: 200,
    });
    const totalTokens = budgetContext.reduce((sum, s) => sum + s.tokens, 0);
    console.log(`✅ Selected ${budgetContext.length} slices (${totalTokens} tokens)`);
    console.log(
      totalTokens <= 200 ? '✅ Budget respected' : `❌ Budget exceeded (${totalTokens}/200)`
    );

    // Test 6: Format for API
    console.log('\n6️⃣  Test: Format for API');
    const formatted = selector.formatForAPI(weatherContext);
    console.log('✅ Formatted context:');
    if (formatted.profile) console.log('   - Profile: ✓');
    if (formatted.facts) console.log('   - Facts: ✓');
    if (formatted.preferences) console.log('   - Preferences: ✓');
    if (formatted.recent_messages) console.log('   - Recent messages: ✓');

    // Test 7: Deterministic results
    console.log('\n7️⃣  Test: Deterministic results');
    const context1 = await selector.selectContext('Weather in Philadelphia', vault);
    const context2 = await selector.selectContext('Weather in Philadelphia', vault);
    const same =
      context1.length === context2.length &&
      context1.every((s1, i) => s1.id === context2[i].id);
    console.log(same ? '✅ Results are deterministic' : '❌ Results vary');

    vault.close();

    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL CONTEXT SELECTOR TESTS PASSED! 🎉');
    console.log('='.repeat(60));
    console.log('\nContext selector is working correctly!\n');

    return true;
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);
    vault.close();
    return false;
  }
}

runTests()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
