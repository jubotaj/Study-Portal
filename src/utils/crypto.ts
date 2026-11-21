function toBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.byteLength; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, bytes.byteLength));
    parts.push(String.fromCharCode(...chunk));
  }
  return btoa(parts.join(''));
}

function fromBase64(base64: string): Uint8Array {
  const normalized = base64.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function assertWebCryptoAvailable(): SubtleCrypto {
  if (typeof globalThis === 'undefined' || !globalThis.crypto || !globalThis.crypto.subtle) {
    throw new Error(
      'Browser Web Crypto API is unavailable. Please open StudyGlobe over HTTPS to use AES-256-GCM encryption.',
    );
  }
  return globalThis.crypto.subtle;
}

export function guessMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'txt':
    case 'md':
    case 'csv':
      return 'text/plain;charset=utf-8';
    case 'json':
      return 'application/json';
    case 'doc':
      return 'application/msword';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    default:
      return 'application/octet-stream';
  }
}

async function deriveAesKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const subtle = assertWebCryptoAvailable();
  const encoder = new TextEncoder();
  const baseKey = await subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );
  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptDocumentFile(
  file: File,
  passphrase: string,
): Promise<{
  ivBase64: string;
  saltBase64: string;
  ciphertextBase64: string;
  sha256Fingerprint: string;
}> {
  const subtle = assertWebCryptoAvailable();
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await subtle.digest('SHA-256', arrayBuffer);
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 20);

  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(passphrase, salt);

  const encrypted = await subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    arrayBuffer,
  );

  return {
    ivBase64: toBase64(iv),
    saltBase64: toBase64(salt),
    ciphertextBase64: toBase64(new Uint8Array(encrypted)),
    sha256Fingerprint: hashHex,
  };
}

export async function decryptDocumentPayload(
  ciphertextBase64: string,
  ivBase64: string,
  saltBase64: string,
  passphrase: string,
): Promise<Uint8Array> {
  const subtle = assertWebCryptoAvailable();
  const salt = fromBase64(saltBase64);
  const iv = fromBase64(ivBase64);
  const ciphertext = fromBase64(ciphertextBase64);
  const key = await deriveAesKey(passphrase, salt);
  const decrypted = await subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    ciphertext as BufferSource,
  );
  return new Uint8Array(decrypted);
}
