import React, { useState, useEffect, useRef } from "react";
import "./App.css";
import AuthPage from "./AuthPage";
import Onboarding from "./Onboarding";
import MainApp from "./MainApp";

const SERVER_URL = process.env.REACT_APP_SERVER_URL || "http://localhost:80";

function App() {
  const [user, setUser] = useState(null);
  const [onboarded, setOnboarded] = useState(true);
  const [checking, setChecking] = useState(true);
  const mainAppRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem("pp_token");
    if (!token) { setChecking(false); return; }
    fetch(`${SERVER_URL}/auth/verify`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => { if (r.ok) return r.json(); throw new Error(); })
      .then((d) => { setUser(d.nickname); setOnboarded(d.onboarded); })
      .catch(() => localStorage.removeItem("pp_token"))
      .finally(() => setChecking(false));
  }, []);

  const handleLogin = (nickname, isOnboarded) => { setUser(nickname); setOnboarded(isOnboarded); };
  const handleLogout = () => { localStorage.removeItem("pp_token"); setUser(null); };
  const handleOnboardDone = async () => {
    try {
      await fetch(`${SERVER_URL}/auth/onboarded`, {
        method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem("pp_token")}` },
      });
    } catch {}
    setOnboarded(true);
  };

  // 온보딩에서 입력 트리거
  const handleTutorialInput = (text) => {
    if (mainAppRef.current?.triggerSend) {
      mainAppRef.current.triggerSend(text);
    }
  };

  if (checking) return <div className="loading-full"><div className="spinner" /><p>로딩 중</p></div>;
  if (!user) return <AuthPage onLogin={handleLogin} serverUrl={SERVER_URL} />;

  return (
    <>
      <MainApp ref={mainAppRef} nickname={user} onLogout={handleLogout} serverUrl={SERVER_URL} />
      {!onboarded && (
        <Onboarding
          onDone={handleOnboardDone}
          onInput={handleTutorialInput}
        />
      )}
    </>
  );
}

export default App;
