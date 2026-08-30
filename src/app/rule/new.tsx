import { router } from 'expo-router';

import { RuleEditor } from '@/components/rule-editor';

export default function NewRuleScreen() {
  return (
    <RuleEditor
      title="New rule"
      submitLabel="Create rule"
      onSubmit={() => router.back()}
      onClose={() => router.back()}
    />
  );
}
