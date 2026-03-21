import type { Profile, School, Prompt, Essay, EssayComment, Task, Message, Activity, Conversation } from '@/types/database';

// The counselor
export const demoCounselor: Profile = {
  id: 'demo-consultant-1',
  role: 'consultant',
  full_name: 'Sarah Chen',
  assigned_consultant_id: null,
  avatar_initials: 'SC',
  email: 'sarah@deltaxcc.com',
  created_at: '2024-01-01T00:00:00Z',
};

// Multiple students assigned to this counselor
export const demoStudents: (Profile & { grade: string; school_name: string; package_type: string; last_login_at: string })[] = [
  {
    id: 'demo-student-1',
    role: 'student',
    full_name: 'Alex Johnson',
    assigned_consultant_id: 'demo-consultant-1',
    avatar_initials: 'AJ',
    email: 'alex@example.com',
    created_at: '2024-09-01T00:00:00Z',
    grade: 'Senior',
    school_name: 'Westlake High School',
    package_type: 'Rising Senior',
    last_login_at: '2024-10-22T08:00:00Z',
  },
  {
    id: 'demo-student-2',
    role: 'student',
    full_name: 'Jane Doe',
    assigned_consultant_id: 'demo-consultant-1',
    avatar_initials: 'JD',
    email: 'jane@example.com',
    created_at: '2024-09-02T00:00:00Z',
    grade: 'Senior',
    school_name: 'Lake Travis High School',
    package_type: 'Rising Senior',
    last_login_at: '2024-10-23T14:00:00Z',
  },
  {
    id: 'demo-student-3',
    role: 'student',
    full_name: 'Marcus Brown',
    assigned_consultant_id: 'demo-consultant-1',
    avatar_initials: 'MB',
    email: 'marcus@example.com',
    created_at: '2024-09-05T00:00:00Z',
    grade: 'Senior',
    school_name: 'Anderson High School',
    package_type: 'Rising Senior',
    last_login_at: '2024-10-10T12:00:00Z',
  },
  {
    id: 'demo-student-4',
    role: 'student',
    full_name: 'Priya Patel',
    assigned_consultant_id: 'demo-consultant-1',
    avatar_initials: 'PP',
    email: 'priya@example.com',
    created_at: '2024-09-08T00:00:00Z',
    grade: 'Junior',
    school_name: 'Vandegrift High School',
    package_type: 'Rising Junior',
    last_login_at: '2024-10-22T20:00:00Z',
  },
  {
    id: 'demo-student-5',
    role: 'student',
    full_name: 'Ethan Williams',
    assigned_consultant_id: 'demo-consultant-1',
    avatar_initials: 'EW',
    email: 'ethan@example.com',
    created_at: '2024-09-10T00:00:00Z',
    grade: 'Senior',
    school_name: 'Cedar Park High School',
    package_type: 'Essay-Only',
    last_login_at: '2024-10-21T09:00:00Z',
  },
];

// All schools across all students
export const allSchools: School[] = [
  // Alex's schools (already in student demo data)
  { id: 'common-app-1', student_id: 'demo-student-1', name: 'Common Application', program: 'Personal Statement', category: 'target', decision_plan: '', deadline: '', notes: '', created_at: '2024-09-01T00:00:00Z', is_common_app: true },
  { id: 'school-1', student_id: 'demo-student-1', name: 'Cornell University', program: 'College of Engineering', category: 'reach', decision_plan: 'ED', deadline: '2024-11-01', notes: '', created_at: '2024-09-01T00:00:00Z' },
  { id: 'school-2', student_id: 'demo-student-1', name: 'Rice University', program: 'School of Engineering', category: 'reach', decision_plan: 'RD', deadline: '2025-01-01', notes: '', created_at: '2024-09-02T00:00:00Z' },
  { id: 'school-3', student_id: 'demo-student-1', name: 'UT Austin', program: 'Cockrell School of Engineering', category: 'target', decision_plan: 'EA', deadline: '2024-11-01', notes: '', created_at: '2024-09-03T00:00:00Z' },
  { id: 'school-4', student_id: 'demo-student-1', name: 'Texas A&M', program: 'Engineering', category: 'safety', decision_plan: 'RD', deadline: '2024-12-01', notes: '', created_at: '2024-09-04T00:00:00Z' },

  // Jane's schools
  { id: 'common-app-2', student_id: 'demo-student-2', name: 'Common Application', program: 'Personal Statement', category: 'target', decision_plan: '', deadline: '', notes: '', created_at: '2024-09-02T00:00:00Z', is_common_app: true },
  { id: 'school-j1', student_id: 'demo-student-2', name: 'Cornell University', program: 'College of Arts & Sciences', category: 'reach', decision_plan: 'ED', deadline: '2024-11-01', notes: '', created_at: '2024-09-02T00:00:00Z' },
  { id: 'school-j2', student_id: 'demo-student-2', name: 'Georgetown University', program: 'School of Foreign Service', category: 'reach', decision_plan: 'EA', deadline: '2024-11-01', notes: '', created_at: '2024-09-02T00:00:00Z' },
  { id: 'school-j3', student_id: 'demo-student-2', name: 'UT Austin', program: 'Liberal Arts Honors', category: 'target', decision_plan: 'EA', deadline: '2024-11-01', notes: '', created_at: '2024-09-02T00:00:00Z' },

  // Marcus's schools
  { id: 'common-app-3', student_id: 'demo-student-3', name: 'Common Application', program: 'Personal Statement', category: 'target', decision_plan: '', deadline: '', notes: '', created_at: '2024-09-05T00:00:00Z', is_common_app: true },
  { id: 'school-m1', student_id: 'demo-student-3', name: 'UT Austin', program: 'McCombs School of Business', category: 'target', decision_plan: 'EA', deadline: '2024-11-01', notes: '', created_at: '2024-09-05T00:00:00Z' },
  { id: 'school-m2', student_id: 'demo-student-3', name: 'Texas A&M', program: 'Mays Business School', category: 'safety', decision_plan: 'RD', deadline: '2024-12-01', notes: '', created_at: '2024-09-05T00:00:00Z' },

  // Priya's schools
  { id: 'school-p1', student_id: 'demo-student-4', name: 'Summer Research Program', program: 'Pre-application prep', category: 'target', decision_plan: 'Prep', deadline: '2025-03-01', notes: '', created_at: '2024-09-08T00:00:00Z' },

  // Ethan's schools
  { id: 'common-app-5', student_id: 'demo-student-5', name: 'Common Application', program: 'Personal Statement', category: 'target', decision_plan: '', deadline: '', notes: '', created_at: '2024-09-10T00:00:00Z', is_common_app: true },
  { id: 'school-e1', student_id: 'demo-student-5', name: 'SMU', program: 'Lyle School of Engineering', category: 'target', decision_plan: 'EA', deadline: '2024-11-01', notes: '', created_at: '2024-09-10T00:00:00Z' },
  { id: 'school-e2', student_id: 'demo-student-5', name: 'Baylor University', program: 'Engineering', category: 'safety', decision_plan: 'RD', deadline: '2025-02-01', notes: '', created_at: '2024-09-10T00:00:00Z' },
];

// Prompts across students
export const allPrompts: Prompt[] = [
  // Alex
  { id: 'prompt-ca-1', school_id: 'common-app-1', title: 'Personal Statement', prompt_text: 'Some students have a background, identity, interest, or talent that is so meaningful they believe their application would be incomplete without it. If this sounds like you, then please share your story.', word_limit: 650, sort_order: 1 },
  { id: 'prompt-c1', school_id: 'school-1', title: 'Why Cornell Engineering', prompt_text: 'How do you see yourself being a part of the Cornell Engineering community?', word_limit: 250, sort_order: 1 },
  { id: 'prompt-c2', school_id: 'school-1', title: 'Engineering Interest', prompt_text: 'Describe an engineering problem that impacts your local community.', word_limit: 250, sort_order: 2 },
  { id: 'prompt-r1', school_id: 'school-2', title: 'Why Rice', prompt_text: 'Please explain why you wish to study in the academic areas you selected.', word_limit: 500, sort_order: 1 },
  { id: 'prompt-r2', school_id: 'school-2', title: 'The Box', prompt_text: 'What perspectives shaped you and are meaningfully different from the perspectives of your peers?', word_limit: 500, sort_order: 2 },
  { id: 'prompt-ut1', school_id: 'school-3', title: 'Why UT Engineering', prompt_text: 'Why are you interested in the major you indicated?', word_limit: 500, sort_order: 1 },
  { id: 'prompt-am1', school_id: 'school-4', title: 'Why Texas A&M', prompt_text: 'Describe a life event which you feel has prepared you to be successful in college.', word_limit: 500, sort_order: 1 },

  // Jane
  { id: 'prompt-ca-2', school_id: 'common-app-2', title: 'Personal Statement', prompt_text: 'Some students have a background, identity, interest, or talent...', word_limit: 650, sort_order: 1 },
  { id: 'prompt-j1', school_id: 'school-j1', title: 'Why Cornell A&S', prompt_text: 'Students in Arts and Sciences embrace the opportunity to delve into their academic interests. Tell us about the areas of study you are excited to explore.', word_limit: 650, sort_order: 1 },
  { id: 'prompt-j2', school_id: 'school-j2', title: 'Georgetown SFS Essay', prompt_text: 'Briefly discuss a current global issue, indicating why you consider it important and what you suggest should be done to deal with it.', word_limit: 500, sort_order: 1 },
  { id: 'prompt-j3', school_id: 'school-j3', title: 'UT Short Answer 1', prompt_text: 'Why are you interested in the major you indicated?', word_limit: 500, sort_order: 1 },

  // Marcus
  { id: 'prompt-ca-3', school_id: 'common-app-3', title: 'Personal Statement', prompt_text: 'Some students have a background, identity, interest, or talent...', word_limit: 650, sort_order: 1 },
  { id: 'prompt-m1', school_id: 'school-m1', title: 'UT McCombs Essay', prompt_text: 'Why are you interested in the major you indicated?', word_limit: 500, sort_order: 1 },
  { id: 'prompt-m2', school_id: 'school-m2', title: 'A&M Mays Essay', prompt_text: 'Describe a life event which has prepared you for college.', word_limit: 500, sort_order: 1 },

  // Ethan
  { id: 'prompt-ca-5', school_id: 'common-app-5', title: 'Personal Statement', prompt_text: 'Some students have a background, identity, interest, or talent...', word_limit: 650, sort_order: 1 },
  { id: 'prompt-e1', school_id: 'school-e1', title: 'Why SMU', prompt_text: 'SMU appeals to students for a variety of reasons. Briefly describe why you are interested in attending SMU.', word_limit: 250, sort_order: 1 },
  { id: 'prompt-e2', school_id: 'school-e2', title: 'Baylor Essay', prompt_text: 'What is your motivation for pursuing higher education?', word_limit: 500, sort_order: 1 },
];

// Essays across students
export const allEssays: Essay[] = [
  // Alex
  { id: 'essay-ca-1', prompt_id: 'prompt-ca-1', student_id: 'demo-student-1', content: '<p>Growing up in a household where two cultures collided daily...</p>', status: 'in_review', word_count: 412, updated_at: '2024-10-15T14:30:00Z' },
  { id: 'essay-c1', prompt_id: 'prompt-c1', student_id: 'demo-student-1', content: '<p>The robotics lab was where I first experienced collaborative engineering...</p>', status: 'draft', word_count: 180, updated_at: '2024-10-12T10:00:00Z' },
  { id: 'essay-r1', prompt_id: 'prompt-r1', student_id: 'demo-student-1', content: '', status: 'not_started', word_count: 0, updated_at: '2024-09-01T00:00:00Z' },
  { id: 'essay-ut1', prompt_id: 'prompt-ut1', student_id: 'demo-student-1', content: '<p>My journey into engineering began with a broken toaster...</p>', status: 'final', word_count: 487, updated_at: '2024-10-20T09:00:00Z' },
  { id: 'essay-am1', prompt_id: 'prompt-am1', student_id: 'demo-student-1', content: '<p>Moving to a new city during my sophomore year...</p>', status: 'submitted', word_count: 445, updated_at: '2024-10-22T15:00:00Z' },

  // Jane
  { id: 'essay-ca-2', prompt_id: 'prompt-ca-2', student_id: 'demo-student-2', content: '<p>The first time I debated international policy...</p>', status: 'revision', word_count: 580, updated_at: '2024-10-20T11:00:00Z' },
  { id: 'essay-j1', prompt_id: 'prompt-j1', student_id: 'demo-student-2', content: '<p>Cornell\'s open curriculum philosophy...</p>', status: 'in_review', word_count: 610, updated_at: '2024-10-23T09:00:00Z' },
  { id: 'essay-j2', prompt_id: 'prompt-j2', student_id: 'demo-student-2', content: '<p>The global refugee crisis represents...</p>', status: 'in_review', word_count: 480, updated_at: '2024-10-23T10:00:00Z' },
  { id: 'essay-j3', prompt_id: 'prompt-j3', student_id: 'demo-student-2', content: '', status: 'not_started', word_count: 0, updated_at: '2024-09-02T00:00:00Z' },

  // Marcus
  { id: 'essay-ca-3', prompt_id: 'prompt-ca-3', student_id: 'demo-student-3', content: '<p>Basketball taught me more about leadership than any classroom...</p>', status: 'draft', word_count: 320, updated_at: '2024-10-08T16:00:00Z' },
  { id: 'essay-m1', prompt_id: 'prompt-m1', student_id: 'demo-student-3', content: '', status: 'not_started', word_count: 0, updated_at: '2024-09-05T00:00:00Z' },
  { id: 'essay-m2', prompt_id: 'prompt-m2', student_id: 'demo-student-3', content: '', status: 'not_started', word_count: 0, updated_at: '2024-09-05T00:00:00Z' },

  // Ethan
  { id: 'essay-ca-5', prompt_id: 'prompt-ca-5', student_id: 'demo-student-5', content: '<p>When my father lost his job during the pandemic...</p>', status: 'in_review', word_count: 630, updated_at: '2024-10-21T08:00:00Z' },
  { id: 'essay-e1', prompt_id: 'prompt-e1', student_id: 'demo-student-5', content: '<p>SMU\'s location in Dallas...</p>', status: 'draft', word_count: 120, updated_at: '2024-10-18T14:00:00Z' },
  { id: 'essay-e2', prompt_id: 'prompt-e2', student_id: 'demo-student-5', content: '', status: 'not_started', word_count: 0, updated_at: '2024-09-10T00:00:00Z' },
];

// Comments
export const allComments: EssayComment[] = [
  { id: 'cc-1', essay_id: 'essay-ca-1', author_id: 'demo-consultant-1', content: 'Great opening! Can you expand on a specific moment where these two worlds collided?', created_at: '2024-10-16T09:00:00Z', author: demoCounselor },
  { id: 'cc-2', essay_id: 'essay-j1', author_id: 'demo-consultant-1', content: 'Strong draft — tighten the second paragraph. The transition from debate to policy studies needs a clearer bridge.', created_at: '2024-10-23T10:30:00Z', author: demoCounselor },
  { id: 'cc-3', essay_id: 'essay-ca-5', author_id: 'demo-consultant-1', content: 'Very moving. Watch the word count — you\'re at 630 and need to be under 650. Don\'t cut the ending.', created_at: '2024-10-21T10:00:00Z', author: demoCounselor },
];

// Tasks across students
export const allTasks: Task[] = [
  // Alex's tasks
  { id: 'task-1', student_id: 'demo-student-1', created_by: 'demo-consultant-1', title: 'Finish Cornell "Why Us" essay first draft', category: 'Essays', due_date: '2024-10-25', completed: false, completed_at: null },
  { id: 'task-2', student_id: 'demo-student-1', created_by: 'demo-consultant-1', title: 'Revise Common App personal statement intro', category: 'Essays', due_date: '2024-10-20', completed: false, completed_at: null },
  { id: 'task-3', student_id: 'demo-student-1', created_by: 'demo-consultant-1', title: 'Request recommendation letter from Mr. Davis', category: 'Recommendations', due_date: '2024-10-15', completed: true, completed_at: '2024-10-14T10:00:00Z' },
  { id: 'task-4', student_id: 'demo-student-1', created_by: 'demo-consultant-1', title: 'Complete activities list — all 10 entries', category: 'Activities', due_date: '2024-10-30', completed: false, completed_at: null },
  { id: 'task-5', student_id: 'demo-student-1', created_by: 'demo-consultant-1', title: 'Submit SAT scores to Cornell', category: 'Testing', due_date: '2024-10-10', completed: false, completed_at: null },

  // Jane's tasks
  { id: 'task-j1', student_id: 'demo-student-2', created_by: 'demo-consultant-1', title: 'Revise Common App essay — address feedback', category: 'Essays', due_date: '2024-10-25', completed: false, completed_at: null },
  { id: 'task-j2', student_id: 'demo-student-2', created_by: 'demo-consultant-1', title: 'Start Georgetown SFS supplemental', category: 'Essays', due_date: '2024-10-22', completed: false, completed_at: null },
  { id: 'task-j3', student_id: 'demo-student-2', created_by: 'demo-consultant-1', title: 'Schedule alumni interview prep call', category: 'Action', due_date: '2024-10-28', completed: false, completed_at: null },

  // Marcus's tasks
  { id: 'task-m1', student_id: 'demo-student-3', created_by: 'demo-consultant-1', title: 'Finish Common App essay draft', category: 'Essays', due_date: '2024-10-12', completed: false, completed_at: null },
  { id: 'task-m2', student_id: 'demo-student-3', created_by: 'demo-consultant-1', title: 'Research UT McCombs programs', category: 'Research', due_date: '2024-10-10', completed: false, completed_at: null },
  { id: 'task-m3', student_id: 'demo-student-3', created_by: 'demo-consultant-1', title: 'Update activities list with leadership roles', category: 'Activities', due_date: '2024-10-08', completed: false, completed_at: null },

  // Priya's tasks
  { id: 'task-p1', student_id: 'demo-student-4', created_by: 'demo-consultant-1', title: 'Complete preliminary school research worksheet', category: 'Research', due_date: '2024-11-01', completed: false, completed_at: null },
  { id: 'task-p2', student_id: 'demo-student-4', created_by: 'demo-consultant-1', title: 'Draft summer program application essay', category: 'Essays', due_date: '2024-11-15', completed: false, completed_at: null },

  // Ethan's tasks
  { id: 'task-e1', student_id: 'demo-student-5', created_by: 'demo-consultant-1', title: 'Revise SMU "Why Us" response', category: 'Essays', due_date: '2024-10-25', completed: false, completed_at: null },
  { id: 'task-e2', student_id: 'demo-student-5', created_by: 'demo-consultant-1', title: 'Finalize Common App personal statement', category: 'Essays', due_date: '2024-10-24', completed: false, completed_at: null },
];

// Activities (Alex's only for demo)
export const allActivities: Activity[] = [
  { id: 'act-1', student_id: 'demo-student-1', position_order: 1, activity_name: 'Robotics Team Captain', activity_type: 'Academic', role: 'Captain & Lead Programmer', organization: 'Westlake HS FIRST Robotics', grade_levels: '9, 10, 11, 12', timing: 'School Year', hours_per_week: 15, weeks_per_year: 30, description: 'Led 25-member team to regional finals; designed autonomous navigation system' },
  { id: 'act-2', student_id: 'demo-student-1', position_order: 2, activity_name: 'Math Olympiad', activity_type: 'Academic', role: 'Team Member', organization: 'AMC / AIME', grade_levels: '10, 11, 12', timing: 'School Year', hours_per_week: 5, weeks_per_year: 36, description: 'Qualified for AIME in 11th grade; organized weekly practice sessions' },
  { id: 'act-3', student_id: 'demo-student-1', position_order: 3, activity_name: 'Community Tutoring', activity_type: 'Community Service', role: 'Volunteer Tutor', organization: 'Austin Public Library', grade_levels: '10, 11, 12', timing: 'All Year', hours_per_week: 4, weeks_per_year: 40, description: 'Tutor K-8 students in math and science; developed STEM curriculum' },
];

// Conversations & Messages
export const allConversations: Conversation[] = [
  { id: 'conv-1', student_id: 'demo-student-1', consultant_id: 'demo-consultant-1' },
  { id: 'conv-2', student_id: 'demo-student-2', consultant_id: 'demo-consultant-1' },
  { id: 'conv-3', student_id: 'demo-student-3', consultant_id: 'demo-consultant-1' },
  { id: 'conv-4', student_id: 'demo-student-4', consultant_id: 'demo-consultant-1' },
  { id: 'conv-5', student_id: 'demo-student-5', consultant_id: 'demo-consultant-1' },
];

export const allMessages: Message[] = [
  // Alex
  { id: 'msg-1', conversation_id: 'conv-1', sender_id: 'demo-consultant-1', content: 'Hi Alex! I\'ve added all your Cornell prompts. Let\'s focus on the Common App first since that\'s shared.', file_url: null, created_at: '2024-09-01T10:00:00Z', sender: demoCounselor },
  { id: 'msg-2', conversation_id: 'conv-1', sender_id: 'demo-student-1', content: 'Thanks Sarah! I have a few topic ideas I\'d love to run by you.', file_url: null, created_at: '2024-09-01T10:15:00Z', sender: demoStudents[0] as unknown as Profile },

  // Jane
  { id: 'msg-j1', conversation_id: 'conv-2', sender_id: 'demo-consultant-1', content: 'Jane, your Cornell essay is really strong. I left some comments — mainly the transition in paragraph 2.', file_url: null, created_at: '2024-10-23T10:30:00Z', sender: demoCounselor },
  { id: 'msg-j2', conversation_id: 'conv-2', sender_id: 'demo-student-2', content: 'Got it! I\'ll work on that transition tonight. Should I also start Georgetown?', file_url: null, created_at: '2024-10-23T14:00:00Z', sender: demoStudents[1] as unknown as Profile },

  // Marcus
  { id: 'msg-m1', conversation_id: 'conv-3', sender_id: 'demo-consultant-1', content: 'Marcus, checking in — how\'s the Common App draft coming? We\'re getting close to your UT deadline.', file_url: null, created_at: '2024-10-08T09:00:00Z', sender: demoCounselor },

  // Priya
  { id: 'msg-p1', conversation_id: 'conv-4', sender_id: 'demo-consultant-1', content: 'Welcome Priya! Since you\'re a junior, we\'ll focus on building your profile and prepping for summer programs.', file_url: null, created_at: '2024-09-08T10:00:00Z', sender: demoCounselor },
  { id: 'msg-p2', conversation_id: 'conv-4', sender_id: 'demo-student-4', content: 'Thank you! I\'m excited to start. I\'ve been researching some summer research programs.', file_url: null, created_at: '2024-09-08T11:00:00Z', sender: demoStudents[3] as unknown as Profile },

  // Ethan
  { id: 'msg-e1', conversation_id: 'conv-5', sender_id: 'demo-consultant-1', content: 'Ethan, your personal statement draft is powerful. I left a few comments — mainly about word count.', file_url: null, created_at: '2024-10-21T10:00:00Z', sender: demoCounselor },
];

// Prompt Library (counselor's reusable templates)
export const promptLibrary = [
  { id: 'pl-1', school_name: 'Cornell University', program: 'Engineering', prompt_title: 'Why Cornell Engineering', prompt_text: 'Cornell Engineering celebrates collaborative environments that extend beyond any one classroom, laboratory, or studio. How do you see yourself being a part of the Cornell Engineering community?', word_limit: 250, sort_order: 1 },
  { id: 'pl-2', school_name: 'Cornell University', program: 'Arts & Sciences', prompt_title: 'Why Cornell A&S', prompt_text: 'Students in Arts and Sciences embrace the opportunity to delve into their academic interests, and tell us about the areas of study you are excited to explore.', word_limit: 650, sort_order: 1 },
  { id: 'pl-3', school_name: 'Rice University', program: null, prompt_title: 'Why Rice', prompt_text: 'Please explain why you wish to study in the academic areas you selected and why Rice University is a good fit for you.', word_limit: 500, sort_order: 1 },
  { id: 'pl-4', school_name: 'Rice University', program: null, prompt_title: 'The Box', prompt_text: 'The quality of Rice\'s residential college system stems from the unique life experiences and cultural traditions each student brings. What perspectives shaped you?', word_limit: 500, sort_order: 2 },
  { id: 'pl-5', school_name: 'UT Austin', program: null, prompt_title: 'Topic A', prompt_text: 'Why are you interested in the major you indicated as your first-choice major?', word_limit: 500, sort_order: 1 },
  { id: 'pl-6', school_name: 'Georgetown University', program: 'SFS', prompt_title: 'Global Issue', prompt_text: 'Briefly discuss a current global issue, indicating why you consider it important and what you suggest should be done to deal with it.', word_limit: 500, sort_order: 1 },
  { id: 'pl-7', school_name: 'Texas A&M', program: null, prompt_title: 'Life Event', prompt_text: 'Describe a life event which you feel has prepared you to be successful in college.', word_limit: 500, sort_order: 1 },
  { id: 'pl-8', school_name: 'SMU', program: null, prompt_title: 'Why SMU', prompt_text: 'SMU appeals to students for a variety of reasons. Briefly describe why you are interested in attending SMU.', word_limit: 250, sort_order: 1 },
];

// Needs Attention Feed items
export interface AttentionItem {
  id: string;
  student_id: string;
  student_name: string;
  student_initials: string;
  description: string;
  type: 'review' | 'overdue' | 'activity' | 'inactive';
  timestamp: string;
  action_label: string;
  action_tab?: string;
}

export const attentionFeed: AttentionItem[] = [
  { id: 'att-1', student_id: 'demo-student-2', student_name: 'Jane Doe', student_initials: 'JD', description: 'submitted "Cornell A&S Essay" for review', type: 'review', timestamp: '2024-10-23T09:00:00Z', action_label: 'Review essay', action_tab: 'reviews' },
  { id: 'att-2', student_id: 'demo-student-2', student_name: 'Jane Doe', student_initials: 'JD', description: 'submitted "Georgetown SFS Essay" for review', type: 'review', timestamp: '2024-10-23T10:00:00Z', action_label: 'Review essay', action_tab: 'reviews' },
  { id: 'att-3', student_id: 'demo-student-5', student_name: 'Ethan Williams', student_initials: 'EW', description: 'submitted "Common App Personal Statement" for review', type: 'review', timestamp: '2024-10-21T08:00:00Z', action_label: 'Review essay', action_tab: 'reviews' },
  { id: 'att-4', student_id: 'demo-student-3', student_name: 'Marcus Brown', student_initials: 'MB', description: 'has 3 overdue tasks', type: 'overdue', timestamp: '2024-10-10T00:00:00Z', action_label: 'Send reminder', action_tab: 'tasks' },
  { id: 'att-5', student_id: 'demo-student-4', student_name: 'Priya Patel', student_initials: 'PP', description: 'started her summer program research', type: 'activity', timestamp: '2024-10-22T20:00:00Z', action_label: 'View progress' },
  { id: 'att-6', student_id: 'demo-student-3', student_name: 'Marcus Brown', student_initials: 'MB', description: 'hasn\'t logged in for 13 days', type: 'inactive', timestamp: '2024-10-10T12:00:00Z', action_label: 'Send reminder', action_tab: 'messages' },
];

// Helper functions
export function getStudentSchools(studentId: string): School[] {
  return allSchools.filter(s => s.student_id === studentId);
}

export function getStudentPrompts(studentId: string): Prompt[] {
  const schoolIds = getStudentSchools(studentId).map(s => s.id);
  return allPrompts.filter(p => schoolIds.includes(p.school_id));
}

export function getStudentEssays(studentId: string): Essay[] {
  return allEssays.filter(e => e.student_id === studentId);
}

export function getStudentTasks(studentId: string): Task[] {
  return allTasks.filter(t => t.student_id === studentId);
}

export function getStudentMessages(studentId: string): Message[] {
  const conv = allConversations.find(c => c.student_id === studentId);
  if (!conv) return [];
  return allMessages.filter(m => m.conversation_id === conv.id);
}

export function getEssayById(essayId: string): Essay | undefined {
  return allEssays.find(e => e.id === essayId);
}

export function getPromptById(promptId: string): Prompt | undefined {
  return allPrompts.find(p => p.id === promptId);
}

export function getSchoolById(schoolId: string): School | undefined {
  return allSchools.find(s => s.id === schoolId);
}

export function getStudentById(studentId: string) {
  return demoStudents.find(s => s.id === studentId);
}
