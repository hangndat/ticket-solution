'use strict';
// Per-process resolver for the generated run domain. Never writes /etc/hosts.
const dns = require('node:dns');
const suffix = process.env.E2E_HOST_SUFFIX;
if (suffix && /^e2e-[a-z0-9-]+\.test$/.test(suffix)) {
  const original = dns.lookup.bind(dns);
  dns.lookup = function (hostname, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    if (
      typeof hostname === 'string' &&
      (hostname === suffix || hostname.endsWith('.' + suffix))
    ) {
      const value = options?.all
        ? [{ address: '127.0.0.1', family: 4 }]
        : '127.0.0.1';
      queueMicrotask(() => callback(null, value, 4));
      return;
    }
    return original(hostname, options, callback);
  };
  const promiseLookup = dns.promises.lookup.bind(dns.promises);
  dns.promises.lookup = async function (hostname, options) {
    if (
      typeof hostname === 'string' &&
      (hostname === suffix || hostname.endsWith('.' + suffix))
    ) {
      return options?.all
        ? [{ address: '127.0.0.1', family: 4 }]
        : { address: '127.0.0.1', family: 4 };
    }
    return promiseLookup(hostname, options);
  };
}
