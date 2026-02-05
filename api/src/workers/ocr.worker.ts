import { Worker, Job } from 'bullmq';
import { connection, QUEUE_NAMES, OcrJobData } from '../config/queue';
import { prisma } from '../config/database';
import fs from 'fs/promises';

// OCR処理のモック（実際の実装ではGoogle Vision APIやTesseractを使用）
async function performOcr(imagePath: string): Promise<{
  rawText: string;
  merchant: string | null;
  date: Date | null;
  total: number | null;
}> {
  // ファイルの存在確認
  await fs.access(imagePath);

  // モックOCR結果（実際の実装ではOCRエンジンを使用）
  // ここではサンプルデータを返す
  const mockResult = {
    rawText: 'レシート\nサンプル店舗\n2024-01-15\n合計 ¥1,234',
    merchant: 'サンプル店舗',
    date: new Date(),
    total: 1234,
  };

  // 処理時間をシミュレート
  await new Promise((resolve) => setTimeout(resolve, 1000));

  return mockResult;
}

async function processReceipt(job: Job<OcrJobData>): Promise<void> {
  const { receiptId, imagePath } = job.data;

  console.log(`Processing OCR for receipt: ${receiptId}`);

  // ステータスをprocessingに更新
  await prisma.receipt.update({
    where: { id: receiptId },
    data: { ocrStatus: 'processing' },
  });

  try {
    const result = await performOcr(imagePath);

    // OCR結果を保存
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

    console.log(`OCR completed for receipt: ${receiptId}`);
  } catch (error) {
    console.error(`OCR failed for receipt: ${receiptId}`, error);

    // ステータスをfailedに更新
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
      concurrency: 5,
    }
  );

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err.message);
  });

  console.log('OCR Worker started');

  return worker;
}
