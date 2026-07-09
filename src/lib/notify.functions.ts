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
