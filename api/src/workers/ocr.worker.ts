import { Worker, Job } from 'bullmq';
import { createWorker, PSM, setLogging } from 'tesseract.js';
import sharp from 'sharp';
import { connection, QUEUE_NAMES, OcrJobData } from '../config/queue';
import { prisma } from '../config/database';
import fs from 'fs/promises';
import { extractReceiptFields, ExtractedReceiptFields } from '../utils/receipt-ocr';
import { logger } from '../utils/logger';

const OCR_LANG = process.env.OCR_LANG || 'jpn+eng';
const OCR_CONCURRENCY = Number.parseInt(process.env.OCR_CONCURRENCY || '1', 10);
const OCR_LOG_PROGRESS = process.env.OCR_LOG_PROGRESS === 'true';
const OCR_MULTI_PASS = process.env.OCR_MULTI_PASS !== 'false';
const OCR_IMAGE_MAX_WIDTH = Number.parseInt(process.env.OCR_IMAGE_MAX_WIDTH || '2200', 10);
const OCR_BINARY_THRESHOLD = Number.parseInt(process.env.OCR_BINARY_THRESHOLD || '170', 10);

let ocrWorker: Awaited<ReturnType<typeof createWorker>> | null = null;
let ocrWorkerPromise: Promise<Awaited<ReturnType<typeof createWorker>>> | null = null;
let shutdownHookRegistered = false;
let ocrExecutionLock: Promise<void> = Promise.resolve();

interface OcrVariant {
  strategy: string;
  image: string | Buffer;
  psm: PSM;
}

interface OcrAttemptResult {
  strategy: string;
  confidence: number | null;
  fields: ExtractedReceiptFields;
  score: number;
  textLength: number;
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

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

  score += Math.min(4, compactTextLength / 120);

  if (confidence !== null) {
    score += Math.min(6, Math.max(0, confidence) / 20);
  }

  return Number(score.toFixed(2));
}

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

function pickBestAttempt(results: OcrAttemptResult[]): OcrAttemptResult {
  if (results.length === 0) {
    throw new Error('OCR result is empty');
  }

  return [...results].sort(compareAttemptQuality)[0];
}

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

async function withOcrLock<T>(task: () => Promise<T>): Promise<T> {
  const previousLock = ocrExecutionLock;
  let releaseLock: (() => void) | undefined;

  ocrExecutionLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  await previousLock;

  try {
    return await task();
  } finally {
    releaseLock?.();
  }
}

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
    const source = await fs.readFile(imagePath);

    const basePipeline = sharp(source, { failOn: 'none' })
      .rotate()
      .resize({
        width: OCR_IMAGE_MAX_WIDTH,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .grayscale()
      .normalize()
      .sharpen();

    const enhanced = await basePipeline
      .clone()
      .jpeg({
        quality: 95,
        chromaSubsampling: '4:4:4',
      })
      .toBuffer();

    const binary = await basePipeline
      .clone()
      .threshold(OCR_BINARY_THRESHOLD)
      .jpeg({
        quality: 95,
        chromaSubsampling: '4:4:4',
      })
      .toBuffer();

    variants.push(
      {
        strategy: 'enhanced-sparse',
        image: enhanced,
        psm: PSM.SPARSE_TEXT,
      },
      {
        strategy: 'binary-block',
        image: binary,
        psm: PSM.SINGLE_BLOCK,
      },
      {
        strategy: 'enhanced-auto',
        image: enhanced,
        psm: PSM.AUTO,
      }
    );
  } catch (error) {
    logger.warn('Failed to build OCR preprocess variants, fallback to original image only', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return variants;
}

async function getOcrWorker(): Promise<Awaited<ReturnType<typeof createWorker>>> {
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
        user_defined_dpi: '300',
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

async function terminateOcrWorker(): Promise<void> {
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
      user_defined_dpi: '300',
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
  await fs.access(imagePath);

  const worker = await getOcrWorker();
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

async function processReceipt(job: Job<OcrJobData>): Promise<void> {
  const { receiptId, imagePath } = job.data;

  logger.info(`Processing OCR for receipt: ${receiptId}`);

  await prisma.receipt.update({
    where: { id: receiptId },
    data: { ocrStatus: 'processing' },
  });

  try {
    const result = await performOcr(imagePath);

    await prisma.receipt.update({
      where: { id: receiptId },
      data: {
        ocrStatus: 'success',
        ocrRawText: result.rawText,
        extractedMerchant: result.merchant,
        extractedDate: result.date,
        extractedTotal: result.total,
        ocrProcessedAt: new Date(),
      },
    });

    logger.info(`OCR completed for receipt: ${receiptId}`);
  } catch (error) {
    logger.error(`OCR failed for receipt: ${receiptId}`, error);

    await prisma.receipt.update({
      where: { id: receiptId },
      data: {
        ocrStatus: 'failed',
        ocrProcessedAt: new Date(),
      },
    });

    throw error;
  }
}

export function startOcrWorker(): Worker<OcrJobData> {
  const worker = new Worker<OcrJobData>(
    QUEUE_NAMES.OCR,
    processReceipt,
    {
      connection,
      concurrency: Number.isFinite(OCR_CONCURRENCY) && OCR_CONCURRENCY > 0 ? OCR_CONCURRENCY : 1,
    }
  );

  worker.on('completed', (job) => {
    logger.info(`OCR job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`OCR job ${job?.id} failed`, err);
  });

  worker.on('closed', () => {
    void terminateOcrWorker();
  });

  if (!shutdownHookRegistered) {
    const shutdown = () => {
      void terminateOcrWorker();
    };

    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
    shutdownHookRegistered = true;
  }

  logger.info('OCR Worker started', {
    concurrency: Number.isFinite(OCR_CONCURRENCY) && OCR_CONCURRENCY > 0 ? OCR_CONCURRENCY : 1,
    multiPass: OCR_MULTI_PASS,
  });

  return worker;
}
