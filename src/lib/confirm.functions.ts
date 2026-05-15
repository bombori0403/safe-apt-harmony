import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
    const { data: a } = await supabaseAdmin
      .from("assessments")
      .select("id")
      .eq("id", data.assessmentId)
      .maybeSingle();
    if (!a) throw new Error("존재하지 않는 평가입니다.");

    let participantId = data.participantId ?? null;
    if (!participantId) {
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
    return { ok: true };
  });
