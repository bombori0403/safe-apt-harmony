import { RELATED_APPS } from "@/lib/related-apps";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";

/**
 * "함께 쓰면 좋은 도구" — 관련 업무 앱 크로스링크. url 있는 항목만 노출.
 * 새 탭으로 열고 rel=noopener. 없으면 아무것도 렌더하지 않음.
 */
export function RelatedApps() {
  const apps = RELATED_APPS.filter((a) => a.url);
  if (apps.length === 0) return null;
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground">함께 쓰면 좋은 시설·안전 도구</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {apps.map((a) => (
          <a key={a.name} href={a.url} target="_blank" rel="noreferrer noopener" className="block">
            <Card className="hover:border-primary/50 transition-colors">
              <CardContent className="p-4 flex items-start gap-3">
                <div className="text-2xl leading-none shrink-0">{a.emoji}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-sm">{a.name}</span>
                    {a.tag && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{a.tag}</span>}
                    <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto shrink-0" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{a.desc}</p>
                </div>
              </CardContent>
            </Card>
          </a>
        ))}
      </div>
    </div>
  );
}
