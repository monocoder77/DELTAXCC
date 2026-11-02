'use client';

/* ==========================================================================
   Resources
   Six built-in guides, written for DeltaX students. An index column on the
   left (sticky on large screens) and a serif reading column on the right;
   on small screens the guides collapse into an accordion.
   ========================================================================== */

import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useNow } from '@/lib/hooks';
import type { StudentPanelProps, StudentTab } from './nav';
import { Diamond, LineMeter, Panel, PanelHeader, cx, pad2, toneColor } from './ui/primitives';
import { IconArrowRight, IconChevronDown, IconMessage } from './ui/icons';

/* --------------------------------------------------------------------------
   Content model
   -------------------------------------------------------------------------- */
type Block =
  | { kind: 'p'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'steps'; items: { title: string; text: string }[] }
  | { kind: 'months'; items: { month: number; name: string; items: string[] }[] }
  | { kind: 'example'; caption: string; rows: { tag: string; field: string; text: string; limit: number }[] }
  | { kind: 'note'; text: string };

interface GuideSection {
  label: string;
  blocks: Block[];
}

type GuideId = 'essays' | 'list' | 'timeline' | 'activities' | 'recommendations' | 'interviews';

interface Guide {
  id: GuideId;
  title: string;
  summary: string;
  related?: { tab: StudentTab; label: string };
  sections: GuideSection[];
}

/* --------------------------------------------------------------------------
   Guides
   -------------------------------------------------------------------------- */
const GUIDES: Guide[] = [
  {
    id: 'essays',
    title: 'The essay process',
    summary: 'Brainstorm, draft, revise, and get the most out of feedback here.',
    related: { tab: 'schools', label: 'Open Schools & Essays' },
    sections: [
      {
        label: 'Brainstorm',
        blocks: [
          {
            kind: 'p',
            text: 'Start with material, not a theme. Strong essays usually grow out of one specific moment, habit, place, or question, then widen out to what it says about you.',
          },
          {
            kind: 'list',
            items: [
              'List twenty small, concrete things: a routine you never skip, an object on your desk, an argument you keep having, a problem you could talk about for an hour.',
              'For each one, ask: what did I do, what did I notice, and what changed in how I think?',
              'Pick the idea only you could write. If a classmate could put their name on it without changing much, keep digging.',
              'Skip guessing what admissions officers want to hear. Familiar topics can work, but only when the details and the thinking are unmistakably yours.',
            ],
          },
        ],
      },
      {
        label: 'Draft',
        blocks: [
          {
            kind: 'list',
            items: [
              'Write a fast, messy first draft. Get the whole story down before you polish a single sentence.',
              'Open close to the action: a scene, a line of dialogue, a specific detail. Avoid openings that define a word or quote someone famous.',
              'Leave real room for reflection. What did you learn, how did you change, and what do you do differently now?',
              'Ignore the word count at first. The Common App personal statement allows up to 650 words, and supplement limits vary, so check each prompt in Schools & Essays.',
            ],
          },
        ],
      },
      {
        label: 'Revise',
        blocks: [
          {
            kind: 'steps',
            items: [
              {
                title: 'Big picture',
                text: 'Does the essay make one clear point about who you are? Could a reader sum it up in a sentence? Fix the structure before the sentences.',
              },
              {
                title: 'Paragraphs',
                text: 'Cut any paragraph that repeats what the reader already knows. Each one should move the story or the thinking forward.',
              },
              {
                title: 'Sentences',
                text: 'Read it out loud. Trade vague words for specific ones, cut filler like "very" and "really", and keep the voice you actually speak in.',
              },
              {
                title: 'Rest',
                text: 'Step away for a day or two between rounds. Fresh eyes catch what tired ones miss.',
              },
            ],
          },
        ],
      },
      {
        label: 'Using feedback here',
        blocks: [
          {
            kind: 'list',
            items: [
              'Write in the essay editor under Schools & Essays. It saves as you type and keeps a version history, so an earlier draft is never lost.',
              'When a draft feels ready, press Submit for review. Your counselor reads it and leaves comments alongside the essay.',
              'Work through every comment. If you disagree with a suggestion, reply and say why. It is your essay and your voice.',
              'Your counselor will either approve it as final or send it back for revision. Revise, then submit again.',
            ],
          },
          {
            kind: 'note',
            text: 'Write it yourself. Feedback should sharpen your ideas, not replace them, and that applies to AI tools as much as to people.',
          },
        ],
      },
    ],
  },
  {
    id: 'list',
    title: 'Building a balanced school list',
    summary: 'Reach, target, and safety, and how DeltaX balances a list.',
    related: { tab: 'schools', label: 'Open Schools & Essays' },
    sections: [
      {
        label: 'The three categories',
        blocks: [
          {
            kind: 'steps',
            items: [
              {
                title: 'Reach',
                text: 'Admission is unlikely even if you are a strong fit. Your profile may sit below the typical admitted student, or the school admits so few applicants that it is a reach for everyone.',
              },
              {
                title: 'Target',
                text: 'Your grades, course rigor, and scores (if you submit them) fall in or above the middle of admitted students. Admission is reasonably likely, not guaranteed.',
              },
              {
                title: 'Safety',
                text: 'You are very likely to be admitted, you can afford it, and you would genuinely be happy to go. All three have to be true.',
              },
            ],
          },
        ],
      },
      {
        label: 'How DeltaX builds a list',
        blocks: [
          {
            kind: 'p',
            text: 'We aim for 2 safeties, 3 to 4 targets, and the rest reaches. Every school on the list should be one you would actually attend.',
          },
          {
            kind: 'list',
            items: [
              'Two safeties make sure you have real choices in the spring, including at least one that works financially without counting on merit aid.',
              'Three or four targets are the heart of the list. Research them as seriously as your reaches, because this is where many students end up.',
              'Reaches fill the rest. Add one only if you can write strong, specific essays for it. Quality slips when a list grows too long.',
            ],
          },
        ],
      },
      {
        label: 'Sorting schools honestly',
        blocks: [
          {
            kind: 'list',
            items: [
              "Compare your GPA, course rigor, and test scores to each school's middle 50% ranges. You can find them in the school's Common Data Set or on its admissions site.",
              'Check testing policies school by school. Test-optional, test-required, and test-blind policies differ and can change from one year to the next.',
              'Your intended major can matter. Some programs, often engineering, nursing, or computer science, are more selective than the university as a whole.',
              "Run each college's Net Price Calculator (every college posts one on its website) before you call it a safety.",
            ],
          },
        ],
      },
      {
        label: 'Fit beyond the numbers',
        blocks: [
          {
            kind: 'steps',
            items: [
              { title: 'Academics', text: 'Does it offer your likely major, plus a couple of backups you would be glad to study?' },
              { title: 'Setting', text: 'Size, location, distance from home, and the feel of the campus on an ordinary weekday.' },
              { title: 'Cost', text: 'Net price after aid, not the sticker price.' },
              { title: 'People', text: 'Visit if you can, sit in on a class, or talk with current students about what a normal week looks like.' },
            ],
          },
          {
            kind: 'note',
            text: 'Every school in Schools & Essays carries a reach, target, or safety tag, so you and your counselor can see the balance at a glance.',
          },
        ],
      },
    ],
  },
  {
    id: 'timeline',
    title: 'Senior year timeline',
    summary: 'Month by month, from August through May.',
    related: { tab: 'tasks', label: 'Open Tasks' },
    sections: [
      {
        label: 'Before you start',
        blocks: [
          {
            kind: 'p',
            text: "These dates are typical. Every college sets its own deadlines, so confirm each one on the school's website and keep them current in Schools & Essays.",
          },
        ],
      },
      {
        label: 'Month by month',
        blocks: [
          {
            kind: 'months',
            items: [
              {
                month: 7,
                name: 'August',
                items: [
                  'The Common App opens for the new cycle on August 1. Create your account or roll over last year’s.',
                  'Settle on a first version of your school list.',
                  'Finish a full draft of your personal statement.',
                  'Confirm which teachers will write your recommendations.',
                ],
              },
              {
                month: 8,
                name: 'September',
                items: [
                  'Decide whether to apply Early Decision (binding) or Early Action (non-binding) anywhere.',
                  'Draft supplements for your early schools first.',
                  "Formally request recommendations through your school's system, giving recommenders at least a month.",
                  'Register for a fall SAT or ACT if you plan to retest.',
                ],
              },
              {
                month: 9,
                name: 'October',
                items: [
                  'The FAFSA normally opens October 1. Confirm the date on studentaid.gov and file early.',
                  'The CSS Profile, required by many private colleges, usually opens October 1 as well. Note which schools need it and their priority deadlines.',
                  'Finalize early applications and send official test scores where required.',
                ],
              },
              {
                month: 10,
                name: 'November',
                items: [
                  'Early Decision and Early Action deadlines usually fall in early November, most often November 1 or November 15.',
                  'After you submit, log in to each applicant portal and confirm every document arrived.',
                  'Keep writing your Regular Decision essays.',
                ],
              },
              {
                month: 11,
                name: 'December',
                items: [
                  'Most early decisions arrive in mid-December.',
                  "Admitted Early Decision? Withdraw your other applications and follow the school's deposit instructions.",
                  'Deferred? Read what the school asks for. Some welcome a short update letter, others prefer nothing extra.',
                  'Finish Regular Decision essays before the break.',
                ],
              },
              {
                month: 0,
                name: 'January',
                items: [
                  'Many Regular Decision deadlines fall in early January, often between January 1 and January 15.',
                  'Early Decision II deadlines are often in early January too.',
                  'Your school counselor sends a midyear report with first semester grades, so finish the semester strong.',
                ],
              },
              {
                month: 1,
                name: 'February',
                items: [
                  'Watch applicant portals and email for missing items or financial aid requests.',
                  'A few colleges have February deadlines. Check any that remain on your list.',
                  'Keep your grades steady. Offers of admission can depend on your final transcript.',
                ],
              },
              {
                month: 2,
                name: 'March',
                items: [
                  'Regular Decision results start arriving, many of them in mid to late March.',
                  'Read each financial aid offer carefully as it comes in.',
                ],
              },
              {
                month: 3,
                name: 'April',
                items: [
                  'Compare aid offers side by side by net cost, not sticker price.',
                  "If an offer falls short, you can ask the school's financial aid office to review it, especially if your circumstances have changed.",
                  'Visit campuses or attend admitted student events if you can.',
                  "Waitlisted? Opt in only where you would still go, and follow each school's instructions.",
                ],
              },
              {
                month: 4,
                name: 'May',
                items: [
                  'May 1 is the usual national deposit deadline. Submit one deposit, to one school.',
                  'Decline your other offers so students on waitlists can get a spot.',
                  'Ask your high school to send your final transcript to the college you chose.',
                  'Thank your recommenders and tell them where you are headed.',
                ],
              },
            ],
          },
          {
            kind: 'note',
            text: 'Your Tasks tab holds the deadlines and to-dos your counselor sets for you, so the plan above turns into a checklist you can actually tick off.',
          },
        ],
      },
    ],
  },
  {
    id: 'activities',
    title: 'Activities list tips',
    summary: 'Ten slots, tight character limits, and how to make every one count.',
    related: { tab: 'activities', label: 'Open Activities' },
    sections: [
      {
        label: 'The format',
        blocks: [
          {
            kind: 'steps',
            items: [
              { title: '10 slots', text: 'The Common App gives you room for up to ten activities.' },
              { title: '50 characters', text: 'Position or leadership description.' },
              { title: '100 characters', text: 'Organization name.' },
              { title: '150 characters', text: 'Description of what you did, spaces included.' },
            ],
          },
          {
            kind: 'p',
            text: 'You also list grade levels, timing, hours per week, and weeks per year. Estimate honestly; readers notice totals that do not add up.',
          },
        ],
      },
      {
        label: 'Writing descriptions',
        blocks: [
          {
            kind: 'list',
            items: [
              'Lead with impact. Start with what you did or changed, not with background about the club.',
              'Use numbers: people reached, money raised, members recruited, hours taught, results achieved.',
              'Open phrases with strong verbs: founded, led, built, taught, organized, designed, raised.',
              'Cut filler. Fragments, semicolons, and common abbreviations are all fine here.',
              'Do not repeat the position or organization in the description. Those fields already say it.',
            ],
          },
        ],
      },
      {
        label: 'Before and after',
        blocks: [
          {
            kind: 'example',
            caption: 'The same activity, written two ways. The first version would not even fit in the 150 character box.',
            rows: [
              {
                tag: 'Before',
                field: 'Description',
                limit: 150,
                text: 'I am the founder and president of the coding club at my school, where we meet every week to learn about programming and work on lots of different projects together.',
              },
              {
                tag: 'After',
                field: 'Position',
                limit: 50,
                text: 'Founder and President',
              },
              {
                tag: 'After',
                field: 'Description',
                limit: 150,
                text: 'Grew club from 4 to 30 members; teach weekly Python lessons; led 6 students in building a homework help app now used across our school',
              },
            ],
          },
        ],
      },
      {
        label: 'Ordering the list',
        blocks: [
          {
            kind: 'list',
            items: [
              'Put your most important activities first. Readers give the top of the list the most attention.',
              'Important means depth, time, and impact, not prestige.',
              'Jobs, family responsibilities, and caring for siblings are real activities. List them.',
              'Save the Additional Information section for context that truly does not fit anywhere else.',
            ],
          },
          {
            kind: 'note',
            text: 'The Activities tab uses the same limits, with live counters, so what you write here drops straight into the Common App.',
          },
        ],
      },
    ],
  },
  {
    id: 'recommendations',
    title: 'Recommendations etiquette',
    summary: 'Who to ask, when to ask, and how to make it easy for them.',
    sections: [
      {
        label: 'Who to ask',
        blocks: [
          {
            kind: 'list',
            items: [
              "Selective colleges commonly ask for one or two teacher recommendations plus one from your school counselor. Check each school's requirements.",
              'Choose teachers from core academic subjects, ideally from junior year, who saw you participate, struggle, and grow. A real connection matters more than your top grade.',
              'If a school allows an optional extra letter from a coach, employer, or mentor, send one only if it shows something new.',
            ],
          },
        ],
      },
      {
        label: 'How to ask',
        blocks: [
          {
            kind: 'steps',
            items: [
              {
                title: 'Ask in person',
                text: 'Late in junior year or at the very start of senior year, and at least a month before your first deadline. Ask directly: would you be able to write me a strong recommendation?',
              },
              {
                title: 'Follow up in writing',
                text: 'Send a short email with your list of schools, each deadline, and how the letter will be submitted.',
              },
              {
                title: 'Share a brag sheet',
                text: 'One page: moments from their class you remember, a project you are proud of, your goals, and anything you want them to know.',
              },
              {
                title: 'Send the request',
                text: "Once they agree, invite them through the Common App or your school's platform.",
              },
            ],
          },
        ],
      },
      {
        label: 'Small things that matter',
        blocks: [
          {
            kind: 'list',
            items: [
              'Waive your right to see the letter (the FERPA release on the Common App). Colleges tend to give waived letters more weight.',
              'A polite reminder about a week before a deadline is fine. More than that is pressure.',
              'Write a handwritten thank-you note once the letters are in, and tell them where you end up in the spring.',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'interviews',
    title: 'Interview prep',
    summary: 'Prepare stories, not scripts.',
    related: { tab: 'messages', label: 'Set up a practice run' },
    sections: [
      {
        label: 'What to expect',
        blocks: [
          {
            kind: 'list',
            items: [
              'Many colleges offer interviews with alumni or admissions staff, in person or by video. Some do not interview at all, and that will not count against you.',
              'Most interviews are a relaxed conversation that runs under an hour.',
              'Some are evaluative and some are mainly informational. Either way, treat it as a chance to learn about the school.',
            ],
          },
        ],
      },
      {
        label: 'Questions to prepare for',
        blocks: [
          {
            kind: 'steps',
            items: [
              { title: 'Tell me about yourself.', text: 'Two or three things that matter to you, not a list of awards.' },
              { title: 'Why this school?', text: 'Specific programs, people, or traditions you could not find everywhere.' },
              { title: 'What do you do outside class?', text: 'Pick one activity and go deep on why you care about it.' },
              { title: 'Tell me about a challenge.', text: 'What happened, what you did, and what you would do differently.' },
              { title: 'Do you have questions for me?', text: 'Always say yes. Have two or three ready.' },
            ],
          },
        ],
      },
      {
        label: 'How to prepare',
        blocks: [
          {
            kind: 'list',
            items: [
              'Know your why. Have two or three reasons for each school that would not be true of any other.',
              'Choose three or four stories you can tell well: an activity you love, a challenge, something you are curious about.',
              'Practice out loud with a parent, a friend, or your counselor. Aim to sound prepared, not memorized.',
              "Prepare questions about the interviewer's own experience. People enjoy talking about what they know.",
            ],
          },
        ],
      },
      {
        label: 'On the day',
        blocks: [
          {
            kind: 'list',
            items: [
              'Arrive a few minutes early, or log in early and test your camera, microphone, and lighting.',
              'Dress neatly. Business casual is a safe choice.',
              'Put your phone away and give the interviewer your full attention.',
              'Send a short thank-you email within a day that mentions something specific you talked about.',
            ],
          },
        ],
      },
    ],
  },
];

/* --------------------------------------------------------------------------
   Helpers
   -------------------------------------------------------------------------- */
function blockWords(block: Block): string[] {
  switch (block.kind) {
    case 'p':
    case 'note':
      return [block.text];
    case 'list':
      return block.items;
    case 'steps':
      return block.items.flatMap((s) => [s.title, s.text]);
    case 'months':
      return block.items.flatMap((m) => m.items);
    case 'example':
      return [block.caption, ...block.rows.map((r) => r.text)];
  }
}

/** Reading time at roughly 220 words per minute, computed from the guide text itself. */
function readingMinutes(guide: Guide): number {
  const words = guide.sections
    .flatMap((s) => s.blocks.flatMap(blockWords))
    .join(' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

/** The guides are static, so their reading times are computed once. */
const READING_MINUTES = Object.fromEntries(GUIDES.map((g) => [g.id, readingMinutes(g)])) as Record<GuideId, number>;

const tabId = (id: GuideId) => `resources-tab-${id}`;
const READING_PANEL_ID = 'resources-reading';

/* --------------------------------------------------------------------------
   Blocks
   -------------------------------------------------------------------------- */
function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item} className="flex gap-4">
          <span aria-hidden="true" className="mt-[0.7em] h-[5px] w-[5px] flex-none bg-portal-accent-light/70" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Steps({ items }: { items: { title: string; text: string }[] }) {
  return (
    <ol className="border-t border-portal-line">
      {items.map((step, i) => (
        <li key={step.title} className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 border-b border-portal-line py-4 sm:grid-cols-[2.5rem_11rem_minmax(0,1fr)] sm:gap-x-5">
          <span className="pt-1 font-mono text-[11px] tabular-nums text-portal-accent-light">{pad2(i + 1)}</span>
          <span className="font-sans text-[15px] font-semibold text-portal-text">{step.title}</span>
          <span className="col-start-2 mt-1 sm:col-start-3 sm:mt-0">{step.text}</span>
        </li>
      ))}
    </ol>
  );
}

function Months({ items }: { items: { month: number; name: string; items: string[] }[] }) {
  // Hourly is plenty: this only needs to know the current month.
  const now = useNow(60 * 60 * 1000);
  const current = now.getMonth();
  return (
    <ol className="relative">
      {/* the spine */}
      <span aria-hidden="true" className="absolute bottom-3 left-[3px] top-3 w-px bg-portal-line-strong" />
      {items.map((m) => {
        const isNow = m.month === current;
        return (
          <li key={m.name} className="relative grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3 pb-7 last:pb-0 sm:grid-cols-[1.5rem_8.5rem_minmax(0,1fr)] sm:gap-x-5">
            <span className="relative flex h-6 items-center">
              <Diamond size={isNow ? 11 : 7} filled={isNow} color={isNow ? toneColor.accent : undefined} className={isNow ? '-ml-[2px]' : ''} />
            </span>
            <div className="flex h-6 items-center gap-3">
              <span className={cx('font-mono text-[11px] uppercase tracking-[0.18em]', isNow ? 'text-portal-accent-light' : 'text-portal-muted')}>{m.name}</span>
              {isNow && (
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-portal-text">
                  <span className="sr-only">(</span>Now<span className="sr-only">)</span>
                </span>
              )}
            </div>
            <ul className={cx('col-start-2 mt-2 space-y-2 sm:col-start-3 sm:mt-0', isNow ? 'text-portal-text' : '')}>
              {m.items.map((item) => (
                <li key={item} className="flex gap-3">
                  <span aria-hidden="true" className="mt-[0.7em] h-px w-3 flex-none bg-portal-line-strong" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}

function Example({ caption, rows }: { caption: string; rows: { tag: string; field: string; text: string; limit: number }[] }) {
  return (
    <figure>
      <div className="space-y-6">
        {rows.map((row, i) => {
          const len = row.text.length;
          const over = len > row.limit;
          return (
            <div key={i}>
              <div className="mb-2 flex items-baseline justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.16em]">
                <span className={row.tag === 'Before' ? 'text-portal-dim' : 'text-portal-accent-light'}>
                  {row.tag} <span className="text-portal-muted">/ {row.field}</span>
                </span>
                <span className={cx('tabular-nums', over ? 'text-portal-red' : 'text-portal-muted')}>
                  {len} / {row.limit}
                  {over && <span className="ml-2">({len - row.limit} over)</span>}
                </span>
              </div>
              <p className={cx('border-l pl-4 font-sans text-[14px] leading-relaxed', over ? 'border-portal-red/60 text-portal-muted' : 'border-portal-accent/60 text-portal-text')}>
                {row.text}
              </p>
              <LineMeter value={len} max={row.limit} className="mt-3" />
            </div>
          );
        })}
      </div>
      <figcaption className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-portal-dim">{caption}</figcaption>
    </figure>
  );
}

function Note({ text }: { text: string }) {
  return (
    <aside className="relative border-y border-portal-line py-4 pl-6 font-sans text-[14px] leading-relaxed text-portal-body">
      <span aria-hidden="true" className="absolute left-0 top-[1.45rem]">
        <Diamond size={7} filled={false} />
      </span>
      {text}
    </aside>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case 'p':
      return <p>{block.text}</p>;
    case 'list':
      return <BulletList items={block.items} />;
    case 'steps':
      return <Steps items={block.items} />;
    case 'months':
      return <Months items={block.items} />;
    case 'example':
      return <Example caption={block.caption} rows={block.rows} />;
    case 'note':
      return <Note text={block.text} />;
  }
}

/* --------------------------------------------------------------------------
   Guide body (shared by the reading column and the accordion)
   -------------------------------------------------------------------------- */
function GuideBody({ guide, number }: { guide: Guide; number: string }) {
  return (
    <div className="space-y-10">
      {guide.sections.map((section, i) => (
        <section key={section.label}>
          <h3 className="mb-4 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-portal-muted">
            <span className="text-portal-accent-light">
              {number}.{i + 1}
            </span>
            <span>{section.label}</span>
            <span aria-hidden="true" className="h-px flex-1 bg-portal-line" />
          </h3>
          <div className="space-y-5 font-serif text-[16px] leading-[1.75] text-portal-body sm:text-[17px]">
            {section.blocks.map((block, j) => (
              <BlockView key={j} block={block} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function GuideActions({
  guide,
  canMessage,
  onNavigate,
}: {
  guide: Guide;
  canMessage: boolean;
  onNavigate: StudentPanelProps['onNavigate'];
}) {
  const related = guide.related && (guide.related.tab !== 'messages' || canMessage) ? guide.related : null;
  if (!related) return null;
  return (
    <button
      type="button"
      onClick={() => onNavigate(related.tab)}
      className="group inline-flex min-h-8 items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-portal-accent-light hover:text-portal-text"
    >
      {related.label}
      <IconArrowRight size={14} className="transition-transform duration-200 ease-portal group-hover:translate-x-1" />
    </button>
  );
}

function CounselorLink({ onNavigate }: { onNavigate: StudentPanelProps['onNavigate'] }) {
  return (
    <button
      type="button"
      onClick={() => onNavigate('messages')}
      className="group flex min-h-8 w-full items-center gap-3 text-left text-sm text-portal-muted hover:text-portal-text"
    >
      <IconMessage size={16} className="flex-none text-portal-accent-light" />
      <span>
        Questions? <span className="text-portal-text underline decoration-portal-line-strong underline-offset-4 group-hover:decoration-portal-accent-light">Message your counselor</span>
      </span>
    </button>
  );
}

/* --------------------------------------------------------------------------
   Large screens: index column + reading column
   -------------------------------------------------------------------------- */
function ReadingLayout({
  activeId,
  onSelect,
  canMessage,
  onNavigate,
}: {
  activeId: GuideId;
  onSelect: (id: GuideId) => void;
  canMessage: boolean;
  onNavigate: StudentPanelProps['onNavigate'];
}) {
  const tabRefs = useRef<Partial<Record<GuideId, HTMLButtonElement | null>>>({});
  const readingRef = useRef<HTMLDivElement>(null);
  const activeIndex = GUIDES.findIndex((g) => g.id === activeId);
  const guide = GUIDES[activeIndex];
  const next = GUIDES[(activeIndex + 1) % GUIDES.length];
  const number = pad2(activeIndex + 1);

  function select(id: GuideId, focusTab = false) {
    onSelect(id);
    if (focusTab) tabRefs.current[id]?.focus();
    // If the reader had scrolled down a long guide, bring the new one's top into view.
    const top = readingRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) readingRef.current?.scrollIntoView({ block: 'start' });
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const keys: Record<string, number> = {
      ArrowDown: (activeIndex + 1) % GUIDES.length,
      ArrowUp: (activeIndex - 1 + GUIDES.length) % GUIDES.length,
      Home: 0,
      End: GUIDES.length - 1,
    };
    if (!(e.key in keys)) return;
    e.preventDefault();
    select(GUIDES[keys[e.key]].id, true);
  }

  return (
    <div className="hidden lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] xl:grid-cols-[19rem_minmax(0,1fr)]">
      {/* index column */}
      <div className="border-r border-portal-line pr-8">
        <div className="sticky top-8">
          <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.18em] text-portal-dim">Index</p>
          <div role="tablist" aria-orientation="vertical" aria-label="Guides" onKeyDown={onKeyDown} className="stagger border-t border-portal-line">
            {GUIDES.map((g, i) => {
              const active = g.id === activeId;
              return (
                <button
                  key={g.id}
                  ref={(el) => {
                    tabRefs.current[g.id] = el;
                  }}
                  id={tabId(g.id)}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={READING_PANEL_ID}
                  tabIndex={active ? 0 : -1}
                  onClick={() => select(g.id)}
                  className={cx(
                    'group relative grid w-full grid-cols-[2rem_minmax(0,1fr)] gap-x-2 border-b border-portal-line py-4 pr-2 text-left transition-colors duration-150',
                    active ? 'bg-portal-select' : 'hover:bg-portal-hover',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cx('absolute inset-y-0 left-0 w-[2px] transition-colors duration-150', active ? 'bg-portal-accent' : 'bg-transparent')}
                  />
                  <span className={cx('pl-3 pt-0.5 font-mono text-[11px] tabular-nums', active ? 'text-portal-accent-light' : 'text-portal-dim group-hover:text-portal-muted')}>
                    {pad2(i + 1)}
                  </span>
                  <span className="min-w-0">
                    <span className={cx('block text-sm font-medium leading-snug', active ? 'text-portal-text' : 'text-portal-body group-hover:text-portal-text')}>
                      {g.title}
                    </span>
                    <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-portal-dim">{READING_MINUTES[g.id]} min read</span>
                  </span>
                </button>
              );
            })}
          </div>
          {canMessage && (
            <div className="mt-6">
              <CounselorLink onNavigate={onNavigate} />
            </div>
          )}
        </div>
      </div>

      {/* reading column */}
      <div ref={readingRef} id={READING_PANEL_ID} role="tabpanel" aria-labelledby={tabId(guide.id)} tabIndex={0} className="min-w-0 scroll-mt-8 pl-10 xl:pl-14">
        <article key={guide.id} className="animate-rise max-w-[680px]">
          <header className="mb-10 border-b border-portal-line pb-8">
            <div className="flex items-start gap-6">
              <span aria-hidden="true" className="font-mono text-6xl font-bold leading-none tabular-nums text-portal-accent/40">
                {number}
              </span>
              <div className="min-w-0 pt-1">
                <h2 className="font-serif text-3xl font-bold leading-tight text-portal-text">{guide.title}</h2>
                <p className="mt-2 text-[15px] text-portal-muted">{guide.summary}</p>
                <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-portal-dim">
                  {guide.sections.length} sections <span aria-hidden="true">/</span> {READING_MINUTES[guide.id]} min read
                </p>
              </div>
            </div>
          </header>

          <GuideBody guide={guide} number={number} />

          <footer className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-portal-line-strong pt-6">
            <GuideActions guide={guide} canMessage={canMessage} onNavigate={onNavigate} />
            <button
              type="button"
              onClick={() => {
                select(next.id);
                // The article remounts, so keep focus on the reading column instead of losing it.
                readingRef.current?.focus({ preventScroll: true });
              }}
              className="group ml-auto inline-flex min-h-8 items-center gap-3 text-right text-sm text-portal-muted hover:text-portal-text"
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-portal-dim">Next</span>
              <span>
                <span className="font-mono text-portal-accent-light">{pad2(GUIDES.indexOf(next) + 1)}</span> {next.title}
              </span>
              <IconArrowRight size={14} className="transition-transform duration-200 ease-portal group-hover:translate-x-1" />
            </button>
          </footer>
        </article>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Small screens: accordion
   -------------------------------------------------------------------------- */
function AccordionLayout({
  openId,
  onToggle,
  canMessage,
  onNavigate,
}: {
  openId: GuideId | null;
  onToggle: (id: GuideId) => void;
  canMessage: boolean;
  onNavigate: StudentPanelProps['onNavigate'];
}) {
  return (
    <div className="lg:hidden">
      <div className="stagger border-t border-portal-line-strong">
        {GUIDES.map((g, i) => {
          const open = g.id === openId;
          const number = pad2(i + 1);
          const regionId = `resources-acc-${g.id}`;
          const buttonId = `resources-acc-btn-${g.id}`;
          return (
            <div key={g.id} className="border-b border-portal-line">
              <h2>
                <button
                  id={buttonId}
                  type="button"
                  aria-expanded={open}
                  aria-controls={regionId}
                  onClick={() => onToggle(g.id)}
                  className={cx(
                    'grid w-full grid-cols-[2rem_minmax(0,1fr)_1.25rem] items-start gap-x-3 py-5 text-left transition-colors duration-150',
                    open ? 'text-portal-text' : 'text-portal-body hover:text-portal-text',
                  )}
                >
                  <span className={cx('pt-1 font-mono text-[11px] tabular-nums', open ? 'text-portal-accent-light' : 'text-portal-dim')}>{number}</span>
                  <span className="min-w-0">
                    <span className="block font-serif text-lg font-bold leading-snug">{g.title}</span>
                    <span className="mt-1 block text-sm text-portal-muted">{g.summary}</span>
                    <span className="mt-2 block font-mono text-[10px] uppercase tracking-[0.14em] text-portal-dim">{READING_MINUTES[g.id]} min read</span>
                  </span>
                  <IconChevronDown
                    size={18}
                    className={cx('mt-1 text-portal-muted transition-transform duration-200 ease-portal', open && 'rotate-180 text-portal-accent-light')}
                  />
                </button>
              </h2>
              {open && (
                <div id={regionId} role="region" aria-labelledby={buttonId} className="animate-rise pb-10 pt-2">
                  <GuideBody guide={g} number={number} />
                  <div className="mt-10 flex flex-col gap-4 border-t border-portal-line pt-5">
                    <GuideActions guide={g} canMessage={canMessage} onNavigate={onNavigate} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {canMessage && (
        <div className="mt-8">
          <CounselorLink onNavigate={onNavigate} />
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Panel
   -------------------------------------------------------------------------- */
export default function ResourcesPanel(props: StudentPanelProps) {
  const { viewer, onNavigate } = props;
  const [activeId, setActiveId] = useState<GuideId>(GUIDES[0].id);
  const [openId, setOpenId] = useState<GuideId | null>(null);
  const canMessage = viewer === 'student';

  return (
    <Panel wide>
      <PanelHeader
        index="07"
        eyebrow="Resources"
        title="Guides for the road ahead"
        description={
          viewer === 'student'
            ? 'Six short guides on the parts of applying that come up again and again. Read them in any order, and bring questions to your counselor.'
            : 'The six guides your student sees here. Point them to a section when it helps.'
        }
      />
      <ReadingLayout activeId={activeId} onSelect={setActiveId} canMessage={canMessage} onNavigate={onNavigate} />
      <AccordionLayout
        openId={openId}
        onToggle={(id) => setOpenId((cur) => (cur === id ? null : id))}
        canMessage={canMessage}
        onNavigate={onNavigate}
      />
    </Panel>
  );
}
