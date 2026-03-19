import { useState, useEffect, useRef } from "react";

const fontLink = document.createElement("link");
fontLink.href = "https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700;800;900&display=swap";
fontLink.rel = "stylesheet";
document.head.appendChild(fontLink);

const STORAGE_KEY = "pawcare-landing";

export default function LandingPage() {
  const [submitted, setSubmitted] = useState(false);
  const [feedbacks, setFeedbacks] = useState([]);
  const [form, setForm] = useState({ shopName: "", name: "", phone: "", needs: [] });
  const [fbForm, setFbForm] = useState({ text: "", type: "feature" });
  const [showFb, setShowFb] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [visibleSections, setVisibleSections] = useState({});
  const containerRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get(STORAGE_KEY);
        if (r?.value) {
          const d = JSON.parse(r.value);
          if (d.feedbacks) setFeedbacks(d.feedbacks);
          if (d.submitted) setSubmitted(d.submitted);
        }
      } catch (e) {}
    })();
  }, []);

  const saveLanding = async (data) => {
    try { await window.storage.set(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleScroll = () => {
      setScrollY(el.scrollTop);
      const sections = el.querySelectorAll("[data-section]");
      const newVisible = {};
      sections.forEach(s => {
        const rect = s.getBoundingClientRect();
        const containerRect = el.getBoundingClientRect();
        if (rect.top < containerRect.bottom - 80) {
          newVisible[s.dataset.section] = true;
        }
      });
      setVisibleSections(prev => ({ ...prev, ...newVisible }));
    };
    el.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  const submitForm = () => {
    setSubmitted(true);
    saveLanding({ submitted: true, feedbacks, formData: form });
  };

  const submitFeedback = () => {
    if (!fbForm.text.trim()) return;
    const newFb = [...feedbacks, { ...fbForm, id: Date.now(), date: new Date().toISOString().split("T")[0] }];
    setFeedbacks(newFb);
    setFbForm({ text: "", type: "feature" });
    saveLanding({ submitted, feedbacks: newFb });
  };

  const toggleNeed = (n) => {
    setForm(f => ({
      ...f,
      needs: f.needs.includes(n) ? f.needs.filter(x => x !== n) : [...f.needs, n]
    }));
  };

  const vis = (id) => visibleSections[id] ? "vis" : "";

  return (
    <>
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; }
        :root {
          --bg: #FAF8F6; --s: #FFFFFF; --t: #2A2623; --t2: #847B72; --t3: #B0A89F;
          --a: #C96B4F; --al: #FCEEE9; --ad: #A8533A; --g: #4E9462; --gl: #EAF5ED;
          --y: #B89A3E; --yl: #F9F4E0; --f: 'Noto Sans KR', system-ui, sans-serif;
        }
        html, body { font-family: var(--f); background: var(--bg); color: var(--t); overflow: hidden; }
        .landing { max-width: 430px; margin: 0 auto; height: 100dvh; overflow-y: auto; overflow-x: hidden; scroll-behavior: smooth; background: var(--bg); }
        .landing::-webkit-scrollbar { display: none; }

        /* Hero */
        .hero { background: var(--t); color: white; padding: 48px 24px 40px; position: relative; overflow: hidden; }
        .hero::after { content:''; position:absolute; bottom:-1px; left:0; right:0; height:40px; background:var(--bg); border-radius:24px 24px 0 0; }
        .hero-badge { display:inline-block; padding:4px 12px; background:rgba(201,107,79,0.25); border:1px solid rgba(201,107,79,0.4); border-radius:20px; font-size:11px; font-weight:600; color:#E8A08E; margin-bottom:16px; }
        .hero h1 { font-size:32px; font-weight:900; line-height:1.25; margin-bottom:12px; letter-spacing:-0.5px; }
        .hero h1 em { font-style:normal; color:var(--a); }
        .hero p { font-size:14px; color:#B0A89F; line-height:1.6; margin-bottom:24px; }
        .hero-cta { display:block; width:100%; padding:16px; background:var(--a); color:white; border:none; border-radius:12px; font-size:15px; font-weight:700; font-family:var(--f); cursor:pointer; transition:.2s; text-align:center; }
        .hero-cta:active { background:var(--ad); transform:scale(.98); }
        .hero-sub { text-align:center; font-size:11px; color:#847B72; margin-top:10px; }

        /* Sections */
        .sec { padding: 32px 20px; }
        .sec-tag { font-size:10px; font-weight:800; letter-spacing:2px; text-transform:uppercase; color:var(--a); margin-bottom:8px; }
        .sec h2 { font-size:22px; font-weight:800; line-height:1.3; margin-bottom:6px; letter-spacing:-0.3px; }
        .sec h2 em { font-style:normal; color:var(--a); }
        .sec .sub { font-size:13px; color:var(--t2); margin-bottom:20px; line-height:1.5; }

        /* Animate in */
        [data-section] { opacity:0; transform:translateY(24px); transition: opacity 0.5s ease, transform 0.5s ease; }
        [data-section].vis { opacity:1; transform:translateY(0); }

        /* Problem cards */
        .prob-card { background:var(--s); border-radius:14px; padding:18px; margin-bottom:12px; box-shadow:0 2px 8px rgba(42,38,35,0.06); border:1px solid #EDE9E4; }
        .prob-card .emoji { font-size:24px; margin-bottom:8px; display:block; }
        .prob-card h3 { font-size:15px; font-weight:700; margin-bottom:4px; }
        .prob-card p { font-size:12px; color:var(--t2); line-height:1.5; }

        /* Solution grid */
        .sol-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
        .sol-card { background:var(--s); border-radius:12px; padding:16px 14px; box-shadow:0 2px 8px rgba(42,38,35,0.06); border:1px solid #EDE9E4; text-align:center; }
        .sol-card .ico { font-size:28px; margin-bottom:8px; display:block; }
        .sol-card h4 { font-size:13px; font-weight:700; margin-bottom:4px; }
        .sol-card p { font-size:10px; color:var(--t2); line-height:1.4; }

        /* Status flow */
        .flow { background:var(--s); border-radius:14px; padding:20px; box-shadow:0 2px 8px rgba(42,38,35,0.06); }
        .flow-row { display:flex; align-items:center; gap:10px; padding:10px 0; }
        .flow-dot { width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:14px; flex-shrink:0; }
        .flow-line { width:2px; height:12px; background:#E0DCD7; margin-left:15px; }
        .flow-info { flex:1; }
        .flow-info h4 { font-size:12px; font-weight:700; }
        .flow-info p { font-size:10px; color:var(--t2); }
        .flow-tag { font-size:9px; font-weight:700; padding:3px 8px; border-radius:10px; }

        /* Benefits */
        .ben { display:flex; gap:12px; padding:14px 0; border-bottom:1px solid #EDE9E4; }
        .ben:last-child { border-bottom:none; }
        .ben-num { font-size:28px; font-weight:900; color:var(--a); opacity:0.3; width:36px; flex-shrink:0; }
        .ben h4 { font-size:14px; font-weight:700; margin-bottom:3px; }
        .ben p { font-size:11px; color:var(--t2); line-height:1.5; }

        /* Pricing */
        .price-card { background:var(--s); border-radius:14px; padding:24px 20px; box-shadow:0 2px 8px rgba(42,38,35,0.06); border:2px solid var(--a); margin-bottom:12px; text-align:center; }
        .price-card .tag { display:inline-block; padding:3px 10px; background:var(--al); color:var(--ad); border-radius:10px; font-size:10px; font-weight:700; margin-bottom:10px; }
        .price-card .amount { font-size:36px; font-weight:900; color:var(--a); }
        .price-card .period { font-size:12px; color:var(--t2); margin-bottom:12px; }
        .price-card ul { list-style:none; text-align:left; }
        .price-card li { font-size:12px; padding:5px 0; color:var(--t2); }
        .price-card li::before { content:'✓ '; color:var(--g); font-weight:700; }

        /* CTA form */
        .form-card { background:var(--s); border-radius:14px; padding:24px 20px; box-shadow:0 4px 16px rgba(42,38,35,0.1); }
        .form-card h3 { font-size:17px; font-weight:800; margin-bottom:4px; text-align:center; }
        .form-card .fsub { font-size:11px; color:var(--t2); text-align:center; margin-bottom:16px; }
        .fg { margin-bottom:12px; }
        .fg label { display:block; font-size:11px; font-weight:700; color:var(--t2); margin-bottom:4px; }
        .fg input { width:100%; padding:11px 12px; border:1px solid #E0DCD7; border-radius:8px; font-size:14px; font-family:var(--f); background:var(--bg); }
        .fg input:focus { outline:none; border-color:var(--a); box-shadow:0 0 0 3px var(--al); }
        .needs-grid { display:flex; flex-wrap:wrap; gap:6px; }
        .need-chip { padding:8px 12px; border:1.5px solid #E0DCD7; border-radius:20px; font-size:11px; font-weight:600; cursor:pointer; transition:.15s; font-family:var(--f); background:var(--s); color:var(--t2); }
        .need-chip.sel { border-color:var(--a); background:var(--al); color:var(--ad); }
        .submit-btn { display:block; width:100%; padding:14px; background:var(--a); color:white; border:none; border-radius:10px; font-size:15px; font-weight:700; font-family:var(--f); cursor:pointer; margin-top:16px; transition:.2s; }
        .submit-btn:active { background:var(--ad); transform:scale(.98); }
        .submit-btn:disabled { opacity:0.4; }

        /* Success */
        .success { text-align:center; padding:40px 20px; }
        .success .check { font-size:48px; margin-bottom:16px; }
        .success h3 { font-size:20px; font-weight:800; margin-bottom:8px; }
        .success p { font-size:13px; color:var(--t2); line-height:1.6; }

        /* Feedback section */
        .fb-card { background:var(--s); border-radius:14px; padding:20px; margin:0 20px 12px; box-shadow:0 2px 8px rgba(42,38,35,0.06); }
        .fb-card h3 { font-size:14px; font-weight:700; margin-bottom:10px; }
        .fb-type { display:flex; gap:6px; margin-bottom:10px; }
        .fb-type button { padding:6px 12px; border:1.5px solid #E0DCD7; border-radius:16px; font-size:11px; font-weight:600; background:var(--s); color:var(--t2); cursor:pointer; font-family:var(--f); transition:.15s; }
        .fb-type button.sel { border-color:var(--a); background:var(--al); color:var(--ad); }
        .fb-textarea { width:100%; padding:10px 12px; border:1px solid #E0DCD7; border-radius:8px; font-size:13px; font-family:var(--f); min-height:60px; resize:vertical; background:var(--bg); }
        .fb-textarea:focus { outline:none; border-color:var(--a); box-shadow:0 0 0 3px var(--al); }
        .fb-submit { padding:10px 20px; background:var(--a); color:white; border:none; border-radius:8px; font-size:12px; font-weight:700; font-family:var(--f); cursor:pointer; margin-top:8px; }
        .fb-item { padding:10px 0; border-bottom:1px solid #EDE9E4; }
        .fb-item:last-child { border-bottom:none; }
        .fb-item .fb-tag { display:inline-block; padding:2px 6px; border-radius:4px; font-size:9px; font-weight:700; margin-right:6px; }
        .fb-item p { font-size:11px; color:var(--t); margin-top:3px; }
        .fb-item .fb-date { font-size:9px; color:var(--t3); }

        /* Floating feedback button */
        .fab { position:fixed; bottom:20px; right:calc(50% - 195px); width:48px; height:48px; border-radius:50%; background:var(--a); color:white; border:none; font-size:20px; cursor:pointer; box-shadow:0 4px 16px rgba(201,107,79,0.4); z-index:50; transition:.2s; display:flex; align-items:center; justify-content:center; }
        .fab:active { transform:scale(.9); }
        @media(max-width:430px) { .fab { right:20px; } }

        /* Footer */
        .footer { padding:24px 20px; text-align:center; font-size:10px; color:var(--t3); line-height:1.6; border-top:1px solid #EDE9E4; margin-top:20px; }
      `}</style>

      <div className="landing" ref={containerRef}>
        {/* ═══ HERO ═══ */}
        <section className="hero">
          <div className="hero-badge">🐾 애견미용샵 전용 관리 서비스</div>
          <h1>
            전화, 카톡, 네이버 예약<br/>
            <em>한 화면</em>에서 끝.
          </h1>
          <p>
            예약 받고, 고객 관리하고, 미용 끝나면 알림 보내고.<br/>
            사장님은 버튼 2번이면 충분합니다.
          </p>
          <button className="hero-cta" onClick={() => {
            const el = containerRef.current?.querySelector("#cta-form");
            el?.scrollIntoView({ behavior: "smooth" });
          }}>
            무료로 시작하기
          </button>
          <div className="hero-sub">설치비 없음 · 1개월 무료 · 언제든 해지</div>
        </section>

        {/* ═══ PROBLEM ═══ */}
        <section className="sec" data-section="prob" className={`sec ${vis("prob")}`} data-section="prob">
          <div className="sec-tag">PROBLEM</div>
          <h2>사장님, 이런 적 <em>없으세요?</em></h2>
          <div className="sub">혹시 하나라도 해당되시면, PawCare가 도와드릴 수 있어요.</div>

          {[
            { emoji: "📱", title: "카톡 예약 지옥", desc: "전화, 문자, 카톡, 네이버, 인스타 DM... 채널이 너무 많아서 예약이 꼬이고, 미용 중에도 계속 답장해야 해요." },
            { emoji: "📝", title: "수첩에 적고, 기억에 의존하고", desc: "단골 주기를 놓쳐서 매출이 빠지고, 강아지 특이사항을 까먹어서 실수하고..." },
            { emoji: "📞", title: "\"언제 끝나요?\" 반복 전화", desc: "미용하는데 계속 전화 오고, \"거의 다 됐어요\" 매번 같은 대답..." },
            { emoji: "😰", title: "노쇼인데 연락이 안 돼요", desc: "예약 확인도 안 했는데 안 오고, 빈 시간이 생겨도 대응할 방법이 없어요." },
          ].map((p, i) => (
            <div key={i} className="prob-card" style={{ animationDelay: `${i * 0.1}s` }}>
              <span className="emoji">{p.emoji}</span>
              <h3>{p.title}</h3>
              <p>{p.desc}</p>
            </div>
          ))}
        </section>

        {/* ═══ SOLUTION ═══ */}
        <section data-section="sol" className={`sec ${vis("sol")}`} style={{ background: "var(--t)", color: "white", borderRadius: "24px", margin: "0 12px", padding: "28px 18px" }}>
          <div className="sec-tag" style={{ color: "#E8A08E" }}>SOLUTION</div>
          <h2 style={{ color: "white" }}>PawCare <em>하나</em>면 됩니다</h2>
          <div className="sub" style={{ color: "#B0A89F" }}>복잡한 거 없어요. 폰 하나로 전부 관리.</div>

          <div className="sol-grid">
            {[
              { ico: "📅", title: "예약 통합", desc: "한 캘린더에서\n충돌 자동 방지" },
              { ico: "👥", title: "고객 관리", desc: "보호자·반려견\n정보 자동 축적" },
              { ico: "🔔", title: "재방문 알림", desc: "미용 주기 자동 계산\n알림톡 발송" },
              { ico: "✅", title: "완료 알림", desc: "버튼 한 번이면\n픽업 알림 발송" },
              { ico: "📱", title: "고객 예약페이지", desc: "앱 설치 없이\n링크로 예약" },
              { ico: "✂️", title: "미용 기록", desc: "스타일·메모\n자동 누적" },
            ].map((s, i) => (
              <div key={i} className="sol-card">
                <span className="ico">{s.ico}</span>
                <h4>{s.title}</h4>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ═══ STATUS AUTOMATION ═══ */}
        <section data-section="flow" className={`sec ${vis("flow")}`}>
          <div className="sec-tag">자동화</div>
          <h2>사장님은 <em>2번만</em> 누르세요</h2>
          <div className="sub">나머지는 PawCare가 알아서 합니다.</div>

          <div className="flow">
            {[
              { ico: "✅", label: "예약 확정", desc: "사장님 승인 시 자동 알림", tag: "사장 버튼", tagBg: "#FCEEE9", tagColor: "#C96B4F" },
              { ico: "🔔", label: "전날 리마인더", desc: "전날 오후 6시 자동 발송", tag: "자동", tagBg: "#F9F4E0", tagColor: "#B89A3E" },
              { ico: "🎨", label: "미용 시작", desc: "시작 버튼 → 고객에게 안내", tag: "사장 버튼", tagBg: "#FCEEE9", tagColor: "#C96B4F" },
              { ico: "💇", label: "거의 완료", desc: "소요시간 80% 경과 시 자동", tag: "자동", tagBg: "#F9F4E0", tagColor: "#B89A3E" },
              { ico: "🎀", label: "픽업 가능!", desc: "완료 버튼 → 픽업 알림 발송", tag: "사장 버튼", tagBg: "#EAF5ED", tagColor: "#4E9462" },
            ].map((f, i) => (
              <div key={i}>
                <div className="flow-row">
                  <div className="flow-dot" style={{ background: i === 4 ? "var(--gl)" : "var(--al)" }}>{f.ico}</div>
                  <div className="flow-info"><h4>{f.label}</h4><p>{f.desc}</p></div>
                  <span className="flow-tag" style={{ background: f.tagBg, color: f.tagColor }}>{f.tag}</span>
                </div>
                {i < 4 && <div className="flow-line" />}
              </div>
            ))}
          </div>
        </section>

        {/* ═══ BENEFITS ═══ */}
        <section data-section="ben" className={`sec ${vis("ben")}`}>
          <div className="sec-tag">BENEFITS</div>
          <h2>사장님이 <em>얻는 것</em></h2>
          <div className="sub">시간, 매출, 마음의 여유.</div>

          {[
            { title: "카톡 응대 60% 감소", desc: "고객이 직접 예약/취소/변경하니까 사장님이 일일이 답장 안 해도 됩니다." },
            { title: "단골 재방문 자동 관리", desc: "미용 주기 지나면 알아서 알림톡 발송. 사장님이 챙기지 않아도 단골이 돌아옵니다." },
            { title: "\"언제 끝나요?\" 전화 제로", desc: "미용 시작/거의 완료/픽업 가능 알림이 자동으로 가니까 전화가 안 옵니다." },
            { title: "예약 충돌 자동 방지", desc: "서비스별 소요시간 기반으로 겹치는 예약을 차단. 더블부킹 걱정 끝." },
            { title: "강아지별 미용 기록 축적", desc: "\"지난번처럼 해주세요\" 하면 바로 확인. 특이사항도 자동으로 떠요." },
          ].map((b, i) => (
            <div key={i} className="ben">
              <div className="ben-num">{String(i + 1).padStart(2, "0")}</div>
              <div><h4>{b.title}</h4><p>{b.desc}</p></div>
            </div>
          ))}
        </section>

        {/* ═══ CUSTOMER SIDE ═══ */}
        <section data-section="cust" className={`sec ${vis("cust")}`} style={{ background: "white", margin: "0 12px", borderRadius: "24px", padding: "28px 18px" }}>
          <div className="sec-tag">FOR CUSTOMERS</div>
          <h2>손님도 <em>편해집니다</em></h2>
          <div className="sub">앱 설치 없이, 카카오톡 링크 하나로.</div>

          {[
            { emoji: "📱", title: "링크 터치 → 바로 예약", desc: "서비스 고르고, 날짜 고르고, 시간 고르면 끝" },
            { emoji: "🔔", title: "미용 상태 실시간 알림", desc: "\"미용 시작됐어요\" → \"거의 끝나요\" → \"픽업 가능!\"" },
            { emoji: "🔄", title: "\"지난번처럼\" 원터치 재예약", desc: "이전 서비스+스타일 그대로, 날짜만 골라서 예약" },
            { emoji: "📅", title: "직접 취소·변경", desc: "전화 없이 직접 날짜/시간 바꾸기 가능" },
          ].map((c, i) => (
            <div key={i} style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: i < 3 ? "1px solid #EDE9E4" : "none" }}>
              <span style={{ fontSize: 24, flexShrink: 0 }}>{c.emoji}</span>
              <div><div style={{ fontSize: 13, fontWeight: 700 }}>{c.title}</div><div style={{ fontSize: 11, color: "var(--t2)", marginTop: 2, lineHeight: 1.4 }}>{c.desc}</div></div>
            </div>
          ))}
        </section>

        {/* ═══ PRICING ═══ */}
        <section data-section="price" className={`sec ${vis("price")}`}>
          <div className="sec-tag">PRICING</div>
          <h2>부담 없이 <em>시작</em>하세요</h2>
          <div className="sub">마음에 안 들면 바로 해지. 위약금 없음.</div>

          <div className="price-card">
            <div className="tag">🎁 지금 가입하면</div>
            <div className="amount">무료</div>
            <div className="period">첫 1개월 · 모든 기능 제한 없음</div>
            <ul>
              <li>예약 통합 관리</li>
              <li>고객·반려견 관리</li>
              <li>재방문 자동 알림</li>
              <li>미용 완료 알림</li>
              <li>고객 예약 페이지</li>
              <li>카카오 알림톡 연동</li>
            </ul>
          </div>

          <div style={{ textAlign: "center", fontSize: 11, color: "var(--t3)", lineHeight: 1.6 }}>
            이후 월 29,900원~ (확정 전)<br />
            초기 가입 매장 추가 혜택 제공
          </div>
        </section>

        {/* ═══ CTA FORM ═══ */}
        <section className="sec" id="cta-form" data-section="cta" className={`sec ${vis("cta")}`}>
          {!submitted ? (
            <div className="form-card">
              <h3>🐾 무료 체험 신청</h3>
              <div className="fsub">30초면 끝나요. 바로 시작할 수 있습니다.</div>

              <div className="fg">
                <label>매장 이름</label>
                <input placeholder="예: 해피독 애견미용" value={form.shopName} onChange={e => setForm({ ...form, shopName: e.target.value })} />
              </div>
              <div className="fg">
                <label>사장님 성함</label>
                <input placeholder="홍길동" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="fg">
                <label>전화번호</label>
                <input type="tel" placeholder="010-0000-0000" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="fg">
                <label>가장 필요한 기능 (복수 선택)</label>
                <div className="needs-grid">
                  {["예약 통합", "재방문 알림", "미용 완료 알림", "고객 관리", "고객 예약페이지", "매출 통계"].map(n => (
                    <button key={n} className={`need-chip ${form.needs.includes(n) ? "sel" : ""}`} onClick={() => toggleNeed(n)}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <button className="submit-btn" disabled={!form.shopName || !form.phone} onClick={submitForm}>
                무료로 시작하기
              </button>
              <div style={{ textAlign: "center", fontSize: 10, color: "var(--t3)", marginTop: 8 }}>
                설치비 없음 · 카드 등록 불필요 · 언제든 해지
              </div>
            </div>
          ) : (
            <div className="success">
              <div className="check">🎉</div>
              <h3>신청 완료!</h3>
              <p>
                감사합니다! 빠른 시일 내에 연락드리겠습니다.<br />
                사용하시면서 불편한 점이나 필요한 기능이 있으면<br />
                아래 💬 버튼으로 언제든 피드백 보내주세요!
              </p>
            </div>
          )}
        </section>

        {/* ═══ FEEDBACK SECTION ═══ */}
        {showFb && (
          <div className="fb-card">
            <h3>💬 피드백 보내기</h3>
            <div className="fb-type">
              {[
                { k: "feature", l: "🙋 기능 요청" },
                { k: "bug", l: "🐛 불편/오류" },
                { k: "idea", l: "💡 아이디어" },
              ].map(t => (
                <button key={t.k} className={fbForm.type === t.k ? "sel" : ""} onClick={() => setFbForm({ ...fbForm, type: t.k })}>
                  {t.l}
                </button>
              ))}
            </div>
            <textarea className="fb-textarea" placeholder="어떤 기능이 필요하세요? 불편한 점이 있나요? 자유롭게 적어주세요!" value={fbForm.text} onChange={e => setFbForm({ ...fbForm, text: e.target.value })} />
            <button className="fb-submit" onClick={submitFeedback} disabled={!fbForm.text.trim()}>보내기</button>

            {feedbacks.length > 0 && <>
              <div style={{ fontSize: 12, fontWeight: 700, marginTop: 16, marginBottom: 8 }}>📋 보낸 피드백 ({feedbacks.length})</div>
              {feedbacks.map(f => (
                <div key={f.id} className="fb-item">
                  <span className="fb-tag" style={{
                    background: f.type === "feature" ? "var(--al)" : f.type === "bug" ? "#FEF2F2" : "var(--yl)",
                    color: f.type === "feature" ? "var(--ad)" : f.type === "bug" ? "#DC2626" : "var(--y)"
                  }}>
                    {f.type === "feature" ? "기능요청" : f.type === "bug" ? "불편/오류" : "아이디어"}
                  </span>
                  <span className="fb-date">{f.date}</span>
                  <p>{f.text}</p>
                </div>
              ))}
            </>}
          </div>
        )}

        {/* ═══ FOOTER ═══ */}
        <div className="footer">
          PawCare — 애견미용샵 통합 관리 서비스<br />
          문의: contact@pawcare.kr<br />
          © 2026 PawCare. All rights reserved.
        </div>
      </div>

      {/* Floating feedback button */}
      <button className="fab" onClick={() => setShowFb(!showFb)} title="피드백 보내기">
        {showFb ? "✕" : "💬"}
      </button>
    </>
  );
}
