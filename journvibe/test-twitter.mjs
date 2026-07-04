/**
 * Quick Twitter post test — uses social-mcp SEND_TWEET directly.
 * Run: node test-twitter.mjs
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '.env') });

const binPath = resolve(__dirname, 'node_modules', 'social-mcp', 'dist', 'index.js');

const transport = new StdioClientTransport({
  command: 'node',
  args: [binPath],
  env: process.env,
});

const client = new Client({ name: 'journvibe-test', version: '1.0.0' }, { capabilities: {} });

await client.connect(transport);

const tweetText = `✈️ JournVibe test post — ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC\n#travel #JournVibe`;

console.log('Sending tweet:', tweetText);

try {
  const result = await client.callTool({ name: 'SEND_TWEET', arguments: { text: tweetText } });
  console.log('Result:', JSON.stringify(result, null, 2));
} catch (err) {
  console.error('Error:', err.message);
} finally {
  await client.close();
}
