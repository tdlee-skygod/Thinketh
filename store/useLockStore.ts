import { create } from 'zustand';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  DEFAULT_LOCK_TIMEOUT_SEC,
  readBiometricEnabled,
  readFailState,
  readLockTimeoutSec,
  readPinRecord,
  writeBiometricEnabled,
  writeFailState,
  writeLockTimeoutSec,
  writePinRecord,
} from '@/lib/secure';
import { generateSalt, hashPin, isValidPin, lockoutSeconds, verifyPin } from '@/lib/pin';

// 앱 잠금 (F-23, D-235). PIN·해시는 이 스토어 상태에 올리지 않는다(검증·저장은 lib/secure·lib/pin에서만).

export type LockStatus = 'loading' | 'needs_setup' | 'locked' | 'unlocked';
export type PinCheckResult = 'ok' | 'wrong' | 'wait';

interface LockState {
  status: LockStatus;
  biometricEnabled: boolean;
  lockTimeoutSec: number;
  failCount: number;
  lockUntilMs: number | null;       // 연속 실패 대기 종료 시각(epoch ms)
  backgroundedAt: number | null;
  init: () => Promise<void>;
  setupPin: (pin: string, enableBiometric: boolean) => Promise<void>;
  checkPin: (pin: string) => Promise<PinCheckResult>;           // 실패 횟수·대기 시간 반영, 상태는 바꾸지 않음
  unlock: (pin: string) => Promise<PinCheckResult>;             // checkPin 성공 시 unlocked
  unlockWithBiometric: () => Promise<boolean>;
  authenticateDevice: (message: string) => Promise<boolean>;    // 기기 잠금(지문·화면 비밀번호) 인증
  changePin: (newPin: string) => Promise<void>;                 // 이미 해제된 상태에서 호출
  setBiometricEnabled: (enabled: boolean) => Promise<boolean>;
  setLockTimeoutSec: (sec: number) => Promise<void>;
  onBackground: () => void;
  onForeground: () => void;
}

export async function isBiometricAvailable(): Promise<boolean> {
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

// 기기에 화면 잠금(PIN/패턴/지문 등)이 설정되어 있는가 — PIN 재설정이 가능한 조건
export async function hasDeviceLock(): Promise<boolean> {
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    return level !== LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

export const useLockStore = create<LockState>((set, get) => ({
  status: 'loading',
  biometricEnabled: false,
  lockTimeoutSec: DEFAULT_LOCK_TIMEOUT_SEC,
  failCount: 0,
  lockUntilMs: null,
  backgroundedAt: null,

  init: async () => {
    try {
      const [record, biometricEnabled, lockTimeoutSec, fail] = await Promise.all([
        readPinRecord(),
        readBiometricEnabled(),
        readLockTimeoutSec(),
        readFailState(),
      ]);
      set({
        status: record ? 'locked' : 'needs_setup',
        biometricEnabled,
        lockTimeoutSec,
        failCount: fail.failCount,
        lockUntilMs: fail.lockUntilMs,
      });
    } catch (e) {
      // 보안 저장소를 읽지 못하면 잠금 해제 상태로 두지 않는다
      console.error('[useLockStore] init', e instanceof Error ? e.message : 'error');
      set({ status: 'locked' });
    }
  },

  setupPin: async (pin, enableBiometric) => {
    if (!isValidPin(pin)) throw new Error('PIN 형식 오류');
    const salt = generateSalt();
    const hash = await hashPin(pin, salt);
    await writePinRecord({ hash, salt });
    await writeFailState(0, null);
    await writeBiometricEnabled(enableBiometric);
    set({ status: 'unlocked', biometricEnabled: enableBiometric, failCount: 0, lockUntilMs: null });
  },

  checkPin: async (pin) => {
    const { lockUntilMs, failCount } = get();
    if (lockUntilMs && lockUntilMs > Date.now()) return 'wait';

    const record = await readPinRecord();
    if (!record) return 'wrong';

    if (await verifyPin(pin, record.salt, record.hash)) {
      await writeFailState(0, null);
      set({ failCount: 0, lockUntilMs: null });
      return 'ok';
    }

    const nextCount = failCount + 1;
    const waitSec = lockoutSeconds(nextCount);
    const nextLockUntil = waitSec > 0 ? Date.now() + waitSec * 1000 : null;
    await writeFailState(nextCount, nextLockUntil);
    set({ failCount: nextCount, lockUntilMs: nextLockUntil });
    return waitSec > 0 ? 'wait' : 'wrong';
  },

  unlock: async (pin) => {
    const result = await get().checkPin(pin);
    if (result === 'ok') set({ status: 'unlocked', backgroundedAt: null });
    return result;
  },

  unlockWithBiometric: async () => {
    if (!get().biometricEnabled) return false;
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Thinketh 잠금 해제',
        disableDeviceFallback: true,
        cancelLabel: 'PIN 입력',
      });
      if (result.success) {
        set({ status: 'unlocked', backgroundedAt: null });
        return true;
      }
    } catch {
      // 생체인증 실패는 PIN 입력으로 이어진다
    }
    return false;
  },

  authenticateDevice: async (message) => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: message,
        disableDeviceFallback: false,
      });
      return result.success;
    } catch {
      return false;
    }
  },

  changePin: async (newPin) => {
    if (!isValidPin(newPin)) throw new Error('PIN 형식 오류');
    const salt = generateSalt();
    const hash = await hashPin(newPin, salt);
    await writePinRecord({ hash, salt });
  },

  setBiometricEnabled: async (enabled) => {
    if (enabled) {
      // 켤 때 한 번 인증해 실제로 사용할 수 있는지 확인한다
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: '생체인증을 사용하려면 인증해 주세요',
          disableDeviceFallback: true,
        });
        if (!result.success) return false;
      } catch {
        return false;
      }
    }
    await writeBiometricEnabled(enabled);
    set({ biometricEnabled: enabled });
    return true;
  },

  setLockTimeoutSec: async (sec) => {
    await writeLockTimeoutSec(sec);
    set({ lockTimeoutSec: sec });
  },

  onBackground: () => {
    if (get().status === 'unlocked' && get().backgroundedAt === null) set({ backgroundedAt: Date.now() });
  },

  onForeground: () => {
    const { status, backgroundedAt, lockTimeoutSec } = get();
    if (status !== 'unlocked' || backgroundedAt === null) return;
    const elapsedSec = (Date.now() - backgroundedAt) / 1000;
    set(elapsedSec >= lockTimeoutSec ? { status: 'locked', backgroundedAt: null } : { backgroundedAt: null });
  },
}));
