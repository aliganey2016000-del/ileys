import { supabase } from './supabase';

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

async function sendSMS(phones: string[], message: string): Promise<void> {
  const phones_clean = phones.filter(Boolean);
  if (phones_clean.length === 0) return;

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON}`,
      },
      body: JSON.stringify({ to: phones_clean, message }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn('[sms] gateway error:', err);
    }
  } catch (e) {
    console.warn('[sms] send failed:', e);
  }
}

/** Fetch phone numbers of opted-in users by their profile IDs */
async function getPhonesForUsers(userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return [];
  const { data } = await supabase
    .from('profiles')
    .select('phone_number')
    .in('id', userIds)
    .eq('sms_notifications_enabled', true)
    .not('phone_number', 'is', null);
  return (data ?? []).map(r => r.phone_number).filter(Boolean) as string[];
}

/** Fetch all enrolled student phones for a given course */
async function getCourseStudentPhones(courseId: string): Promise<string[]> {
  const { data } = await supabase
    .from('course_enrollments')
    .select('profiles!student_id(phone_number, sms_notifications_enabled)')
    .eq('course_id', courseId);
  if (!data) return [];
  return data
    .flatMap(r => {
      const p = (r as any).profiles;
      if (!p || !p.sms_notifications_enabled || !p.phone_number) return [];
      return [p.phone_number as string];
    });
}

// ── Per-event SMS helpers ────────────────────────────────────────────────────

/** Called when a new recommended course is added */
export async function smsNewCourse(studentIds: string[], courseTitle: string) {
  const phones = await getPhonesForUsers(studentIds);
  await sendSMS(phones,
    `EduApp: New course available — "${courseTitle}". Open the app to enroll now!`
  );
}

/** Called when a new lesson is published in a course */
export async function smsNewLesson(courseId: string, lessonTitle: string) {
  const phones = await getCourseStudentPhones(courseId);
  await sendSMS(phones,
    `EduApp: New lesson added — "${lessonTitle}". Log in to continue learning!`
  );
}

/** Called when a new lesson is published in a level (legacy levels) */
export async function smsNewLessonByLevelId(levelId: string, lessonTitle: string) {
  const { data } = await supabase
    .from('enrollments')
    .select('profiles!student_id(phone_number, sms_notifications_enabled)')
    .eq('level_id', levelId);
  const phones = (data ?? []).flatMap((r: any) => {
    const p = r.profiles;
    if (!p?.sms_notifications_enabled || !p?.phone_number) return [];
    return [p.phone_number as string];
  });
  await sendSMS(phones,
    `EduApp: New lesson added — "${lessonTitle}". Log in to continue learning!`
  );
}

/** Called when a new quiz is published */
export async function smsNewQuiz(courseId: string, quizTitle: string) {
  const phones = await getCourseStudentPhones(courseId);
  await sendSMS(phones,
    `EduApp: New quiz ready — "${quizTitle}". Test your knowledge and earn XP!`
  );
}

/** Called when a live arena session is created */
export async function smsArenaLive(studentIds: string[], arenaTitle: string) {
  const phones = await getPhonesForUsers(studentIds);
  await sendSMS(phones,
    `EduApp: LIVE Arena "${arenaTitle}" is starting NOW! Join quickly before it fills up.`
  );
}

/** Called when a student's streak is at risk */
export async function smsStreakAtRisk(userId: string, currentDays: number) {
  const phones = await getPhonesForUsers([userId]);
  await sendSMS(phones,
    `EduApp: Your ${currentDays}-day streak is at risk! Complete any lesson today to keep it alive.`
  );
}

/** Called when a student's streak is broken */
export async function smsStreakBroken(userId: string, lostDays: number) {
  const phones = await getPhonesForUsers([userId]);
  await sendSMS(phones,
    `EduApp: Your ${lostDays}-day streak ended. Don't give up — start fresh today!`
  );
}

/** Manual admin SMS blast to specific users or all students */
export async function smsAdminBlast(userIds: string[], message: string) {
  const phones = await getPhonesForUsers(userIds);
  await sendSMS(phones, `EduApp: ${message}`);
}

/** Send to explicit phone numbers directly (admin override) */
export async function smsDirectBlast(phones: string[], message: string) {
  await sendSMS(phones, `EduApp: ${message}`);
}
