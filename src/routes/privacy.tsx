import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/privacy")({ component: Privacy });

function Privacy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="max-w-3xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/logo-mark.png" alt="안전데스크" className="w-8 h-8 rounded-lg object-cover" />
            <span className="font-semibold tracking-tight">안전데스크</span>
          </Link>
          <Link to="/"><Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" />홈</Button></Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-12 prose-sm">
        <h1 className="text-2xl font-bold tracking-tight">개인정보처리방침</h1>
        <p className="text-sm text-muted-foreground mt-2">
          안전데스크(이하 "회사")는 「개인정보 보호법」 등 관련 법령을 준수하며, 이용자의 개인정보를
          다음과 같이 처리합니다.
        </p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed">
          <Section n="1" title="수집하는 개인정보 항목">
            <ul className="list-disc pl-5 space-y-1">
              <li><b>회원가입·계정</b>: 이메일, 비밀번호(암호화 저장), 단지·회사명</li>
              <li><b>정식 등록 시</b>: 사업자등록번호, 담당자 성명, 연락처</li>
              <li><b>서비스 이용 중 입력</b>: 위험성평가 참여자 성명·직책·서명, 관리소장/담당자 성명·연락처,
                아차사고·작업중지·현장 사진 등 안전관리 기록</li>
              <li><b>자동 수집</b>: 접속 로그, 브라우저·기기 정보(서비스 운영·보안 목적)</li>
            </ul>
          </Section>

          <Section n="2" title="개인정보의 수집·이용 목적">
            <ul className="list-disc pl-5 space-y-1">
              <li>회원 식별 및 서비스 제공·운영</li>
              <li>산업안전보건법령상 위험성평가의 작성·기록·보존 지원</li>
              <li>고객 문의 응대 및 공지</li>
            </ul>
          </Section>

          <Section n="3" title="보유 및 이용 기간">
            <p>
              회원 탈퇴 또는 이용계약 종료 시 지체 없이 파기합니다. 다만 위험성평가 기록 등 관계 법령
              (산업안전보건법 시행규칙 제37조 등)에 따라 일정 기간 보존이 필요한 정보는 해당 법정 기간 동안
              보관 후 파기합니다.
            </p>
          </Section>

          <Section n="4" title="개인정보 처리의 위탁">
            <p>서비스 제공을 위해 다음 업체에 개인정보 처리를 위탁하며, 계약을 통해 안전한 관리를 요구합니다.</p>
            <ul className="list-disc pl-5 space-y-1 mt-1">
              <li><b>Supabase</b> — 데이터베이스 및 파일(사진) 저장</li>
              <li><b>Cloudflare</b> — 애플리케이션 호스팅</li>
              <li><b>Resend</b> — 이메일 발송</li>
            </ul>
            <p className="text-xs text-muted-foreground mt-1">
              ※ 위 업체의 서버가 국외에 위치할 수 있으며, 이 경우 개인정보가 국외로 이전될 수 있습니다.
            </p>
          </Section>

          <Section n="5" title="제3자 제공">
            <p>회사는 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만 법령에 근거가 있거나 이용자의
              동의가 있는 경우는 예외로 합니다.</p>
          </Section>

          <Section n="6" title="이용자의 권리">
            <p>이용자는 언제든지 자신의 개인정보에 대한 열람·정정·삭제·처리정지를 요청할 수 있으며,
              앱 내 설정 또는 아래 연락처를 통해 요청할 수 있습니다.</p>
          </Section>

          <Section n="7" title="개인정보의 안전성 확보 조치">
            <ul className="list-disc pl-5 space-y-1">
              <li>비밀번호 단방향 암호화 저장</li>
              <li>조직 단위 접근통제(Row-Level Security)로 다른 조직의 데이터 접근 차단</li>
              <li>사진 등 첨부파일 비공개 저장소 + 시간제한 서명 URL 접근</li>
              <li>전 구간 HTTPS 암호화 통신</li>
            </ul>
          </Section>

          <Section n="8" title="개인정보 보호책임자 · 문의">
            <p>개인정보 처리에 관한 문의는 아래로 연락해 주세요.</p>
            <p className="mt-1">이메일: <b>get0412@gmail.com</b></p>
          </Section>

          <Section n="9" title="고지의 의무">
            <p>본 방침의 내용 추가·삭제·수정이 있을 경우 시행 전 서비스 내 공지를 통해 안내합니다.</p>
            <p className="text-xs text-muted-foreground mt-2">시행일: 2026-07-23</p>
          </Section>
        </div>

        <p className="mt-10 text-xs text-muted-foreground border-t border-border/60 pt-4">
          ※ 본 문서는 표준 양식을 바탕으로 작성되었습니다. 실제 사업 형태·수집 항목에 맞게
          검토·보완하여 사용하시기 바랍니다.
        </p>
      </main>
    </div>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-bold text-[15px] mb-2">제{n}조 · {title}</h2>
      <div className="text-muted-foreground">{children}</div>
    </section>
  );
}
