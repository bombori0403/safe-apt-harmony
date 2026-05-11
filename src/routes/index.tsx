import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [position, setPosition] = useState("관리사무소장");
  const [affiliation, setAffiliation] = useState("위탁관리");
  const [orgName, setOrgName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.href = "/dashboard";
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { name, position, affiliation, org_name: orgName, phone },
          },
        });
        if (error) throw error;
        toast.success("가입 완료! 자동 로그인됩니다.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
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
            <Shield className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">안전관리소</h1>
          <p className="text-sm text-muted-foreground mt-1">
            공동주택 위험성평가 통합 관리 플랫폼
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{mode === "login" ? "로그인" : "회원가입"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-3">
              {mode === "signup" && (
                <>
                  <div>
                    <Label htmlFor="name">이름</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                  <div>
                    <Label htmlFor="pos">직책</Label>
                    <select
                      id="pos"
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                      className="w-full h-10 px-3 rounded-md border bg-background text-sm"
                    >
                      <option>관리사무소장</option>
                      <option>안전보건관리책임자</option>
                      <option>관리감독자</option>
                      <option>안전관리자</option>
                      <option>보건관리자</option>
                      <option>본사_안전담당</option>
                      <option>기타</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="aff">소속 구분</Label>
                    <select
                      id="aff"
                      value={affiliation}
                      onChange={(e) => setAffiliation(e.target.value)}
                      className="w-full h-10 px-3 rounded-md border bg-background text-sm"
                    >
                      <option value="자가관리">자가관리 단지</option>
                      <option value="위탁관리">위탁관리 단지</option>
                      <option value="본사">위탁관리회사 본사</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="org">단지명 또는 회사명</Label>
                    <Input id="org" value={orgName} onChange={(e) => setOrgName(e.target.value)} required />
                  </div>
                  <div>
                    <Label htmlFor="phone">연락처</Label>
                    <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                </>
              )}
              <div>
                <Label htmlFor="email">이메일</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="pw">비밀번호</Label>
                <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              </div>
              <Button type="submit" disabled={loading} className="w-full h-11 text-base">
                {loading ? "처리 중..." : mode === "login" ? "로그인" : "가입하기"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled
                className="w-full"
                title="기능 준비 중"
              >
                카카오로 시작하기 (준비 중)
              </Button>
            </form>

            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="w-full mt-4 text-sm text-primary hover:underline"
            >
              {mode === "login" ? "계정이 없으신가요? 회원가입" : "이미 가입하셨나요? 로그인"}
            </button>
          </CardContent>
        </Card>

        <p className="text-[11px] text-center text-muted-foreground mt-6 leading-relaxed">
          본 서비스는 산업안전보건법 제36조, 고용노동부 고시 제2024-76호,<br />
          공동주택관리법 제32조에 근거한 위험성평가 절차를 지원합니다.
        </p>
      </div>
    </div>
  );
}

// Keep server-safe redirect for already-authed (optional, not strictly needed)
void redirect;
