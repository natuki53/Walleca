export interface SubscriptionCategory {
  id: string;
  name: string;
  subscriptionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSubscriptionCategoryInput {
  name: string;
}

export interface UpdateSubscriptionCategoryInput {
  name: string;
}
