# Walleca モバイル

Walleca の Flutter モバイルクライアント（Android / iOS）です。

## 必要環境

- [Flutter SDK](https://flutter.dev/docs/get-started/install) 3.0 以上
- Android Studio または VS Code + Flutter 拡張

## セットアップ

1. Flutter をインストールし、`flutter doctor` で問題がないことを確認する。
2. リポジトリルートの `mobile` ディレクトリで以下を実行する。

```bash
cd mobile
flutter pub get
```

## 実行

### Android

```bash
flutter run
```

エミュレータまたは実機が 1 台だけ接続されている必要があります。

### iOS（macOS のみ）

```bash
flutter run
```

## プロジェクト構造

```
mobile/
├── lib/
│   └── main.dart      # エントリポイント
├── android/           # Android ネイティブ
├── ios/               # iOS ネイティブ
│   ├── Runner/        # アプリ本体（Info.plist, AppDelegate, ストーリーボード）
│   ├── Flutter/       # Flutter 設定（xcconfig）
│   └── Podfile        # CocoaPods
├── test/
├── pubspec.yaml
└── README.md
```

**iOS ビルド時（macOS のみ）:** 初回は `flutter pub get` を実行すると `ios/Flutter/Generated.xcconfig` が更新され、`pod install` で CocoaPods が入ります。Xcode では `ios/Runner.xcworkspace` を開いてください（`pod install` 実行後）。

## API 接続

本番・検証環境の API ベース URL は、今後の実装で環境ごとに設定してください（例: `lib/config/env.dart`）。
