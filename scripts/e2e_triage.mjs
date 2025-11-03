#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

function loadJsonReport(reportPath) {
  if (!fs.existsSync(reportPath)) {
    console.error(`[triage] JSON report not found at ${reportPath}. Run with: npm run test:e2e:json`);
    process.exit(1);
  }
  const raw = fs.readFileSync(reportPath, 'utf8');
  return JSON.parse(raw);
}

function bucketizeFailures(report) {
  const buckets = {
    http_401_403: [],
    http_404_405: [],
    http_5xx: [],
    selector_timeout: [],
    pointer_interception: [],
    other: []
  };

  function addToBucket(test, message) {
    const entry = `- ${test.title} (${test.projectName}) in ${test.location?.file}:${test.location?.line}`;
    if (/\b(401|403)\b/.test(message)) buckets.http_401_403.push(entry);
    else if (/\b(404|405)\b/.test(message)) buckets.http_404_405.push(entry);
    else if (/\b(5\d\d)\b/.test(message)) buckets.http_5xx.push(entry);
    else if (/Timeout.*click|waiting for locator|selector/i.test(message)) buckets.selector_timeout.push(entry);
    else if (/intercepts pointer events/i.test(message)) buckets.pointer_interception.push(entry);
    else buckets.other.push(entry);
  }

  for (const suite of report.suites || []) {
    for (const project of suite.suites || []) {
      for (const file of project.suites || []) {
        for (const spec of file.specs || []) {
          for (const test of spec.tests || []) {
            if (test.results) {
              for (const res of test.results) {
                if (res.status === 'failed') {
                  const msg = (res.error && (res.error.message || res.error.stack)) || JSON.stringify(res.error || res, null, 2);
                  addToBucket(test, msg);
                }
              }
            }
          }
        }
      }
    }
  }

  return buckets;
}

function renderMarkdown(buckets) {
  const sections = [];
  sections.push(`# E2E Triage Report`);
  const keys = Object.keys(buckets);
  for (const k of keys) {
    const items = buckets[k];
    if (!items.length) continue;
    const title = {
      http_401_403: 'Auth-protected endpoints (401/403)',
      http_404_405: 'Path/method mismatches (404/405)',
      http_5xx: 'Server errors (5xx)',
      selector_timeout: 'Selector/timeout issues',
      pointer_interception: 'Pointer interception (overlays)',
      other: 'Other failures'
    }[k] || k;
    sections.push(`\n## ${title} (${items.length})`);
    sections.push(items.join('\n'));
  }
  if (sections.length === 1) sections.push('\nNo failures found. Great job!');
  return sections.join('\n');
}

function main() {
  const root = process.cwd();
  const reportPath = path.join(root, 'play-results.json');
  const outDir = path.join(root, 'tests', 'e2e', '_reports');
  const outFile = path.join(outDir, 'latest-triage.md');

  const report = loadJsonReport(reportPath);
  const buckets = bucketizeFailures(report);
  const md = renderMarkdown(buckets);

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, md, 'utf8');
  console.log(`[triage] Wrote triage report to ${outFile}`);
}

main();
