// Shared config for the agency-side scrapers (creator + sellers).
// The bookmarklet-sync sidecar in docker-compose.yml rewrites
// GRAYLOG_ENDPOINT and GRAYLOG_TOKEN on every `docker compose up`.
var GRAYLOG_ENDPOINT = 'https://tok-graylog-gelf.ngrok-free.dev/gelf';
var GRAYLOG_TOKEN    = '1m0r2v13opjqaj64bqcupa5ltkuq8j95jnlkm5epf8eiao2r9jmc';

globalThis.TOK_CONFIG = {
  GRAYLOG_ENDPOINT: GRAYLOG_ENDPOINT,
  GRAYLOG_TOKEN: GRAYLOG_TOKEN,
  SHEET_ENDPOINT: 'https://script.google.com/macros/s/AKfycbzRGJMcZGvdRsAd9UHHATRG5ilpeh4JHCZ11ye5CMhHbs4LulaYJJsnndw8I2NfgvdG/exec',
  SHEET_TOKEN: '**dingleding&&'
};
