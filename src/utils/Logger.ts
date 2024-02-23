const logLevel = 'debug';

function log (name: string, level: string, text: string): void {
  console.log(`[${level}] [${name}] ${text}`);
}

function createLogger (name: string) {
 return {
  debug: log.bind(this, name, 'debug'),
  info: log.bind(this, name, 'info'),
  warn: log.bind(this, name, 'warn'),
  error: log.bind(this, name, 'error'),
 };
}

export { createLogger };
