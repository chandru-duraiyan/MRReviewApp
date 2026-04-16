// ─── Ask for Review — Message Templates ──────────────────────────────────────
// Edit this file to customise the messages shown in the "Ask for Review" panel.
//
// ASK_MESSAGES: each entry needs id (unique), label (tab text), text (message
//   with {link} placeholder replaced at runtime with the MR link).
//   The greeting is always "Hi{salutation}," — {salutation} is injected
//   automatically based on the user's salutation selection.
//
// ASK_SALUTATIONS: list of salutation options shown below the template tabs.
//   id: unique key, label: display text, value: what is inserted after "Hi".
//   Include an entry with value: '' for the "None" (no salutation) option.

const ASK_MESSAGES = [
  {
    id:    'default',
    label: 'Default',
    text:  'Hi{salutation}, could you please review this MR when you have a moment? {link}',
  },
  {
    id:    'urgent',
    label: 'Urgent',
    text:  'Hi{salutation}, could you please review this MR at the earliest convenience? This is quite urgent. {link}',
  },
  {
    id:    'eod',
    label: 'Before EOD',
    text:  'Hi{salutation}, could you please review this MR before the end of the day? It would be greatly appreciated. {link}',
  },
];

const ASK_SALUTATIONS = [
  { id: 'none',  label: 'None',  value: ''      },
  { id: 'anna',  label: 'Anna',  value: ' Anna' },
  { id: 'akka',  label: 'Akka',  value: ' Akka' },
  { id: 'bro',  label: 'Bro',  value: ' Bro' },
];
