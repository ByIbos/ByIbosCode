/**
 * ByIbosCode CLI Patcher
 * 
 * This script locates the official Claude Code (@anthropic-ai/claude-code) CLI application 
 * installed in NPM's global directory, copies its codebase, and patches the system paths 
 * associated with '.claude' configuration to a '.ByIbosCode' isolated directory.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Scanning for global NPM modules...');

let sourceFile = '';
try {
  // Dynamically detect the npm -g installation directory on your system
  const globalNodeModules = execSync('npm root -g').toString().trim();
  sourceFile = path.join(globalNodeModules, '@anthropic-ai', 'claude-code', 'cli.js');
  
  if (!fs.existsSync(sourceFile)) {
    throw new Error('Claude Code could not be found in the official directory.');
  }
} catch (error) {
  console.error('Error: Claude-code installation could not be found! Please run the following command first:');
  console.error('npm install -g @anthropic-ai/claude-code');
  process.exit(1);
}

const targetFile = path.join(__dirname, 'byibos_cli.js');

try {
  console.log(`Success! Original file detected... copying from (${sourceFile})`);
  fs.copyFileSync(sourceFile, targetFile);

  console.log(`Initializing '.ByIbosCode' interface patches and configuration isolation on the copy...`);
  let content = fs.readFileSync(targetFile, 'utf8');

  // Regex and String Replacements for full decoupling strategy
  content = content.replace(/join\([^,]+,\s*'\.claude'\)/g, match => match.replace("'.claude'", "'.ByIbosCode'"));
  content = content.replace(/join\([^,]+,\s*"\.claude"\)/g, match => match.replace('".claude"', '".ByIbosCode"'));

  content = content.replace(/`\.claude\$\{/g, '`.ByIbosCode${');

  // Explicit literal replacements for config JSONs
  content = content.replace(/".claude.json"/g, '".ByIbosCode.json"');
  content = content.replace(/'.claude.json'/g, "'.ByIbosCode.json'");
  
  // Explicit literal replacements for cache directory constant naming loops
  content = content.replace(/".claude"/g, '".ByIbosCode"');
  content = content.replace(/'.claude'/g, "'.ByIbosCode'");
  
  // Terminal System Prompt Override
  content = content.replace(/Claude Code, Anthropic's official CLI for Claude/g, 'ByIbos Code, the custom independent CLI for ByIbo');

  fs.writeFileSync(targetFile, content, 'utf8');

  console.log('🎉 byibos_cli.js has been successfully patched and created!');
  console.log('Now all you need to do is run -> start.bat <- !');
} catch (error) {
  console.error('A critical error occurred while processing the file:', error);
}
