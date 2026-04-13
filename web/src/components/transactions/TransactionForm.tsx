'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Transaction, TransactionType } from '@/types/transaction';
import { TransactionCategory } from '@/types/transactionCategory';

const transactionSchema = z.object({
  type: z.enum(['expense', 'income', 'adjustment']),
  amount: z.coerce.number().positive('金額は正の数で入力してください'),
  transactionDate: z.string().min(1, '日付を入力してください'),
  merchant: z.string().optional(),
  categoryId: z.string().optional(),
});

type TransactionFormData = z.infer<typeof transactionSchema>;

interface TransactionFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: TransactionFormData) => Promise<void>;
  transaction?: Transaction;
  categoryOptions?: TransactionCategory[];
  isLoading?: boolean;
}

export function TransactionForm({
  open,
  onClose,
  onSubmit,
  transaction,
  categoryOptions = [],
  isLoading,
}: TransactionFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: transaction?.type || 'expense',
      amount: transaction?.amount || undefined,
      transactionDate: transaction?.transactionDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      merchant: transaction?.merchant || '',
      categoryId: transaction?.categoryId || '',
    },
  });

  useEffect(() => {
    reset({
      type: transaction?.type || 'expense',
      amount: transaction?.amount || undefined,
      transactionDate: transaction?.transactionDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      merchant: transaction?.merchant || '',
      categoryId: transaction?.categoryId || '',
    });
  }, [open, transaction, reset]);

  const handleFormSubmit = async (data: TransactionFormData) => {
    await onSubmit(data);
    reset();
    onClose();
  };

  const typeLabels: Record<TransactionType, string> = {
    expense: '支出',
    income: '収入',
    adjustment: '調整',
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{transaction ? '取引を編集' : '取引を追加'}</DialogTitle>
          <DialogDescription className="sr-only">
            取引情報を入力して保存します。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="type">種類</Label>
              <Select
                value={watch('type')}
                onValueChange={(value) => setValue('type', value as TransactionType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(typeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">金額</Label>
              <Input
                id="amount"
                type="number"
                placeholder="1000"
                {...register('amount')}
              />
              {errors.amount && (
                <p className="text-sm text-destructive">{errors.amount.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="transactionDate">日付</Label>
              <Input
                id="transactionDate"
                type="date"
                {...register('transactionDate')}
              />
              {errors.transactionDate && (
                <p className="text-sm text-destructive">{errors.transactionDate.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="merchant">店舗名（任意）</Label>
              <Input
                id="merchant"
                type="text"
                placeholder="コンビニ"
                {...register('merchant')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoryId">カテゴリ（任意）</Label>
              <input type="hidden" {...register('categoryId')} />
              <Select
                value={watch('categoryId') || '__none__'}
                onValueChange={(value) => setValue('categoryId', value === '__none__' ? '' : value)}
              >
                <SelectTrigger id="categoryId">
                  <SelectValue placeholder="カテゴリを選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">未選択</SelectItem>
                  {categoryOptions.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
