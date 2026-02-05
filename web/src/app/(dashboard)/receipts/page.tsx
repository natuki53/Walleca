'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ReceiptUploader } from '@/components/receipts/ReceiptUploader';
import { ReceiptList } from '@/components/receipts/ReceiptList';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { receiptsApi } from '@/api/receipts';
import { OcrStatus } from '@/types/receipt';

type ReceiptSortBy = 'createdAt' | 'ocrStatus' | 'extractedDate';
type ReceiptSortOrder = 'asc' | 'desc';

export default function ReceiptsPage() {
  const [ocrStatus, setOcrStatus] = useState<'all' | OcrStatus>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sortBy, setSortBy] = useState<ReceiptSortBy>('createdAt');
  const [sortOrder, setSortOrder] = useState<ReceiptSortOrder>('desc');

  const { data, isLoading } = useQuery({
    queryKey: ['receipts', { ocrStatus, from, to, sortBy, sortOrder }],
    queryFn: () =>
      receiptsApi.getAll({
        limit: 50,
        ...(ocrStatus !== 'all' && { ocrStatus }),
        ...(from && { from }),
        ...(to && { to }),
        sortBy,
        sortOrder,
      }),
    refetchInterval: 5000, // OCR処理状況を定期的に更新
  });

  const receipts = useMemo(() => data?.data ?? [], [data?.data]);
  const statusSummary = useMemo(() => {
    return receipts.reduce(
      (acc, receipt) => {
        acc[receipt.ocrStatus] += 1;
        return acc;
      },
      { pending: 0, processing: 0, success: 0, failed: 0 } as Record<OcrStatus, number>
    );
  }, [receipts]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">レシート</h1>

      <ReceiptUploader />

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">OCRステータス</p>
              <Select
                value={ocrStatus}
                onValueChange={(value) => setOcrStatus(value as 'all' | OcrStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  <SelectItem value="pending">処理待ち</SelectItem>
                  <SelectItem value="processing">処理中</SelectItem>
                  <SelectItem value="success">完了</SelectItem>
                  <SelectItem value="failed">失敗</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">期間（開始）</p>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">期間（終了）</p>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">並び替え項目</p>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as ReceiptSortBy)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt">アップロード日時</SelectItem>
                  <SelectItem value="ocrStatus">OCRステータス</SelectItem>
                  <SelectItem value="extractedDate">抽出日付</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">並び順</p>
              <Select
                value={sortOrder}
                onValueChange={(value) => setSortOrder(value as ReceiptSortOrder)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">新しい順</SelectItem>
                  <SelectItem value="asc">古い順</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">合計 {data?.meta?.total ?? receipts.length} 件</Badge>
            <Badge variant="outline">処理待ち {statusSummary.pending}</Badge>
            <Badge variant="outline">処理中 {statusSummary.processing}</Badge>
            <Badge variant="outline">完了 {statusSummary.success}</Badge>
            <Badge variant="outline">失敗 {statusSummary.failed}</Badge>

            <Button
              variant="ghost"
              className="ml-auto"
              onClick={() => {
                setOcrStatus('all');
                setFrom('');
                setTo('');
                setSortBy('createdAt');
                setSortOrder('desc');
              }}
            >
              フィルタをリセット
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">
          読み込み中...
        </div>
      ) : (
        <ReceiptList receipts={receipts} />
      )}
    </div>
  );
}
