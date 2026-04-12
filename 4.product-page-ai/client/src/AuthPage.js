import React, { useState } from "react";

export default function AuthPage({ onLogin, serverUrl }) {
  const [isReg, setIsReg] = useState(false);
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const res = await fetch(`${serverUrl}/auth/${isReg ? "register" : "login"}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      localStorage.setItem("pp_token", data.token);
      onLogin(data.nickname, data.onboarded);
    } catch { setError("서버 연결 실패"); }
    finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>AI 상품 페이지 빌더</h1>
        <p className="auth-desc">상품명만 입력하면 AI가 상세페이지를 자동 생성합니다</p>
        <div className="auth-tabs">
          <button className={!isReg ? "active" : ""} onClick={() => { setIsReg(false); setError(""); }}>로그인</button>
          <button className={isReg ? "active" : ""} onClick={() => { setIsReg(true); setError(""); }}>회원가입</button>
        </div>
        <form onSubmit={submit} className="auth-form">
          <input type="text" placeholder="닉네임" value={nickname} onChange={(e) => setNickname(e.target.value)} autoFocus />
          <input type="password" placeholder="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="auth-submit" disabled={loading}>{loading ? "처리 중..." : isReg ? "회원가입" : "로그인"}</button>
        </form>
      </div>
    </div>
  );
}
