import { prisma } from '../config/database';
import { Errors } from '../utils/errors';
import { QueryBuilder, buildOrderBy } from '../utils/query-builder';
import { addOcrJob } from '../config/queue';
import { UpdateReceiptInput, ConfirmReceiptInput } from '../validators/receipt.validator';
import { OcrStatus, Prisma } from '@prisma/client';
import fs from 'fs/promises';

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

export class ReceiptService {
  async upload(
    userId: string,
    file: Express.Multer.File
  ) {
    const receipt = await prisma.receipt.create({
      data: {
        userId,
        imagePath: file.path,
        imageSize: file.size,
        mimeType: file.mimetype,
        ocrStatus: 'pending',
      },
      select: receiptSelect,
    });

    // OCRジョブをキューに追加
    await addOcrJob({
      receiptId: receipt.id,
      imagePath: file.path,
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
