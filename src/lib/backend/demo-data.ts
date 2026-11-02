/* ==========================================================================
   Demo dataset for /portal/demo
   Fictional people only. Dates are generated relative to "today" so the
   demo always looks like the middle of an application season.
   ========================================================================== */

import type {
  Activity,
  Conversation,
  Essay,
  EssayComment,
  EssayVersion,
  Message,
  Profile,
  Prompt,
  School,
  SharedFile,
  Task,
} from '@/types/database';

export interface DemoDb {
  profiles: Profile[];
  schools: School[];
  prompts: Prompt[];
  essays: Essay[];
  essay_versions: EssayVersion[];
  essay_comments: EssayComment[];
  tasks: Task[];
  activities: Activity[];
  conversations: Conversation[];
  messages: Message[];
  files: SharedFile[];
}

export const DEMO_COUNSELOR_ID = 'demo-counselor-1';
export const DEMO_STUDENT_ID = 'demo-student-1';

/** YYYY-MM-DD for today + offset days (local time). */
function day(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dd}`;
}

/** ISO timestamp for now + offset hours. */
function at(offsetHours: number): string {
  return new Date(Date.now() + offsetHours * 3_600_000).toISOString();
}

function words(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

function html(...paragraphs: string[]): string {
  return paragraphs.map((p) => `<p>${p}</p>`).join('');
}

const PERSONAL_STATEMENT = html(
  'The first thing I ever fixed was a toaster, and I fixed it wrong. I was nine, armed with a butter knife and a library book about circuits, and when the toaster finally clicked on it also tripped the breaker for the entire kitchen. My mother stood in the dark and asked, very calmly, what exactly I had learned.',
  'I have been trying to give her a better answer ever since. In ninth grade it was a bike light that charged from the wheel. In tenth it was a soil sensor for my grandmother\'s tomatoes that texted her when they were thirsty, which she still calls "the plant\'s phone." Each project failed first. Each failure taught me to slow down, measure twice, and ask the person I was building for what they actually needed.',
  'That last lesson changed how I work. When our robotics team lost three regionals in a row, I stopped redesigning our drivetrain and started interviewing the drivers. The problem was never torque; it was that nobody could see the intake from the driver station. We added a two-dollar mirror. We placed fourth at state.',
);

const WHY_CORNELL = html(
  'Cornell\'s Engineering Project Teams are the closest thing I have found to the garage where I learned to build. I want to join the Cornell Cup Robotics team, where students design systems that real users depend on.',
  'Outside the lab, I am drawn to the way Cornell asks engineers to take a humanities seat at the table through the Engineering Communications Program.',
);

export function createDemoDb(): DemoDb {
  const profiles: Profile[] = [
    {
      id: DEMO_COUNSELOR_ID,
      role: 'consultant',
      full_name: 'Jordan Reyes',
      assigned_consultant_id: null,
      avatar_initials: 'JR',
      email: 'jordan@deltax.example',
      created_at: at(-24 * 300),
    },
    {
      id: 'demo-counselor-2',
      role: 'consultant',
      full_name: 'Priya Nair',
      assigned_consultant_id: null,
      avatar_initials: 'PN',
      email: 'priya@deltax.example',
      created_at: at(-24 * 280),
    },
    {
      id: DEMO_STUDENT_ID,
      role: 'student',
      full_name: 'Maya Chen',
      assigned_consultant_id: DEMO_COUNSELOR_ID,
      avatar_initials: 'MC',
      email: 'maya@student.example',
      created_at: at(-24 * 120),
    },
    {
      id: 'demo-student-2',
      role: 'student',
      full_name: 'Ethan Brooks',
      assigned_consultant_id: DEMO_COUNSELOR_ID,
      avatar_initials: 'EB',
      email: 'ethan@student.example',
      created_at: at(-24 * 110),
    },
    {
      id: 'demo-student-3',
      role: 'student',
      full_name: 'Sofia Alvarez',
      assigned_consultant_id: DEMO_COUNSELOR_ID,
      avatar_initials: 'SA',
      email: 'sofia@student.example',
      created_at: at(-24 * 95),
    },
    {
      id: 'demo-student-4',
      role: 'student',
      full_name: 'Noah Kim',
      assigned_consultant_id: 'demo-counselor-2',
      avatar_initials: 'NK',
      email: 'noah@student.example',
      created_at: at(-24 * 60),
    },
  ];

  const schools: School[] = [
    // Maya
    { id: 's-ca', student_id: DEMO_STUDENT_ID, name: 'Common Application', program: 'Personal Statement', category: 'target', decision_plan: '', deadline: day(4), notes: 'Shared across every school on the list.', created_at: at(-24 * 100), is_common_app: true },
    { id: 's-cornell', student_id: DEMO_STUDENT_ID, name: 'Cornell University', program: 'College of Engineering', category: 'reach', decision_plan: 'ED', deadline: day(4), notes: 'Binding. Visit notes in Shared Files.', created_at: at(-24 * 99) },
    { id: 's-rice', student_id: DEMO_STUDENT_ID, name: 'Rice University', program: 'George R. Brown School of Engineering', category: 'reach', decision_plan: 'RD', deadline: day(64), notes: '', created_at: at(-24 * 98) },
    { id: 's-ut', student_id: DEMO_STUDENT_ID, name: 'UT Austin', program: 'Cockrell School of Engineering', category: 'target', decision_plan: 'EA', deadline: day(29), notes: 'Apply Texas, priority deadline.', created_at: at(-24 * 97) },
    { id: 's-gt', student_id: DEMO_STUDENT_ID, name: 'Georgia Tech', program: 'Mechanical Engineering', category: 'target', decision_plan: 'EA', deadline: day(13), notes: '', created_at: at(-24 * 96) },
    { id: 's-tamu', student_id: DEMO_STUDENT_ID, name: 'Texas A&M', program: 'College of Engineering', category: 'safety', decision_plan: 'RD', deadline: day(29), notes: '', created_at: at(-24 * 95) },
    // Ethan
    { id: 's2-ca', student_id: 'demo-student-2', name: 'Common Application', program: 'Personal Statement', category: 'target', decision_plan: '', deadline: day(4), notes: '', created_at: at(-24 * 90), is_common_app: true },
    { id: 's2-umich', student_id: 'demo-student-2', name: 'University of Michigan', program: 'Ross School of Business', category: 'reach', decision_plan: 'EA', deadline: day(4), notes: '', created_at: at(-24 * 90) },
    { id: 's2-uva', student_id: 'demo-student-2', name: 'University of Virginia', program: 'Economics', category: 'target', decision_plan: 'EA', deadline: day(4), notes: '', created_at: at(-24 * 89) },
    // Sofia
    { id: 's3-ca', student_id: 'demo-student-3', name: 'Common Application', program: 'Personal Statement', category: 'target', decision_plan: '', deadline: day(58), notes: '', created_at: at(-24 * 80), is_common_app: true },
    { id: 's3-jhu', student_id: 'demo-student-3', name: 'Johns Hopkins University', program: 'Public Health Studies', category: 'reach', decision_plan: 'ED II', deadline: day(64), notes: '', created_at: at(-24 * 80) },
    // Noah
    { id: 's4-ca', student_id: 'demo-student-4', name: 'Common Application', program: 'Personal Statement', category: 'target', decision_plan: '', deadline: day(58), notes: '', created_at: at(-24 * 50), is_common_app: true },
  ];

  const prompts: Prompt[] = [
    { id: 'p-ca', school_id: 's-ca', title: 'Personal Statement', prompt_text: 'Share an essay on any topic of your choice. It can be one you\'ve already written, one that responds to a different prompt, or one of your own design.', word_limit: 650, sort_order: 1 },
    { id: 'p-cornell-1', school_id: 's-cornell', title: 'Why Cornell Engineering', prompt_text: 'How do your interests directly connect with Cornell Engineering? If you have an intended major, what draws you to that department at Cornell?', word_limit: 650, sort_order: 1 },
    { id: 'p-cornell-2', school_id: 's-cornell', title: 'Engineering Ideas', prompt_text: 'Describe an engineering problem that impacts your local community and how you would approach solving it.', word_limit: 250, sort_order: 2 },
    { id: 'p-rice-1', school_id: 's-rice', title: 'Why Rice', prompt_text: 'Based upon your exploration of Rice University, what elements of the Rice experience appeal to you?', word_limit: 150, sort_order: 1 },
    { id: 'p-rice-2', school_id: 's-rice', title: 'Residential Colleges', prompt_text: 'Rice\'s residential college system heavily influences student life. What life perspectives would you contribute?', word_limit: 500, sort_order: 2 },
    { id: 'p-ut-1', school_id: 's-ut', title: 'Short Answer: Major', prompt_text: 'Why are you interested in the major you indicated as your first-choice major?', word_limit: 160, sort_order: 1 },
    { id: 'p-gt-1', school_id: 's-gt', title: 'Why Georgia Tech', prompt_text: 'Why do you want to study your chosen major specifically at Georgia Tech?', word_limit: 300, sort_order: 1 },
    { id: 'p2-ca', school_id: 's2-ca', title: 'Personal Statement', prompt_text: 'Share an essay on any topic of your choice.', word_limit: 650, sort_order: 1 },
    { id: 'p2-umich', school_id: 's2-umich', title: 'Community Essay', prompt_text: 'Describe one of the communities you belong to and your place within it.', word_limit: 300, sort_order: 1 },
    { id: 'p3-ca', school_id: 's3-ca', title: 'Personal Statement', prompt_text: 'Share an essay on any topic of your choice.', word_limit: 650, sort_order: 1 },
    { id: 'p3-jhu', school_id: 's3-jhu', title: 'Community Contribution', prompt_text: 'Tell us about an aspect of your identity or background that has impacted you.', word_limit: 350, sort_order: 1 },
  ];

  const essay = (id: string, prompt_id: string, student_id: string, content: string, status: Essay['status'], hoursAgo: number): Essay => ({
    id, prompt_id, student_id, content, status, word_count: words(content.replace(/<[^>]+>/g, ' ')), updated_at: at(-hoursAgo),
  });

  const essays: Essay[] = [
    essay('e-ca', 'p-ca', DEMO_STUDENT_ID, PERSONAL_STATEMENT, 'revision', 5),
    essay('e-cornell-1', 'p-cornell-1', DEMO_STUDENT_ID, WHY_CORNELL, 'in_review', 20),
    essay('e-cornell-2', 'p-cornell-2', DEMO_STUDENT_ID, '', 'not_started', 200),
    essay('e-rice-1', 'p-rice-1', DEMO_STUDENT_ID, html('Rice\'s commitment to undergraduate research, and the fact that freshmen can join a lab in the first semester, is exactly the pace I want.'), 'draft', 50),
    essay('e-rice-2', 'p-rice-2', DEMO_STUDENT_ID, '', 'not_started', 300),
    essay('e-ut-1', 'p-ut-1', DEMO_STUDENT_ID, html('Mechanical engineering is the discipline where I can hold the answer in my hands.'), 'final', 70),
    essay('e-gt-1', 'p-gt-1', DEMO_STUDENT_ID, html('Georgia Tech\'s Invention Studio is a student-run makerspace, and I want to help run it.'), 'draft', 30),
    essay('e2-ca', 'p2-ca', 'demo-student-2', html('My grandfather\'s hardware store taught me that every customer is a negotiation.'), 'in_review', 10),
    essay('e2-umich', 'p2-umich', 'demo-student-2', html('Every Saturday at 6 a.m., the rowing team meets at the dock.'), 'draft', 60),
    essay('e3-ca', 'p3-ca', 'demo-student-3', html('I learned Spanish twice: once at home and once in a hospital waiting room.'), 'in_review', 3),
    essay('e3-jhu', 'p3-jhu', 'demo-student-3', '', 'not_started', 400),
  ];

  const essay_versions: EssayVersion[] = [
    { id: 'v-ca-1', essay_id: 'e-ca', content: html('The first thing I ever fixed was a toaster.'), word_count: 8, created_at: at(-24 * 20) },
    { id: 'v-ca-2', essay_id: 'e-ca', content: PERSONAL_STATEMENT.split('</p>').slice(0, 2).join('</p>') + '</p>', word_count: 120, created_at: at(-24 * 6) },
  ];

  const essay_comments: EssayComment[] = [
    { id: 'c-1', essay_id: 'e-ca', author_id: DEMO_COUNSELOR_ID, content: 'The toaster opening is fantastic. Keep it. The mirror detail in the last paragraph is your best line; consider ending closer to it.', created_at: at(-26) },
    { id: 'c-2', essay_id: 'e-ca', author_id: DEMO_STUDENT_ID, content: 'Thank you! Should I cut the soil sensor part to make room?', created_at: at(-20) },
    { id: 'c-3', essay_id: 'e-ca', author_id: DEMO_COUNSELOR_ID, content: 'Trim it to one sentence rather than cutting it. It shows the "ask the user" theme building over time.', created_at: at(-18) },
    { id: 'c-4', essay_id: 'e-cornell-1', author_id: DEMO_COUNSELOR_ID, content: 'Name one specific professor or lab here. Right now this could be about any school with project teams.', created_at: at(-8) },
    { id: 'c-5', essay_id: 'e2-ca', author_id: DEMO_COUNSELOR_ID, content: 'Strong voice. The second paragraph drifts; tie it back to the store.', created_at: at(-4) },
  ];

  const task = (id: string, student_id: string, title: string, category: string, due: number, completed = false): Task => ({
    id, student_id, created_by: DEMO_COUNSELOR_ID, title, category, due_date: day(due), completed, completed_at: completed ? at(-24) : null,
  });

  const tasks: Task[] = [
    task('t-1', DEMO_STUDENT_ID, 'Finalize personal statement after comments', 'Essays', 2),
    task('t-2', DEMO_STUDENT_ID, 'Submit Cornell ED application', 'Applications', 4),
    task('t-3', DEMO_STUDENT_ID, 'Send SAT scores to Cornell and Georgia Tech', 'Testing', 3),
    task('t-4', DEMO_STUDENT_ID, 'Ask Ms. Patel to upload recommendation', 'Recommendations', -1),
    task('t-5', DEMO_STUDENT_ID, 'Draft Georgia Tech short answer', 'Essays', 8),
    task('t-6', DEMO_STUDENT_ID, 'Complete CSS Profile', 'Financial Aid', 20),
    task('t-7', DEMO_STUDENT_ID, 'Finish activities list descriptions', 'Activities', -6, true),
    task('t-8', DEMO_STUDENT_ID, 'Brainstorm Rice residential college essay', 'Essays', 15),
    task('t-9', DEMO_STUDENT_ID, 'Request official transcript', 'Applications', -12, true),
    task('t2-1', 'demo-student-2', 'Revise Common App essay', 'Essays', 3),
    task('t2-2', 'demo-student-2', 'Submit Michigan EA', 'Applications', 4),
    task('t3-1', 'demo-student-3', 'Start JHU supplement', 'Essays', -2),
    task('t4-1', 'demo-student-4', 'Build college list', 'Applications', 10),
  ];

  const activity = (n: number, a: Partial<Activity> & Pick<Activity, 'activity_name' | 'activity_type'>): Activity => ({
    id: `a-${n}`, student_id: DEMO_STUDENT_ID, position_order: n, role: '', organization: '', grade_levels: '', timing: '', hours_per_week: 0, weeks_per_year: 0, description: '', ...a,
  });

  const activities: Activity[] = [
    activity(1, { activity_name: 'Robotics Team', activity_type: 'Robotics', role: 'Captain, Lead Mechanical Designer', organization: 'Westlake FRC Team 4206', grade_levels: '9, 10, 11, 12', timing: 'School year', hours_per_week: 15, weeks_per_year: 30, description: 'Led 24-member team; redesigned intake after driver interviews; 4th place at state, up from no placings in 3 years.' }),
    activity(2, { activity_name: 'Soil Sensor Project', activity_type: 'Research', role: 'Founder & Developer', organization: 'Independent', grade_levels: '10, 11', timing: 'All year', hours_per_week: 4, weeks_per_year: 40, description: 'Built low-cost moisture sensors that text gardeners; deployed 18 units in a community garden.' }),
    activity(3, { activity_name: 'Math Tutoring', activity_type: 'Community Service (Volunteer)', role: 'Volunteer Tutor', organization: 'Eastside Library', grade_levels: '10, 11, 12', timing: 'School year', hours_per_week: 3, weeks_per_year: 32, description: 'Tutor 6 middle schoolers weekly in algebra and geometry.' }),
    activity(4, { activity_name: 'Varsity Cross Country', activity_type: 'Athletics: JV/Varsity', role: 'Varsity Runner', organization: 'Westlake High School', grade_levels: '9, 10, 11, 12', timing: 'Fall', hours_per_week: 10, weeks_per_year: 14, description: '' }),
  ];

  const conversations: Conversation[] = [
    { id: 'conv-1', student_id: DEMO_STUDENT_ID, consultant_id: DEMO_COUNSELOR_ID },
    { id: 'conv-2', student_id: 'demo-student-2', consultant_id: DEMO_COUNSELOR_ID },
    { id: 'conv-3', student_id: 'demo-student-3', consultant_id: DEMO_COUNSELOR_ID },
  ];

  const msg = (id: string, conversation_id: string, sender_id: string, content: string, hoursAgo: number): Message => ({
    id, conversation_id, sender_id, content, file_url: null, created_at: at(-hoursAgo),
  });

  const messages: Message[] = [
    msg('m-1', 'conv-1', DEMO_COUNSELOR_ID, 'Hey Maya! I left comments on your personal statement. Big picture: it\'s working. Mostly trimming now.', 30),
    msg('m-2', 'conv-1', DEMO_STUDENT_ID, 'Just read them, thank you!! I\'ll have the next draft tonight.', 28),
    msg('m-3', 'conv-1', DEMO_COUNSELOR_ID, 'Perfect. Also, Cornell ED is in 4 days. Let\'s do a final read together Thursday?', 6),
    msg('m-4', 'conv-1', DEMO_STUDENT_ID, 'Thursday works. 7pm?', 5),
    msg('m-5', 'conv-2', 'demo-student-2', 'Can you look at my Michigan essay when you get a chance?', 2),
    msg('m-6', 'conv-3', DEMO_COUNSELOR_ID, 'Sofia, your JHU supplement is overdue. Want to brainstorm tomorrow?', 20),
  ];

  const files: SharedFile[] = [
    { id: 'f-1', uploaded_by: DEMO_COUNSELOR_ID, student_id: DEMO_STUDENT_ID, name: 'Brainstorming worksheet.pdf', storage_path: 'demo/brainstorm.pdf', folder: 'Worksheets', size_bytes: 184_320, created_at: at(-24 * 40) },
    { id: 'f-2', uploaded_by: DEMO_STUDENT_ID, student_id: DEMO_STUDENT_ID, name: 'Resume - Maya Chen.pdf', storage_path: 'demo/resume.pdf', folder: 'Documents', size_bytes: 96_512, created_at: at(-24 * 12) },
    { id: 'f-3', uploaded_by: DEMO_COUNSELOR_ID, student_id: DEMO_STUDENT_ID, name: 'Cornell visit notes.docx', storage_path: 'demo/cornell.docx', folder: 'Research', size_bytes: 41_000, created_at: at(-24 * 5) },
  ];

  return { profiles, schools, prompts, essays, essay_versions, essay_comments, tasks, activities, conversations, messages, files };
}
