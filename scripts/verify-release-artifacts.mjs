import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import yaml from 'js-yaml';

const metadataPaths = process.argv.slice(2);
if (metadataPaths.length === 0) throw new Error('Pass at least one updater metadata file.');

for (const metadataPath of metadataPaths) {
  const metadata = yaml.load(fs.readFileSync(metadataPath, 'utf8'));
  const outputDir = path.dirname(metadataPath);
  const names = new Set([
    metadata.path,
    ...(metadata.files || []).map((file) => file.url),
  ].filter(Boolean));

  for (const name of names) {
    const artifactPath = path.join(outputDir, decodeURIComponent(name));
    if (!fs.existsSync(artifactPath)) {
      throw new Error(`${metadataPath} references missing artifact: ${name}`);
    }
    if (fs.statSync(artifactPath).size === 0) {
      throw new Error(`${metadataPath} references empty artifact: ${name}`);
    }
  }
  console.log(`[release] ${metadataPath} references ${names.size} existing artifact(s).`);
}
