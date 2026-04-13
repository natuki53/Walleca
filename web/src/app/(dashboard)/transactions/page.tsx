'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ReceiptText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TransactionList } from '@/components/transactions/TransactionList';
import { TransactionForm } from '@/components/transactions/TransactionForm';
import { ReceiptUploader } from '@/components/receipts/ReceiptUploader';
import { transactionsApi } from '@/api/transactions';
import { transactionCategoriesApi } from '@/api/transactionCategories';
import { toast } from '@/hooks/useToast';
import { CreateTransactionInput } from '@/types/transaction';

function toCreateInput(input: {
  type: 'expense' | 'income' | 'adjustment';
  amount: number;
  transactionDate: string;
  merchant?: string;
  categoryId?: string;
}): CreateTransactionInput {
  return {
    type: input.type,
    amount: input.amount,
    transactionDate: input.transactionDate,
    ...(input.merchant?.trim() && { merchant: input.merchant.trim() }),
    ...(input.categoryId?.trim() && { categoryId: input.categoryId }),
  };
}

export default function TransactionsPage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const receiptSectionRef = useRef<HTMLDivElement | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [dismissedAutoAction, setDismissedAutoAction] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => transactionsApi.getAll({ limit: 50 }),
  });

  const { data: categoryResponse } = useQuery({
    queryKey: ['transaction-categories'],
    queryFn: () => transactionCategoriesApi.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateTransactionInput) => transactionsApi.create(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast({ title: '取引を追加しました' });
    },
    onError: () => {
      toast({ title: '追加に失敗しました', variant: 'destructive' });
    },
  });

  const categoryOptions = useMemo(() => categoryResponse?.data ?? [], [categoryResponse?.data]);

  const action = searchParams?.get('action') ?? '';
  const autoOpenForm = action === 'manual' && dismissedAutoAction !== action;

  useEffect(() => {
    if (action === 'receipt') {
      receiptSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [action]);

  const handleCloseForm = () => {
    setIsFormOpen(false);
    if (action === 'manual') {
      setDismissedAutoAction(action);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">取引</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            手入力とレシートOCRを同じフローにまとめて、登録までここで完結できます。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              setDismissedAutoAction(null);
              setIsFormOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            手動で追加
          </Button>
          <Button
            variant="outline"
            onClick={() => receiptSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            <ReceiptText className="mr-2 h-4 w-4" />
            レシートを読み取る
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_1.35fr]">
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>手動入力</CardTitle>
            <CardDescription>
              現金、振込、調整などレシートがない取引はこちらから直接登録します。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted/60 p-4 text-sm text-muted-foreground">
              日付、金額、種別、カテゴリを入力してすぐ登録できます。
            </div>
            <Button
              className="w-full"
              onClick={() => {
                setDismissedAutoAction(null);
                setIsFormOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              取引フォームを開く
            </Button>
          </CardContent>
        </Card>

        <div ref={receiptSectionRef} id="receipt-upload">
          <Card>
            <CardHeader>
              <CardTitle>レシートOCR</CardTitle>
              <CardDescription>
                アップロード後はそのまま確認画面へ進み、修正して取引登録できます。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ReceiptUploader />
            </CardContent>
          </Card>
        </div>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">最近の取引</h2>
          <p className="text-sm text-muted-foreground">
            直近50件を表示しています。編集や削除もここから行えます。
          </p>
        </div>

        {isLoading ? (
          <div className="py-10 text-center text-muted-foreground">読み込み中...</div>
        ) : (
          <TransactionList
            transactions={data?.data || []}
            categoryOptions={categoryOptions}
          />
        )}
      </section>

      <TransactionForm
        open={isFormOpen || autoOpenForm}
        onClose={handleCloseForm}
        onSubmit={async (formData) => {
          await createMutation.mutateAsync(toCreateInput(formData));
        }}
        categoryOptions={categoryOptions}
        isLoading={createMutation.isPending}
      />
    </div>
  );
}
