const { useState } = React;

window.SERVICES = [
  { id: "full",     name: "전체미용",      dur: "90~120분",  desc: "목욕·컷·발톱·귀", price: 45000 },
  { id: "hygiene",  name: "위생미용+목욕", dur: "60~90분",   desc: "부분미용·목욕",   price: 30000 },
  { id: "sporting", name: "스포팅",        dur: "120~150분", desc: "전체 가위컷",     price: 70000 },
];
window.DATES = [
  { id: "6/13", day: "금", num: 13, tag: "오늘" },
  { id: "6/14", day: "토", num: 14 },
  { id: "6/15", day: "일", num: 15, off: true },
  { id: "6/16", day: "월", num: 16 },
  { id: "6/17", day: "화", num: 17 },
  { id: "6/18", day: "수", num: 18 },
  { id: "6/19", day: "목", num: 19 },
];
window.TIMES = ["10:00","11:00","12:00","14:00","15:30","17:00","18:30","19:30","20:30"];
window.BOOKED = ["11:00","17:00"];
window.COUPON = 10000;
window.fmt = (n) => n.toLocaleString("ko-KR") + "원";

function App() {
  const [screen, setScreen] = useState("home");
  const [dir, setDir] = useState("");
  const [service, setService] = useState("full");
  const [date, setDate] = useState(null);
  const [time, setTime] = useState(null);
  const [coupon, setCoupon] = useState(true);

  const go = (s, d = "fwd") => { setDir(d); setScreen(s); };
  const onSlot = (t) => { setDate("6/13"); setTime(t); setDir("fwd"); setScreen("booking"); };
  const reset = () => {
    setDir("back"); setScreen("home");
    setDate(null); setTime(null); setService("full"); setCoupon(true);
  };

  let content;
  if (screen === "home")
    content = <Home go={go} onSlot={onSlot} />;
  else if (screen === "booking")
    content = <Booking {...{ service, setService, date, setDate, time, setTime, go }} />;
  else if (screen === "info")
    content = <Info {...{ service, date, time, coupon, setCoupon, go }} />;
  else
    content = <Done {...{ service, date, time, coupon, reset }} />;

  return (
    <div className="phone"><div className="screen">
      <div className="island"></div>
      <div className="sb"><span>9:41</span><div className="rt"><i></i><i></i><i></i></div></div>
      <div className={"page " + dir} key={screen}>{content}</div>
    </div></div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
