import { CryptoDigestAlgorithm, digest, getRandomValues } from 'expo-crypto';

// Supabase PKCE needs crypto.getRandomValues and crypto.subtle.digest('SHA-256'),
// which React Native does not provide. expo-crypto implements both natively.
const globalCrypto = (globalThis.crypto ?? {}) as Partial<Crypto>;

if (typeof globalCrypto.getRandomValues !== 'function') {
  globalCrypto.getRandomValues = getRandomValues as Crypto['getRandomValues'];
}

if (typeof globalCrypto.subtle === 'undefined') {
  Object.defineProperty(globalCrypto, 'subtle', {
    configurable: true,
    value: {
      digest: (algorithm: AlgorithmIdentifier, data: BufferSource) => {
        const name = typeof algorithm === 'string' ? algorithm : algorithm.name;
        if (name.toUpperCase() !== 'SHA-256') {
          return Promise.reject(new Error(`Unsupported digest algorithm: ${name}`));
        }
        return digest(CryptoDigestAlgorithm.SHA256, data);
      },
    },
  });
}

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: globalCrypto });
}
