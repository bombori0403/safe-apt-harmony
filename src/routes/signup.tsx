import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({ component: Signup });

function Signup() {
  const [orgName, setOrgName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { signup_type: "org_admin", org_name: orgName, name },
        },
      });
      if (error) throw error;
      if (!data.session) {
        toast.success("가입 신청 완료! 이메일의 인증 링크를 확인해주세요.");
        window.location.href = "/";
        return;
      }
      toast.success("회사 등록 완료! 관리자 승인 후 이용하실 수 있습니다.");
      window.location.href = "/dashboard";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-gradient-to-br from-background to-accent/30">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-primary-foreground mb-3 shadow-lg shadow-primary/20">
            <Building2 className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">회사 대표 가입</h1>
          <p className="text-sm text-muted-foreground mt-1">새 조직을 만들고 관리자 권한으로 시작합니다</p>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-xl">회사 등록</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <Label>회사(조직)명</Label>
                <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} required maxLength={200} placeholder="(주)○○관리" />
              </div>
              <div>
                <Label>대표자 이름</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
              </div>
              <div>
                <Label>이메일</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div>
                <Label>비밀번호</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              </div>
              <Button type="submit" disabled={loading} className="w-full h-11">
                {loading ? "등록 중..." : "회사 등록 후 가입"}
              </Button>
            </form>
            <Link to="/" className="block text-center mt-4 text-sm text-primary hover:underline">로그인으로 돌아가기</Link>
          </CardContent>
        </Card>
        <p className="text-[11px] text-center text-muted-foreground mt-6">
          14일 무료 체험 · 좌석 5명 기본 제공
        </p>
      </div>
    </div>
  );
}
