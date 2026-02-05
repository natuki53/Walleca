'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { MoreHorizontal, Check, RefreshCw, Trash2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ReceiptConfirmDialog } from './ReceiptConfirmDialog';
import { ReceiptEditDialog } from './ReceiptEditDialog';
import { Receipt, OcrStatus } from '@/types/receipt';
import { receiptsApi } from '@/api/receipts';
import { toast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';

interface ReceiptListProps {
  receipts: Receipt[];
}

const statusLabels: Record<OcrStatus, string> = {
  pending: '処理待ち',
  processing: '処理中',
  success: '完了',
  failed: '失敗',
};

const statusColors: Record<OcrStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  success: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

export function ReceiptList({ receipts }: ReceiptListProps) {
  const queryClient = useQueryClient();
  const [confirmingReceipt, setConfirmingReceipt] = useState<Receipt | null>(null);
  const [editingReceipt, setEditingReceipt] = useState<Receipt | null>(null);
  const [deletingReceipt, setDeletingReceipt] = useState<Receipt | null>(null);

  const retryMutation = useMutation({
    mutationFn: receiptsApi.retryOcr,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      toast({ title: 'OCR処理を再開しました' });
    },
    onError: () => {
      toast({ title: '再処理に失敗しました', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: receiptsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      toast({ title: 'レシートを削除しました' });
    },
    onError: () => {
      toast({ title: '削除に失敗しました', variant: 'destructive' });
    },
  });

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return '-';
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
    }).format(amount);
  };

  if (receipts.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          レシートがありません
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {receipts.map((receipt) => (
          <Card key={receipt.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <Badge className={cn('mb-2', statusColors[receipt.ocrStatus])}>
                  {statusLabels[receipt.ocrStatus]}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {receipt.ocrStatus !== 'processing' && !receipt.transaction && (
                      <DropdownMenuItem onClick={() => setConfirmingReceipt(receipt)}>
                        <Check className="mr-2 h-4 w-4" />
                        確定
                      </DropdownMenuItem>
                    )}
                    {(receipt.ocrStatus === 'success' || receipt.ocrStatus === 'failed') && (
                      <DropdownMenuItem onClick={() => setEditingReceipt(receipt)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        OCR結果を編集
                      </DropdownMenuItem>
                    )}
                    {receipt.ocrStatus === 'failed' && (
                      <DropdownMenuItem onClick={() => retryMutation.mutate(receipt.id)}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        再処理
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => setDeletingReceipt(receipt)}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      削除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="space-y-2">
                <p className="font-medium">
                  {receipt.extractedMerchant || '(店舗名未取得)'}
                </p>
                <p className="text-lg font-bold">
                  {formatCurrency(receipt.extractedTotal)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {receipt.extractedDate
                    ? format(new Date(receipt.extractedDate), 'yyyy年M月d日', { locale: ja })
                    : '日付未取得'}
                </p>
                <p className="text-xs text-muted-foreground">
                  アップロード: {format(new Date(receipt.createdAt), 'yyyy/MM/dd HH:mm')}
                </p>
                {receipt.transaction && (
                  <Badge variant="outline" className="mt-2">
                    確定済み
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {confirmingReceipt && (
        <ReceiptConfirmDialog
          open={!!confirmingReceipt}
          onClose={() => setConfirmingReceipt(null)}
          receipt={confirmingReceipt}
        />
      )}

      {editingReceipt && (
        <ReceiptEditDialog
          open={!!editingReceipt}
          onClose={() => setEditingReceipt(null)}
          receipt={editingReceipt}
        />
      )}

      <AlertDialog
        open={!!deletingReceipt}
        onOpenChange={() => setDeletingReceipt(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>レシートを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingReceipt) {
                  deleteMutation.mutate(deletingReceipt.id);
                  setDeletingReceipt(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
