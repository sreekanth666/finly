import { router, useLocalSearchParams } from 'expo-router';
import { Typography } from 'heroui-native';
import { Lightbulb, TriangleAlert } from 'lucide-react-native';
import { View } from 'react-native';

import { Icon } from '@/components/icon';
import { RuleEditor, type RuleDraft } from '@/components/rule-editor';
import { createRule } from '@/db/repositories/rules';
import { useAction, useSubmitOnce } from '@/db/use-action';
import { findRuleTemplate } from '@/domain/rule-templates';
import { useCategories } from '@/features/catalog/hooks';
import { draftToInput, templateToDraft } from '@/features/rules/mappers';

export default function NewRuleScreen() {
  /* `?template=<id>` when opened from the templates sheet. An id that no
     longer exists — an old link, a template since removed — opens a blank
     rule rather than an error: there is nothing wrong with starting fresh. */
  const params = useLocalSearchParams<{ template?: string | string[] }>();
  const templateId = Array.isArray(params.template) ? params.template[0] : params.template;
  const template = findRuleTemplate(templateId);

  /* Read synchronously on the first render, so the draft below is complete
     before the editor copies it into its own state. Active only: a template
     must never point a new rule at a category the user archived. */
  const categories = useCategories();
  const initial = template === null ? undefined : templateToDraft(template, categories.data ?? []);

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
      /* The editor takes `initial` once, when it mounts. Keyed on the template
         so a different one can never inherit the previous one's draft. */
      key={template?.id ?? 'blank'}
      title={template === null ? 'New rule' : 'New rule from template'}
      initial={initial}
      intro={
        template === null ? undefined : (
          <View className="gap-3 rounded-3xl bg-surface p-4">
            <View className="flex-row items-start gap-3">
              <Icon icon={Lightbulb} color="accent" size={16} />
              <View className="flex-1 gap-1">
                <Typography type="body-sm" weight="semibold">
                  {`From the “${template.name}” template`}
                </Typography>
                <Typography type="body-xs" color="muted">
                  {template.lesson}
                </Typography>
                <Typography type="body-xs" color="muted">
                  Change anything below before you create it.
                </Typography>
              </View>
            </View>

            {/* Renamed or archived since install. Not created or restored on
                the user's behalf: that would write before they agreed, and undo
                an archive they chose. The picker's New pill does it in a tap. */}
            {initial?.categoryId === null && (
              <View className="flex-row items-start gap-3">
                <Icon icon={TriangleAlert} color="warning" size={16} />
                <Typography type="body-xs" color="muted" className="flex-1">
                  {`Couldn’t find your “${template.categoryName}” category — pick one below, or add it with New.`}
                </Typography>
              </View>
            )}
          </View>
        )
      }
      submitLabel="Create rule"
      isSubmitting={save.isPending}
      errorMessage={save.errorMessage}
      onSubmit={(draft) => void saveOnce.submit(draft)}
      onClose={() => router.back()}
    />
  );
}
