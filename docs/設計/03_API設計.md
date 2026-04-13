# 03. API設計

## 1. 共通仕様

### 1.1 ベース URL
- `/v1`

### 1.2 認証
- Bearer Token を利用する
- Access Token と Refresh Token の 2 トークン構成

### 1.3 レスポンス形式

```ts
type SuccessResponse<T> = {
  success: true;
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type ErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};
```

## 2. 認証 API

### 2.1 エンドポイント
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

### 2.2 MVP 範囲外
- パスワード再発行
- メール認証

## 3. ユーザー設定 API

### 3.1 設定取得
- `GET /settings`

返却対象:
- `timezone`
- `subscriptionNotificationEnabled`
- `subscriptionNotificationDaysBefore`

### 3.2 設定更新
- `PATCH /settings`

## 4. カテゴリ API

### 4.1 取引カテゴリ
- `GET /transaction-categories`
- `POST /transaction-categories`
- `PATCH /transaction-categories/:id`
- `DELETE /transaction-categories/:id`

### 4.2 サブスクカテゴリ
- `GET /subscription-categories`
- `POST /subscription-categories`
- `PATCH /subscription-categories/:id`
- `DELETE /subscription-categories/:id`

## 5. レシート OCR API

### 5.1 OCR ジョブ作成
- `POST /receipt-ocr-jobs`
- `multipart/form-data`
- 画像アップロードを受け付ける

レスポンス:
- `jobId`
- `status`
- `expiresAt`

### 5.2 OCR ジョブ取得
- `GET /receipt-ocr-jobs/:id`

返却対象:
- `status`
- `extractedMerchant`
- `extractedDate`
- `extractedTotal`
- `rawText`
- `expiresAt`

### 5.3 OCR 結果確定
- `POST /receipt-ocr-jobs/:id/confirm`

リクエスト:
- `merchant`
- `amount`
- `transactionDate`
- `categoryId`
- `paymentMethod`
- `memo`
- `type`

処理:
- `receipts` を作成
- `transactions` を作成
- `rawText` を削除
- ジョブを `confirmed` に更新

### 5.4 OCR ジョブ破棄
- `DELETE /receipt-ocr-jobs/:id`

### 5.5 OCR 失敗時
- クライアントでは手動登録画面、再アップロード画面へ遷移可能とする

## 6. 取引 API

### 6.1 一覧取得
- `GET /transactions`

対応フィルタ:
- `type`
- `startDate`
- `endDate`
- `categoryId`
- `paymentMethod`
- `merchant`
- `keyword`

対応ソート:
- `transactionDate`
- `amount`

### 6.2 手動登録
- `POST /transactions`

### 6.3 詳細取得
- `GET /transactions/:id`

### 6.4 更新
- `PATCH /transactions/:id`

### 6.5 削除
- `DELETE /transactions/:id`

### 6.6 集計
- `GET /transactions/summary`

対応粒度:
- `day`
- `week`
- `month`
- `year`

対応種別:
- `expense`
- `income`

## 7. サブスク OCR API

### 7.1 OCR ジョブ作成
- `POST /subscription-ocr-jobs`

### 7.2 OCR ジョブ取得
- `GET /subscription-ocr-jobs/:id`

### 7.3 OCR 結果確定
- `POST /subscription-ocr-jobs/:id/confirm`

入力:
- `serviceName`
- `amount`
- `billingCycle`
- `nextPaymentDate`
- `categoryId`
- `status`
- `memo`

### 7.4 OCR ジョブ破棄
- `DELETE /subscription-ocr-jobs/:id`

## 8. サブスク API

### 8.1 一覧取得
- `GET /subscriptions`

### 8.2 手動登録
- `POST /subscriptions`

### 8.3 詳細取得
- `GET /subscriptions/:id`

### 8.4 更新
- `PATCH /subscriptions/:id`

### 8.5 削除
- `DELETE /subscriptions/:id`

### 8.6 集計取得
- `GET /subscriptions/summary`

返却対象:
- 月額換算合計
- カテゴリ別合計
- 直近の支払予定

## 9. ダッシュボード API

### 9.1 ダッシュボード概要取得
- `GET /dashboard`

返却対象:
- 今月の支出合計
- 先月比差額
- 先月比増減率
- サブスク合計金額
- 直近の支払い予定
- 月表示カレンダー用集計

## 10. 通知 API

### 10.1 一覧取得
- `GET /notifications`

### 10.2 既読化
- `PATCH /notifications/:id/read`

### 10.3 全件既読化
- `POST /notifications/read-all`

## 11. 検索 API

### 11.1 横断検索
- `GET /search`

対象:
- Transaction の `merchant`
- Transaction の `memo`
- Subscription の `service_name`

## 12. エクスポート API

### 12.1 取引 CSV
- `POST /exports/transactions`

### 12.2 サブスク CSV
- `POST /exports/subscriptions`

## 13. 定期ジョブ

### 13.1 OCR ジョブ掃除
- 期限切れの `receipt_ocr_jobs`
- 期限切れの `subscription_ocr_jobs`

### 13.2 通知生成
- ユーザー設定に基づいてサブスク支払通知を生成する

### 13.3 サブスク次回支払日の自動更新
- 毎日 AM 0:00 に実行する
- `status = active` かつ `next_payment_date` が今日以前のサブスクを対象とする
- `billing_cycle` に応じて `next_payment_date` を加算する
  - `monthly`: +1 ヶ月
  - `yearly`: +1 年
- 複数周期を跨いで滞留していた場合は、今日以降になるまで繰り返し加算する

## 14. エラーコード一覧

### 14.1 共通エラーコード

| code | HTTP ステータス | 説明 |
| --- | --- | --- |
| `UNAUTHORIZED` | 401 | 未認証、またはトークン不正 |
| `FORBIDDEN` | 403 | 認証済みだがリソースへのアクセス権なし |
| `NOT_FOUND` | 404 | 対象リソースが存在しない |
| `VALIDATION_ERROR` | 422 | 入力値が不正（`details` に項目ごとのエラーを含む） |
| `CONFLICT` | 409 | 重複登録など競合が発生 |
| `INTERNAL_ERROR` | 500 | サーバー内部エラー |

### 14.2 OCR 固有エラーコード

| code | HTTP ステータス | 説明 |
| --- | --- | --- |
| `OCR_JOB_NOT_FOUND` | 404 | 指定した OCR ジョブが存在しない |
| `OCR_JOB_EXPIRED` | 410 | OCR ジョブが期限切れで無効 |
| `OCR_JOB_ALREADY_CONFIRMED` | 409 | すでに確定済みの OCR ジョブに対する操作 |
| `OCR_PROCESSING_FAILED` | 500 | OCR 処理中にエラーが発生 |
| `OCR_INVALID_STATUS` | 422 | ジョブのステータスが操作を許可していない |

### 14.3 クライアント側の対処方針

| code | 推奨 UI 対応 |
| --- | --- |
| `UNAUTHORIZED` | ログイン画面へリダイレクト |
| `FORBIDDEN` | 「アクセスできません」トースト表示 |
| `NOT_FOUND` | 「見つかりません」トースト表示 |
| `VALIDATION_ERROR` | フォーム項目ごとにエラーメッセージ表示 |
| `OCR_JOB_EXPIRED` | 「セッションが切れました」+ 再アップロード導線 |
| `OCR_PROCESSING_FAILED` | 「読み取りに失敗しました」+ 手動入力 / 再アップロード導線 |
| `INTERNAL_ERROR` | 「エラーが発生しました。しばらく後に再試行してください」トースト表示 |
