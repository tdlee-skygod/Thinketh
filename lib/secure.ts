import * as SecureStore from 'expo-secure-store';
import { getRandomBytes } from 'expo-crypto';

// 보안 저장소(Android Keystore). 키 값은 로그·화면·파일에 남기지 않는다 (D-244).
const DB_KEY_NAME = 'db_key';

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}

// 저장된 DB 암호화 키(256비트 hex)를 반환한다. 없으면 null — 첫 실행인지 키 분실인지는 호출부가 DB 파일 유무로 구분한다.
export async function readDbKey(): Promise<string | null> {
  return SecureStore.getItemAsync(DB_KEY_NAME);
}

// 새 무작위 256비트 키를 만들어 저장하고 반환한다. 이미 키가 있으면 호출하지 않는다 (덮어쓰면 기존 DB를 열 수 없다).
export async function createDbKey(): Promise<string> {
  const key = toHex(getRandomBytes(32));
  await SecureStore.setItemAsync(DB_KEY_NAME, key);
  return key;
}

// ── 앱 잠금 상태 (D-235) ──────────────────────────────────────────
// 자동 잠금 시간도 여기에 둔다: DB를 열기 전에 잠금 여부를 판단해야 하기 때문이다.
const PIN_HASH = 'pin_hash';
const PIN_SALT = 'pin_salt';
const PIN_FAIL_COUNT = 'pin_fail_count';
const PIN_LOCK_UNTIL = 'pin_lock_until';
const BIOMETRIC_ENABLED = 'biometric_enabled';
const LOCK_TIMEOUT_SEC = 'lock_timeout_sec';

export const DEFAULT_LOCK_TIMEOUT_SEC = 30;

export interface PinRecord {
  hash: string;
  salt: string;
}

export async function readPinRecord(): Promise<PinRecord | null> {
  const [hash, salt] = await Promise.all([SecureStore.getItemAsync(PIN_HASH), SecureStore.getItemAsync(PIN_SALT)]);
  return hash && salt ? { hash, salt } : null;
}

export async function writePinRecord(record: PinRecord): Promise<void> {
  await SecureStore.setItemAsync(PIN_HASH, record.hash);
  await SecureStore.setItemAsync(PIN_SALT, record.salt);
}

export async function readFailState(): Promise<{ failCount: number; lockUntilMs: number | null }> {
  const [count, until] = await Promise.all([
    SecureStore.getItemAsync(PIN_FAIL_COUNT),
    SecureStore.getItemAsync(PIN_LOCK_UNTIL),
  ]);
  const failCount = Number(count);
  const lockUntilMs = Number(until);
  return {
    failCount: Number.isInteger(failCount) && failCount > 0 ? failCount : 0,
    lockUntilMs: Number.isFinite(lockUntilMs) && lockUntilMs > 0 ? lockUntilMs : null,
  };
}

export async function writeFailState(failCount: number, lockUntilMs: number | null): Promise<void> {
  await SecureStore.setItemAsync(PIN_FAIL_COUNT, String(failCount));
  await SecureStore.setItemAsync(PIN_LOCK_UNTIL, lockUntilMs === null ? '' : String(lockUntilMs));
}

export async function readBiometricEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(BIOMETRIC_ENABLED)) === '1';
}

export async function writeBiometricEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(BIOMETRIC_ENABLED, enabled ? '1' : '0');
}

export async function readLockTimeoutSec(): Promise<number> {
  const raw = await SecureStore.getItemAsync(LOCK_TIMEOUT_SEC);
  const value = Number(raw);
  return raw !== null && Number.isFinite(value) && value >= 0 ? value : DEFAULT_LOCK_TIMEOUT_SEC;
}

export async function writeLockTimeoutSec(sec: number): Promise<void> {
  await SecureStore.setItemAsync(LOCK_TIMEOUT_SEC, String(sec));
}
