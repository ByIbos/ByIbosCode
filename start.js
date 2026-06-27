const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const envPath = path.join(__dirname, '.env');
const proxyPath = path.join(__dirname, 'local_proxy.js');
const cliPath = path.join(__dirname, 'byibos_cli.js');

function askQuestion(rl, query) {
  return new Promise(resolve => rl.question(query, ans => resolve(ans.trim())));
}

async function runSetupWizard() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('\n====================================================');
  console.log('    BYIBOS CODE - CONFIGURATION SETUP WIZARD        ');
  console.log('====================================================');
  console.log('Select your LLM Provider:');
  console.log('1) LM Studio (Local, Free)');
  console.log('2) Gemini API (Cloud, High Performance)');
  console.log('====================================================\n');

  let provider = '';
  while (provider !== '1' && provider !== '2') {
    provider = await askQuestion(rl, 'Choose provider (1 or 2): ');
  }

  let envLines = [];
  if (provider === '1') {
    console.log('\n--- LM Studio Setup ---');
    const port = await askQuestion(rl, 'LM Studio Port (default: 1234): ') || '1234';
    const model = await askQuestion(rl, 'LM Studio Model Name (default: gemma4:e4b): ') || 'gemma4:e4b';
    const dir = await askQuestion(rl, `Target project directory path (default: ${process.cwd()}): `) || process.cwd();

    envLines.push(`# ByIbosCode Configuration - LM Studio Mode`);
    envLines.push(`TARGET_PORT=${port}`);
    envLines.push(`TARGET_MODEL=${model}`);
    envLines.push(`TARGET_DIR=${dir}`);
  } else {
    console.log('\n--- Gemini API Setup ---');
    let key = '';
    while (!key) {
      key = await askQuestion(rl, 'Enter Gemini API Key (starts with AIzaSy...): ');
      if (!key) console.log('API Key cannot be empty!');
    }
    const model = await askQuestion(rl, 'Gemini Model Name (default: gemini-1.5-flash): ') || 'gemini-1.5-flash';
    const dir = await askQuestion(rl, `Target project directory path (default: ${process.cwd()}): `) || process.cwd();

    envLines.push(`# ByIbosCode Configuration - Gemini API Mode`);
    envLines.push(`GEMINI_API_KEY=${key}`);
    envLines.push(`TARGET_MODEL=${model}`);
    envLines.push(`TARGET_DIR=${dir}`);
  }

  rl.close();

  // Save to .env
  fs.writeFileSync(envPath, envLines.join('\n') + '\n', 'utf8');
  console.log('\n[SUCCESS] Configuration saved to .env file!\n');
}

async function main() {
  const forceSetup = process.argv.includes('--setup') || process.argv.includes('-s');

  // If .env does not exist or setup is forced, run the setup wizard
  if (!fs.existsSync(envPath) || forceSetup) {
    await runSetupWizard();
  }

  // Load environment variables from .env manually
  const env = { ...process.env };
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return; // Ignore comments and empty lines
      const parts = trimmed.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
        if (key) env[key] = val;
      }
    });
  }

  // Override Anthropic environment variables for local routing
  env.ANTHROPIC_API_KEY = 'byibos-local';
  env.ANTHROPIC_BASE_URL = 'http://localhost:8082';

  console.log('====================================================');
  console.log('STARTING BYIBOS CODE WITH LOCAL PROXY...');
  console.log('====================================================\n');

  // 1. Start the proxy server
  console.log('[1/2] Launching Local Proxy...');
  const proxy = spawn('node', [proxyPath], {
    env,
    stdio: 'pipe'
  });

  let proxyStarted = false;
  proxy.stdout.on('data', data => {
    const msg = data.toString();
    if (msg.includes('Proxy Listen')) {
      proxyStarted = true;
      console.log(msg.trim());
    }
  });

  proxy.stderr.on('data', data => {
    console.error('[Proxy Error]:', data.toString());
  });

  // Wait a bit for the proxy to start
  setTimeout(() => {
    console.log('\n[2/2] Loading Claude Code interface...');
    
    // Set working directory to TARGET_DIR if configured
    const targetDir = env.TARGET_DIR || process.cwd();
    console.log(`Opening Claude Code in directory: ${targetDir}\n`);

    if (!fs.existsSync(cliPath)) {
      console.error(`[ERROR] byibos_cli.js not found in ${__dirname}! Please run "node patch_cli.js" first.`);
      proxy.kill();
      process.exit(1);
    }

    // 2. Start the CLI in the target directory with inherited stdio (interactive!)
    const cli = spawn('node', [cliPath], {
      cwd: targetDir,
      env,
      stdio: 'inherit'
    });

    cli.on('error', err => {
      console.error('\n[Error launching CLI]:', err.message);
      if (err.code === 'ENOENT') {
        console.error(`Please check if the target directory exists: ${targetDir}`);
      }
      proxy.kill();
      process.exit(1);
    });

    cli.on('close', code => {
      // Kill the proxy when CLI exits
      proxy.kill();
      process.exit(code ?? 0);
    });
  }, 2000);
}

main().catch(err => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
