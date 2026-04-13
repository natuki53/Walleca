'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Loader2 } from 'lucide-react';
import { isAxiosError } from 'axios';
import { subscriptionOcrJobsApi } from '@/api/ocrJobs';
import { subscriptionCategoriesApi } from '@/api/subscriptionCategories';
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
  serviceName: z.string().min(1, 'サービス名を入力してください'),
  amount: z.coerce.number().positive('金額は正の数で入力してください'),
  billingCycle: z.enum(['monthly', 'yearly']),
  nextPaymentDate: z.string().min(1, '次回支払日を入力してください'),
  category: z.string().optional(),
  status: z.enum(['active', 'paused', 'cancelled']),
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

export default function SubscriptionOcrJobPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = params?.jobId ?? '';
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pageState, setPageState] = useState<PageState>('polling');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: categoryResponse } = useQuery({
    queryKey: ['subscription-categories'],
    queryFn: () => subscriptionCategoriesApi.getAll(),
  });

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<ConfirmFormData>({
    resolver: zodResolver(confirmSchema),
    defaultValues: {
      billingCycle: 'monthly',
      category: '',
      status: 'active',
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
          const res = await subscriptionOcrJobsApi.get(jobId);
          const job = res.data;

          if (new Date(job.expiresAt).getTime() <= Date.now()) {
            setPageState('timeout');
            return;
          }

          if (job.status === 'success') {
            if (job.extractedServiceName) setValue('serviceName', job.extractedServiceName);
            if (job.extractedAmount) setValue('amount', job.extractedAmount);
            if (job.extractedBillingCycle) setValue('billingCycle', job.extractedBillingCycle);
            if (job.extractedNextPaymentDate) {
              setValue('nextPaymentDate', new Date(job.extractedNextPaymentDate).toISOString().slice(0, 10));
            }
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
      await subscriptionOcrJobsApi.confirm(jobId, {
        serviceName: data.serviceName,
        amount: data.amount,
        billingCycle: data.billingCycle,
        nextPaymentDate: data.nextPaymentDate,
        categoryId: categoryResponse?.data.find((category) => category.name === data.category)?.id,
        status: data.status,
        memo: data.memo,
      });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      toast({ title: 'サブスクを登録しました' });
      router.push('/subscriptions');
    } catch {
      toast({ title: '登録に失敗しました', variant: 'destructive' });
      setIsSubmitting(false);
    }
  };

  const handleDiscard = async () => {
    try {
      await subscriptionOcrJobsApi.discard(jobId);
    } catch {}
    router.push('/subscriptions');
  };

  if (pageState === 'polling') {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground">
        <Loader2 className="h-10 w-10 animate-spin" />
        <p className="text-lg">スクリーンショットを読み取り中...</p>
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
          <Button variant="outline" onClick={() => router.push('/subscriptions')}>
            手動で入力
          </Button>
          <Button onClick={() => router.push('/subscriptions?action=ocr')}>
            再アップロード
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold">サブスク確認</h1>

      <Card>
        <CardHeader>
          <CardTitle>サブスク情報を確認・修正</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>サービス名</Label>
              <Input type="text" {...register('serviceName')} placeholder="例: Netflix" />
              {errors.serviceName && <p className="text-sm text-destructive">{errors.serviceName.message}</p>}
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
              <Label>支払周期</Label>
              <Select
                value={watch('billingCycle')}
                onValueChange={(v) => setValue('billingCycle', v as 'monthly' | 'yearly')}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">月額</SelectItem>
                  <SelectItem value="yearly">年額</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>次回支払日</Label>
              <Input type="date" {...register('nextPaymentDate')} />
              {errors.nextPaymentDate && (
                <p className="text-sm text-destructive">{errors.nextPaymentDate.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                推論できなかった場合は空欄のままにするので、内容を確認して入力してください。
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>カテゴリ（任意）</Label>
                <input type="hidden" {...register('category')} />
                <Select
                  value={watch('category') || '__none__'}
                  onValueChange={(value) => setValue('category', value === '__none__' ? '' : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="カテゴリを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">未選択</SelectItem>
                    {(categoryResponse?.data ?? []).map((category) => (
                      <SelectItem key={category.id} value={category.name}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>状態</Label>
                <Select
                  value={watch('status')}
                  onValueChange={(v) => setValue('status', v as 'active' | 'paused' | 'cancelled')}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">有効</SelectItem>
                    <SelectItem value="paused">停止</SelectItem>
                    <SelectItem value="cancelled">解約</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
