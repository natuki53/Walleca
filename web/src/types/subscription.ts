export type BillingCycle = 'monthly' | 'yearly';
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled';

export interface Subscription {
  id: string;
  serviceName: string;
  amount: number;
  billingCycle: BillingCycle;
  nextPaymentDate: string;
  category: string | null;
  status: SubscriptionStatus;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSubscriptionInput {
  serviceName: string;
  amount: number;
  billingCycle?: BillingCycle;
  nextPaymentDate: string;
  category?: string;
  status?: SubscriptionStatus;
  memo?: string;
}

export interface UpdateSubscriptionInput {
  serviceName?: string;
  amount?: number;
  billingCycle?: BillingCycle;
  nextPaymentDate?: string;
  category?: string | null;
  status?: SubscriptionStatus;
  memo?: string | null;
}

export interface SubscriptionFilters {
  status?: SubscriptionStatus;
  billingCycle?: BillingCycle;
  category?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SubscriptionSummary {
  count: number;
  monthlyTotal: number;
  yearlyTotal: number;
  byCategory: Array<{
    category: string;
    monthlyAmount: number;
  }>;
  upcomingPayments: Array<{
    id: string;
    serviceName: string;
    amount: number;
    nextPaymentDate: string;
  }>;
}
