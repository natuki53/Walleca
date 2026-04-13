'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Loader2 } from 'lucide-react';
import { isAxiosError } from 'axios';
import { receiptOcrJobsApi } from '@/api/ocrJobs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/useToast';

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 180000;

const confirmSchema = z.object({
  type: z.enum(['expense', 'income', 'adjustment']),
  amount: z.coerce.number().positive('金額は正の数で入力してください'),
  transactionDate: z.string().min(1, '日付を入力してください'),
  merchant: z.string().optional(),
  memo: z.string().optional(),
});
type ConfirmFormData = z.infer<typeof confirmSchema>;

type PageState = 'polling' | 'confirm' | 'failed' | 'timeout';

function getPollingErrorState(error: unknown): Extract<PageState, 'failed' | 'timeout'> {
  if (isAxiosError(error) && error.response?.status === 410) {
    return 'timeout';
  }

  return 'failed';
}

export default function ReceiptOcrJobPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = params?.jobId ?? '';
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pageState, setPageState] = useState<PageState>('polling');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<ConfirmFormData>({
    resolver: zodResolver(confirmSchema),
    defaultValues: {
      type: 'expense',
      transactionDate: new Date().toISOString().slice(0, 10),
    },
  });

  useEffect(() => {
    let stopped = false;
    const startedAt = Date.now();

    const poll = async () => {
      while (!stopped) {
        if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
          setPageState('timeout');
          return;
        }

        try {
          const res = await receiptOcrJobsApi.get(jobId);
          const job = res.data;

          if (new Date(job.expiresAt).getTime() <= Date.now()) {
            setPageState('timeout');
            return;
          }

          if (job.status === 'success') {
            setValue('amount', job.extractedTotal ?? 0);
            setValue('transactionDate', job.extractedDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
            setValue('merchant', job.extractedMerchant ?? '');
            setPageState('confirm');
            return;
          }

          if (job.status === 'failed') {
            setPageState('failed');
            return;
          }
        } catch (error) {
          setPageState(getPollingErrorState(error));
          return;
        }

        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
      }
    };

    poll();
    return () => { stopped = true; };
  }, [jobId, setValue]);

  const onSubmit = async (data: ConfirmFormData) => {
    setIsSubmitting(true);
    try {
      await receiptOcrJobsApi.confirm(jobId, {
        type: data.type,
        amount: data.amount,
        transactionDate: data.transactionDate,
        merchant: data.merchant,
        memo: data.memo,
      });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast({ title: '取引を登録しました' });
      router.push('/transactions');
    } catch {
      toast({ title: '登録に失敗しました', variant: 'destructive' });
      setIsSubmitting(false);
    }
  };

  const handleDiscard = async () => {
    try {
      await receiptOcrJobsApi.discard(jobId);
    } catch {}
    router.push('/transactions');
  };

  if (pageState === 'polling') {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground">
        <Loader2 className="h-10 w-10 animate-spin" />
        <p className="text-lg">レシートを読み取り中...</p>
        <p className="text-sm">初回は 1 分以上かかることがあります</p>
      </div>
    );
  }

  if (pageState === 'failed' || pageState === 'timeout') {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-lg font-medium">
          {pageState === 'timeout' ? '読み取りがタイムアウトしました' : '読み取りに失敗しました'}
        </p>
        <p className="text-sm text-muted-foreground">
          手動で入力するか、再度アップロードしてください。ローカル開発では OCR ワーカー未起動でもこの状態になります。
        </p>
        <div className="flex gap-2 mt-2">
          <Button variant="outline" onClick={() => router.push('/transactions')}>
            手動で入力
          </Button>
          <Button onClick={() => router.push('/transactions?action=receipt')}>
            再アップロード
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold">レシート確認</h1>

      <Card>
        <CardHeader>
          <CardTitle>取引情報を確認・修正</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>種別</Label>
              <Select
                value={watch('type')}
                onValueChange={(v) => setValue('type', v as ConfirmFormData['type'])}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">支出</SelectItem>
                  <SelectItem value="income">収入</SelectItem>
                  <SelectItem value="adjustment">調整</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>金額</Label>
              <Input type="number" {...register('amount')} />
              {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
              <p className="text-xs text-muted-foreground">
                ドル表記を検出した場合は、対象日の為替レートで円換算した金額を初期入力しています。
              </p>
            </div>

            <div className="space-y-2">
              <Label>日付</Label>
              <Input type="date" {...register('transactionDate')} />
              {errors.transactionDate && <p className="text-sm text-destructive">{errors.transactionDate.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>店名</Label>
              <Input type="text" {...register('merchant')} placeholder="店名（任意）" />
            </div>

            <div className="space-y-2">
              <Label>メモ</Label>
              <Input type="text" {...register('memo')} placeholder="メモ（任意）" />
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={handleDiscard} className="flex-1">
                キャンセル
              </Button>
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting ? '登録中...' : '登録する'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
