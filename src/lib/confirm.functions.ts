import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * 로그인 없이 열리는 두 화면의 서버 함수.
 *   /confirm/:id — 참여자 확인 서명 (직원)
 *   /view/:id    — 진행 현황 열람 + "확인했습니다" 기록 (입주자대표·본사 담당)
 * 평가 UUID 가 곧 링크이므로, 담당자가 assessments.share_enabled 로 언제든 끌 수 있다.
 */

const idSchema = z.object({ assessmentId: z.string().uuid() });

async function loadSharedAssessment(assessmentId: string) {
  const { data: a, error } = await supabaseAdmin
    .from("assessments")
    .select("id, work_name, assessment_date, method, status, allowable_level, updated_at, created_at, complex_id, share_enabled, location, assessment_type")
    .eq("id", assessmentId)
    .maybeSingle();
  if (error && /share_enabled/.test(error.message)) throw new Error("서버 업데이트(데이터베이스 SQL)가 아직 적용되지 않아 이 화면을 열 수 없습니다. 관리사무소에 알려 주세요.");
  if (error) throw new Error(error.message);
  if (!a) throw new Error("존재하지 않는 평가입니다.");
  if ((a as any).share_enabled === false) throw new Error("담당자가 이 평가의 공유 링크를 꺼 두었습니다. 관리사무소에 문의하세요.");
  const { data: cx } = await supabaseAdmin.from("complexes").select("name").eq("id", a.complex_id).maybeSingle();
  return { ...a, complex_name: cx?.name ?? "" };
}

async function loadProgress(assessmentId: string) {
  const [{ data: hazards }, { data: parts }, { data: sigs }] = await Promise.all([
    supabaseAdmin.from("hazards")
      .select("id, description, level, post_level, current_control, legal_basis_override, origin, hazard_library:library_item_id(legal_basis), measures(id, content, type, status, due_date, completed_at, responsible_name)")
      .eq("assessment_id", assessmentId).order("created_at"),
    supabaseAdmin.from("participants").select("id, name, role, confirmed").eq("assessment_id", assessmentId),
    supabaseAdmin.from("signatures").select("participant_id").eq("assessment_id", assessmentId),
  ]);
  const signed = new Set((sigs ?? []).map((s: any) => s.participant_id));
  const participants = (parts ?? []).map((p: any) => ({ id: p.id, name: p.name, role: p.role, confirmed: !!p.confirmed || signed.has(p.id) }));
  const hz = (hazards ?? []) as any[];
  const measures = hz.flatMap((h) => h.measures ?? []);
  return {
    hazards: hz.map((h) => ({
      id: h.id, description: h.description, level: h.level, post_level: h.post_level, current_control: h.current_control, origin: h.origin,
      legal_basis: h.legal_basis_override || h.hazard_library?.legal_basis || null,
      measures: (h.measures ?? []).map((m: any) => ({ id: m.id, content: m.content, type: m.type, status: m.status, due_date: m.due_date, completed_at: m.completed_at, responsible_name: m.responsible_name })),
    })),
    participants,
    counts: {
      hazards: hz.length,
      unrated: hz.filter((h) => !h.level).length,
      measures: measures.length,
      measuresNotDone: measures.filter((m: any) => m.status !== "완료").length,
      participants: participants.length,
      confirmed: participants.filter((p) => p.confirmed).length,
    },
  };
}

/** 참여 확인 화면: 무엇에 서명하는지 보여줄 요약 포함 */
export const getConfirmInfo = createServerFn({ method: "POST" })
  .inputValidator((i) => idSchema.parse(i))
  .handler(async ({ data }) => {
    const a = await loadSharedAssessment(data.assessmentId);
    const p = await loadProgress(data.assessmentId);
    return { assessment: a, participants: p.participants.map(({ id, name, role, confirmed }) => ({ id, name, role, confirmed })), counts: p.counts };
  });

/** 진행 현황 열람 화면 (입주자대표·본사 담당) */
export const getViewInfo = createServerFn({ method: "POST" })
  .inputValidator((i) => idSchema.parse(i))
  .handler(async ({ data }) => {
    const a = await loadSharedAssessment(data.assessmentId);
    const p = await loadProgress(data.assessmentId);
    const { data: acks } = await supabaseAdmin.from("assessment_acks").select("name, role, acked_at").eq("assessment_id", data.assessmentId).order("acked_at", { ascending: false }).limit(20);
    return { assessment: a, ...p, acks: acks ?? [] };
  });

const ackSchema = z.object({
  assessmentId: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  role: z.string().trim().max(100).optional().nullable(),
  userAgent: z.string().max(500).optional().nullable(),
});

/** "확인했습니다" — 열람 증빙. 결재가 아니다. */
export const submitViewAck = createServerFn({ method: "POST" })
  .inputValidator((i) => ackSchema.parse(i))
  .handler(async ({ data }) => {
    await loadSharedAssessment(data.assessmentId); // 존재·공유 여부 확인
    const { error } = await supabaseAdmin.from("assessment_acks").insert({
      assessment_id: data.assessmentId, name: data.name, role: data.role ?? null, user_agent: data.userAgent ?? null,
    });
    if (error) throw error;
    return { ok: true };
  });

const schema = z.object({
  assessmentId: z.string().uuid(),
  participantId: z.string().uuid().optional().nullable(),
  name: z.string().trim().min(1).max(100).optional().nullable(),
  signatureImage: z.string().min(20).max(2_000_000),
  userAgent: z.string().max(500).optional().nullable(),
});

export const submitParticipantConfirmation = createServerFn({ method: "POST" })
  .inputValidator((i) => schema.parse(i))
  .handler(async ({ data }) => {
    await loadSharedAssessment(data.assessmentId); // 존재·공유 여부 확인

    let participantId = data.participantId ?? null;
    if (participantId) {
      // 전달된 참석자가 이 평가 소속인지 검증(다른 평가의 participant_id를 붙이는 것 방지)
      const { data: owner } = await supabaseAdmin
        .from("participants")
        .select("id")
        .eq("id", participantId)
        .eq("assessment_id", data.assessmentId)
        .maybeSingle();
      if (!owner) throw new Error("잘못된 참석자 정보입니다.");
    } else {
      if (!data.name) throw new Error("이름을 입력하세요.");
      const { data: p, error } = await supabaseAdmin
        .from("participants")
        .insert({
          assessment_id: data.assessmentId,
          name: data.name,
          participation_role: "근로자",
        })
        .select("id")
        .single();
      if (error) throw error;
      participantId = p.id;
    }

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
