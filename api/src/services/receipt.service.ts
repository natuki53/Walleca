import { prisma } from '../config/database';
import { Errors } from '../utils/errors';
import { QueryBuilder, buildOrderBy } from '../utils/query-builder';
import { addOcrJob } from '../config/queue';
import { UpdateReceiptInput, ConfirmReceiptInput } from '../validators/receipt.validator';
import { OcrStatus, Prisma } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { logger } from '../utils/logger';

export interface ReceiptListParams {
  page: number;
  limit: number;
  skip: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  ocrStatus?: OcrStatus;
  from?: Date;
  to?: Date;
}

const receiptSelect = {
  id: true,
  imagePath: true,
  imageSize: true,
  mimeType: true,
  ocrStatus: true,
  ocrRawText: true,
  extractedMerchant: true,
  extractedDate: true,
  extractedTotal: true,
  ocrProcessedAt: true,
  createdAt: true,
  updatedAt: true,
};

const HEIF_MIME_TYPES = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);
const HEIF_EXTENSIONS = new Set(['.heic', '.heif']);

interface NormalizedUploadFile {
  path: string;
  size: number;
  mimeType: string;
}

function isHeifUpload(file: Express.Multer.File): boolean {
  const mimeType = (file.mimetype || '').toLowerCase();
  const extension = path.extname(file.originalname).toLowerCase();

  return HEIF_MIME_TYPES.has(mimeType) || HEIF_EXTENSIONS.has(extension);
}

export class ReceiptService {
  private async normalizeUploadFile(file: Express.Multer.File): Promise<NormalizedUploadFile> {
    if (!isHeifUpload(file)) {
      return {
        path: file.path,
        size: file.size,
        mimeType: file.mimetype,
      };
    }

    const parsedPath = path.parse(file.path);
    const convertedPath = path.join(parsedPath.dir, `${parsedPath.name}.jpg`);

    try {
      await sharp(file.path, { failOn: 'none' })
        .rotate()
        .jpeg({
          quality: 95,
          chromaSubsampling: '4:4:4',
        })
        .toFile(convertedPath);

      const stats = await fs.stat(convertedPath);
      await fs.unlink(file.path).catch(() => undefined);

      logger.info('HEIC/HEIF converted to JPEG on upload', {
        source: file.path,
        converted: convertedPath,
      });

      return {
        path: convertedPath,
        size: stats.size,
        mimeType: 'image/jpeg',
      };
    } catch (error) {
      logger.warn('HEIC/HEIF conversion failed on upload, fallback to original file', {
        path: file.path,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        path: file.path,
        size: file.size,
        mimeType: file.mimetype,
      };
    }
  }

  async upload(
    userId: string,
    file: Express.Multer.File
  ) {
    const normalizedFile = await this.normalizeUploadFile(file);

    const receipt = await prisma.receipt.create({
      data: {
        userId,
        imagePath: normalizedFile.path,
        imageSize: normalizedFile.size,
        mimeType: normalizedFile.mimeType,
        ocrStatus: 'pending',
      },
      select: receiptSelect,
    });

    // OCRジョブをキューに追加
    await addOcrJob({
      receiptId: receipt.id,
      imagePath: normalizedFile.path,
      userId,
    });

    return receipt;
  }

  async list(userId: string, params: ReceiptListParams) {
    const where = new QueryBuilder()
      .where({ userId })
      .whereEquals('ocrStatus', params.ocrStatus)
      .whereDateRange('createdAt', params.from, params.to)
      .build();

    const [receipts, total] = await Promise.all([
      prisma.receipt.findMany({
        where,
        select: {
          ...receiptSelect,
          transaction: {
            select: { id: true },
          },
        },
        orderBy: buildOrderBy(params.sortBy, params.sortOrder),
        skip: params.skip,
        take: params.limit,
      }),
      prisma.receipt.count({ where }),
    ]);

    return { receipts, total };
  }

  async getById(userId: string, receiptId: string) {
    const receipt = await prisma.receipt.findFirst({
      where: { id: receiptId, userId },
      select: {
        ...receiptSelect,
        transaction: {
          select: {
            id: true,
            type: true,
            amount: true,
            transactionDate: true,
            merchant: true,
          },
        },
      },
    });

    if (!receipt) {
      throw Errors.notFound('レシート');
    }

    return receipt;
  }

  async update(userId: string, receiptId: string, input: UpdateReceiptInput) {
    const existing = await prisma.receipt.findFirst({
      where: { id: receiptId, userId },
    });

    if (!existing) {
      throw Errors.notFound('レシート');
    }

    const receipt = await prisma.receipt.update({
      where: { id: receiptId },
      data: {
        ...(input.extractedMerchant !== undefined && {
          extractedMerchant: input.extractedMerchant,
        }),
        ...(input.extractedDate !== undefined && {
          extractedDate: input.extractedDate ? new Date(input.extractedDate) : null,
        }),
        ...(input.extractedTotal !== undefined && {
          extractedTotal: input.extractedTotal,
        }),
      },
      select: receiptSelect,
    });

    return receipt;
  }

  async retryOcr(userId: string, receiptId: string) {
    const existing = await prisma.receipt.findFirst({
      where: { id: receiptId, userId },
    });

    if (!existing) {
      throw Errors.notFound('レシート');
    }

    // ステータスをpendingに戻す
    const receipt = await prisma.receipt.update({
      where: { id: receiptId },
      data: {
        ocrStatus: 'pending',
        ocrRawText: null,
        extractedMerchant: null,
        extractedDate: null,
        extractedTotal: null,
        ocrProcessedAt: null,
      },
      select: receiptSelect,
    });

    // OCRジョブを再キュー
    await addOcrJob({
      receiptId,
      imagePath: existing.imagePath,
      userId,
    });

    return receipt;
  }

  async delete(userId: string, receiptId: string) {
    const existing = await prisma.receipt.findFirst({
      where: { id: receiptId, userId },
    });

    if (!existing) {
      throw Errors.notFound('レシート');
    }

    // 画像ファイルを削除
    try {
      await fs.unlink(existing.imagePath);
    } catch {
      // ファイルが存在しない場合は無視
    }

    await prisma.receipt.delete({
      where: { id: receiptId },
    });
  }

  async confirm(userId: string, receiptId: string, input: ConfirmReceiptInput) {
    const existing = await prisma.receipt.findFirst({
      where: { id: receiptId, userId },
      include: { transaction: true },
    });

    if (!existing) {
      throw Errors.notFound('レシート');
    }

    if (existing.transaction) {
      throw Errors.duplicate('取引（このレシートは既に確定済みです）');
    }

    // OCRの結果またはユーザー入力から取引データを作成
    const amount = input.amount ?? Number(existing.extractedTotal);
    const transactionDate = input.transactionDate
      ? new Date(input.transactionDate)
      : existing.extractedDate ?? new Date();
    const merchant = input.merchant ?? existing.extractedMerchant;

    if (!amount || amount <= 0) {
      throw Errors.validation('金額が設定されていません');
    }

    const transaction = await prisma.transaction.create({
      data: {
        userId,
        receiptId,
        type: input.type,
        amount,
        transactionDate,
        merchant,
        properties: (input.properties || {}) as Prisma.InputJsonValue,
      },
      select: {
        id: true,
        type: true,
        amount: true,
        transactionDate: true,
        merchant: true,
        properties: true,
        receiptId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return transaction;
  }
}

export const receiptService = new ReceiptService();
