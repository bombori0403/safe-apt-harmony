import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const schema = z.object({
  orgName: z.string().trim().min(1).max(200),
  repName: z.string().trim().min(1).max(100),
  email: z.string().email(),
});

export const notifyPendingSignup = createServerFn({ method: "POST" })
  .inputValidator((i) => schema.parse(i))
  .handler(async ({ data }) => {
    const apiKey = process.env.RESEND_API_KEY;
    const notifyTo = process.env.SIGNUP_NOTIFY_EMAIL;
    if (!apiKey || !notifyTo) return { ok: false };

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "onboarding@resend.dev",
        to: notifyTo,
        subject: `[가입 승인 대기] ${data.orgName}`,
        html: `<p>새 회사가 가입 승인을 기다리고 있습니다.</p>
<p>회사명: ${data.orgName}<br/>대표자: ${data.repName}<br/>이메일: ${data.email}</p>
<p>앱의 "가입 승인" 메뉴에서 확인해주세요.</p>`,
      }),
    }).catch(() => {});

    return { ok: true };
  });

const urgentSchema = z.object({
  orgId: z.string().uuid(),
  kind: z.string().trim().max(40),          // 예: 아차사고, 안전신고
  title: z.string().trim().max(200).optional().default(""),
  complexName: z.string().trim().max(200).optional().default(""),
  location: z.string().trim().max(200).optional().default(""),
  situation: z.string().trim().max(2000).optional().default(""),
  reporter: z.string().trim().max(100).optional().default(""),
});

// 긴급 안전신고(아차사고/직원참여 '긴급' 체크) 시 해당 조직의 관리자(관리소장)에게 즉시 이메일.
// 수신자는 서버에서 조직의 admin/manager 이메일로만 산출한다(임의 대상 발송 방지).
export const notifyUrgentReport = createServerFn({ method: "POST" })
  .inputValidator((i) => urgentSchema.parse(i))
  .handler(async ({ data }) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return { ok: false, sent: 0 };

    const { data: admins } = await supabaseAdmin
      .from("users")
      .select("email")
      .eq("organization_id", data.orgId)
      .in("org_role", ["admin", "manager"]);
    const to = [...new Set((admins ?? []).map((u: any) => u.email).filter(Boolean))];
    if (to.length === 0) return { ok: true, sent: 0 };

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "onboarding@resend.dev",
        to,
        subject: `[긴급 안전신고] ${data.complexName || ""} ${data.kind}`.trim(),
        html: `<p style="font-size:16px"><b>🚨 긴급 안전신고가 접수되었습니다.</b></p>
<p>구분: ${data.kind}<br/>
단지: ${data.complexName || "-"}<br/>
${data.title ? `제목: ${data.title}<br/>` : ""}
${data.location ? `위치: ${data.location}<br/>` : ""}
${data.reporter ? `신고자: ${data.reporter}<br/>` : ""}</p>
${data.situation ? `<p>내용:<br/>${data.situation.replace(/\n/g, "<br/>")}</p>` : ""}
<p>안전데스크 앱에서 즉시 확인하고 조치해 주세요.</p>`,
      }),
    }).catch(() => {});

    return { ok: true, sent: to.length };
  });

const activationSchema = z.object({
  orgName: z.string().trim().min(1).max(200),
  businessNumber: z.string().trim().max(50).optional().default(""),
  phone: z.string().trim().max(50).optional().default(""),
  repName: z.string().trim().max(100).optional().default(""),
});

// 14일 체험 종료 후 조직 관리자가 "정식 등록(활성화)"을 신청할 때 플랫폼 관리자에게 알림.
export const notifyActivationRequest = createServerFn({ method: "POST" })
  .inputValidator((i) => activationSchema.parse(i))
  .handler(async ({ data }) => {
    const apiKey = process.env.RESEND_API_KEY;
    const notifyTo = process.env.SIGNUP_NOTIFY_EMAIL;
    if (!apiKey || !notifyTo) return { ok: false };

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "onboarding@resend.dev",
        to: notifyTo,
        subject: `[정식 사용 신청] ${data.orgName}`,
        html: `<p>체험이 종료된 회사가 정식 사용(활성화)을 신청했습니다.</p>
<p>회사/단지명: ${data.orgName}<br/>사업자등록번호: ${data.businessNumber || "-"}<br/>담당자: ${data.repName || "-"}<br/>연락처: ${data.phone || "-"}</p>
<p>결제 확인 후 앱의 "가입 승인 · 활성화 요청" 메뉴에서 활성화해주세요.</p>`,
      }),
    }).catch(() => {});

    return { ok: true };
  });
