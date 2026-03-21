import { Profile, School, Prompt, Essay, Task, Message, Activity, EssayComment, Conversation } from '@/types/database';

// Demo user
export const demoProfile: Profile = {
  id: 'demo-student-1',
  role: 'student',
  full_name: 'Alex Johnson',
  assigned_consultant_id: 'demo-consultant-1',
  avatar_initials: 'AJ',
  email: 'alex@example.com',
  created_at: '2024-09-01T00:00:00Z',
};

export const demoConsultant: Profile = {
  id: 'demo-consultant-1',
  role: 'consultant',
  full_name: 'Sarah Chen',
  assigned_consultant_id: null,
  avatar_initials: 'SC',
  email: 'sarah@deltaxcc.com',
  created_at: '2024-01-01T00:00:00Z',
};

export const demoSchools: School[] = [
  {
    id: 'common-app',
    student_id: 'demo-student-1',
    name: 'Common Application',
    program: 'Personal Statement',
    category: 'target',
    decision_plan: '',
    deadline: '',
    notes: 'Shared across all schools',
    created_at: '2024-09-01T00:00:00Z',
    is_common_app: true,
  },
  {
    id: 'school-1',
    student_id: 'demo-student-1',
    name: 'Cornell University',
    program: 'College of Engineering',
    category: 'reach',
    decision_plan: 'ED',
    deadline: '2024-11-01',
    notes: '',
    created_at: '2024-09-01T00:00:00Z',
  },
  {
    id: 'school-2',
    student_id: 'demo-student-1',
    name: 'Rice University',
    program: 'School of Engineering',
    category: 'reach',
    decision_plan: 'RD',
    deadline: '2025-01-01',
    notes: '',
    created_at: '2024-09-02T00:00:00Z',
  },
  {
    id: 'school-3',
    student_id: 'demo-student-1',
    name: 'UT Austin',
    program: 'Cockrell School of Engineering',
    category: 'target',
    decision_plan: 'EA',
    deadline: '2024-11-01',
    notes: '',
    created_at: '2024-09-03T00:00:00Z',
  },
  {
    id: 'school-4',
    student_id: 'demo-student-1',
    name: 'Texas A&M',
    program: 'Engineering',
    category: 'safety',
    decision_plan: 'RD',
    deadline: '2024-12-01',
    notes: '',
    created_at: '2024-09-04T00:00:00Z',
  },
];

export const demoPrompts: Prompt[] = [
  // Common App
  {
    id: 'prompt-ca-1',
    school_id: 'common-app',
    title: 'Personal Statement',
    prompt_text: 'Some students have a background, identity, interest, or talent that is so meaningful they believe their application would be incomplete without it. If this sounds like you, then please share your story.',
    word_limit: 650,
    sort_order: 1,
  },
  // Cornell
  {
    id: 'prompt-c1',
    school_id: 'school-1',
    title: 'Why Cornell Engineering',
    prompt_text: 'Cornell Engineering celebrates collaborative environments that extend beyond any one classroom, laboratory, or studio. How do you see yourself being a part of the Cornell Engineering community?',
    word_limit: 250,
    sort_order: 1,
  },
  {
    id: 'prompt-c2',
    school_id: 'school-1',
    title: 'Engineering Interest',
    prompt_text: 'Describe an engineering problem that impacts your local community. What have you done, or what would you do, to contribute to a solution?',
    word_limit: 250,
    sort_order: 2,
  },
  // Rice
  {
    id: 'prompt-r1',
    school_id: 'school-2',
    title: 'Why Rice',
    prompt_text: 'Please explain why you wish to study in the academic areas you selected and why Rice University is a good fit for you.',
    word_limit: 500,
    sort_order: 1,
  },
  {
    id: 'prompt-r2',
    school_id: 'school-2',
    title: 'The Box',
    prompt_text: 'The quality of Rice\'s residential college system stems from the unique life experiences and cultural traditions each student brings. What perspectives shaped you and are meaningfully different from the perspectives of your peers?',
    word_limit: 500,
    sort_order: 2,
  },
  // UT Austin
  {
    id: 'prompt-ut1',
    school_id: 'school-3',
    title: 'Why UT Engineering',
    prompt_text: 'Why are you interested in the major you indicated as your first-choice major? Please discuss how your interests and experiences have led you to choose this major.',
    word_limit: 500,
    sort_order: 1,
  },
  // Texas A&M
  {
    id: 'prompt-am1',
    school_id: 'school-4',
    title: 'Why Texas A&M',
    prompt_text: 'Describe a life event which you feel has prepared you to be successful in college.',
    word_limit: 500,
    sort_order: 1,
  },
];

export const demoEssays: Essay[] = [
  {
    id: 'essay-ca-1',
    prompt_id: 'prompt-ca-1',
    student_id: 'demo-student-1',
    content: '<p>Growing up in a household where two cultures collided daily, I learned early that identity isn\'t something you inherit — it\'s something you build...</p>',
    status: 'in_review',
    word_count: 412,
    updated_at: '2024-10-15T14:30:00Z',
  },
  {
    id: 'essay-c1',
    prompt_id: 'prompt-c1',
    student_id: 'demo-student-1',
    content: '<p>The robotics lab at my high school was where I first experienced the magic of collaborative engineering...</p>',
    status: 'draft',
    word_count: 180,
    updated_at: '2024-10-12T10:00:00Z',
  },
  {
    id: 'essay-r1',
    prompt_id: 'prompt-r1',
    student_id: 'demo-student-1',
    content: '',
    status: 'not_started',
    word_count: 0,
    updated_at: '2024-09-01T00:00:00Z',
  },
  {
    id: 'essay-ut1',
    prompt_id: 'prompt-ut1',
    student_id: 'demo-student-1',
    content: '<p>My journey into engineering began with a broken toaster and a curious mind...</p>',
    status: 'final',
    word_count: 487,
    updated_at: '2024-10-20T09:00:00Z',
  },
  {
    id: 'essay-am1',
    prompt_id: 'prompt-am1',
    student_id: 'demo-student-1',
    content: '<p>Moving to a new city during my sophomore year was the hardest thing I\'ve ever done...</p>',
    status: 'submitted',
    word_count: 445,
    updated_at: '2024-10-22T15:00:00Z',
  },
];

export const demoComments: EssayComment[] = [
  {
    id: 'comment-1',
    essay_id: 'essay-ca-1',
    author_id: 'demo-consultant-1',
    content: 'Great opening! The cultural contrast is compelling. Can you expand on a specific moment where these two worlds collided? Show, don\'t tell.',
    created_at: '2024-10-16T09:00:00Z',
    author: demoConsultant,
  },
  {
    id: 'comment-2',
    essay_id: 'essay-ca-1',
    author_id: 'demo-student-1',
    content: 'Thanks! I was thinking about the time my grandmother visited and I had to translate at my school\'s parent-teacher conference. Would that work?',
    created_at: '2024-10-16T14:30:00Z',
    author: demoProfile,
  },
  {
    id: 'comment-3',
    essay_id: 'essay-ca-1',
    author_id: 'demo-consultant-1',
    content: 'Perfect — that\'s exactly the kind of concrete scene that will make this essay memorable. Work it into the second paragraph.',
    created_at: '2024-10-16T16:00:00Z',
    author: demoConsultant,
  },
  {
    id: 'comment-4',
    essay_id: 'essay-c1',
    author_id: 'demo-consultant-1',
    content: 'Good start! You need to be more specific about what draws you to Cornell specifically — mention a professor, lab, or program.',
    created_at: '2024-10-13T11:00:00Z',
    author: demoConsultant,
  },
];

export const demoTasks: Task[] = [
  {
    id: 'task-1',
    student_id: 'demo-student-1',
    created_by: 'demo-consultant-1',
    title: 'Finish Cornell "Why Us" essay first draft',
    category: 'Essays',
    due_date: '2024-10-25',
    completed: false,
    completed_at: null,
  },
  {
    id: 'task-2',
    student_id: 'demo-student-1',
    created_by: 'demo-consultant-1',
    title: 'Revise Common App personal statement intro',
    category: 'Essays',
    due_date: '2024-10-20',
    completed: false,
    completed_at: null,
  },
  {
    id: 'task-3',
    student_id: 'demo-student-1',
    created_by: 'demo-consultant-1',
    title: 'Request recommendation letter from Mr. Davis',
    category: 'Recommendations',
    due_date: '2024-10-15',
    completed: true,
    completed_at: '2024-10-14T10:00:00Z',
  },
  {
    id: 'task-4',
    student_id: 'demo-student-1',
    created_by: 'demo-consultant-1',
    title: 'Complete activities list — all 10 entries',
    category: 'Activities',
    due_date: '2024-10-30',
    completed: false,
    completed_at: null,
  },
  {
    id: 'task-5',
    student_id: 'demo-student-1',
    created_by: 'demo-consultant-1',
    title: 'Submit SAT scores to Cornell',
    category: 'Testing',
    due_date: '2024-10-10',
    completed: false,
    completed_at: null,
  },
  {
    id: 'task-6',
    student_id: 'demo-student-1',
    created_by: 'demo-consultant-1',
    title: 'Fill out Rice application demographic section',
    category: 'Applications',
    due_date: '2024-11-15',
    completed: false,
    completed_at: null,
  },
];

export const demoActivities: Activity[] = [
  {
    id: 'act-1',
    student_id: 'demo-student-1',
    position_order: 1,
    activity_name: 'Robotics Team Captain',
    activity_type: 'Academic',
    role: 'Captain & Lead Programmer',
    organization: 'Westlake High School FIRST Robotics',
    grade_levels: '9, 10, 11, 12',
    timing: 'School Year',
    hours_per_week: 15,
    weeks_per_year: 30,
    description: 'Led 25-member team to regional finals; designed autonomous navigation system using computer vision',
  },
  {
    id: 'act-2',
    student_id: 'demo-student-1',
    position_order: 2,
    activity_name: 'Math Olympiad',
    activity_type: 'Academic',
    role: 'Team Member',
    organization: 'AMC / AIME',
    grade_levels: '10, 11, 12',
    timing: 'School Year',
    hours_per_week: 5,
    weeks_per_year: 36,
    description: 'Qualified for AIME in 11th grade; organized weekly practice sessions for underclassmen',
  },
  {
    id: 'act-3',
    student_id: 'demo-student-1',
    position_order: 3,
    activity_name: 'Community Tutoring',
    activity_type: 'Community Service',
    role: 'Volunteer Tutor',
    organization: 'Austin Public Library',
    grade_levels: '10, 11, 12',
    timing: 'All Year',
    hours_per_week: 4,
    weeks_per_year: 40,
    description: 'Tutor K-8 students in math and science; developed curriculum for summer STEM program',
  },
  {
    id: 'act-4',
    student_id: 'demo-student-1',
    position_order: 4,
    activity_name: 'Cross Country',
    activity_type: 'Athletics',
    role: 'Varsity Runner',
    organization: 'Westlake High School',
    grade_levels: '9, 10, 11, 12',
    timing: 'School Year',
    hours_per_week: 12,
    weeks_per_year: 20,
    description: 'Varsity letter all 4 years; team placed 3rd at state championship junior year',
  },
];

export const demoConversation: Conversation = {
  id: 'conv-1',
  student_id: 'demo-student-1',
  consultant_id: 'demo-consultant-1',
};

export const demoMessages: Message[] = [
  {
    id: 'msg-1',
    conversation_id: 'conv-1',
    sender_id: 'demo-consultant-1',
    content: 'Hi Alex! Welcome to DeltaX. I\'m Sarah, your consultant. Let\'s start by reviewing your school list and timeline.',
    file_url: null,
    created_at: '2024-09-01T10:00:00Z',
    sender: demoConsultant,
  },
  {
    id: 'msg-2',
    conversation_id: 'conv-1',
    sender_id: 'demo-student-1',
    content: 'Hi Sarah! Thanks so much. I\'m really excited to get started. I\'ve been thinking a lot about my Common App essay topic.',
    file_url: null,
    created_at: '2024-09-01T10:15:00Z',
    sender: demoProfile,
  },
  {
    id: 'msg-3',
    conversation_id: 'conv-1',
    sender_id: 'demo-consultant-1',
    content: 'That\'s great! Let\'s schedule a brainstorming session. In the meantime, could you jot down 3-4 story ideas that feel meaningful to you? We\'ll narrow it down together.',
    file_url: null,
    created_at: '2024-09-01T10:20:00Z',
    sender: demoConsultant,
  },
  {
    id: 'msg-4',
    conversation_id: 'conv-1',
    sender_id: 'demo-student-1',
    content: 'Will do! I\'ll have those ready by our meeting. Also, should I start looking at the Cornell supplementals?',
    file_url: null,
    created_at: '2024-09-02T14:00:00Z',
    sender: demoProfile,
  },
  {
    id: 'msg-5',
    conversation_id: 'conv-1',
    sender_id: 'demo-consultant-1',
    content: 'Yes — I just added the Cornell prompts to your Schools & Essays tab. Take a look and start brainstorming. We\'ll focus on Common App first, then move to Cornell since that\'s your ED school.',
    file_url: null,
    created_at: '2024-09-02T14:30:00Z',
    sender: demoConsultant,
  },
];

// Helper to get essay for a prompt
export function getEssayForPrompt(promptId: string): Essay | undefined {
  return demoEssays.find(e => e.prompt_id === promptId);
}

// Helper to get comments for an essay
export function getCommentsForEssay(essayId: string): EssayComment[] {
  return demoComments.filter(c => c.essay_id === essayId);
}

// Helper to get prompts for a school
export function getPromptsForSchool(schoolId: string): Prompt[] {
  return demoPrompts.filter(p => p.school_id === schoolId);
}
