'use strict';

const dns = require('node:dns');

const FALLBACK_SERVERS = ['8.8.8.8', '8.8.4.4'];

// Vercel/Lambda ship a resolver that already handles Atlas SRV records, and
// outbound UDP/53 to public resolvers is frequently blocked there - forcing
// 8.8.8.8 would itself cause `querySrv ECONNREFUSED` in production. The
// override is therefore only applied on local/self-hosted runtimes.
const IS_SERVERLESS = Boolean(
  process.env.VERCEL ||
    process.env.VERCEL_ENV ||
    process.env.AWS_LAMBDA_FUNCTION_NAME
);

let applied = false;

/**
 * Work around SRV lookups for MongoDB Atlas failing with
 * `querySrv ECONNREFUSED _mongodb._tcp.<cluster>.mongodb.net`.
 *
 * Some networks (corporate DNS, certain Windows/ISP resolvers, VPNs) refuse
 * DNS-over-UDP SRV queries, which breaks the `mongodb+srv://` bootstrap that
 * the Node driver performs before it can connect. Forcing a public resolver
 * and an IPv4-first result order restores the lookup.
 *
 * Must run before the first `mongoose.connect()` call. Safe to call repeatedly.
 */
const applyDnsFallback = () => {
  if (applied) return;
  applied = true;

  try {
    dns.setDefaultResultOrder('ipv4first');
  } catch {
    // setDefaultResultOrder is unavailable on very old runtimes; not fatal.
  }

  if (!IS_SERVERLESS) {
    try {
      dns.setServers(FALLBACK_SERVERS);
    } catch {
      // Never let a DNS tweak crash the process before it has started.
    }
  }
};

applyDnsFallback();

module.exports = { applyDnsFallback, FALLBACK_SERVERS };
