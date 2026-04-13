import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { Job, Worker } from 'bullmq';
import sharp from 'sharp';
import { createWorker, PSM, setLogging } from 'tesseract.js';
import { prisma } from '../config/database';
import { connection, OcrJobData, QUEUE_NAMES } from '../config/queue';
import { extractReceiptFields, ExtractedReceiptFields } from '../utils/receipt-ocr';
import { inferSubscriptionFields } from '../utils/subscription-ocr';
import { maybeConvertDetectedUsdAmountToJpy } from '../utils/currency-conversion';
import { logger } from '../utils/logger';

// OCR に使用する言語（デフォルトは日本語＋英語）
const OCR_LANG = process.env.OCR_LANG || 'jpn+eng';
// OCR ジョブの同時実行数
const OCR_CONCURRENCY = Number.parseInt(process.env.OCR_CONCURRENCY || '1', 10);
// OCR 処理の進捗をデバッグログとして出力するか
const OCR_LOG_PROGRESS = process.env.OCR_LOG_PROGRESS === 'true';
// 複数の画像前処理バリアントで OCR を行うマルチパスモード（true がデフォルト）
const OCR_MULTI_PASS = process.env.OCR_MULTI_PASS !== 'false';
// 画像の最大幅（ピクセル）。これを超える場合はリサイズする
const OCR_IMAGE_MAX_WIDTH = Number.parseInt(process.env.OCR_IMAGE_MAX_WIDTH || '2800', 10);
// 2値化（白黒変換）の閾値。小さいほど暗い部分も白になる
const OCR_BINARY_THRESHOLD = Number.parseInt(process.env.OCR_BINARY_THRESHOLD || '150', 10);
// レシートOCRに最適化: 高解像度ターゲット (300 DPI 相当)
const OCR_TARGET_DPI = Number.parseInt(process.env.OCR_TARGET_DPI || '300', 10);

// Tesseract.js のワーカーインスタンス（シングルトン）
let ocrWorker: Awaited<ReturnType<typeof createWorker>> | null = null;
// ワーカー初期化の Promise（同時に複数回初期化されないよう管理する）
let ocrWorkerPromise: Promise<Awaited<ReturnType<typeof createWorker>>> | null = null;
// プロセスシグナルのシャットダウンフックを重複登録しないためのフラグ
let shutdownHookRegistered = false;
// Tesseract.js は並列呼び出しに対応していないため、1ジョブずつ直列実行するためのロック
let ocrExecutionLock: Promise<void> = Promise.resolve();

// OCR 処理のバリアント（前処理の種類・画像・ページセグメンテーションモード）の型
interface OcrVariant {
  strategy: string;
  image: string | Buffer;
  psm: PSM;
}

// 1回の OCR 試行の結果を格納する型
interface OcrAttemptResult {
  strategy: string;
  confidence: number | null;  // Tesseract が報告する信頼度スコア（0〜100）
  fields: ExtractedReceiptFields;
  score: number;              // 抽出フィールドの品質スコア（date/total/merchant の有無で計算）
  textLength: number;
}

// 数値型かつ有限値であれば返し、そうでなければ null を返す
function asFiniteNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

// OCR で抽出したフィールドの品質スコアを計算する
// date・total・merchant の有無、テキスト長、Tesseract の信頼度を加味してスコアを返す
function scoreExtractedFields(
  fields: ExtractedReceiptFields,
  confidence: number | null
): number {
  const compactTextLength = fields.rawText.replace(/\s/g, '').length;

  let score = 0;

  if (fields.date) {
    score += 8;
  }

  if (fields.total !== null) {
    score += 10;
    // 異常に大きな金額は誤認識の可能性があるため減点する
    if (fields.total > 1_000_000) {
      score -= 2;
    }
  }

  if (fields.merchant) {
    score += 6;
    if (fields.merchant.length >= 4) {
      score += 1;
    }
  }

  // テキスト量に比例したボーナス（最大 4 点）
  score += Math.min(4, compactTextLength / 120);

  // Tesseract の信頼度スコアに基づくボーナス（最大 6 点）
  if (confidence !== null) {
    score += Math.min(6, Math.max(0, confidence) / 20);
  }

  return Number(score.toFixed(2));
}

// 2つの OCR 試行結果を品質順（スコア→信頼度→テキスト長）で比較する
function compareAttemptQuality(a: OcrAttemptResult, b: OcrAttemptResult): number {
  if (b.score !== a.score) {
    return b.score - a.score;
  }

  const confidenceDiff = (b.confidence ?? -1) - (a.confidence ?? -1);
  if (confidenceDiff !== 0) {
    return confidenceDiff;
  }

  return b.textLength - a.textLength;
}

// 複数の OCR 試行結果の中から最も品質が高い結果を返す
function pickBestAttempt(results: OcrAttemptResult[]): OcrAttemptResult {
  if (results.length === 0) {
    throw new Error('OCR result is empty');
  }

  return [...results].sort(compareAttemptQuality)[0];
}

// 複数の OCR 試行結果をマージして最良のフィールド組み合わせを返す
// rawText はベスト試行のものを使い、各フィールドは最もスコアが高い試行から取得する
function mergeAttempts(
  bestAttempt: OcrAttemptResult,
  results: OcrAttemptResult[]
): ExtractedReceiptFields {
  const sortedByQuality = [...results].sort(compareAttemptQuality);

  const bestWithDate = sortedByQuality.find((result) => result.fields.date);
  const bestWithTotal = sortedByQuality.find((result) => result.fields.total !== null);
  const bestWithMerchant = sortedByQuality.find((result) => result.fields.merchant);

  return {
    rawText: bestAttempt.fields.rawText,
    date: bestWithDate?.fields.date ?? bestAttempt.fields.date,
    total: bestWithTotal?.fields.total ?? bestAttempt.fields.total,
    merchant: bestWithMerchant?.fields.merchant ?? bestAttempt.fields.merchant,
  };
}

// Tesseract.js の OCR 呼び出しを直列実行するためのロック機構
// 前のタスクが終わるまで次のタスクを待機させる
async function withOcrLock<T>(task: () => Promise<T>): Promise<T> {
  const previousLock = ocrExecutionLock;
  let releaseLock: (() => void) | undefined;

  ocrExecutionLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  // 前のタスクが終わるまで待つ
  await previousLock;

  try {
    return await task();
  } finally {
    // タスク完了後にロックを解放して次の待機中タスクを実行可能にする
    releaseLock?.();
  }
}

/**
 * 画像の実際の解像度に基づいてリサイズ幅を決定する。
 * レシート写真は解像度が様々なため、過度な拡大でノイズが増えないよう制御する。
 */
async function resolveTargetWidth(source: Buffer): Promise<number> {
  try {
    const meta = await sharp(source, { failOn: 'none' }).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    const longer = Math.max(w, h);

    // 長辺が既にターゲットDPI相当 (2800px) 以上あれば縮小しない
    if (longer >= OCR_IMAGE_MAX_WIDTH) {
      return OCR_IMAGE_MAX_WIDTH;
    }

    // 長辺が小さい場合は最大3倍まで拡大してTesseractの精度を上げる
    const upscaled = longer * 3;
    return Math.min(upscaled, OCR_IMAGE_MAX_WIDTH);
  } catch {
    return OCR_IMAGE_MAX_WIDTH;
  }
}

/**
 * レシートのような縦長画像に最適化した前処理パイプラインを構築する。
 * - CLAHE相当の局所コントラスト強化 (normalize + linear)
 * - アンシャープマスクで文字エッジを強調
 * - ガンマ補正で薄い印字を読みやすくする
 */
async function buildOcrVariants(imagePath: string): Promise<OcrVariant[]> {
  const variants: OcrVariant[] = [
    {
      strategy: 'original-sparse',
      image: imagePath,
      psm: PSM.SPARSE_TEXT,
    },
  ];

  if (!OCR_MULTI_PASS) {
    return variants;
  }

  try {
    const source = await fsPromises.readFile(imagePath);
    const targetWidth = await resolveTargetWidth(source);

    // ベースパイプライン: 回転補正 → リサイズ → グレースケール
    const resized = await sharp(source, { failOn: 'none' })
      .rotate() // EXIF方向を自動補正
      .resize({
        width: targetWidth,
        fit: 'inside',
        withoutEnlargement: false, // 小さい画像は積極的に拡大
        kernel: sharp.kernel.lanczos3,
      })
      .grayscale()
      .toBuffer();

    // variant 1: normalize + アンシャープマスク (薄い印字に有効)
    const enhanced = await sharp(resized, { failOn: 'none' })
      .normalize() // グローバルコントラスト正規化
      .linear(1.1, -10) // わずかにコントラスト強調
      .sharpen({ sigma: 1.2, m1: 1.5, m2: 0.5 }) // エッジ強調
      .png() // PNGはJPEGより文字品質が高い
      .toBuffer();

    // variant 2: ガンマ補正 + 強いシャープ (レシートの薄い熱転写印字向け)
    const gammaEnhanced = await sharp(resized, { failOn: 'none' })
      .gamma(1.8) // 暗部を持ち上げる
      .normalize()
      .sharpen({ sigma: 1.5, m1: 2.0, m2: 0.5 })
      .png()
      .toBuffer();

    // variant 3: 適応的二値化相当 (normalize後にthreshold)
    const binary = await sharp(resized, { failOn: 'none' })
      .normalize()
      .linear(1.3, -20) // コントラストをさらに高めてからthreshold
      .threshold(OCR_BINARY_THRESHOLD)
      .png()
      .toBuffer();

    // variant 4: 反転二値化 (背景が暗いレシートや領収書向け)
    const invertedBinary = await sharp(resized, { failOn: 'none' })
      .normalize()
      .negate() // 反転
      .threshold(OCR_BINARY_THRESHOLD)
      .png()
      .toBuffer();

    variants.push(
      {
        strategy: 'enhanced-sparse',
        image: enhanced,
        psm: PSM.SPARSE_TEXT,
      },
      {
        strategy: 'enhanced-auto',
        image: enhanced,
        psm: PSM.AUTO,
      },
      {
        strategy: 'gamma-block',
        image: gammaEnhanced,
        psm: PSM.SINGLE_BLOCK,
      },
      {
        strategy: 'binary-block',
        image: binary,
        psm: PSM.SINGLE_BLOCK,
      },
      {
        strategy: 'binary-sparse',
        image: binary,
        psm: PSM.SPARSE_TEXT,
      },
      {
        strategy: 'inverted-sparse',
        image: invertedBinary,
        psm: PSM.SPARSE_TEXT,
      }
    );
  } catch (error) {
    logger.warn('Failed to build OCR preprocess variants, fallback to original image only', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return variants;
}

async function getOcrEngine(): Promise<Awaited<ReturnType<typeof createWorker>>> {
  if (ocrWorker) {
    return ocrWorker;
  }

  if (!ocrWorkerPromise) {
    ocrWorkerPromise = (async () => {
      setLogging(OCR_LOG_PROGRESS);

      const options: NonNullable<Parameters<typeof createWorker>[2]> = {};

      if (process.env.OCR_LANG_PATH) {
        options.langPath = process.env.OCR_LANG_PATH;
      }

      if (process.env.OCR_CACHE_PATH) {
        options.cachePath = process.env.OCR_CACHE_PATH;
      }

      if (OCR_LOG_PROGRESS) {
        options.logger = (message) => {
          logger.debug('OCR progress', {
            status: message.status,
            progress: Number((message.progress * 100).toFixed(1)),
          });
        };
      }

      options.errorHandler = (error) => {
        logger.error('OCR engine error', error);
      };

      const worker = await createWorker(OCR_LANG, 1, options);
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
        preserve_interword_spaces: '1',
        user_defined_dpi: String(OCR_TARGET_DPI),
        // 小文字・大文字・数字・記号・日本語を含む文字セットを明示
        tessedit_char_whitelist: '',
        // 単語辞書を使わず数字や固有名詞を正確に読む
        load_system_dawg: '0',
        load_freq_dawg: '0',
        // 最小文字信頼度を下げてOCRが諦めにくくする
        tessedit_reject_bad_qual_wds: '0',
        // 行間の文字を積極的に拾う
        textord_tabfind_find_tables: '0',
      });

      logger.info('OCR engine initialized', {
        lang: OCR_LANG,
      });

      ocrWorker = worker;
      return worker;
    })().catch((error) => {
      ocrWorkerPromise = null;
      throw error;
    });
  }

  return ocrWorkerPromise;
}

async function terminateOcrEngine(): Promise<void> {
  if (!ocrWorker) {
    return;
  }

  try {
    await ocrWorker.terminate();
    logger.info('OCR engine terminated');
  } catch (error) {
    logger.error('Failed to terminate OCR engine', error);
  } finally {
    ocrWorker = null;
    ocrWorkerPromise = null;
  }
}

async function runOcrAttempt(
  worker: Awaited<ReturnType<typeof createWorker>>,
  variant: OcrVariant
): Promise<OcrAttemptResult> {
  return withOcrLock(async () => {
    await worker.setParameters({
      tessedit_pageseg_mode: variant.psm,
      preserve_interword_spaces: '1',
      user_defined_dpi: String(OCR_TARGET_DPI),
      load_system_dawg: '0',
      load_freq_dawg: '0',
      tessedit_reject_bad_qual_wds: '0',
      textord_tabfind_find_tables: '0',
    });

    const { data } = await worker.recognize(variant.image);
    const text = data.text || '';
    const fields = extractReceiptFields(text);
    const confidence = asFiniteNumber(data.confidence);
    const textLength = text.replace(/\s/g, '').length;

    return {
      strategy: variant.strategy,
      confidence,
      fields,
      score: scoreExtractedFields(fields, confidence),
      textLength,
    };
  });
}

async function performOcr(imagePath: string): Promise<ExtractedReceiptFields> {
  await fsPromises.access(imagePath);

  const worker = await getOcrEngine();
  const variants = await buildOcrVariants(imagePath);

  const attempts: OcrAttemptResult[] = [];

  for (const variant of variants) {
    try {
      attempts.push(await runOcrAttempt(worker, variant));
    } catch (error) {
      logger.warn('OCR attempt failed', {
        strategy: variant.strategy,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (attempts.length === 0) {
    throw new Error('All OCR attempts failed');
  }

  const bestAttempt = pickBestAttempt(attempts);
  const merged = mergeAttempts(bestAttempt, attempts);

  logger.info('OCR attempt summary', {
    bestStrategy: bestAttempt.strategy,
    bestScore: bestAttempt.score,
    attempts: attempts.map((attempt) => ({
      strategy: attempt.strategy,
      score: attempt.score,
      confidence: attempt.confidence,
      hasDate: Boolean(attempt.fields.date),
      hasTotal: attempt.fields.total !== null,
      hasMerchant: Boolean(attempt.fields.merchant),
    })),
  });

  return merged;
}

async function cleanupImage(imagePath: string): Promise<void> {
  if (fs.existsSync(imagePath)) {
    fs.unlink(imagePath, (unlinkErr) => {
      if (unlinkErr) {
        logger.warn(`Failed to delete image ${imagePath}:`, unlinkErr);
      }
    });
  }

  const dir = path.dirname(imagePath);
  try {
    const remaining = await fsPromises.readdir(dir);
    if (remaining.length === 0) {
      await fsPromises.rmdir(dir);
    }
  } catch (cleanupError) {
    logger.debug(`Skipped OCR temp directory cleanup for ${dir}`, cleanupError);
  }
}

async function processOcrJob(job: Job<OcrJobData>): Promise<void> {
  const { receiptId, imagePath } = job.data;

  const receiptJob = await prisma.receiptOcrJob.findUnique({ where: { id: receiptId } });
  const subscriptionJob = receiptJob
    ? null
    : await prisma.subscriptionOcrJob.findUnique({ where: { id: receiptId } });

  if (!receiptJob && !subscriptionJob) {
    logger.warn(`OCR job not found: ${receiptId}`);
    await cleanupImage(imagePath);
    return;
  }

  if (receiptJob) {
    await prisma.receiptOcrJob.update({
      where: { id: receiptId },
      data: { status: 'processing' },
    });
  } else if (subscriptionJob) {
    await prisma.subscriptionOcrJob.update({
      where: { id: receiptId },
      data: { status: 'processing' },
    });
  }

  try {
    const extracted = await performOcr(imagePath);
    const referenceDate = receiptJob?.createdAt ?? subscriptionJob?.createdAt ?? new Date();
    const receiptConversion = await maybeConvertDetectedUsdAmountToJpy({
      amount: extracted.total,
      rawText: extracted.rawText,
      preferredDate: extracted.date,
      fallbackDate: referenceDate,
    });
    const convertedReceiptTotal = receiptConversion?.convertedAmount ?? extracted.total;

    if (receiptJob) {
      await prisma.receiptOcrJob.update({
        where: { id: receiptId },
        data: {
          status: 'success',
          rawText: extracted.rawText,
          extractedMerchant: extracted.merchant,
          extractedDate: extracted.date,
          extractedTotal: convertedReceiptTotal,
          processedAt: new Date(),
        },
      });
    } else if (subscriptionJob) {
      const subscriptionFields = inferSubscriptionFields(extracted.rawText, extracted);
      const subscriptionConversion = await maybeConvertDetectedUsdAmountToJpy({
        amount: subscriptionFields.amount,
        rawText: extracted.rawText,
        preferredDate: subscriptionFields.nextPaymentDate,
        fallbackDate: referenceDate,
        amountLineCurrencyHint: subscriptionFields.amountCurrencyHint,
      });

      await prisma.subscriptionOcrJob.update({
        where: { id: receiptId },
        data: {
          status: 'success',
          rawText: extracted.rawText,
          extractedServiceName: subscriptionFields.serviceName,
          extractedAmount: subscriptionConversion?.convertedAmount ?? subscriptionFields.amount,
          extractedBillingCycle: subscriptionFields.billingCycle,
          extractedNextPaymentDate: subscriptionFields.nextPaymentDate,
          processedAt: new Date(),
        },
      });
    }
  } catch (error) {
    logger.error(`OCR processing failed for job ${receiptId}:`, error);

    if (receiptJob) {
      await prisma.receiptOcrJob.update({
        where: { id: receiptId },
        data: { status: 'failed', processedAt: new Date() },
      });
    } else if (subscriptionJob) {
      await prisma.subscriptionOcrJob.update({
        where: { id: receiptId },
        data: { status: 'failed', processedAt: new Date() },
      });
    }
  } finally {
    await cleanupImage(imagePath);
  }
}

export function startOcrWorker(): Worker<OcrJobData> {
  const concurrency = Number.isFinite(OCR_CONCURRENCY) && OCR_CONCURRENCY > 0
    ? OCR_CONCURRENCY
    : 1;

  const worker = new Worker<OcrJobData>(
    QUEUE_NAMES.OCR,
    processOcrJob,
    {
      connection,
      concurrency,
    }
  );

  worker.on('completed', (job) => {
    logger.info(`OCR job completed: ${job.id}`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`OCR job failed: ${job?.id}`, err);
  });

  worker.on('closed', () => {
    void terminateOcrEngine();
  });

  if (!shutdownHookRegistered) {
    const shutdown = () => {
      void terminateOcrEngine();
    };

    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
    shutdownHookRegistered = true;
  }

  logger.info('OCR worker started', {
    concurrency,
    multiPass: OCR_MULTI_PASS,
    lang: OCR_LANG,
  });

  return worker;
}
