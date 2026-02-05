'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Subscription } from '@/types/subscription';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const subscriptionSchema = z.object({
  serviceName: z.string().min(1, 'サービス名を入力してください').max(255),
  amount: z.coerce.number().positive('金額は正の数で入力してください'),
  billingCycle: z.enum(['monthly', 'yearly']),
  registrationDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '日付はYYYY-MM-DD形式で入力してください')
    .optional(),
  nextPaymentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '日付はYYYY-MM-DD形式で入力してください')
    .optional(),
  category: z.string().max(100).optional(),
  status: z.enum(['active', 'paused', 'cancelled']),
  memo: z.string().optional(),
});

export type SubscriptionFormData = z.infer<typeof subscriptionSchema>;

interface SubscriptionFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: SubscriptionFormData) => Promise<void>;
  categoryOptions: string[];
  subscription?: Subscription;
  isLoading?: boolean;
}

const statusLabels: Record<SubscriptionFormData['status'], string> = {
  active: '有効',
  paused: '停止',
  cancelled: '解約',
};

const cycleLabels: Record<SubscriptionFormData['billingCycle'], string> = {
  monthly: '月額',
  yearly: '年額',
};

export function SubscriptionForm({
  open,
  onClose,
  onSubmit,
  categoryOptions,
  subscription,
  isLoading,
}: SubscriptionFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<SubscriptionFormData>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: {
      serviceName: subscription?.serviceName || '',
      amount: subscription?.amount || undefined,
      billingCycle: subscription?.billingCycle || 'monthly',
      registrationDate: subscription ? undefined : new Date().toISOString().slice(0, 10),
      nextPaymentDate: subscription?.nextPaymentDate?.slice(0, 10),
      category: subscription?.category || '',
      status: subscription?.status || 'active',
      memo: subscription?.memo || '',
    },
  });

  useEffect(() => {
    reset({
      serviceName: subscription?.serviceName || '',
      amount: subscription?.amount || undefined,
      billingCycle: subscription?.billingCycle || 'monthly',
      registrationDate: subscription ? undefined : new Date().toISOString().slice(0, 10),
      nextPaymentDate: subscription?.nextPaymentDate?.slice(0, 10),
      category: subscription?.category || '',
      status: subscription?.status || 'active',
      memo: subscription?.memo || '',
    });
  }, [subscription, reset, open]);

  const handleFormSubmit = async (data: SubscriptionFormData) => {
    await onSubmit(data);
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{subscription ? 'サブスクを編集' : 'サブスクを追加'}</DialogTitle>
          <DialogDescription className="sr-only">
            サブスクリプションの情報を入力して保存します。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="serviceName">サービス名</Label>
              <Input
                id="serviceName"
                type="text"
                placeholder="Netflix"
                {...register('serviceName')}
              />
              {errors.serviceName && (
                <p className="text-sm text-destructive">{errors.serviceName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">金額</Label>
              <Input id="amount" type="number" min="1" step="1" {...register('amount')} />
              {errors.amount && (
                <p className="text-sm text-destructive">{errors.amount.message}</p>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="billingCycle">支払周期</Label>
                <Select
                  value={watch('billingCycle')}
                  onValueChange={(value) =>
                    setValue('billingCycle', value as SubscriptionFormData['billingCycle'])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(cycleLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">状態</Label>
                <Select
                  value={watch('status')}
                  onValueChange={(value) =>
                    setValue('status', value as SubscriptionFormData['status'])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {subscription ? (
              <div className="space-y-2">
                <Label htmlFor="nextPaymentDate">次回支払日</Label>
                <Input id="nextPaymentDate" type="date" {...register('nextPaymentDate')} />
                {errors.nextPaymentDate && (
                  <p className="text-sm text-destructive">{errors.nextPaymentDate.message}</p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="registrationDate">登録日</Label>
                <Input id="registrationDate" type="date" {...register('registrationDate')} />
                {errors.registrationDate && (
                  <p className="text-sm text-destructive">{errors.registrationDate.message}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  登録日を基準に次回支払日を自動設定します。
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="category">カテゴリ（任意）</Label>
              <input type="hidden" {...register('category')} />
              <Select
                value={watch('category') || '__none__'}
                onValueChange={(value) => setValue('category', value === '__none__' ? '' : value)}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="カテゴリを選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">未選択</SelectItem>
                  {categoryOptions.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                カテゴリは設定画面から追加・編集できます。
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="memo">メモ（任意）</Label>
              <Input id="memo" type="text" placeholder="ファミリープラン" {...register('memo')} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              キャンセル
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
