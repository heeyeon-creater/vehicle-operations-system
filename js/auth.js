import { supabase } from './supabaseClient.js';

let session = null;
let profile = null;
const listeners = new Set();

async function loadProfile() {
  if (!session) {
    profile = null;
    return null;
  }
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, role, department_id, departments:department_id(id, name)')
    .eq('id', session.user.id)
    .single();
  if (error) {
    console.error('프로필 조회 실패', error);
    profile = null;
    return null;
  }
  profile = data;
  return profile;
}

supabase.auth.onAuthStateChange(async (_event, newSession) => {
  session = newSession;
  if (session) {
    await loadProfile();
  } else {
    profile = null;
  }
  listeners.forEach((fn) => fn({ session, profile }));
});

export async function initAuth() {
  const { data } = await supabase.auth.getSession();
  session = data.session;
  if (session) await loadProfile();
  return { session, profile };
}

export function onAuthChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getSession() {
  return session;
}

export function getProfile() {
  return profile;
}

export function isAdmin() {
  return profile?.role === 'admin';
}

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp({ email, password, name, departmentId }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });
  if (error) throw error;

  // 트리거(handle_new_user)가 profiles row를 자동 생성한다.
  // 이메일 인증 없이 세션이 즉시 발급된 경우에만 부서 정보를 반영할 수 있다
  // (RLS 정책상 로그인된 사용자 본인만 자신의 프로필을 수정 가능).
  if (data.session && departmentId) {
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ department_id: departmentId })
      .eq('id', data.user.id);
    if (updateError) console.error('부서 정보 반영 실패', updateError);
  }

  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}
