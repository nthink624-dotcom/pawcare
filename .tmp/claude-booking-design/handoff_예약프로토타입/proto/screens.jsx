const { useState, useRef } = React;
const { Ig, Threads, Kakao, Pin, Chat, Back, Check, Ticket } = window;

/* ===================== HOME ===================== */
function Home({ go, onSlot }) {
  const [gi, setGi] = useState(0);
  const [hoursOpen, setHoursOpen] = useState(false);
  const galRef = useRef(null);

  const onGalScroll = () => {
    const el = galRef.current; if (!el) return;
    setGi(Math.round(el.scrollLeft / (el.scrollWidth / 4)));
  };
  const jump = (i) => {
    const el = galRef.current; if (!el) return;
    el.scrollTo({ left: (el.scrollWidth / 4) * i, behavior: "smooth" });
  };

  return (
    <>
      <div className="scroll" style={{ paddingBottom: 100 }}>
        <div className="gwrap">
          <div className="gallery" ref={galRef} onScroll={onGalScroll}>
            <div className="gcard ph">
              <span>대표 작업 ①</span><div className="ovl"></div>
              <div className="gacts">
                <button title="문의하기"><Chat/></button>
                <button title="길찾기"><Pin/></button>
              </div>
              <span className="cnt">1 / 324</span>
              <div className="id"><div className="nm">우진만세</div></div>
            </div>
            <div className="gcard ph b"><span>대표 작업 ②</span></div>
            <div className="gcard ph c"><span>대표 작업 ③</span></div>
            <div className="gcard ph"><span>대표 작업 ④</span></div>
          </div>
          <div className="gdots">
            {[0,1,2,3].map(i => <i key={i} className={gi===i?"on":""} onClick={()=>jump(i)}></i>)}
          </div>
        </div>

        <div className="body">
          <div className="pbar">
            <div className="av ph"></div>
            <div className="who">
              <div className="nm">정우진 원장</div>
              <div className="sub">@woojinmanse · 팔로워 1.8천 · 반려견 미용 9년차</div>
            </div>
          </div>

          <div className="srow">
            <div className="socials">
              <button className="chip" style={{ background: "var(--ig)" }}><Ig/></button>
              <button className="chip" style={{ background: "#000" }}><Threads/></button>
              <button className="chip" style={{ background: "#FEE500" }}><Kakao/></button>
            </div>
            <div className={"hours" + (hoursOpen ? " open" : "")}>
              <div className="top" onClick={() => setHoursOpen(o => !o)}>
                <span className="od"></span>영업 중<span className="chev">▾</span>
              </div>
              {hoursOpen && (
                <div className="list"><div className="inner">
                  <div className="hrow today"><span className="d">오늘 (금)</span><span className="t">10:00 – 21:00</span></div>
                  <div className="hrow"><span className="d">월–목</span><span className="t">10:00 – 21:00</span></div>
                  <div className="hrow"><span className="d">토</span><span className="t">10:00 – 19:00</span></div>
                  <div className="hrow off"><span className="d">일</span><span className="t">정기 휴무</span></div>
                  <div className="hrow off"><span className="d">점심</span><span className="t">13:00 – 14:00</span></div>
                </div></div>
              )}
            </div>
          </div>

          <div className="pcard">
            {SERVICES.map(s => (
              <div className="pr" key={s.id} onClick={() => go("booking")}>
                <span className="n">{s.name}</span><span className="d">{s.dur}</span>
                <span className="p">{fmt(s.price)}~</span>
              </div>
            ))}
            <div className="slots">
              <div className="sh"><span className="b">오늘 예약 가능 시간</span><span className="left"><b>3자리</b> 남음</span></div>
              <div className="chips">
                <span className="chip soon" onClick={() => onSlot("14:00")}>14:00</span>
                <span className="chip" onClick={() => onSlot("15:30")}>15:30</span>
                <span className="chip" onClick={() => onSlot("19:30")}>19:30</span>
              </div>
            </div>
            <div className="full" onClick={() => go("booking")}>전체 요금표 보기 ›</div>
          </div>
        </div>
      </div>

      <div className="dock">
        <div className="cpn"><span className="ctag">첫 방문</span>10,000원 할인 자동 적용<span className="x">D-7</span></div>
        <button className="cta" onClick={() => go("booking")}>예약하기</button>
      </div>
    </>
  );
}

/* ===================== 예약(시술·날짜·시간) ===================== */
function Booking({ service, setService, date, setDate, time, setTime, go }) {
  const svc = SERVICES.find(s => s.id === service);
  const dObj = DATES.find(d => d.id === date);
  const ready = date && time;
  const summary = [svc.name, dObj ? `${dObj.day} ${dObj.num}일` : null, time].filter(Boolean).join(" · ");

  return (
    <>
      <div className="nav">
        <button className="back" onClick={() => go("home", "back")}><Back/></button>
        <div className="ttl">예약하기</div><div className="step">1 / 2</div>
      </div>
      <div className="pgscroll">
        <div className="sec">
          <h3><span className="no">1</span>시술 선택</h3>
          {SERVICES.map(s => (
            <div className={"svc" + (service === s.id ? " sel" : "")} key={s.id} onClick={() => setService(s.id)}>
              <div className="radio"></div>
              <div className="info"><div className="n">{s.name}</div><div className="d">{s.dur} · {s.desc}</div></div>
              <div className="price">{fmt(s.price)}~</div>
            </div>
          ))}
        </div>

        <div className="sec">
          <h3><span className="no">2</span>날짜 선택</h3>
          <div className="dstrip">
            {DATES.map(d => (
              <div key={d.id}
                className={"dcell" + (d.off ? " off" : "") + (date === d.id ? " sel" : "")}
                onClick={() => !d.off && setDate(d.id)}>
                <div className="dw">{d.day}</div>
                <div className="dn" style={d.off ? { fontSize: 13 } : null}>{d.off ? "휴무" : d.num}</div>
                {d.tag && <div className="tag">{d.tag}</div>}
              </div>
            ))}
          </div>
        </div>

        <div className="sec">
          <h3><span className="no">3</span>시간 선택</h3>
          <div className="tgrid">
            {TIMES.map(t => BOOKED.includes(t)
              ? <div className="tcell off" key={t}>{t}</div>
              : <div className={"tcell" + (time === t ? " sel" : "")} key={t} onClick={() => setTime(t)}>{t}</div>
            )}
          </div>
          <div className="hint" style={{ marginTop: 14 }}>취소선은 이미 마감된 시간이에요</div>
        </div>
      </div>

      <div className="dock">
        <div className="sumline">
          <span className="k">선택</span>
          <span className="v">{ready ? summary : "날짜·시간을 골라주세요"}</span>
          <span className="amt">{ready ? fmt(svc.price) : ""}</span>
        </div>
        <button className="cta" disabled={!ready} onClick={() => go("info")}>다음</button>
      </div>
    </>
  );
}

/* ===================== 정보 입력 ===================== */
function Info({ service, date, time, coupon, setCoupon, go }) {
  const svc = SERVICES.find(s => s.id === service);
  const dObj = DATES.find(d => d.id === date);
  const disc = coupon ? COUPON : 0;
  const total = svc.price - disc;

  return (
    <>
      <div className="nav">
        <button className="back" onClick={() => go("booking", "back")}><Back/></button>
        <div className="ttl">예약 정보</div><div className="step">2 / 2</div>
      </div>
      <div className="pgscroll">
        <div className="sec">
          <h3>반려견 정보</h3>
          <div className="field">
            <label>이름</label>
            <input defaultValue="" placeholder="예) 보리" />
          </div>
          <div className="frow">
            <div className="field"><label>견종</label><input placeholder="예) 푸들" /></div>
            <div className="field"><label>몸무게</label><input placeholder="예) 4kg" /></div>
          </div>
        </div>

        <div className="sec">
          <h3>요청사항 <span style={{ color: "var(--textMuted)", fontWeight: 400, fontSize: 12.5 }}>선택</span></h3>
          <div className="field">
            <textarea placeholder="미용 스타일, 예민한 부위, 건강 특이사항 등을 알려주세요."></textarea>
          </div>
        </div>

        <div className="sec">
          <h3>할인 쿠폰</h3>
          <div className="cpnrow">
            <div className="ic"><Ticket/></div>
            <div>
              <div className="t">첫 방문 10,000원 할인</div>
              <div className="s">전체미용 외 전 시술 · 7일 내 사용</div>
            </div>
            <button className={"sw" + (coupon ? " on" : "")} onClick={() => setCoupon(c => !c)}>
              <span className="knob"></span>
            </button>
          </div>
        </div>

        <div className="sec">
          <h3>결제 예정 금액</h3>
          <div className="pay">
            <div className="py"><span className="k">{svc.name}</span><span className="v">{fmt(svc.price)}</span></div>
            {coupon && <div className="py"><span className="k">첫 방문 쿠폰</span><span className="v disc">- {fmt(COUPON)}</span></div>}
            <div className="py total"><span className="k">현장 결제</span><span className="v">{fmt(total)}</span></div>
          </div>
          <div className="paynote">금액은 기본가 기준이며, 모질·엉킴 상태에 따라 현장에서 조정될 수 있어요.<br/>결제는 방문 시 매장에서 진행됩니다.</div>
        </div>
      </div>

      <div className="dock">
        <div className="sumline">
          <span className="k">{dObj.day} {dObj.num}일 {time}</span>
          <span className="amt">{fmt(total)}</span>
        </div>
        <button className="cta" onClick={() => go("done")}>예약 확정하기</button>
      </div>
    </>
  );
}

/* ===================== 완료 ===================== */
function Done({ service, date, time, coupon, reset }) {
  const svc = SERVICES.find(s => s.id === service);
  const dObj = DATES.find(d => d.id === date);
  const total = svc.price - (coupon ? COUPON : 0);
  return (
    <div className="done">
      <div className="ic"><Check/></div>
      <h2>예약이 완료되었어요</h2>
      <div className="lead">예약 확정 알림을 카카오톡으로 보내드렸어요.<br/>방문 전 변경·취소도 여기서 가능해요.</div>
      <div className="rcard">
        <div className="ry"><span className="k">매장</span><span className="v">우진만세 · 정우진 원장</span></div>
        <div className="ry"><span className="k">일시</span><span className="v">6월 {dObj.num}일 ({dObj.day}) {time}</span></div>
        <div className="ry"><span className="k">시술</span><span className="v">{svc.name} · {svc.dur}</span></div>
        <div className="ry"><span className="k">결제</span><span className="v amt">{fmt(total)} <span style={{color:"var(--textMuted)",fontWeight:400,fontSize:12.5}}>현장 결제</span></span></div>
      </div>
      <div style={{ flex: 1 }}></div>
      <div className="btnrow">
        <button className="btn ghost">예약 내역</button>
        <button className="btn primary" onClick={reset}>홈으로</button>
      </div>
    </div>
  );
}

Object.assign(window, { Home, Booking, Info, Done });
