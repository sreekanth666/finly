import { router, useLocalSearchParams } from 'expo-router';
import { Input, Switch, Typography } from 'heroui-native';
import { Mail, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/button';
import { FilterChipBar, type FilterOption } from '@/components/filter-chip-bar';
import { FormScreen } from '@/components/form-screen';
import { SectionHeader } from '@/components/section-header';
import { buildSupportEmail, type ReportSections, type ReportTopic } from '@/domain/support/report';
import { DEVELOPER_EMAIL } from '@/domain/txn-detect';
import { useNavigateOnce } from '@/features/navigation/hooks';
import { useDiagnostics } from '@/features/support/diagnostics';
import { sendToDeveloper, sentMessage } from '@/features/support/mail';

const TOPICS: FilterOption<ReportTopic>[] = [
  { id: 'detection', label: 'Detection problem' },
  { id: 'other', label: 'Something else' },
];

const PLACEHOLDERS: Record<ReportTopic, string> = {
  detection: 'What went wrong? A bank whose alerts never arrive, an amount read wrong, a payment filed as something else…',
  other: 'A bug, an idea, a question — anything.',
};

function SectionToggle({
  label,
  description,
  isSelected,
  onChange,
  isFirst,
}: {
  label: string;
  description: string;
  isSelected: boolean;
  onChange: (next: boolean) => void;
  isFirst: boolean;
}) {
  return (
    <View
      className={
        isFirst ? 'flex-row items-center gap-3 px-4 py-3.5' : 'flex-row items-center gap-3 border-t border-border px-4 py-3.5'
      }>
      <View className="flex-1 gap-0.5">
        <Typography type="body-sm" weight="medium">
          {label}
        </Typography>
        <Typography type="body-xs" color="muted">
          {description}
        </Typography>
      </View>
      <Switch isSelected={isSelected} onSelectedChange={onChange} accessibilityLabel={label} />
    </View>
  );
}

/**
 * Writing to the developer (D19). Email only: the user's own mail app opens
 * with the recipient, subject, message and report filled in, and nothing is
 * sent until they press send there.
 *
 * Every section of the report can be switched off, and the preview below is
 * exactly what the email will contain — built from counts and bank names,
 * never from amounts, payees or message text.
 */
export default function ContactScreen() {
  const params = useLocalSearchParams<{ topic?: string }>();
  const navigate = useNavigateOnce();

  const [topic, setTopic] = useState<ReportTopic>(params.topic === 'detection' ? 'detection' : 'other');
  const [text, setText] = useState('');
  const [sections, setSections] = useState<ReportSections>({
    appDevice: true,
    detection: params.topic === 'detection',
    shapes: false,
  });
  const [isAttachmentOpen, setIsAttachmentOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);

  const diagnostics = useDiagnostics(sections.shapes);

  const email = useMemo(
    () =>
      buildSupportEmail({
        topic,
        userText: text,
        sections,
        app: diagnostics.app,
        device: diagnostics.device,
        status: diagnostics.status,
        summary: diagnostics.summary,
        templates: diagnostics.templates,
        shapes: diagnostics.shapes,
      }),
    [topic, text, sections, diagnostics],
  );

  const chooseTopic = (next: ReportTopic) => {
    setTopic(next);
    setSections((current) => ({ ...current, detection: next === 'detection', shapes: next === 'detection' && current.shapes }));
  };

  const send = async () => {
    setIsSending(true);
    try {
      setOutcome(sentMessage(await sendToDeveloper(email)));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <FormScreen
      title="Contact the developer"
      closeIcon={X}
      closeLabel="Close"
      onClose={() => router.back()}
      contentContainerClassName="gap-5 px-5 pb-6 pt-2"
      footer={
        <>
          {outcome !== null && (
            <Typography type="body-xs" color="muted">
              {outcome}
            </Typography>
          )}
          <Button
            icon={Mail}
            label="Email the developer"
            isDisabled={isSending || (text.trim().length === 0 && email.attachment === null)}
            onPress={() => void send()}
          />
        </>
      }>
      <Typography type="body-sm" color="muted">
        Your mail app opens with everything filled in and addressed to the developer. You see all of it, and nothing
        is sent until you press send there.
      </Typography>

      <View className="gap-2">
        <SectionHeader label="What is it about?" />
        <FilterChipBar options={TOPICS} selectedId={topic} onSelect={chooseTopic} />
      </View>

      <View className="gap-2">
        <SectionHeader label="Your message" />
        <Input
          placeholder={PLACEHOLDERS[topic]}
          value={text}
          onChangeText={setText}
          multiline
          numberOfLines={5}
          accessibilityLabel="Your message"
        />
      </View>

      <View className="gap-2">
        <SectionHeader label="Include" />
        <View className="rounded-3xl bg-surface">
          <SectionToggle
            isFirst
            label="App and phone"
            description="App version, Android version, phone make and model, language and time zone"
            isSelected={sections.appDevice}
            onChange={(next) => setSections((current) => ({ ...current, appDevice: next }))}
          />
          <SectionToggle
            isFirst={false}
            label="How detection is doing"
            description="Settings, whether the listener is running, and counts by bank. No amounts, payees or messages."
            isSelected={sections.detection}
            onChange={(next) => setSections((current) => ({ ...current, detection: next }))}
          />
          <SectionToggle
            isFirst={false}
            label="Shapes of misread messages"
            description="Up to 10 messages Finly had trouble with, with every name, amount and number replaced. Dates and times are kept."
            isSelected={sections.shapes}
            onChange={(next) => setSections((current) => ({ ...current, shapes: next }))}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigate('/inbox')}
          className="self-start px-1 active:opacity-60">
          <Typography type="body-xs" className="text-link">
            One message read wrong? Open it in the review inbox and send that one instead.
          </Typography>
        </Pressable>
      </View>

      <View className="gap-2">
        <SectionHeader label="What will be sent" />
        <View className="gap-2 rounded-2xl bg-surface p-3">
          <Typography type="body-xs" color="muted">
            {`To: ${DEVELOPER_EMAIL}`}
          </Typography>
          <Typography type="body-xs" color="muted">
            {`Subject: ${email.subject}`}
          </Typography>
          <Typography type="body-sm" selectable>
            {email.body}
          </Typography>
          {email.attachment !== null && (
            <View className="gap-2 border-t border-border pt-2">
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: isAttachmentOpen }}
                onPress={() => setIsAttachmentOpen((current) => !current)}
                className="flex-row items-center justify-between active:opacity-60">
                <Typography type="body-xs" weight="semibold">
                  {`Attached: ${email.attachment.name}`}
                </Typography>
                <Typography type="body-xs" className="text-link">
                  {isAttachmentOpen ? 'Hide' : 'Show all of it'}
                </Typography>
              </Pressable>
              {isAttachmentOpen && (
                <Typography type="body-xs" selectable>
                  {email.attachment.text}
                </Typography>
              )}
            </View>
          )}
        </View>
      </View>
    </FormScreen>
  );
}
