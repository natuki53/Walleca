'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { TransactionForm } from './TransactionForm';
import { Transaction, TransactionType, UpdateTransactionInput } from '@/types/transaction';
import { transactionsApi } from '@/api/transactions';
import { toast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';

interface TransactionListProps {
  transactions: Transaction[];
}

const typeLabels: Record<TransactionType, string> = {
  expense: '支出',
  income: '収入',
  adjustment: '調整',
};

const typeColors: Record<TransactionType, string> = {
  expense: 'text-destructive',
  income: 'text-green-600',
  adjustment: 'text-blue-600',
};

export function TransactionList({ transactions }: TransactionListProps) {
  const queryClient = useQueryClient();
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTransactionInput }) =>
      transactionsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast({ title: '取引を更新しました' });
    },
    onError: () => {
      toast({ title: '更新に失敗しました', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => transactionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast({ title: '取引を削除しました' });
    },
    onError: () => {
      toast({ title: '削除に失敗しました', variant: 'destructive' });
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
    }).format(amount);
  };

  if (transactions.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          取引がありません
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {transactions.map((transaction) => (
          <Card key={transaction.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-4">
                <div>
                  <p className="font-medium">
                    {transaction.merchant || '(店舗名なし)'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(transaction.transactionDate), 'yyyy年M月d日', {
                      locale: ja,
                    })}
                    <span className="ml-2 text-xs">
                      {typeLabels[transaction.type]}
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'font-semibold',
                    typeColors[transaction.type]
                  )}
                >
                  {transaction.type === 'expense' ? '-' : '+'}
                  {formatCurrency(transaction.amount)}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditingTransaction(transaction)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      編集
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setDeletingTransaction(transaction)}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      削除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {editingTransaction && (
        <TransactionForm
          open={!!editingTransaction}
          onClose={() => setEditingTransaction(null)}
          onSubmit={async (data) => {
            await updateMutation.mutateAsync({
              id: editingTransaction.id,
              data,
            });
          }}
          transaction={editingTransaction}
          isLoading={updateMutation.isPending}
        />
      )}

      <AlertDialog
        open={!!deletingTransaction}
        onOpenChange={() => setDeletingTransaction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>取引を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingTransaction) {
                  deleteMutation.mutate(deletingTransaction.id);
                  setDeletingTransaction(null);
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
