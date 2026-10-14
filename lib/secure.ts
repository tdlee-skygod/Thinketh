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
