# 빌드 & 환경 설정 — Thinketh

> v2(2026.10.14, D-234~D-254): 서버 없는 로컬 전용 앱으로 전환한다. 아래 표기 — 📝 v2 계획(코드 미반영) / 나머지는 현재(✅) 환경이다.
> **v2는 Expo Go로 개발할 수 없다.** SQLCipher·알림·위젯이 네이티브 코드를 쓰므로 개발용 빌드(dev build)가 필요하다. 빌드는 요청이 있을 때만 수행한다(CLAUDE.md).

## v2 의존성 변경 계획 📝

| 구분 | 패키지 | 사유 |
|---|---|---|
| 추가 | `expo-sqlite`(SQLCipher 옵션 `useSQLCipher`) | 암호화 로컬 DB (D-236) |
| 추가 | `expo-secure-store` | DB 키, PIN 해시 (D-235, D-236) |
| 추가 | `expo-local-authentication` | 생체인증, PIN 재설정 (D-235) |
| 추가 | `expo-crypto` | 무작위 키 생성 |
| 추가 | `expo-screen-capture` | 잠금·백그라운드 때만 화면 가림 (D-235) |
| 추가 | `@noble/ciphers`, `@noble/hashes` | 백업 파일 암호화 (D-237) |
| 추가 | `expo-file-system`, `expo-sharing`, `expo-document-picker` | 내보내기/가져오기 |
| 유지 | `expo-notifications` | 로컬 예약 알림 (D-241) |
| 유지 | `@react-native-community/datetimepicker`, `expo-linear-gradient`, `expo-font`, `react-native-svg`, `zustand` | Time 탭·기간 입력 등 |
| 제거 | `expo-speech`, `expo-speech-recognition`(+ `app.json` 플러그인) | 목표 탭 삭제 (D-240) |
| 제거(단계 0) | `@supabase/supabase-js`, `@react-native-async-storage/async-storage` | Supabase 폐기 (D-234, D-238) |

정확한 버전은 `npx expo install`로 Expo SDK 57에 맞춘다. `expo-sqlite`의 SQLCipher 옵션은 구현 시점에 SDK 57에서 동작하는지 확인한다.

## v2 네이티브 변경 체크리스트 📝

1. `app.json` 플러그인에 `["expo-sqlite", { "useSQLCipher": true }]` 추가, 음성 인식 플러그인 제거
2. `AndroidManifest.xml`: `allowBackup="false"`(D-236). **`INTERNET` 권한은 `main`에서 제거하고 `src/debug`·`src/debugOptimized`의 매니페스트에 추가**(D-246 — 현재 `INTERNET`은 `main`에만 있어, 옮기지 않으면 디버그 빌드가 Metro에 연결하지 못함). 최종 릴리즈 병합 매니페스트에 `INTERNET`이 다시 들어오지 않았는지 확인. 마지막 단계에서 불필요 권한 제거(D-244): `SYSTEM_ALERT_WINDOW`, `RECORD_AUDIO`, `FOREGROUND_SERVICE*`, `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`, `READ/WRITE_EXTERNAL_STORAGE`, `RECEIVE_BOOT_COMPLETED`(알림 재예약에 필요하면 유지)
3. 단계 8: 위젯 Kotlin 코드·리소스(XML)·매니페스트 `<receiver>` 추가
4. 단계 9: `Ticker*.kt`, `BootReceiver.kt` 삭제와 `MainApplication.kt`의 `add(TickerPackage())` 제거
5. 프리빌드는 `--clean` 없이 병합한다. `android/`는 git으로 추적하므로(D-253) 실수로 덮어써도 `git diff`/`git checkout`으로 복구한다. `--clean`을 쓰면 아래 "주요 Gradle 설정"과 키스토어 설정(`keystore.properties`는 git에 없음)을 다시 적용해야 한다.
6. **기존 설치 앱**: 데이터를 이전하지 않으므로 기존 앱을 삭제(또는 앱 데이터 삭제)한 뒤 새로 설치하는 것을 권장한다 — 덮어 설치하면 이전 버전이 AsyncStorage에 저장한 Supabase 세션 토큰이 기기에 남는다.
7. **git**: 원격 `https://github.com/tdlee-skygod/Thinketh`(Public), 작업 브랜치 `v2.0.0-20261014`(D-254). `.gitignore`는 `android/`를 추적하되 `build/`, `.gradle/`, `.cxx/`, `local.properties`, `*.apk`, `*.aab`, `*.keystore`, `keystore.properties`를 제외한다(D-253). push 전 비밀값 점검은 conventions.md § 7.


## 기술 스택

| 항목 | 버전/내용 |
|------|---------|
| Expo SDK | 57 (`expo ~57.0.18`) |
| React Native | 0.86.3 |
| React | 19.2.3 |
| Node.js | v24.x (npm 11.x) |
| 상태관리 | Zustand (`^5.0.15`) |
| DB | 📝 암호화 로컬 SQLite(`expo-sqlite` + SQLCipher). 서버 없음(D-234) |
| 라우팅 | `expo-router ~57.0.17` (entry: `expo-router/entry`, `main` in package.json) |
| 주요 패키지 | `expo-router`, `react-native-safe-area-context`, `react-native-screens`, `expo-linking`, `expo-constants`, `expo-notifications`, `expo-linear-gradient`, `@react-native-community/datetimepicker`, `expo-splash-screen`, `react-native-svg`, `expo-font`, `zustand` (제거 예정: `@supabase/supabase-js`, `@react-native-async-storage/async-storage`, `expo-speech`, `expo-speech-recognition` — 단계 0) |
| Android 패키지명 | `com.sskygod21.thinketh` (prebuild 시 자동 결정됨) |

> npm 설치 시 `--legacy-peer-deps` 필요: expo-router가 끌어오는 웹 전용 패키지(radix-ui 계열)가 요구하는 `react-dom` peer 버전과 `react` 버전이 어긋나는 문제가 있어 `.npmrc`에 `legacy-peer-deps=true`를 고정해두었다.

## 앱 아이콘 / 스플래시

- 원본 소스: 프로젝트 루트의 `Thinketh.png` (브랜드 아이콘 이미지)
- `assets/icon.png`, `assets/favicon.png`, `assets/android-icon-foreground.png`, `assets/splash-icon.png`는 `Thinketh.png`에서 아이콘 정사각형 부분만 크롭해 생성했다.
- Android 어댑티브 아이콘: `app.json`의 `android.adaptiveIcon.backgroundColor`를 `#5b21b6`(브랜드 퍼플)로 설정, `foregroundImage`는 세이프존을 고려해 투명 배경에 인셋 배치.
- 스플래시: `expo-splash-screen` 플러그인으로 `assets/splash-icon.png` + `backgroundColor: #1e1b4b`(`COLORS.primaryDark`) 설정 — 실행 화면부터 앱 진입까지 색 톤이 이어지도록 함. 시작 중에는 폰트·잠금·DB 열기가 끝날 때까지 스플래시를 유지한다(D-253).

## 환경 변수

📝 v2에서는 환경 변수가 필요 없다(서버 없음). 단계 0에서 `.env`/`.env.example`의 `EXPO_PUBLIC_SUPABASE_*`를 삭제한다. 그 전까지 `.env`는 커밋 금지(`.gitignore`).

## 개발 서버 실행

```powershell
# ✅ 현재 개발 서버 — 📝 v2부터는 Expo Go 불가(SQLCipher·알림·위젯), 개발용 빌드를 설치한 기기에 연결한다
$env:EXPO_NO_DOCTOR="1"; npx expo start --lan

# 기기 직접 연결
npx expo start --localhost
```

## Android 릴리즈 APK 빌드 (로컬 PC)

### 사전 준비 (최초 1회 또는 네이티브 변경 시)

```powershell
# android/ 디렉터리 재생성
npx expo prebuild --platform android --clean
```

### 빌드 명령

```powershell
cd android
.\gradlew assembleRelease --no-daemon
```

### 출력 파일

```
android/app/build/outputs/apk/release/app-release.apk
```

### 빌드 성공 확인

```powershell
# PowerShell exit code 255여도 APK 존재 시 성공
Get-Item "android\app\build\outputs\apk\release\app-release.apk"
```

### 기기 설치 (WiFi ADB)

```powershell
adb devices                                              # 기기 확인
adb -s [기기ID] install -r android\app\build\outputs\apk\release\app-release.apk
```

## 주요 Gradle 설정

```properties
# android/gradle.properties
reactNativeArchitectures=arm64-v8a   # APK 크기 축소 + 로컬 테스트 빌드 시간 단축(실기기 하나만 컴파일)

# New Architecture(Fabric/TurboModule) 비활성화 — 구 모듈 호환성뿐 아니라, Windows 로컬 빌드에서
# 간헐적으로 발생하는 "ninja: fatal: CreateProcess failed" 오류의 실제 원인이 New Architecture의
# 코드젠 C++ 컴파일(*-generated.cpp)인 경우가 있었다.
# 이 키가 실제로 작동하는지는 Expo SDK 버전에 따라 다르다 — 일부 최신 SDK는 New Architecture가
# 강제되어 이 키를 무시한다. 그런 경우 앱 기능상 문제가 없다면 이 키가 유효한 SDK 버전으로
# 낮추는 것도 고려한다.
newArchEnabled=false

# 위 설정으로도 CreateProcess 오류가 계속되고, 개발 PC 메모리가 넉넉하지 않다면(예: 8GB 이하 여유)
# ninja의 기본 병렬도가 원인일 수 있다. 이 경우에만 병렬도를 낮춰서 재시도한다.
org.gradle.workers.max=3
```

```powershell
# gradle.properties의 workers.max와 함께 ninja 자체의 병렬 컴파일 job 수도 낮춰서 빌드하면
# 위 메모리 부족 증상을 더 확실히 방지할 수 있다.
cd android
$env:CMAKE_BUILD_PARALLEL_LEVEL="3"; .\gradlew assembleRelease --no-daemon
```

> ⚠️ **`npx expo prebuild --clean`을 실행하면 `android/` 전체가 새로 생성되며 위 설정이 초기화된다.**
> `--clean` prebuild 직후에는 `reactNativeArchitectures`/`newArchEnabled`/`org.gradle.workers.max`를 반드시 다시 추가한다.

> Windows에서 프로젝트 경로가 깊으면(`C:\Users\...\어쩌고\저쩌고\...`) 260자 경로 제한에 걸려
> 네이티브 코드젠 빌드가 `Filename longer than 260 characters`로 실패할 수 있다.
> 되도록 `C:\Dev\Thinketh`처럼 짧은 경로를 쓴다.

## 삭제 예정 네이티브 코드 (D-244)

`TickerService.kt`, `TickerModule.kt`, `TickerPackage.kt`, `BootReceiver.kt`와 매니페스트 항목은 아직 `android/`에 남아 있다. **마지막 단계(9)에서 삭제**하며, 삭제 시 `MainApplication.kt`의 `add(TickerPackage())`와 매니페스트의 `<service android:name=".TickerService">`, `<receiver android:name=".BootReceiver">`를 함께 제거한다.

## 실기기 디버그 빌드 & 설치 (WiFi ADB, 개발 중 테스트용)

릴리즈 서명 없이 빠르게 실기기에서 확인할 때 사용한 실제 절차:

```powershell
# 1. 기기와 페어링(최초 1회, 기기의 무선 디버깅 화면에 표시된 값 사용)
adb pair <기기IP>:<페어링포트> <페어링코드>
adb connect <기기IP>:<연결포트>

# 2. 네이티브 프로젝트 생성(최초 1회 또는 --clean 이후)
npx expo prebuild --platform android
# gradle.properties 튜닝 재적용 (위 "주요 Gradle 설정" 참고)

# 3. 디버그 APK 빌드 (서명 불필요, assembleRelease보다 빠름)
cd android
.\gradlew assembleDebug --no-daemon
# 출력: android/app/build/outputs/apk/debug/app-debug.apk

# 4. 설치
adb -s <기기IP>:<연결포트> install -r android\app\build\outputs\apk\debug\app-debug.apk

# 5. Metro 번들러 실행 + 포트 연결 (디버그 APK는 JS를 Metro에서 받아온다)
adb -s <기기IP>:<연결포트> reverse tcp:8081 tcp:8081
npx expo start --port 8081
# 주의: --android 플래그를 쓰면 Expo CLI가 Expo Go를 열려고 시도할 수 있다(우리 앱이 아님) — 플래그 없이 실행

# 6. 앱 직접 실행/재실행
adb -s <기기IP>:<연결포트> shell am force-stop com.sskygod21.thinketh
adb -s <기기IP>:<연결포트> shell am start -n com.sskygod21.thinketh/.MainActivity
```

> Metro를 백그라운드로 띄워두는 도구(예: 자동화 세션의 background bash)가 일정 시간 후 프로세스를 종료시킬 수 있다. 오래 테스트할 때는 별도 터미널 창에서 `npx expo start`를 직접 띄워두는 것이 안정적이다.

## 서명 키스토어 (D-223)

```
파일: android/app/thinketh.keystore  (PKCS12, 절대 커밋 금지 — .gitignore에 *.keystore)
비밀번호/alias: android/keystore.properties (절대 커밋 금지 — .gitignore에 keystore.properties)
```

`android/app/build.gradle`은 `android/keystore.properties`가 있으면 그 값으로 `release` 빌드타입을 서명하고, 없으면 `debug` 키로 폴백한다(비밀번호를 build.gradle에 하드코딩하지 않음). v2에서 서명 구성은 변경하지 않는다.

```properties
# android/keystore.properties 형식
storeFile=thinketh.keystore
storePassword=...
keyAlias=thinketh
keyPassword=...
```

> ⚠️ 두 파일은 git에 없다(공개 저장소). **프로젝트 밖(비밀번호 관리자, 안전한 백업 등)에 반드시 별도 보관**한다 — 분실하면 이후 릴리스를 같은 키로 서명할 수 없어 기존 설치본과 업데이트 호환이 끊기고, 서버가 없어 앱을 지우고 재설치하면 **데이터가 사라진다**(D-236). 내보내기 백업(F-25)을 정기적으로 만든다.

## iOS

v2 범위에서 iOS는 빌드·검증하지 않는다(D-249).

## 트러블슈팅

| 증상 | 해결 |
|------|------|
| Gradle 빌드 실패 | `cd android && .\gradlew clean` 후 재시도 |
| Metro 포트 충돌 | `npx kill-port 8081` |
| Expo prebuild 오류 | `node_modules` 삭제 후 `npm install` |
| `ninja: fatal: CreateProcess ...` (원인불명 네이티브 빌드 실패) | 먼저 `newArchEnabled=false`가 실제로 적용됐는지 확인. 이 키가 무시되는 SDK 버전이라면 SDK를 낮추는 것을 고려. 그래도 재현되면 메모리 부족 가능성 — `org.gradle.workers.max=3` + `CMAKE_BUILD_PARALLEL_LEVEL=3` 적용 후 재시도 |
| `Filename longer than 260 characters` | Windows 경로 길이 제한 — 프로젝트를 짧은 경로(`C:\Dev\Thinketh`)로 이동 |
| `--clean` prebuild 이후 빌드가 갑자기 다시 느려지거나 실패함 | `android/gradle.properties`가 초기화된 것 — 위 "주요 Gradle 설정" 재적용 |
| v2 기능(SQLCipher, 알림, 위젯)이 Expo Go에서 동작하지 않음 | 예상된 제약 — 개발용 빌드로 테스트 |
| `npx expo start --android` 실행 시 우리 앱이 아니라 Expo Go가 열리거나 업데이트됨 | `--android` 플래그의 자동 오픈 로직이 Dev Client 마커가 없으면 Expo Go를 기본으로 열려고 시도함 — 플래그 없이 `npx expo start`만 실행하고 `adb shell am start`로 직접 앱을 실행 |
| Android 13+ 기기에서 알림이 전혀 안 뜸 | `AndroidManifest.xml`의 `POST_NOTIFICATIONS` 권한과 설정에서 알림 항목을 켰는지 확인(`prebuild --clean` 이후 누락 여부 포함) |
| 앱 데이터를 지운 뒤 "데이터를 열 수 없음" 오류 | DB 키가 SecureStore에서 사라져 복구 불가(D-236) — DB 열기 실패 화면에서 내보내기 백업 파일로 가져오기(D-253) |
