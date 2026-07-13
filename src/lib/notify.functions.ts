import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
