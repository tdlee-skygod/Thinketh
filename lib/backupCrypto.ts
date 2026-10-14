import { scryptAsync } from '@noble/hashes/scrypt.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { getRandomBytes } from 'expo-crypto';

// 백업 파일 암호화 (D-237). 비밀번호에서 scrypt로 키를 만들고 XChaCha20-Poly1305로 암호화한다.
// 헤더(형식·버전·kdf 파라미터·솔트)를 인증 데이터(AAD)로 묶어, 헤더나 암호문이 바뀌면 복호화가 실패한다.
// 비밀번호·평문은 로그에 남기지 않는다 (D-244).

export const MIN_PASSWORD_LENGTH = 8;

const FORMAT = 'thinketh-backup';
const FORMAT_VERSION = 1;
const SCRYPT_N = 2 ** 14;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 32;
const SALT_LEN = 16;
const NONCE_LEN = 24;

// 가져오기 때 파일이 요구하는 비용의 상한 — 악의적인 파일로 기기를 멈추게 하지 못하게 한다
const MAX_N = 2 ** 16;
const MAX_R = 16;
const MAX_P = 4;

export type BackupErrorCode =
  | 'bad_format'              // 이 앱의 백업 파일이 아니거나 구조가 깨짐
  | 'unsupported_version'     // 더 새로운 형식
  | 'wrong_password_or_tampered' // 비밀번호가 틀렸거나 파일이 변조됨(둘을 구분하지 않는다)
  | 'too_large'
  | 'invalid_payload'         // 복호화는 됐지만 내용 검증 실패
  | 'weak_password';

export class BackupError extends Error {
  constructor(public readonly code: BackupErrorCode, message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

interface Envelope {
  format: string;
  formatVersion: number;
  kdf: { name: 'scrypt'; N: number; r: number; p: number; salt: string };
  nonce: string;
  data: string;
}

// Hermes에 TextDecoder가 있다고 가정하지 않고 직접 UTF-8 복호화한다(한글·이모지 포함). 깨진 바이트면 던진다
function bytesToUtf8(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i++];
    let cp: number;
    if (b < 0x80) {
      cp = b;
    } else if (b >= 0xc2 && b < 0xe0) {
      cp = ((b & 0x1f) << 6) | (bytes[i++] & 0x3f);
    } else if (b >= 0xe0 && b < 0xf0) {
      cp = ((b & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
    } else if (b >= 0xf0 && b < 0xf5) {
      cp = ((b & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
    } else {
      throw new Error('invalid utf-8');
    }
    out += String.fromCodePoint(cp);
  }
  return out;
}

function aadFor(version: number, kdf: Envelope['kdf']): Uint8Array {
  return utf8ToBytes(`${FORMAT}|${version}|${kdf.name}|${kdf.N}|${kdf.r}|${kdf.p}|${kdf.salt}`);
}

async function deriveKey(password: string, salt: Uint8Array, N: number, r: number, p: number): Promise<Uint8Array> {
  return scryptAsync(utf8ToBytes(password.normalize('NFKC')), salt, { N, r, p, dkLen: KEY_LEN });
}

export async function encryptBackup(plaintext: string, password: string): Promise<string> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new BackupError('weak_password', `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 해요.`);
  }

  const salt = getRandomBytes(SALT_LEN);
  const nonce = getRandomBytes(NONCE_LEN);
  const kdf: Envelope['kdf'] = { name: 'scrypt', N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, salt: bytesToHex(salt) };

  const key = await deriveKey(password, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P);
  const data = xchacha20poly1305(key, nonce, aadFor(FORMAT_VERSION, kdf)).encrypt(utf8ToBytes(plaintext));

  const envelope: Envelope = { format: FORMAT, formatVersion: FORMAT_VERSION, kdf, nonce: bytesToHex(nonce), data: bytesToHex(data) };
  return JSON.stringify(envelope);
}

function parseEnvelope(text: string): Envelope {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('bad_format', '백업 파일이 아니에요.');
  }
  const e = raw as Partial<Envelope> | null;
  if (!e || typeof e !== 'object' || e.format !== FORMAT) {
    throw new BackupError('bad_format', '이 앱의 백업 파일이 아니에요.');
  }
  if (typeof e.formatVersion !== 'number' || !Number.isInteger(e.formatVersion) || e.formatVersion < 1) {
    throw new BackupError('bad_format', '백업 파일 형식이 올바르지 않아요.');
  }
  if (e.formatVersion > FORMAT_VERSION) {
    throw new BackupError('unsupported_version', '더 새로운 버전의 앱에서 만든 백업이에요. 앱을 업데이트해 주세요.');
  }
  const k = e.kdf;
  if (
    !k || k.name !== 'scrypt' ||
    !Number.isInteger(k.N) || !Number.isInteger(k.r) || !Number.isInteger(k.p) ||
    k.N < 2 || k.N > MAX_N || (k.N & (k.N - 1)) !== 0 || k.r < 1 || k.r > MAX_R || k.p < 1 || k.p > MAX_P ||
    typeof k.salt !== 'string' || typeof e.nonce !== 'string' || typeof e.data !== 'string'
  ) {
    throw new BackupError('bad_format', '백업 파일 형식이 올바르지 않아요.');
  }
  return e as Envelope;
}

// 평문(JSON 문자열)을 돌려준다. 비밀번호가 틀리거나 파일이 변조되면 'wrong_password_or_tampered'
export async function decryptBackup(text: string, password: string): Promise<string> {
  const envelope = parseEnvelope(text);

  let salt: Uint8Array;
  let nonce: Uint8Array;
  let data: Uint8Array;
  try {
    salt = hexToBytes(envelope.kdf.salt);
    nonce = hexToBytes(envelope.nonce);
    data = hexToBytes(envelope.data);
  } catch {
    throw new BackupError('bad_format', '백업 파일 형식이 올바르지 않아요.');
  }
  if (salt.length !== SALT_LEN || nonce.length !== NONCE_LEN) {
    throw new BackupError('bad_format', '백업 파일 형식이 올바르지 않아요.');
  }

  const { N, r, p } = envelope.kdf;
  const key = await deriveKey(password, salt, N, r, p);
  try {
    const plain = xchacha20poly1305(key, nonce, aadFor(envelope.formatVersion, envelope.kdf)).decrypt(data);
    return bytesToUtf8(plain);
  } catch {
    throw new BackupError('wrong_password_or_tampered', '비밀번호가 틀렸거나 파일이 손상되었어요.');
  }
}
