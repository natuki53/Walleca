'use client';

import { FormEvent, RefObject, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { isAxiosError } from 'axios';
import { z } from 'zod';
import { authApi } from '@/api/auth';
import { settingsApi } from '@/api/settings';
import { subscriptionCategoriesApi } from '@/api/subscriptionCategories';
import { transactionCategoriesApi } from '@/api/transactionCategories';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { TransactionCategory } from '@/types/transactionCategory';

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

const updateAppSettingsSchema = z.object({
  timezone: z.string().min(1, 'タイムゾーンを選択してください').max(100, '100文字以内で入力してください'),
  subscriptionNotificationEnabled: z.boolean(),
  subscriptionNotificationDaysBefore: z.coerce
    .number()
    .int('整数で入力してください')
    .min(0, '0日以上で入力してください')
    .max(30, '30日以内で入力してください'),
});

type UpdateProfileFormData = z.infer<typeof updateProfileSchema>;
type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;
type UpdateAppSettingsFormData = z.infer<typeof updateAppSettingsSchema>;

const timezoneOptions = [
  { value: 'Asia/Tokyo', label: '日本標準時', city: 'Tokyo' },
  { value: 'UTC', label: '協定世界時', city: 'UTC' },
  { value: 'America/Los_Angeles', label: '米国西海岸時間', city: 'Los Angeles' },
  { value: 'America/New_York', label: '米国東海岸時間', city: 'New York' },
  { value: 'Europe/London', label: '英国時間', city: 'London' },
  { value: 'Europe/Paris', label: '中央ヨーロッパ時間', city: 'Paris' },
  { value: 'Asia/Seoul', label: '韓国標準時', city: 'Seoul' },
  { value: 'Asia/Singapore', label: 'シンガポール時間', city: 'Singapore' },
  { value: 'Australia/Sydney', label: 'オーストラリア東部時間', city: 'Sydney' },
] as const;

type ManagedCategory = {
  id: string;
  name: string;
  usageCount: number;
};

interface CategoryManagerCardProps {
  title: string;
  description: string;
  placeholder: string;
  emptyText: string;
  usageLabel: string;
  deleteMessage: (category: ManagedCategory) => string;
  categories: ManagedCategory[];
  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  onCreate: (name: string) => Promise<void>;
  onUpdate: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

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

function scrollToSection(ref: RefObject<HTMLDivElement | null>) {
  ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function normalizeCategoryName(rawName: FormDataEntryValue | string | null): string | null {
  const name = typeof rawName === 'string' ? rawName.trim() : '';
  if (name.length === 0) {
    toast({
      title: 'カテゴリ名を入力してください',
      variant: 'destructive',
    });
    return null;
  }

  if (name.length > 100) {
    toast({
      title: 'カテゴリ名は100文字以内で入力してください',
      variant: 'destructive',
    });
    return null;
  }

  return name;
}

function CategoryManagerCard({
  title,
  description,
  placeholder,
  emptyText,
  usageLabel,
  deleteMessage,
  categories,
  isLoading,
  isCreating,
  isUpdating,
  isDeleting,
  onCreate,
  onUpdate,
  onDelete,
}: CategoryManagerCardProps) {
  const newCategoryFormRef = useRef<HTMLFormElement | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [deletingCategory, setDeletingCategory] = useState<ManagedCategory | null>(null);

  const submitNewCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = normalizeCategoryName(formData.get('newCategoryName'));
    if (!name) {
      return;
    }

    await onCreate(name);
    newCategoryFormRef.current?.reset();
  };

  const startEditingCategory = (category: ManagedCategory) => {
    setEditingCategoryId(category.id);
    setEditingCategoryName(category.name);
  };

  const submitCategoryRename = async (id: string) => {
    const name = normalizeCategoryName(editingCategoryName);
    if (!name) {
      return;
    }

    await onUpdate(id, name);
    setEditingCategoryId(null);
    setEditingCategoryName('');
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            ref={newCategoryFormRef}
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              void submitNewCategory(event);
            }}
          >
            <Input
              name="newCategoryName"
              placeholder={placeholder}
              maxLength={100}
            />
            <Button type="submit" disabled={isCreating}>
              {isCreating ? '追加中...' : 'カテゴリを追加'}
            </Button>
          </form>

          <div className="space-y-2">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">読み込み中...</p>
            ) : categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">{emptyText}</p>
            ) : (
              categories.map((category) => {
                const isEditing = editingCategoryId === category.id;
                return (
                  <form
                    key={category.id}
                    className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void submitCategoryRename(category.id);
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
                        {usageLabel}: {category.usageCount}件
                      </p>
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      {isEditing ? (
                        <>
                          <Button type="submit" size="sm" disabled={isUpdating}>
                            {isUpdating ? '保存中...' : '保存'}
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
              {deletingCategory ? deleteMessage(deletingCategory) : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={() => {
                if (!deletingCategory) {
                  return;
                }
                void onDelete(deletingCategory.id).then(() => {
                  setDeletingCategory(null);
                });
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? '削除中...' : '削除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { user, setUser } = useAuthStore();
  const userSectionRef = useRef<HTMLDivElement | null>(null);
  const appSectionRef = useRef<HTMLDivElement | null>(null);
  const categoriesSectionRef = useRef<HTMLDivElement | null>(null);

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

  const {
    register: registerAppSettings,
    handleSubmit: handleAppSettingsSubmit,
    setValue: setAppSettingsValue,
    watch: watchAppSettings,
    formState: { errors: appSettingsErrors, isDirty: isAppSettingsDirty },
    reset: resetAppSettingsForm,
  } = useForm<UpdateAppSettingsFormData>({
    resolver: zodResolver(updateAppSettingsSchema),
    defaultValues: {
      timezone: 'Asia/Tokyo',
      subscriptionNotificationEnabled: true,
      subscriptionNotificationDaysBefore: 3,
    },
  });

  const { data: appSettingsResponse } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.get(),
  });
  const appSettings = appSettingsResponse?.data;

  const { data: transactionCategoriesResponse, isLoading: isTransactionCategoriesLoading } = useQuery({
    queryKey: ['transaction-categories'],
    queryFn: () => transactionCategoriesApi.getAll(),
  });

  const { data: subscriptionCategoriesResponse, isLoading: isSubscriptionCategoriesLoading } = useQuery({
    queryKey: ['subscription-categories'],
    queryFn: () => subscriptionCategoriesApi.getAll(),
  });

  useEffect(() => {
    resetProfileForm({
      displayName: user?.displayName || '',
    });
  }, [user?.displayName, resetProfileForm]);

  useEffect(() => {
    if (!appSettings) {
      return;
    }

    resetAppSettingsForm({
      timezone: appSettings.timezone,
      subscriptionNotificationEnabled: appSettings.subscriptionNotificationEnabled,
      subscriptionNotificationDaysBefore: appSettings.subscriptionNotificationDaysBefore,
    });
  }, [appSettings, resetAppSettingsForm]);

  useEffect(() => {
    const section = searchParams?.get('section');
    if (section === 'app') {
      scrollToSection(appSectionRef);
    } else if (section === 'categories') {
      scrollToSection(categoriesSectionRef);
    } else if (section === 'user') {
      scrollToSection(userSectionRef);
    }
  }, [searchParams]);

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

  const updateAppSettingsMutation = useMutation({
    mutationFn: (input: UpdateAppSettingsFormData) => settingsApi.update(input),
    onSuccess: (response) => {
      resetAppSettingsForm(response.data);
      toast({
        title: 'アプリ設定を更新しました',
      });
    },
    onError: (error: unknown) => {
      const message = getApiErrorMessage(error);
      const detailMessage = getApiErrorDetailMessage(error);
      toast({
        title: 'アプリ設定の更新に失敗しました',
        description: detailMessage || message || 'しばらくしてから再試行してください',
        variant: 'destructive',
      });
    },
  });

  const createTransactionCategoryMutation = useMutation({
    mutationFn: transactionCategoriesApi.create,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['transaction-categories'] }),
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
      ]);
      toast({ title: '取引カテゴリを追加しました' });
    },
    onError: (error: unknown) => {
      const message = getApiErrorMessage(error);
      const detailMessage = getApiErrorDetailMessage(error);
      toast({
        title: '取引カテゴリ追加に失敗しました',
        description: detailMessage || message || 'しばらくしてから再試行してください',
        variant: 'destructive',
      });
    },
  });

  const updateTransactionCategoryMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      transactionCategoriesApi.update(id, { name }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['transaction-categories'] }),
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
      ]);
      toast({ title: '取引カテゴリ名を更新しました' });
    },
    onError: (error: unknown) => {
      const message = getApiErrorMessage(error);
      const detailMessage = getApiErrorDetailMessage(error);
      toast({
        title: '取引カテゴリ更新に失敗しました',
        description: detailMessage || message || 'しばらくしてから再試行してください',
        variant: 'destructive',
      });
    },
  });

  const deleteTransactionCategoryMutation = useMutation({
    mutationFn: (id: string) => transactionCategoriesApi.delete(id),
    onSuccess: async (response) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['transaction-categories'] }),
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
      ]);
      toast({
        title: '取引カテゴリを削除しました',
        description:
          response.data.clearedTransactionCount > 0
            ? `${response.data.clearedTransactionCount}件の取引からカテゴリを解除しました`
            : undefined,
      });
    },
    onError: (error: unknown) => {
      const message = getApiErrorMessage(error);
      const detailMessage = getApiErrorDetailMessage(error);
      toast({
        title: '取引カテゴリ削除に失敗しました',
        description: detailMessage || message || 'しばらくしてから再試行してください',
        variant: 'destructive',
      });
    },
  });

  const createSubscriptionCategoryMutation = useMutation({
    mutationFn: subscriptionCategoriesApi.create,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['subscription-categories'] }),
        queryClient.invalidateQueries({ queryKey: ['subscriptions'] }),
      ]);
      toast({ title: 'サブスクカテゴリを追加しました' });
    },
    onError: (error: unknown) => {
      const message = getApiErrorMessage(error);
      const detailMessage = getApiErrorDetailMessage(error);
      toast({
        title: 'サブスクカテゴリ追加に失敗しました',
        description: detailMessage || message || 'しばらくしてから再試行してください',
        variant: 'destructive',
      });
    },
  });

  const updateSubscriptionCategoryMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      subscriptionCategoriesApi.update(id, { name }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['subscription-categories'] }),
        queryClient.invalidateQueries({ queryKey: ['subscriptions'] }),
      ]);
      toast({ title: 'サブスクカテゴリ名を更新しました' });
    },
    onError: (error: unknown) => {
      const message = getApiErrorMessage(error);
      const detailMessage = getApiErrorDetailMessage(error);
      toast({
        title: 'サブスクカテゴリ更新に失敗しました',
        description: detailMessage || message || 'しばらくしてから再試行してください',
        variant: 'destructive',
      });
    },
  });

  const deleteSubscriptionCategoryMutation = useMutation({
    mutationFn: (id: string) => subscriptionCategoriesApi.delete(id),
    onSuccess: async (response) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['subscription-categories'] }),
        queryClient.invalidateQueries({ queryKey: ['subscriptions'] }),
      ]);
      toast({
        title: 'サブスクカテゴリを削除しました',
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
        title: 'サブスクカテゴリ削除に失敗しました',
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

  const onSubmitAppSettings = (data: UpdateAppSettingsFormData) => {
    updateAppSettingsMutation.mutate(data);
  };

  const transactionCategories: ManagedCategory[] = (transactionCategoriesResponse?.data ?? []).map(
    (category: TransactionCategory) => ({
      id: category.id,
      name: category.name,
      usageCount: category.transactionCount,
    })
  );

  const subscriptionCategories: ManagedCategory[] = (subscriptionCategoriesResponse?.data ?? []).map(
    (category: SubscriptionCategory) => ({
      id: category.id,
      name: category.name,
      usageCount: category.subscriptionCount,
    })
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">設定</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ユーザー設定、アプリ設定、カテゴリ管理をまとめて更新できます。
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => scrollToSection(userSectionRef)}>
          ユーザー設定
        </Button>
        <Button variant="outline" size="sm" onClick={() => scrollToSection(appSectionRef)}>
          アプリ設定
        </Button>
        <Button variant="outline" size="sm" onClick={() => scrollToSection(categoriesSectionRef)}>
          カテゴリ管理
        </Button>
      </div>

      <section ref={userSectionRef} className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">ユーザー設定</h2>
          <p className="text-sm text-muted-foreground">
            プロフィール情報と認証情報を管理します。
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>プロフィール</CardTitle>
              <CardDescription>表示名と登録情報を確認できます。</CardDescription>
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
                  <Input id="email" type="email" value={user?.email || ''} disabled readOnly />
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
        </div>
      </section>

      <section ref={appSectionRef} className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">アプリ設定</h2>
          <p className="text-sm text-muted-foreground">
            表示タイムゾーンと通知ルールをここで管理します。
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>通知・表示設定</CardTitle>
            <CardDescription>サブスク通知とタイムゾーンを更新できます。</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleAppSettingsSubmit(onSubmitAppSettings)}>
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="timezone">タイムゾーン</Label>
                  <Select
                    value={watchAppSettings('timezone')}
                    onValueChange={(value) =>
                      setAppSettingsValue('timezone', value, {
                        shouldDirty: true,
                      })
                    }
                  >
                    <SelectTrigger id="timezone">
                      <SelectValue placeholder="タイムゾーンを選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {timezoneOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label} ({option.city})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {appSettingsErrors.timezone && (
                    <p className="text-sm text-destructive">{appSettingsErrors.timezone.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subscriptionNotificationEnabled">サブスク通知</Label>
                  <Select
                    value={watchAppSettings('subscriptionNotificationEnabled') ? 'enabled' : 'disabled'}
                    onValueChange={(value) =>
                      setAppSettingsValue('subscriptionNotificationEnabled', value === 'enabled', {
                        shouldDirty: true,
                      })
                    }
                  >
                    <SelectTrigger id="subscriptionNotificationEnabled">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="enabled">有効</SelectItem>
                      <SelectItem value="disabled">無効</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subscriptionNotificationDaysBefore">通知する日数</Label>
                <Input
                  id="subscriptionNotificationDaysBefore"
                  type="number"
                  min="0"
                  max="30"
                  {...registerAppSettings('subscriptionNotificationDaysBefore')}
                />
                {appSettingsErrors.subscriptionNotificationDaysBefore && (
                  <p className="text-sm text-destructive">
                    {appSettingsErrors.subscriptionNotificationDaysBefore.message}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  次回支払い日の何日前に通知するかを設定します。
                </p>
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={updateAppSettingsMutation.isPending || !isAppSettingsDirty}
                >
                  {updateAppSettingsMutation.isPending ? '更新中...' : 'アプリ設定を保存'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </section>

      <section ref={categoriesSectionRef} className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">カテゴリ管理</h2>
          <p className="text-sm text-muted-foreground">
            取引とサブスクのカテゴリを個別に管理できます。
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <CategoryManagerCard
            title="取引カテゴリ"
            description="取引フォームとレシート登録で使うカテゴリです。"
            placeholder="例: 食費"
            emptyText="取引カテゴリはまだありません。"
            usageLabel="使用中"
            deleteMessage={(category) =>
              category.usageCount > 0
                ? `「${category.name}」を使用中の${category.usageCount}件の取引からカテゴリを解除します。`
                : `「${category.name}」を削除します。`
            }
            categories={transactionCategories}
            isLoading={isTransactionCategoriesLoading}
            isCreating={createTransactionCategoryMutation.isPending}
            isUpdating={updateTransactionCategoryMutation.isPending}
            isDeleting={deleteTransactionCategoryMutation.isPending}
            onCreate={(name) =>
              createTransactionCategoryMutation.mutateAsync({ name }).then(() => undefined)
            }
            onUpdate={(id, name) =>
              updateTransactionCategoryMutation.mutateAsync({ id, name }).then(() => undefined)
            }
            onDelete={(id) => deleteTransactionCategoryMutation.mutateAsync(id).then(() => undefined)}
          />

          <CategoryManagerCard
            title="サブスクカテゴリ"
            description="サブスク登録・一覧で使うカテゴリです。"
            placeholder="例: 動画配信"
            emptyText="サブスクカテゴリはまだありません。"
            usageLabel="使用中"
            deleteMessage={(category) =>
              category.usageCount > 0
                ? `「${category.name}」を使用中の${category.usageCount}件のサブスクからカテゴリを解除します。`
                : `「${category.name}」を削除します。`
            }
            categories={subscriptionCategories}
            isLoading={isSubscriptionCategoriesLoading}
            isCreating={createSubscriptionCategoryMutation.isPending}
            isUpdating={updateSubscriptionCategoryMutation.isPending}
            isDeleting={deleteSubscriptionCategoryMutation.isPending}
            onCreate={(name) =>
              createSubscriptionCategoryMutation.mutateAsync({ name }).then(() => undefined)
            }
            onUpdate={(id, name) =>
              updateSubscriptionCategoryMutation.mutateAsync({ id, name }).then(() => undefined)
            }
            onDelete={(id) => deleteSubscriptionCategoryMutation.mutateAsync(id).then(() => undefined)}
          />
        </div>
      </section>
    </div>
  );
}
