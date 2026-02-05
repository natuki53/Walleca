'use client';

import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Receipt } from '@/types/receipt';
import { receiptsApi } from '@/api/receipts';
import { toast } from '@/hooks/useToast';

const editSchema = z.object({
  extractedMerchant: z.string().max(255, '店舗名は255文字以内で入力してください').optional(),
  extractedDate: z
    .union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日付はYYYY-MM-DD形式で入力してください')])
    .optional(),
  extractedTotal: z
    .string()
    .optional()
    .refine(
      (value) => !value || (!Number.isNaN(Number(value)) && Number(value) > 0),
      '金額は正の数で入力してください'
    ),
});

type EditFormData = z.infer<typeof editSchema>;

interface ReceiptEditDialogProps {
  open: boolean;
  onClose: () => void;
  receipt: Receipt;
}

export function ReceiptEditDialog({ open, onClose, receipt }: ReceiptEditDialogProps) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      extractedMerchant: receipt.extractedMerchant || '',
      extractedDate: receipt.extractedDate?.slice(0, 10) || '',
      extractedTotal: receipt.extractedTotal?.toString() || '',
    },
  });

  useEffect(() => {
    reset({
      extractedMerchant: receipt.extractedMerchant || '',
      extractedDate: receipt.extractedDate?.slice(0, 10) || '',
      extractedTotal: receipt.extractedTotal?.toString() || '',
    });
  }, [receipt, reset]);

  const updateMutation = useMutation({
    mutationFn: (data: EditFormData) => {
      const merchant = data.extractedMerchant?.trim();
      const date = data.extractedDate?.trim();
      const totalRaw = data.extractedTotal?.toString().trim();
      const totalValue = totalRaw ? Number(totalRaw) : null;

      return receiptsApi.update(receipt.id, {
        extractedMerchant: merchant ? merchant : null,
        extractedDate: date ? date : null,
        extractedTotal: totalValue,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      toast({ title: 'OCR結果を更新しました' });
      onClose();
    },
    onError: () => {
      toast({ title: '更新に失敗しました', variant: 'destructive' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>OCR結果を編集</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit((data) => updateMutation.mutate(data))}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="extractedMerchant">店舗名</Label>
              <Input
                id="extractedMerchant"
                type="text"
                placeholder="コンビニA"
                {...register('extractedMerchant')}
              />
              {errors.extractedMerchant && (
                <p className="text-sm text-destructive">{errors.extractedMerchant.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="extractedDate">購入日</Label>
              <Input id="extractedDate" type="date" {...register('extractedDate')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="extractedTotal">合計金額</Label>
              <Input
                id="extractedTotal"
                type="number"
                min="0"
                step="1"
                placeholder="1500"
                {...register('extractedTotal')}
              />
              {errors.extractedTotal && (
                <p className="text-sm text-destructive">{errors.extractedTotal.message}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              キャンセル
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
