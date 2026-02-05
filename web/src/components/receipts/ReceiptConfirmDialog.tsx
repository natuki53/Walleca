'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Receipt } from '@/types/receipt';
import { TransactionType } from '@/types/transaction';
import { receiptsApi } from '@/api/receipts';
import { toast } from '@/hooks/useToast';

const confirmSchema = z.object({
  type: z.enum(['expense', 'income', 'adjustment']),
  amount: z.coerce.number().positive('金額は正の数で入力してください'),
  transactionDate: z.string().min(1, '日付を入力してください'),
  merchant: z.string().optional(),
});

type ConfirmFormData = z.infer<typeof confirmSchema>;

interface ReceiptConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  receipt: Receipt;
}

const typeLabels: Record<TransactionType, string> = {
  expense: '支出',
  income: '収入',
  adjustment: '調整',
};

export function ReceiptConfirmDialog({
  open,
  onClose,
  receipt,
}: ReceiptConfirmDialogProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ConfirmFormData>({
    resolver: zodResolver(confirmSchema),
    defaultValues: {
      type: 'expense',
      amount: receipt.extractedTotal || undefined,
      transactionDate:
        receipt.extractedDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      merchant: receipt.extractedMerchant || '',
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (data: ConfirmFormData) => receiptsApi.confirm(receipt.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast({ title: '取引を登録しました' });
      onClose();
    },
    onError: () => {
      toast({ title: '登録に失敗しました', variant: 'destructive' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>レシートを確定</DialogTitle>
          <DialogDescription className="sr-only">
            抽出結果を確認して取引として登録します。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((data) => confirmMutation.mutate(data))}>
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="merchant">店舗名</Label>
              <Input
                id="merchant"
                type="text"
                {...register('merchant')}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              キャンセル
            </Button>
            <Button type="submit" disabled={confirmMutation.isPending}>
              {confirmMutation.isPending ? '登録中...' : '登録'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
