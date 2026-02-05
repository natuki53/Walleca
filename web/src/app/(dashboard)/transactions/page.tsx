'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TransactionList } from '@/components/transactions/TransactionList';
import { TransactionForm } from '@/components/transactions/TransactionForm';
import { transactionsApi } from '@/api/transactions';
import { toast } from '@/hooks/useToast';

export default function TransactionsPage() {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => transactionsApi.getAll({ limit: 50 }),
  });

  const createMutation = useMutation({
    mutationFn: transactionsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast({ title: '取引を追加しました' });
    },
    onError: () => {
      toast({ title: '追加に失敗しました', variant: 'destructive' });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">取引一覧</h1>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          取引を追加
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">
          読み込み中...
        </div>
      ) : (
        <TransactionList transactions={data?.data || []} />
      )}

      <TransactionForm
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={async (data) => {
          await createMutation.mutateAsync(data);
        }}
        isLoading={createMutation.isPending}
      />
    </div>
  );
}
