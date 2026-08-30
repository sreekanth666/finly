import { router } from 'expo-router';

import { RuleEditor } from '@/components/rule-editor';
import { createRule } from '@/db/repositories/rules';
import { useAction } from '@/db/use-action';
import { draftToInput } from '@/features/rules/mappers';

export default function NewRuleScreen() {
  const save = useAction(createRule);

  return (
    <RuleEditor
      title="New rule"
      submitLabel="Create rule"
      isSubmitting={save.isPending}
      errorMessage={save.errorMessage}
      onSubmit={async (draft) => {
        const outcome = await save.run(draftToInput(draft));
        if (outcome.ok) router.back();
      }}
      onClose={() => router.back()}
    />
  );
}
