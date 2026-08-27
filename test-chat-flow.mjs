// test-chat-flow.mjs - Standalone Node.js test for Hermedian chat flow
import { spawn } from 'child_process';
import { promisify } from 'util';
import { execFile } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const execFileAsync = promisify(execFile);

// Provider name mapping: cache key -> CLI provider name
const PROVIDER_MAP = {
  'nvidia': 'nvidia-nim',
  'nous': 'nous',
  'opencode-free': 'opencode-free',
  'zai': 'zai',
  'openrouter': 'openrouter',
  'google': 'google',
  'xai': 'xai',
  'openai': 'openai',
  'anthropic': 'anthropic',
  'mistral': 'mistral',
  'meta': 'meta',
  'deepseek': 'deepseek',
  'cohere': 'cohere',
  'groq': 'groq',
  'together': 'together',
};

// Test 1: Check Hermes CLI availability
async function testHermesCLI() {
  console.log('=== Test 1: Hermes CLI Availability ===');
  const cliPath = '/home/k2/.local/bin/hermes';
  
  try {
    const { stdout } = await execFileAsync(cliPath, ['--version'], { timeout: 5000 });
    console.log(`✅ Hermes CLI found: ${stdout.trim()}`);
    return cliPath;
  } catch (e) {
    console.log(`❌ Hermes CLI not found: ${e.message}`);
    return null;
  }
}

// Test 2: Load provider models cache
async function testModelCache() {
  console.log('\n=== Test 2: Provider Models Cache ===');
  const cachePath = join(homedir(), '.hermes', 'provider_models_cache.json');
  
  if (!existsSync(cachePath)) {
    console.log('❌ Cache not found');
    return null;
  }
  
  const cache = JSON.parse(readFileSync(cachePath, 'utf-8'));
  console.log('✅ Cache loaded');
  console.log('Providers:', Object.keys(cache));
  
  for (const [provider, data] of Object.entries(cache)) {
    if (data.models?.length) {
      console.log(`  ${provider}: ${data.models.length} models`);
      data.models.slice(0, 3).forEach(m => console.log(`    - ${m}`));
    }
  }
  
  return cache;
}

// Test 3: Test Hermes chat with models from cache
async function testChat(cliPath, cache) {
  console.log('\n=== Test 3: Chat with Models from Cache ===');
  
  for (const [providerKey, data] of Object.entries(cache)) {
    if (!data.models?.length) continue;
    
    const model = data.models[0];
    const provider = PROVIDER_MAP[providerKey] || providerKey;
    
    console.log(`\n🔄 Testing: ${model} (${provider})`);
    
    const args = [
      'chat',
      '-q', 'What is 2+2? Answer in one word.',
      '-m', model,
      '--provider', provider,
      '--reasoning', 'low',
      '--in', '/tmp'
    ];
    
    try {
      const start = Date.now();
      const { stdout } = await execFileAsync('/home/k2/.local/bin/hermes', args, { 
        timeout: 60000,
        cwd: '/tmp'
      });
      const elapsed = Date.now() - start;
      console.log(`✅ ${provider} (${elapsed}ms): ${stdout.trim().slice(0, 100)}...`);
    } catch (e) {
      console.log(`❌ ${provider} failed: ${e.message}`);
    }
  }
}

// Test 4: Test reasoning levels with models from cache
async function testReasoningLevels(cliPath, cache) {
  console.log('\n=== Test 4: Reasoning Levels ===');
  
  const levels = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'];
  
  // Use first available model from nvidia provider
  const nvidiaData = cache['nvidia'];
  const model = nvidiaData?.models?.[0] || 'nvidia/nemotron-3-ultra-550b-a55b';
  
  for (const level of levels) {
    console.log(`\n🔄 Testing reasoning: ${level}`);
    
    const args = [
      'chat',
      '-q', 'What is the capital of France?',
      '-m', model,
      '--provider', 'nvidia-nim',
      '--reasoning', level,
      '--in', '/tmp'
    ];
    
    try {
      const start = Date.now();
      const { stdout } = await execFileAsync('/home/k2/.local/bin/hermes', args, { 
        timeout: 180000, // 3 minutes for ultra
        cwd: '/tmp'
      });
      const elapsed = Date.now() - start;
      console.log(`✅ ${level} (${elapsed}ms): ${stdout.trim().slice(0, 80)}`);
    } catch (e) {
      console.log(`❌ ${level} failed: ${e.message}`);
    }
  }
}

// Test 5: Test provider switching
async function testProviderSwitching(cliPath, cache) {
  console.log('\n=== Test 5: Provider Switching ===');
  
  for (const [providerKey, data] of Object.entries(cache)) {
    if (!data.models?.length) continue;
    const model = data.models[0];
    const provider = PROVIDER_MAP[providerKey] || providerKey;
    
    console.log(`\n🔄 Testing provider: ${provider} with model: ${model}`);
    
    const args = [
      'chat',
      '-q', 'Say hello in one word',
      '-m', model,
      '--provider', provider,
      '--reasoning', 'low',
      '--in', '/tmp'
    ];
    
    try {
      const start = Date.now();
      const { stdout } = await execFileAsync('/home/k2/.local/bin/hermes', args, { 
        timeout: 30000,
        cwd: '/tmp'
      });
      const elapsed = Date.now() - start;
      console.log(`✅ ${provider} (${elapsed}ms): ${stdout.trim().slice(0, 60)}`);
    } catch (e) {
      console.log(`❌ ${provider} failed: ${e.message}`);
    }
  }
}

// Test 5: Test with specific interesting models
async function testSpecificModels(cliPath, cache) {
  console.log('\n=== Test 5: Specific Interesting Models ===');
  
  const interestingModels = [
    { provider: 'nvidia', model: 'nvidia/nemotron-3-ultra-550b-a55b' },
    { provider: 'nvidia', model: 'nvidia/llama-3.1-nemotron-70b-instruct' },
    { provider: 'nous', model: 'hermes-3-70b' },
    { provider: 'nous', model: 'anthropic/claude-opus-4' },
    { provider: 'opencode-free', model: 'nemotron-3-ultra-free' },
    { provider: 'openrouter', model: 'anthropic/claude-opus-4' },
  ];
  
  for (const { provider: providerKey, model } of interestingModels) {
    // Check if model exists in cache
    const cacheData = cache[providerKey];
    if (!cacheData?.models?.includes(model)) {
      console.log(`\n⏭️  Skipping ${model} (not in cache for ${providerKey})`);
      continue;
    }
    
    const provider = PROVIDER_MAP[providerKey] || providerKey;
    console.log(`\n🔄 Testing: ${model} (${provider})`);
    
    const args = [
      'chat',
      '-q', 'What is 2+2? Answer in one word.',
      '-m', model,
      '--provider', provider,
      '--reasoning', 'medium',
      '--in', '/tmp'
    ];
    
    try {
      const start = Date.now();
      const { stdout } = await execFileAsync('/home/k2/.local/bin/hermes', args, { 
        timeout: 60000,
        cwd: '/tmp'
      });
      const elapsed = Date.now() - start;
      console.log(`✅ ${provider} (${elapsed}ms): ${stdout.trim().slice(0, 100)}...`);
    } catch (e) {
      console.log(`❌ ${provider} failed: ${e.message}`);
    }
  }
}

// Run all tests
async function main() {
  console.log('🧪 Hermedian Chat Flow Tests\n');
  
  const cliPath = await testHermesCLI();
  if (!cliPath) return;
  
  const cache = await testModelCache();
  if (!cache) return;
  
  await testChat(cliPath, cache);
  await testReasoningLevels(cliPath, cache);
  await testProviderSwitching(cliPath, cache);
  await testSpecificModels(cliPath, cache);
  
  console.log('\n✅ All tests completed');
}

main().catch(console.error);