import fs from 'fs';
import path from 'path';

// Simple .env loader (so we don't add dotenv as a dependency here)
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    // remove surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

// Import the built IngestorService from dist
import { IngestorService } from '../dist/services/ingestorService.js';

async function run() {
  const url = 'https://en.wikipedia.org/wiki/Astrophysics';
  console.log('Starting ingestion for:', url);
  const svc = new IngestorService();
  try {
    await svc.initialize();
    const ids = await svc.ingestUrl(url);
    console.log('Ingested IDs:', ids);
    await svc.close();
  } catch (err) {
    console.error('Ingestion failed:', err);
    process.exitCode = 1;
  }
}

run();
