// ─── Ask for Review — Message Templates ──────────────────────────────────────
// Edit this file to customise the messages shown in the "Ask for Review" panel.
//
// ASK_MESSAGES: each entry needs id (unique), label (tab text), text (message
//   with {link} placeholder replaced at runtime with the MR link).

const ASK_MESSAGES = [
  {
    id:    'default',
    label: 'Default',
    text:  'Hi, could you please review this MR when you have a moment? {link}',
  },
  {
    id:    'urgent',
    label: 'Urgent',
    text:  'Hi, could you please review this MR at the earliest convenience? This is quite urgent. {link}',
  },
  {
    id:    'eod',
    label: 'Before EOD',
    text:  'Hi, could you please review this MR before the end of the day? It would be greatly appreciated. {link}',
  },
];
