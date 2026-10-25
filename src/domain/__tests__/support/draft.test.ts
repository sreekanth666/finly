import { freshDraft, withTopic } from '@/domain/support/draft';

describe('freshDraft', () => {
  it('starts empty, with only the app and phone section for something else', () => {
    expect(freshDraft('other')).toEqual({
      topic: 'other',
      text: '',
      sections: { appDevice: true, detection: false, shapes: false, labelled: false },
    });
  });

  it('includes how detection is doing for a detection problem', () => {
    expect(freshDraft('detection').sections).toEqual({
      appDevice: true,
      detection: true,
      shapes: false,
      labelled: false,
    });
  });
});

describe('withTopic', () => {
  it('keeps the message and the app and phone choice', () => {
    const draft = { ...freshDraft('other'), text: 'Hello', sections: { ...freshDraft('other').sections, appDevice: false } };
    const next = withTopic(draft, 'detection');
    expect(next.text).toBe('Hello');
    expect(next.sections.appDevice).toBe(false);
    expect(next.sections.detection).toBe(true);
  });

  it('drops the detection-only sections when leaving a detection problem', () => {
    const draft = {
      ...freshDraft('detection'),
      sections: { appDevice: true, detection: true, shapes: true, labelled: true },
    };
    expect(withTopic(draft, 'other').sections).toEqual({
      appDevice: true,
      detection: false,
      shapes: false,
      labelled: false,
    });
  });

  it('keeps the shapes choices when staying on a detection problem', () => {
    const draft = {
      ...freshDraft('detection'),
      sections: { appDevice: true, detection: false, shapes: true, labelled: true },
    };
    expect(withTopic(draft, 'detection').sections).toEqual({
      appDevice: true,
      detection: true,
      shapes: true,
      labelled: true,
    });
  });
});
