'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Download, Search } from 'lucide-react';
import { searchApi, exportApi } from '@/api/search';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SearchPage() {
  const [keyword, setKeyword] = useState('');
  const [submittedKeyword, setSubmittedKeyword] = useState('');
  const [isExportingTx, setIsExportingTx] = useState(false);
  const [isExportingSub, setIsExportingSub] = useState(false);

  const { data, isFetching } = useQuery({
    queryKey: ['search', submittedKeyword],
    queryFn: () => searchApi.search(submittedKeyword),
    enabled: submittedKeyword.length > 0,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedKeyword(keyword.trim());
  };

  const handleExportTransactions = async () => {
    setIsExportingTx(true);
    try {
      const blob = await exportApi.exportTransactions();
      downloadBlob(blob, 'transactions.csv');
      toast({ title: '取引データをエクスポートしました' });
    } catch {
      toast({ title: 'エクスポートに失敗しました', variant: 'destructive' });
    } finally {
      setIsExportingTx(false);
    }
  };

  const handleExportSubscriptions = async () => {
    setIsExportingSub(true);
    try {
      const blob = await exportApi.exportSubscriptions();
      downloadBlob(blob, 'subscriptions.csv');
      toast({ title: 'サブスクデータをエクスポートしました' });
    } catch {
      toast({ title: 'エクスポートに失敗しました', variant: 'destructive' });
    } finally {
      setIsExportingSub(false);
    }
  };

  const transactions = data?.data?.transactions ?? [];
  const subscriptions = data?.data?.subscriptions ?? [];
  const hasResults = transactions.length > 0 || subscriptions.length > 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">検索・エクスポート</h1>

      {/* 検索フォーム */}
      <Card>
        <CardHeader>
          <CardTitle>検索</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="店名・メモ・サービス名で検索..."
              className="flex-1"
            />
            <Button type="submit" disabled={isFetching}>
              <Search className="h-4 w-4 mr-2" />
              検索
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 検索結果 */}
      {submittedKeyword && (
        <div className="space-y-4">
          {isFetching ? (
            <p className="text-muted-foreground text-sm">検索中...</p>
          ) : !hasResults ? (
            <p className="text-muted-foreground text-sm">
              「{submittedKeyword}」に一致する結果が見つかりませんでした。
            </p>
          ) : (
            <>
              {transactions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">取引 ({transactions.length}件)</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {transactions.map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between px-4 py-3">
                          <div>
                            <p className="font-medium">{tx.merchant ?? '(店舗名なし)'}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(tx.transactionDate), 'yyyy年M月d日', { locale: ja })}
                              {tx.memo && <span className="ml-2">{tx.memo}</span>}
                            </p>
                          </div>
                          <span className={cn(
                            'font-semibold',
                            tx.type === 'expense' ? 'text-destructive' : 'text-green-600'
                          )}>
                            {tx.type === 'expense' ? '-' : '+'}
                            {new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(tx.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {subscriptions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">サブスク ({subscriptions.length}件)</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {subscriptions.map((sub) => (
                        <div key={sub.id} className="flex items-center justify-between px-4 py-3">
                          <div>
                            <p className="font-medium">{sub.serviceName}</p>
                            <p className="text-xs text-muted-foreground">
                              {sub.billingCycle === 'monthly' ? '月額' : '年額'} ·
                              次回 {format(new Date(sub.nextPaymentDate), 'yyyy年M月d日', { locale: ja })}
                            </p>
                          </div>
                          <span className="font-semibold">
                            {new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(sub.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {/* エクスポート */}
      <Card>
        <CardHeader>
          <CardTitle>CSV エクスポート</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            onClick={handleExportTransactions}
            disabled={isExportingTx}
            className="flex-1"
          >
            <Download className="h-4 w-4 mr-2" />
            {isExportingTx ? 'エクスポート中...' : '取引データをエクスポート'}
          </Button>
          <Button
            variant="outline"
            onClick={handleExportSubscriptions}
            disabled={isExportingSub}
            className="flex-1"
          >
            <Download className="h-4 w-4 mr-2" />
            {isExportingSub ? 'エクスポート中...' : 'サブスクデータをエクスポート'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
