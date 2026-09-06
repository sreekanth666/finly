import { router } from 'expo-router';

import { RuleEditor, type RuleDraft } from '@/components/rule-editor';
import { createRule } from '@/db/repositories/rules';
import { useAction, useSubmitOnce } from '@/db/use-action';
import { draftToInput } from '@/features/rules/mappers';

export default function NewRuleScreen() {
  /* One press, one row. The write is synchronous, so by the time a second
     press lands the first has long finished and would simply create another. */
  const save = useAction(createRule);
  const saveOnce = useSubmitOnce(async (draft: RuleDraft) => {
    const outcome = await save.run(draftToInput(draft));
    if (!outcome.ok) return false;
    router.back();
    return true;
  });

  return (
    <RuleEditor
      title="New rule"
      submitLabel="Create rule"
      isSubmitting={save.isPending}
      errorMessage={save.errorMessage}
      onSubmit={(draft) => void saveOnce.submit(draft)}
      onClose={() => router.back()}
    />
  );
}
