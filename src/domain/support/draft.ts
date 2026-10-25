/**
 * What the user has put together on the contact screen (D19) before it goes
 * to their mail app: a topic, their message, and which report sections to
 * include.
 *
 * It is one value so the screen can put it aside whole once the mail app has
 * it, and hand it back if the user comes back without having sent it.
 */

import type { ReportSections, ReportTopic } from './report';

export type ContactDraft = {
  topic: ReportTopic;
  text: string;
  sections: ReportSections;
};

/** A blank form. The detection summary is on by default only for a detection problem. */
export function freshDraft(topic: ReportTopic): ContactDraft {
  return {
    topic,
    text: '',
    sections: { appDevice: true, detection: topic === 'detection', shapes: false, labelled: false },
  };
}

/**
 * Switching topic follows the detection summary to the new topic, and drops the
 * message shapes, which only belong to a detection problem.
 */
export function withTopic(draft: ContactDraft, topic: ReportTopic): ContactDraft {
  return {
    ...draft,
    topic,
    sections: {
      ...draft.sections,
      detection: topic === 'detection',
      shapes: topic === 'detection' && draft.sections.shapes,
      labelled: topic === 'detection' && draft.sections.labelled,
    },
  };
}
