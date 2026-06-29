// Shared config for the seller-side scrapers (live + streamer).
// Points at the graylog-shim Deno Deploy app (replaces the old self-hosted
// Graylog + ngrok stack). The token is accepted by the shim's GELF write gate
// (it's in the shim's API_TOKENS). See MIGRATION_PLAN.md.
var GRAYLOG_ENDPOINT = 'https://graylog-shim.easierbycode.deno.net/gelf';
var GRAYLOG_TOKEN    = '1dfl48d81q96uu1djdahq1ic87cvnlmu4jqsvco2l0bh8u3adns8';

globalThis.TOK_CONFIG = {
  GRAYLOG_ENDPOINT: GRAYLOG_ENDPOINT,
  GRAYLOG_TOKEN: GRAYLOG_TOKEN,
  SHEET_ENDPOINT: 'https://script.google.com/macros/s/AKfycbzRGJMcZGvdRsAd9UHHATRG5ilpeh4JHCZ11ye5CMhHbs4LulaYJJsnndw8I2NfgvdG/exec',
  SHEET_TOKEN: '**dingleding&&'
};
