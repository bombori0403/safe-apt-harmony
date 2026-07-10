// Keyword-based legal-basis suggestion for freely-typed hazards (no cost,
// no external API). Mirrors the same rules used to seed hazard_library,
// so custom entries get a best-effort match instead of nothing.
// Always a suggestion to review, not an authoritative citation.

interface Rule {
  keywords: string[];
  article_no: string;
  legal_basis: string;
}

const RULES: Rule[] = [
  { keywords: ["보호구", "미착용", "안전대", "안전모"], article_no: "제34조", legal_basis: "산업안전보건기준에 관한 규칙 제34조(전용보호구 등)" },
  { keywords: ["감전", "누전", "활선", "차단기", "절연", "정전"], article_no: "제302조", legal_basis: "산업안전보건기준에 관한 규칙 제302조(전기 기계·기구 등의 접지)" },
  { keywords: ["화재", "폭발", "가스", "유류", "화상", "배관 파손"], article_no: "제232조", legal_basis: "산업안전보건기준에 관한 규칙 제232조(폭발 또는 화재 등의 예방)" },
  { keywords: ["낙하", "와이어로프", "비산물", "파손에 의한 충돌"], article_no: "제14조", legal_basis: "산업안전보건기준에 관한 규칙 제14조(낙하물에 의한 위험의 방지)" },
  { keywords: ["난간"], article_no: "제13조", legal_basis: "산업안전보건기준에 관한 규칙 제13조(안전난간의 구조 및 설치요건)" },
  { keywords: ["개구부"], article_no: "제43조", legal_basis: "산업안전보건기준에 관한 규칙 제43조(개구부 등의 방호 조치)" },
  { keywords: ["사다리식 통로", "고정사다리"], article_no: "제24조", legal_basis: "산업안전보건기준에 관한 규칙 제24조(사다리식 통로 등의 구조)" },
  { keywords: ["출입금지", "출입 통제", "출입제한"], article_no: "제20조", legal_basis: "산업안전보건기준에 관한 규칙 제20조(출입의 금지 등)" },
  { keywords: ["단차", "차량계", "지게차"], article_no: "제199조", legal_basis: "산업안전보건기준에 관한 규칙 제199조(전도 등의 방지)" },
  { keywords: ["전도", "미끄럼", "미끄러", "슬립", "빙판", "넘어짐"], article_no: "제3조", legal_basis: "산업안전보건기준에 관한 규칙 제3조(전도의 방지)" },
  { keywords: ["위생 불량", "청결"], article_no: "제4조", legal_basis: "산업안전보건기준에 관한 규칙 제4조(작업장의 청결)" },
  { keywords: ["조명 불량", "통로", "대피통로"], article_no: "제21조", legal_basis: "산업안전보건기준에 관한 규칙 제21조(통로의 설치)" },
  { keywords: ["계단"], article_no: "제22조", legal_basis: "산업안전보건기준에 관한 규칙 제22조(계단의 강도)" },
  { keywords: ["연마", "그라인더", "분진", "후드", "국소배기"], article_no: "제72조", legal_basis: "산업안전보건기준에 관한 규칙 제72조(후드)" },
  { keywords: ["밀폐공간", "호흡기", "질식", "흡입"], article_no: "제617조", legal_basis: "산업안전보건기준에 관한 규칙 제617조(호흡용 보호구의 지급 등)" },
  { keywords: ["매연", "일산화탄소", "산소결핍", "유해가스"], article_no: "제79조", legal_basis: "산업안전보건기준에 관한 규칙 제79조(신체 등의 안전 보호)" },
  { keywords: ["약품", "농약", "화학물질", "누출", "유출"], article_no: "제395조", legal_basis: "산업안전보건기준에 관한 규칙 제395조(누출ㆍ유출 등에 대비한 조치)" },
  { keywords: ["근골격계"], article_no: "제657조", legal_basis: "산업안전보건기준에 관한 규칙 제657조(유해요인 조사)" },
  { keywords: ["협착", "회전체", "회전축", "끼임"], article_no: "제87조", legal_basis: "산업안전보건기준에 관한 규칙 제87조(원동기·회전축 등의 위험 방지)" },
  { keywords: ["추락", "사다리", "고소작업", "강풍"], article_no: "제42조", legal_basis: "산업안전보건기준에 관한 규칙 제42조(추락의 방지)" },
  { keywords: ["폭언", "폭행", "고객", "입주민"], article_no: "법 제41조", legal_basis: "산업안전보건법 제41조(고객의 폭언 등으로 인한 건강장해 예방조치 등)" },
  { keywords: ["안전교육 미이수", "교육 미이수"], article_no: "법 제29조", legal_basis: "산업안전보건법 제29조(근로자에 대한 안전보건교육)" },
];

export function suggestLegalBasis(description: string): { article_no: string; legal_basis: string } | null {
  const text = description.trim();
  if (!text) return null;
  for (const rule of RULES) {
    if (rule.keywords.some((k) => text.includes(k))) {
      return { article_no: rule.article_no, legal_basis: rule.legal_basis };
    }
  }
  return null;
}
