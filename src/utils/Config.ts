import fs from 'fs';

const configPath = 'config/default.json';
let config: Record<string, unknown> = {};

function loadConfig () {
  const data = fs.readFileSync(configPath, 'utf-8');
  config = JSON.parse(data);
}

loadConfig();

export default config;