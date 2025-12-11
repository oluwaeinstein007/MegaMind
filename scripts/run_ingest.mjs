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
    // Only set env var if not already provided in the environment
    if (typeof process.env[key] === 'undefined') {
      process.env[key] = val;
    }
  }
}

// Import the built IngestorService from dist
import { IngestorService } from '../dist/services/ingestorService.js';
//import list of urls ie visa/flights etc from a file or array
import { getUrlsByCategory, getCategories, getAllUrls } from '../dist/data/travel-urls-dataset.js';

// Parse command-line arguments
const args = {
  category: process.argv[2] || null, // Optional: node run_ingest.mjs visa
};

async function run() {
  let urlsToIngest = [];
  let categoryDescription = "all URLs";

  try {
    if (args.category) {
      const category = args.category.toLowerCase();
      const availableCategories = getCategories();
      if (availableCategories.includes(category)) {
        urlsToIngest = getUrlsByCategory(category).map(item => item.url.trim());
        categoryDescription = `URLs in the '${category}' category`;
      } else {
        throw new Error(`Invalid category: ${args.category}. Available categories are: ${availableCategories.join(', ')}`);
      }
    } else {
      urlsToIngest = getAllUrls().map(u => u.trim());
      categoryDescription = "all URLs";
    }

    if (urlsToIngest.length === 0) {
      console.log(`No URLs found to ingest for ${categoryDescription}.`);
      return;
    }

    console.log(`🚀 Starting ingestion for ${urlsToIngest.length} URLs in ${categoryDescription}...\n`);

    const svc = new IngestorService();
    await svc.initialize();

    let successfulIngestions = 0;
    let failedIngestions = 0;
    const results = [];

    for (const url of urlsToIngest) {
      try {
          console.log(`🕸️ Ingesting: ${url}`);
        const ids = await svc.ingestUrl(url);
        console.log(`✅ Successfully ingested ${ids.length} chunks from ${url}`);
        successfulIngestions++;
        results.push({
          url,
          status: 'success',
          chunksIngested: ids.length,
          ids,
        });
      } catch (err) {
        console.error(`❌ Failed to ingest ${url}:`, err?.message || err);
        failedIngestions++;
        results.push({
          url,
          status: 'failed',
          error: err?.message || err,
        });
      }
    }

    await svc.close();

    // Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 Ingestion Summary:`);
    console.log(`  🔗 Total URLs: ${urlsToIngest.length}`);
    console.log(`  ✅ Successful: ${successfulIngestions}`);
    console.log(`  ❌ Failed: ${failedIngestions}`);
    console.log(`${'='.repeat(60)}\n`);

    // Show results
    console.log('📋 Detailed Results:');
    results.forEach(result => {
      if (result.status === 'success') {
        console.log(`  ✅ ${result.url} - ${result.chunksIngested} chunks`);
      } else {
        console.log(`  ❌ ${result.url} - Error: ${result.error}`);
      }
    });

    if (failedIngestions > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Ingestion failed:', err?.message || err);
    process.exitCode = 1;
  }
}

run();




// async function run() {
//   const url = 'https://en.wikipedia.org/wiki/Astrophysics';
//   console.log('Starting ingestion for:', url);
//   const svc = new IngestorService();
//   try {
//     await svc.initialize();
//     const ids = await svc.ingestUrl(url);
//     console.log('Ingested IDs:', ids);
//     await svc.close();
//   } catch (err) {
//     console.error('Ingestion failed:', err);
//     process.exitCode = 1;
//   }
// }

// run();