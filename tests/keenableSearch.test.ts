import 'dotenv/config';
import { searchKeenable } from '../server/keenableSearch';

async function runTest() {
  const query = 'fastest inference providers 2026';
  const results = await searchKeenable(query);
  const top3 = results.slice(0, 3);

  console.log(`Top ${top3.length} results for "${query}":\n`);
  top3.forEach((result, idx) => {
    console.log(`${idx + 1}. ${result.title}`);
    console.log(`   URL: ${result.url}`);
    console.log(`   Snippet: ${(result.snippet || '').slice(0, 300).replace(/\s+/g, ' ')}`);
    console.log('');
  });
}

runTest().catch((err) => {
  console.error('Keenable search test failed:', err.message || err);
  process.exit(1);
});
