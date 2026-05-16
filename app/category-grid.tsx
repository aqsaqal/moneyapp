// Phase 10w long-press FAB destination → Phase 10z thin wrapper around
// the unified CategoryPicker. Renders full-screen via expo-router's
// modal presentation; picks an expense category and lands the user
// on /add with it prefilled.

import React from 'react';
import { useRouter } from 'expo-router';
import { CategoryPicker } from '@/components/CategoryPicker';
import { encodePrefill } from '@/utils/prefill';

export default function CategoryGridScreen() {
  const router = useRouter();

  return (
    <CategoryPicker
      visible
      mode="select"
      transactionType="expense"
      showBudgetProgress
      showAddNew
      headerText="Pick category"
      onSelect={(categoryId) => {
        router.replace({
          pathname: '/add',
          params: { prefill: encodePrefill({ type: 'expense', category: categoryId }) },
        } as never);
      }}
      onClose={() => router.back()}
    />
  );
}
