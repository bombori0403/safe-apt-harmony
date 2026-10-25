import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * 로그인 없이 열리는 두 화면의 서버 함수.
 *   /confirm/:id      — 참여자 확인 서명 (직원). 평가 UUID 가 링크.
 *   /view/:id?k=토큰   — 진행 현황 열람 + "확인했습니다" 기록 (입주자대표·본사 담당).
 *                        열람은 서명 링크보다 훨씬 많은 내용을 보여주므로 UUID 만으로는 열리지 않고,
 *                        담당자가 공유 화면에서 받은 열람 토큰(k)이 함께 있어야 한다.
 * 담당자가 assessments.share_enabled 를 끄면 두 화면 모두 닫힌다.
 */

const idSchema = z.object({ assessmentId: z.string().uuid() });

// ── 열람 토큰: 서버 비밀키로 만든 HMAC. 평가 UUID 를 아는 것만으로는 계산할 수 없다. ──
async function viewTokenFor(assessmentId: string): Promise<string> {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`view:${assessmentId}`));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 24);
}
async function assertViewToken(assessmentId: string, k: string | null | undefined) {
  const expected = await viewTokenFor(assessmentId);
  if (!k || k.length !== expected.length || k !== expected) throw new Error("열람 링크가 올바르지 않습니다. 관리사무소에서 받은 '진행 현황 열람 링크'로 열어 주세요.");
}

async function loadSharedAssessment(assessmentId: string) {
  const { data: a, error } = await supabaseAdmin
    .from("assessments")
    .select("id, work_name, assessment_date, method, status, allowable_level, updated_at, created_at, complex_id, organization_id, share_enabled, location, assessment_type")
    .eq("id", assessmentId)
    .maybeSingle();
  if (error && /share_enabled/.test(error.message)) throw new Error("서버 업데이트(데이터베이스 SQL)가 아직 적용되지 않아 이 화면을 열 수 없습니다. 관리사무소에 알려 주세요.");
  if (error) throw new Error(error.message);
  if (!a) throw new Error("존재하지 않는 평가입니다.");
  if ((a as any).share_enabled === false) throw new Error("담당자가 이 평가의 공유 링크를 꺼 두었습니다. 관리사무소에 문의하세요.");
  const { data: cx } = await supabaseAdmin.from("complexes").select("name").eq("id", a.complex_id).maybeSingle();
  return { ...a, complex_name: cx?.name ?? "" };
}

/** 체험 만료·구독 종료 조직에는 익명 경로로도 새 기록을 남기지 않는다 (org_can_write 와 같은 조건) */
async function assertOrgCanWrite(orgId: string | null) {
  if (!orgId) throw new Error("조직 정보가 없습니다.");
  const { data: org, error } = await supabaseAdmin.from("organizations").select("subscription_status, expires_at").eq("id", orgId).maybeSingle();
  if (error || !org) throw new Error("조직 정보를 확인할 수 없습니다.");
  const okStatus = org.subscription_status === "trial" || org.subscription_status === "active";
  const notExpired = !org.expires_at || new Date(org.expires_at).getTime() > Date.now();
  if (!okStatus || !notExpired) throw new Error("이 사업장의 이용 기간이 끝나 더 이상 기록할 수 없습니다. 관리사무소에 문의하세요.");
}

/** 문서 버전: 평가·위험요인·대책 중 가장 최근 수정 시각 (대책만 고쳐도 버전이 바뀌게) */
function latest(...dates: (string | null | undefined)[]) {
  return dates.filter(Boolean).map((d) => new Date(d as string).getTime()).reduce((m, t) => Math.max(m, t), 0);
}

async function loadProgress(assessmentId: string, assessmentUpdatedAt: string | null) {
  const [hz, pt, sg] = await Promise.all([
    supabaseAdmin.from("hazards")
      .select("id, description, level, post_level, current_control, legal_basis_override, origin, updated_at, hazard_library:library_item_id(legal_basis), measures(id, content, type, status, due_date, completed_at, updated_at)")
      .eq("assessment_id", assessmentId).order("created_at"),
    supabaseAdmin.from("participants").select("id, name, role, confirmed").eq("assessment_id", assessmentId),
    supabaseAdmin.from("signatures").select("participant_id").eq("assessment_id", assessmentId),
  ]);
  // 조회가 하나라도 실패하면 '0건'으로 보이면 안 된다 — 오류로 처리
  if (hz.error) throw new Error("위험요인을 불러오지 못했습니다: " + hz.error.message);
  if (pt.error) throw new Error("참여자를 불러오지 못했습니다: " + pt.error.message);
  if (sg.error) throw new Error("서명 정보를 불러오지 못했습니다: " + sg.error.message);

  const signed = new Set((sg.data ?? []).map((s: any) => s.participant_id));
  const participants = (pt.data ?? []).map((p: any) => ({ id: p.id, name: p.name, role: p.role, confirmed: !!p.confirmed || signed.has(p.id) }));
  const hazards = (hz.data ?? []) as any[];
  const measures = hazards.flatMap((h) => h.measures ?? []);
  const docVersionMs = latest(assessmentUpdatedAt, ...hazards.map((h) => h.updated_at), ...measures.map((m: any) => m.updated_at));
  return {
    hazards: hazards.map((h) => ({
      id: h.id, description: h.description, level: h.level, post_level: h.post_level, current_control: h.current_control, origin: h.origin,
      legal_basis: h.legal_basis_override || h.hazard_library?.legal_basis || null,
      // 책임자 이름 등 개인정보는 공개 응답에서 뺀다
      measures: (h.measures ?? []).map((m: any) => ({ id: m.id, content: m.content, type: m.type, status: m.status, due_date: m.due_date, completed_at: m.completed_at })),
    })),
    participants,
    docVersion: docVersionMs ? new Date(docVersionMs).toISOString() : null,
    counts: {
      hazards: hazards.length,
      unrated: hazards.filter((h) => !h.level).length,
      measures: measures.length,
      measuresNotDone: measures.filter((m: any) => m.status !== "완료").length,
      participants: participants.length,
      confirmed: participants.filter((p) => p.confirmed).length,
    },
  };
}

/** 참여 확인 화면: 무엇에 서명하는지 보여줄 요약 포함. 참여자 명단은 본인 선택용으로만 (이름·직책) */
export const getConfirmInfo = createServerFn({ method: "POST" })
  .inputValidator((i) => idSchema.parse(i))
  .handler(async ({ data }) => {
    const a = await loadSharedAssessment(data.assessmentId);
    const p = await loadProgress(data.assessmentId, a.updated_at);
    const { organization_id: _o, ...pub } = a as any;
    return { assessment: pub, participants: p.participants, counts: p.counts, docVersion: p.docVersion };
  });

/** 담당자(로그인)가 공유 화면·공지에서 쓸 열람 링크 토큰 */
export const getViewToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => idSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: me } = await supabaseAdmin.from("users").select("organization_id").eq("auth_id", context.userId).maybeSingle();
    const { data: a } = await supabaseAdmin.from("assessments").select("organization_id").eq("id", data.assessmentId).maybeSingle();
    if (!me || !a || !me.organization_id || me.organization_id !== a.organization_id) throw new Error("권한이 없습니다.");
    return { token: await viewTokenFor(data.assessmentId) };
  });

const viewSchema = idSchema.extend({ k: z.string().min(8).max(64) });

/** 진행 현황 열람 화면 (입주자대표·본사 담당). 참여자·열람자 이름은 공개하지 않고 수만 센다. */
export const getViewInfo = createServerFn({ method: "POST" })
  .inputValidator((i) => viewSchema.parse(i))
  .handler(async ({ data }) => {
    await assertViewToken(data.assessmentId, data.k);
    const a = await loadSharedAssessment(data.assessmentId);
    const p = await loadProgress(data.assessmentId, a.updated_at);
    const { count: ackCount, error: ackErr } = await supabaseAdmin.from("assessment_acks").select("id", { count: "exact", head: true }).eq("assessment_id", data.assessmentId);
    if (ackErr && !/assessment_acks/.test(ackErr.message)) throw new Error(ackErr.message);
    const { organization_id: _o, ...pub } = a as any;
    return { assessment: pub, hazards: p.hazards, counts: p.counts, docVersion: p.docVersion, ackCount: ackCount ?? 0 };
  });

const ackSchema = viewSchema.extend({
  name: z.string().trim().min(1).max(100),
  role: z.string().trim().max(100).optional().nullable(),
  userAgent: z.string().max(500).optional().nullable(),
});

/** "확인했습니다" — 열람 증빙. 결재가 아니다. 같은 이름·직위가 24시간 안에 이미 있으면 다시 쓰지 않는다. */
export const submitViewAck = createServerFn({ method: "POST" })
  .inputValidator((i) => ackSchema.parse(i))
  .handler(async ({ data }) => {
    await assertViewToken(data.assessmentId, data.k);
    const a = await loadSharedAssessment(data.assessmentId);
    await assertOrgCanWrite((a as any).organization_id);
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { data: dup } = await supabaseAdmin.from("assessment_acks").select("id")
      .eq("assessment_id", data.assessmentId).eq("name", data.name).gte("acked_at", since).limit(1);
    if (dup && dup.length) return { ok: true, duplicate: true };
    const { count } = await supabaseAdmin.from("assessment_acks").select("id", { count: "exact", head: true }).eq("assessment_id", data.assessmentId);
    if ((count ?? 0) >= 200) throw new Error("열람 기록이 너무 많습니다. 관리사무소에 문의하세요.");
    const { error } = await supabaseAdmin.from("assessment_acks").insert({
      assessment_id: data.assessmentId, name: data.name, role: data.role ?? null, user_agent: data.userAgent ?? null,
    });
    if (error) throw error;
    return { ok: true, duplicate: false };
  });

const schema = z.object({
  assessmentId: z.string().uuid(),
  participantId: z.string().uuid().optional().nullable(),
  name: z.string().trim().min(1).max(100).optional().nullable(),
  signatureImage: z.string().min(20).max(2_000_000),
  userAgent: z.string().max(500).optional().nullable(),
  /** 서명자가 화면에서 본 문서 버전 — 그 사이 내용이 바뀌었으면 거부 */
  docVersion: z.string().optional().nullable(),
});

export const submitParticipantConfirmation = createServerFn({ method: "POST" })
  .inputValidator((i) => schema.parse(i))
  .handler(async ({ data }) => {
    const a = await loadSharedAssessment(data.assessmentId);
    await assertOrgCanWrite((a as any).organization_id);

    // 본 내용과 지금 내용이 다르면 서명을 받지 않는다 (무엇에 서명했는지가 분명해야 한다)
    const p = await loadProgress(data.assessmentId, a.updated_at);
    if (data.docVersion && p.docVersion && new Date(p.docVersion).getTime() > new Date(data.docVersion).getTime()) {
      throw new Error("확인하신 뒤 평가 내용이 수정되었습니다. 화면을 새로고침해 바뀐 내용을 다시 확인한 뒤 서명해 주세요.");
    }

    let participantId = data.participantId ?? null;
    if (participantId) {
      // 전달된 참석자가 이 평가 소속인지 검증(다른 평가의 participant_id를 붙이는 것 방지)
      const { data: owner } = await supabaseAdmin
        .from("participants")
        .select("id, confirmed")
        .eq("id", participantId)
        .eq("assessment_id", data.assessmentId)
        .maybeSingle();
      if (!owner) throw new Error("잘못된 참석자 정보입니다.");
      if (owner.confirmed || p.participants.find((x) => x.id === participantId)?.confirmed) throw new Error("이미 확인(서명)한 참여자입니다.");
    } else {
      if (!data.name) throw new Error("이름을 입력하세요.");
      // 같은 이름으로 이미 명단에 있으면 새로 만들지 않고 그 사람으로 처리 (이름 입력 경로로 참여자가 무한 생성되는 것 방지)
      const existing = p.participants.find((x) => String(x.name).replace(/\s+/g, "") === data.name!.replace(/\s+/g, ""));
      if (existing) {
        if (existing.confirmed) throw new Error("이미 확인(서명)한 참여자입니다.");
        participantId = existing.id;
      } else {
        if (p.participants.length >= 100) throw new Error("참여자가 너무 많습니다. 관리사무소에 문의하세요.");
        const { data: np, error } = await supabaseAdmin
          .from("participants")
          .insert({ assessment_id: data.assessmentId, name: data.name, participation_role: "근로자" })
          .select("id")
          .single();
        if (error) throw error;
        participantId = np.id;
      }
    }

    if (!participantId) throw new Error("참여자를 확인할 수 없습니다.");
    const { error: sErr } = await supabaseAdmin.from("signatures").insert({
      assessment_id: data.assessmentId,
      participant_id: participantId,
      signature_image: data.signatureImage,
      user_agent: data.userAgent ?? null,
    });
    if (sErr) throw sErr;
    // 서명이 저장되면 참여자 확인 상태도 함께 갱신한다 — 직원 홈의 "확인·서명할 평가" 목록이 이 값을 본다.
    const { error: cErr } = await supabaseAdmin
      .from("participants")
      .update({ confirmed: true, confirmed_at: new Date().toISOString() })
      .eq("id", participantId)
      .eq("assessment_id", data.assessmentId);
    if (cErr) throw cErr;
    return { ok: true };
  });
