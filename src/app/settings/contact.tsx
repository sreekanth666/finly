import { router, useLocalSearchParams } from 'expo-router';
import { Input, Switch, Typography } from 'heroui-native';
import { Mail, X } from '@/components/icons';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/button';
import { FilterChipBar, type FilterOption } from '@/components/filter-chip-bar';
import { FormScreen } from '@/components/form-screen';
import { SectionHeader } from '@/components/section-header';
import { freshDraft, withTopic, type ContactDraft } from '@/domain/support/draft';
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
 *
 * Once the mail app has the message, the form starts over so the same report
 * is not sent twice by accident. Finly cannot tell a sent email from a
 * cancelled one (see `mail.ts`), so the old draft is kept aside and offered
 * back until the user starts editing the new one.
 */
export default function ContactScreen() {
  const params = useLocalSearchParams<{ topic?: string }>();
  const navigate = useNavigateOnce();

  const startTopic: ReportTopic = params.topic === 'detection' ? 'detection' : 'other';
  const [draft, setDraft] = useState<ContactDraft>(() => freshDraft(startTopic));
  const { topic, text, sections } = draft;
  const [isAttachmentOpen, setIsAttachmentOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  /* What happened on the last send, and the draft it took, while that can
     still be brought back. Both go on the next edit. */
  const [outcome, setOutcome] = useState<{ message: string; previous: ContactDraft | null } | null>(null);

  const diagnostics = useDiagnostics(sections.shapes, sections.labelled);

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
        labelled: diagnostics.labelled,
      }),
    [topic, text, sections, diagnostics],
  );

  const edit = (change: (current: ContactDraft) => ContactDraft) => {
    setDraft(change);
    setOutcome(null);
  };
  const chooseTopic = (next: ReportTopic) => edit((current) => withTopic(current, next));
  const setText = (next: string) => edit((current) => ({ ...current, text: next }));
  const toggle = (key: keyof ReportSections) => (next: boolean) =>
    edit((current) => ({ ...current, sections: { ...current.sections, [key]: next } }));

  const send = async () => {
    setIsSending(true);
    try {
      const route = await sendToDeveloper(email);
      /* Nothing opened, so nothing was handed over: the draft stays put. */
      const isHandedOff = route !== 'failed';
      setOutcome({ message: sentMessage(route), previous: isHandedOff ? draft : null });
      if (isHandedOff) {
        setDraft(freshDraft(startTopic));
        setIsAttachmentOpen(false);
      }
    } finally {
      setIsSending(false);
    }
  };

  const previous = outcome?.previous ?? null;
  const bringBack = (draftToRestore: ContactDraft) => {
    setDraft(draftToRestore);
    setOutcome(null);
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
              {outcome.message}
            </Typography>
          )}
          {previous !== null && (
            <Pressable
              accessibilityRole="button"
              onPress={() => bringBack(previous)}
              className="self-start active:opacity-60">
              <Typography type="body-xs" className="text-link">
                Didn’t send it? Bring your message back.
              </Typography>
            </Pressable>
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
            onChange={toggle('appDevice')}
          />
          <SectionToggle
            isFirst={false}
            label="How detection is doing"
            description="Settings, whether the listener is running, and counts by bank. No amounts, payees or messages."
            isSelected={sections.detection}
            onChange={toggle('detection')}
          />
          <SectionToggle
            isFirst={false}
            label="Shapes of misread messages"
            description="Up to 10 messages Finly had trouble with, with every name, amount and number replaced. Dates and times are kept."
            isSelected={sections.shapes}
            onChange={toggle('shapes')}
          />
          <SectionToggle
            isFirst={false}
            label="Help improve detection"
            description="Up to 300 messages you have reviewed, as shapes with every name, amount and number replaced, and what you did with each. Dates and times are kept."
            isSelected={sections.labelled}
            onChange={toggle('labelled')}
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
