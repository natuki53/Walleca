import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { authMiddleware } from '../middleware/auth.middleware';
import { parseDateRange } from '../utils/pagination';

const router = Router();
router.use(authMiddleware);

// ヘッダー行と各行のデータを CSV 形式の文字列に変換する
// 値はダブルクォートでエスケープし、内部のダブルクォートは "" に変換する（RFC 4180 準拠）
function toCsv(headers: string[], rows: string[][]): string {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(',')];
  for (const row of rows) {
    lines.push(row.map(escape).join(','));
  }
  return lines.join('\r\n');
}

// POST /exports/transactions - 取引データを CSV ファイルとしてダウンロードする
// クエリパラメータで日付範囲を絞り込める。BOM 付き UTF-8 で Excel での文字化けを防ぐ
router.post('/transactions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { from, to } = parseDateRange(req);

    const where = {
      userId,
      ...(from || to ? {
        transactionDate: {
          ...(from && { gte: from }),
          ...(to && { lte: to }),
        },
      } : {}),
    };

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { transactionDate: 'desc' },
      include: { category: true },
    });

    const typeLabels: Record<string, string> = {
      expense: '支出', income: '収入', adjustment: '調整',
    };
    const methodLabels: Record<string, string> = {
      cash: '現金', credit_card: 'クレジットカード', debit_card: 'デビットカード',
      e_money: '電子マネー', qr_payment: 'QRコード決済', bank_transfer: '銀行振込', other: 'その他',
    };

    const headers = ['日付', '種別', '金額', '店名', 'カテゴリ', '支払い方法', 'メモ'];
    const rows = transactions.map(t => [
      new Date(t.transactionDate).toISOString().slice(0, 10),
      typeLabels[t.type] ?? t.type,
      String(Number(t.amount)),
      t.merchant ?? '',
      t.category?.name ?? '',
      t.paymentMethod ? (methodLabels[t.paymentMethod] ?? t.paymentMethod) : '',
      t.memo ?? '',
    ]);

    const csv = toCsv(headers, rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="transactions.csv"');
    res.send('\uFEFF' + csv); // BOM付きUTF-8
  } catch (err) {
    next(err);
  }
});

// POST /exports/subscriptions - サブスクデータを CSV ファイルとしてダウンロードする
router.post('/subscriptions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    const subscriptions = await prisma.subscription.findMany({
      where: { userId },
      orderBy: { nextPaymentDate: 'asc' },
      include: { category: true },
    });

    const cycleLabels: Record<string, string> = { monthly: '月額', yearly: '年額' };
    const statusLabels: Record<string, string> = { active: '有効', paused: '停止', cancelled: '解約' };

    const headers = ['サービス名', '金額', '支払周期', '次回支払日', 'カテゴリ', '状態', 'メモ'];
    const rows = subscriptions.map(s => [
      s.serviceName,
      String(Number(s.amount)),
      cycleLabels[s.billingCycle] ?? s.billingCycle,
      new Date(s.nextPaymentDate).toISOString().slice(0, 10),
      s.category?.name ?? '',
      statusLabels[s.status] ?? s.status,
      s.memo ?? '',
    ]);

    const csv = toCsv(headers, rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="subscriptions.csv"');
    res.send('\uFEFF' + csv);
  } catch (err) {
    next(err);
  }
});

export default router;
