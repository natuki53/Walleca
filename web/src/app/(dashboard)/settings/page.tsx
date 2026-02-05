'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { isAxiosError } from 'axios';
import { z } from 'zod';
import { authApi } from '@/api/auth';
import { subscriptionCategoriesApi } from '@/api/subscriptionCategories';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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
import { toast } from '@/hooks/useToast';
import { useAuthStore } from '@/stores/authStore';
import { ApiError } from '@/types/api';
import { SubscriptionCategory } from '@/types/subscriptionCategory';

const updateProfileSchema = z.object({
  displayName: z
    .string()
    .min(1, '表示名を入力してください')
    .max(100, '表示名は100文字以内で入力してください'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, '現在のパスワードを入力してください'),
  newPassword: z
    .string()
    .min(8, '新しいパスワードは8文字以上で入力してください')
    .regex(/[A-Z]/, '大文字を1文字以上含めてください')
    .regex(/[a-z]/, '小文字を1文字以上含めてください')
    .regex(/[0-9]/, '数字を1文字以上含めてください'),
  confirmPassword: z.string().min(1, '確認用パスワードを入力してください'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: '確認用パスワードが一致しません',
  path: ['confirmPassword'],
});

type UpdateProfileFormData = z.infer<typeof updateProfileSchema>;
type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

function formatJoinedAt(value: string | undefined) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleDateString('ja-JP');
}

function getApiErrorMessage(error: unknown): string | undefined {
  if (!isAxiosError<ApiError>(error)) {
    return undefined;
  }
  return error.response?.data?.error?.message;
}

function getApiErrorDetailMessage(error: unknown): string | undefined {
  if (!isAxiosError<ApiError>(error)) {
    return undefined;
  }

  const details = error.response?.data?.error?.details;
  if (!Array.isArray(details) || details.length === 0) {
    return undefined;
  }

  const firstDetail = details[0] as { message?: unknown };
  return typeof firstDetail.message === 'string' ? firstDetail.message : undefined;
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { user, setUser } = useAuthStore();
  const newCategoryFormRef = useRef<HTMLFormElement | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [deletingCategory, setDeletingCategory] = useState<SubscriptionCategory | null>(null);

  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    formState: { errors: profileErrors, isDirty: isProfileDirty },
    reset: resetProfileForm,
  } = useForm<UpdateProfileFormData>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      displayName: user?.displayName || '',
    },
  });

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    formState: { errors: passwordErrors },
    reset: resetPasswordForm,
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const { data: categoriesResponse, isLoading: isCategoriesLoading } = useQuery({
    queryKey: ['subscription-categories'],
    queryFn: () => subscriptionCategoriesApi.getAll(),
  });
  const categories = categoriesResponse?.data ?? [];

  useEffect(() => {
    resetProfileForm({
      displayName: user?.displayName || '',
    });
  }, [user?.displayName, resetProfileForm]);

  const updateProfileMutation = useMutation({
    mutationFn: authApi.updateMe,
    onSuccess: (response) => {
      setUser(response.data);
      resetProfileForm({
        displayName: response.data.displayName,
      });
      toast({
        title: 'プロフィールを更新しました',
      });
    },
    onError: (error: unknown) => {
      const message = getApiErrorMessage(error);
      toast({
        title: 'プロフィール更新に失敗しました',
        description: message || 'しばらくしてから再試行してください',
        variant: 'destructive',
      });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: () => {
      resetPasswordForm();
      toast({
        title: 'パスワードを更新しました',
      });
    },
    onError: (error: unknown) => {
      const message = getApiErrorMessage(error);
      toast({
        title: 'パスワード更新に失敗しました',
        description: message || 'しばらくしてから再試行してください',
        variant: 'destructive',
      });
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: subscriptionCategoriesApi.create,
    onSuccess: async () => {
      newCategoryFormRef.current?.reset();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['subscription-categories'] }),
        queryClient.invalidateQueries({ queryKey: ['subscriptions'] }),
      ]);
      toast({ title: 'カテゴリを追加しました' });
    },
    onError: (error: unknown) => {
      const message = getApiErrorMessage(error);
      const detailMessage = getApiErrorDetailMessage(error);
      toast({
        title: 'カテゴリ追加に失敗しました',
        description: detailMessage || message || 'しばらくしてから再試行してください',
        variant: 'destructive',
      });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      subscriptionCategoriesApi.update(id, { name }),
    onSuccess: async () => {
      setEditingCategoryId(null);
      setEditingCategoryName('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['subscription-categories'] }),
        queryClient.invalidateQueries({ queryKey: ['subscriptions'] }),
      ]);
      toast({ title: 'カテゴリ名を更新しました' });
    },
    onError: (error: unknown) => {
      const message = getApiErrorMessage(error);
      const detailMessage = getApiErrorDetailMessage(error);
      toast({
        title: 'カテゴリ更新に失敗しました',
        description: detailMessage || message || 'しばらくしてから再試行してください',
        variant: 'destructive',
      });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => subscriptionCategoriesApi.delete(id),
    onSuccess: async (response) => {
      setDeletingCategory(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['subscription-categories'] }),
        queryClient.invalidateQueries({ queryKey: ['subscriptions'] }),
      ]);
      toast({
        title: 'カテゴリを削除しました',
        description:
          response.data.clearedSubscriptionCount > 0
            ? `${response.data.clearedSubscriptionCount}件のサブスクからカテゴリを解除しました`
            : undefined,
      });
    },
    onError: (error: unknown) => {
      const message = getApiErrorMessage(error);
      const detailMessage = getApiErrorDetailMessage(error);
      toast({
        title: 'カテゴリ削除に失敗しました',
        description: detailMessage || message || 'しばらくしてから再試行してください',
        variant: 'destructive',
      });
    },
  });

  const onSubmitProfile = (data: UpdateProfileFormData) => {
    updateProfileMutation.mutate({
      displayName: data.displayName.trim(),
    });
  };

  const onSubmitPassword = (data: ChangePasswordFormData) => {
    changePasswordMutation.mutate({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    });
  };

  const submitNewCategory = (event: FormEvent<HTMLFormElement>) => {
    const formData = new FormData(event.currentTarget);
    const rawName = formData.get('newCategoryName');
    const name = typeof rawName === 'string' ? rawName.trim() : '';

    if (name.length === 0) {
      toast({
        title: 'カテゴリ名を入力してください',
        variant: 'destructive',
      });
      return;
    }

    if (name.length > 100) {
      toast({
        title: 'カテゴリ名は100文字以内で入力してください',
        variant: 'destructive',
      });
      return;
    }

    createCategoryMutation.mutate({ name });
  };

  const startEditingCategory = (category: SubscriptionCategory) => {
    setEditingCategoryId(category.id);
    setEditingCategoryName(category.name);
  };

  const submitCategoryRename = (id: string) => {
    const name = editingCategoryName.trim();

    if (name.length === 0) {
      toast({
        title: 'カテゴリ名を入力してください',
        variant: 'destructive',
      });
      return;
    }

    if (name.length > 100) {
      toast({
        title: 'カテゴリ名は100文字以内で入力してください',
        variant: 'destructive',
      });
      return;
    }

    updateCategoryMutation.mutate({ id, name });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ユーザー設定</h1>
        <p className="text-sm text-muted-foreground mt-1">
          アカウント情報を更新できます。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>プロフィール</CardTitle>
          <CardDescription>表示名を変更できます。</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleProfileSubmit(onSubmitProfile)}>
            <div className="space-y-2">
              <Label htmlFor="displayName">表示名</Label>
              <Input
                id="displayName"
                type="text"
                placeholder="山田太郎"
                {...registerProfile('displayName')}
              />
              {profileErrors.displayName && (
                <p className="text-sm text-destructive">{profileErrors.displayName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス</Label>
              <Input
                id="email"
                type="email"
                value={user?.email || ''}
                disabled
                readOnly
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="joinedAt">登録日</Label>
              <Input
                id="joinedAt"
                type="text"
                value={formatJoinedAt(user?.createdAt)}
                disabled
                readOnly
              />
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={updateProfileMutation.isPending || !isProfileDirty}
              >
                {updateProfileMutation.isPending ? '更新中...' : 'プロフィールを保存'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>サブスクカテゴリ</CardTitle>
          <CardDescription>
            ここで作成したカテゴリはサブスク画面ですぐに選択できます。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            ref={newCategoryFormRef}
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              submitNewCategory(event);
            }}
          >
            <Input
              name="newCategoryName"
              placeholder="例: 動画配信"
              maxLength={100}
            />
            <Button type="submit" disabled={createCategoryMutation.isPending}>
              {createCategoryMutation.isPending ? '追加中...' : 'カテゴリを追加'}
            </Button>
          </form>

          <div className="space-y-2">
            {isCategoriesLoading ? (
              <p className="text-sm text-muted-foreground">読み込み中...</p>
            ) : categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">カテゴリはまだありません。</p>
            ) : (
              categories.map((category) => {
                const isEditing = editingCategoryId === category.id;
                return (
                  <form
                    key={category.id}
                    className="rounded-md border p-3 flex flex-col gap-3 sm:flex-row sm:items-center"
                    onSubmit={(event) => {
                      event.preventDefault();
                      submitCategoryRename(category.id);
                    }}
                  >
                    <div className="flex-1 space-y-1">
                      {isEditing ? (
                        <Input
                          value={editingCategoryName}
                          onChange={(event) => setEditingCategoryName(event.target.value)}
                          maxLength={100}
                          autoFocus
                        />
                      ) : (
                        <p className="font-medium">{category.name}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        使用中: {category.subscriptionCount}件
                      </p>
                    </div>

                    <div className="flex items-center gap-2 justify-end">
                      {isEditing ? (
                        <>
                          <Button type="submit" size="sm" disabled={updateCategoryMutation.isPending}>
                            {updateCategoryMutation.isPending ? '保存中...' : '保存'}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingCategoryId(null);
                              setEditingCategoryName('');
                            }}
                          >
                            キャンセル
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => startEditingCategory(category)}
                          >
                            編集
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => setDeletingCategory(category)}
                          >
                            削除
                          </Button>
                        </>
                      )}
                    </div>
                  </form>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>パスワード変更</CardTitle>
          <CardDescription>
            8文字以上で、大文字・小文字・数字を含めて設定してください。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handlePasswordSubmit(onSubmitPassword)}>
            <div className="space-y-2">
              <Label htmlFor="currentPassword">現在のパスワード</Label>
              <Input
                id="currentPassword"
                type="password"
                placeholder="••••••••"
                {...registerPassword('currentPassword')}
              />
              {passwordErrors.currentPassword && (
                <p className="text-sm text-destructive">{passwordErrors.currentPassword.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">新しいパスワード</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="••••••••"
                {...registerPassword('newPassword')}
              />
              {passwordErrors.newPassword && (
                <p className="text-sm text-destructive">{passwordErrors.newPassword.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">新しいパスワード（確認）</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                {...registerPassword('confirmPassword')}
              />
              {passwordErrors.confirmPassword && (
                <p className="text-sm text-destructive">{passwordErrors.confirmPassword.message}</p>
              )}
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={changePasswordMutation.isPending}>
                {changePasswordMutation.isPending ? '更新中...' : 'パスワードを更新'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <AlertDialog
        open={!!deletingCategory}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingCategory(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>カテゴリを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingCategory?.subscriptionCount
                ? `「${deletingCategory.name}」を使用中の${deletingCategory.subscriptionCount}件のサブスクからカテゴリを解除します。`
                : `「${deletingCategory?.name || ''}」を削除します。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteCategoryMutation.isPending}
              onClick={() => {
                if (!deletingCategory) {
                  return;
                }
                deleteCategoryMutation.mutate(deletingCategory.id);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteCategoryMutation.isPending ? '削除中...' : '削除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
