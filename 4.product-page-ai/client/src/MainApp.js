import React, { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from "react";

const TEMPLATES = [
  { id: "hero", name: "히어로 중심형", desc: "큰 배너 + 스크롤 나열" },
  { id: "card", name: "카드 그리드형", desc: "카드 형태 그리드 배치" },
  { id: "story", name: "스토리텔링형", desc: "좌우 교차 스토리 구조" },
];

function getToken() { return localStorage.getItem("pp_token"); }

const MainApp = forwardRef(function MainApp({ nickname, onLogout, serverUrl }, ref) {
  const [messages, setMessages] = useState([]);
  const [html, setHtml] = useState(null);
  const [selectedAI, setSelectedAI] = useState("gemini");
  const [selectedTemplate, setSelectedTemplate] = useState("hero");
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState("");
  const [images, setImages] = useState([]); // 최대 5장
  const [hasGenerated, setHasGenerated] = useState(false);
  const chatEndRef = useRef(null);
  const fileRef = useRef(null);
  const iframeRef = useRef(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${serverUrl}/chat/history`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.ok) { const d = await res.json(); setMessages(d.messages || []); }
    } catch {}
  }, [serverUrl]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // 온보딩에서 호출할 수 있도록 노출
  useImperativeHandle(ref, () => ({
    triggerSend: (text) => {
      setInput(text);
      // 약간의 딜레이 후 전송 (state 반영 대기)
      setTimeout(() => {
        setInput(""); setIsLoading(true);
        addMsg("user", text);
        const fd = new FormData();
        fd.append("message", text);
        fd.append("template", selectedTemplate);
        fetch(`${serverUrl}/generate`, {
          method: "POST", headers: { Authorization: `Bearer ${getToken()}` }, body: fd,
        }).then(r => r.json()).then(data => {
          setHtml(data.html); setHasGenerated(true);
          addMsg("assistant", "상세페이지가 생성되었습니다.");
        }).catch(() => {
          addMsg("assistant", "생성에 실패했습니다.");
        }).finally(() => setIsLoading(false));
      }, 300);
    },
    hasResult: () => !!html,
  }));

  const addMsg = (role, content, msgImages) => setMessages((prev) => [...prev, { role, content, images: msgImages }]);

  const clearChat = async () => {
    if (!window.confirm("대화 내역을 초기화하시겠습니까?")) return;
    try { await fetch(`${serverUrl}/chat/history`, { method: "DELETE", headers: { Authorization: `Bearer ${getToken()}` } }); } catch {}
    setMessages([]); setHtml(null); setHasGenerated(false);
  };

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files).slice(0, 5 - images.length);
    setImages((prev) => [...prev, ...files].slice(0, 5));
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeImage = (idx) => setImages((prev) => prev.filter((_, i) => i !== idx));

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userText = input;
    setInput(""); setIsLoading(true);

    // 이미지 미리보기 URL 생성
    const previewImages = images.map((f, i) => ({
      number: i + 1,
      url: URL.createObjectURL(f),
    }));
    addMsg("user", userText, previewImages.length > 0 ? previewImages : undefined);

    try {
      const fd = new FormData();
      fd.append("message", userText);
      fd.append("template", selectedTemplate);
      if (html && hasGenerated) fd.append("prevHtml", html.slice(0, 12000));
      images.forEach((img) => fd.append("images", img));

      const res = await fetch(`${serverUrl}/generate`, {
        method: "POST", headers: { Authorization: `Bearer ${getToken()}` }, body: fd,
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setHtml(data.html);
      setHasGenerated(true);

      let msg = hasGenerated ? "수정이 반영되었습니다." : "상세페이지가 생성되었습니다.";
      if (data.sdProductImages?.length > 0) msg += ` (AI 상품 이미지 ${data.sdProductImages.length}장`;
      if (data.sdBgImages?.length > 0) msg += `${data.sdProductImages?.length > 0 ? " + " : " ("}배경 ${data.sdBgImages.length}장`;
      if (data.sdProductImages?.length > 0 || data.sdBgImages?.length > 0) msg += " 생성)";
      addMsg("assistant", msg);
    } catch { addMsg("assistant", "생성에 실패했습니다. 다시 시도해주세요."); }
    finally { setIsLoading(false); setImages([]); }
  };

  const downloadAsImage = async () => {
    if (!html) return;
    try {
      const { default: html2canvas } = await import("html2canvas");
      const win = window.open("", "_blank", "width=1200,height=800");
      win.document.write(html);
      win.document.close();
      await new Promise((r) => setTimeout(r, 2000));
      const canvas = await html2canvas(win.document.body, {
        useCORS: true, allowTaint: true,
        width: 1200, windowWidth: 1200,
      });
      win.close();
      const link = document.createElement("a");
      link.download = "product-page.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("이미지 변환 실패, HTML로 다운로드:", err);
      const blob = new Blob([html], { type: "text/html" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "product-page.html";
      a.click();
    }
  };

  const handleKeyDown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  return (
    <div className="main-layout">
      <aside className="chat-panel">
        <div className="chat-header">
          <div>
            <h2>AI 상품 페이지 빌더</h2>
            <span className="user-label">{nickname}</span>
          </div>
          <div className="header-actions">
            <button onClick={clearChat} className="clear-btn">초기화</button>
            <button onClick={onLogout} className="logout-btn">로그아웃</button>
          </div>
        </div>

        <div className="chat-messages">
          {messages.length === 0 && (
            <div className="chat-welcome">
              <p>만들고 싶은 상품을 설명해주세요.</p>
              <p className="chat-hint">이미지를 첨부하면 번호가 자동 부여됩니다.</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`chat-msg ${m.role}`}>
              <span className="chat-role">{m.role === "user" ? "나" : "AI"}</span>
              <p>{m.content}</p>
              {m.images && m.images.length > 0 && (
                <div className="chat-images">
                  {m.images.map((img, j) => (
                    <div key={j} className="chat-img-thumb">
                      <span className="chat-img-number">{img.number}번</span>
                      <img src={img.url} alt={`${img.number}번 이미지`} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="chat-msg assistant">
              <span className="chat-role">AI</span>
              <div className="typing-dots"><span /><span /><span /></div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* 템플릿 (첫 생성 전만) */}
        {!hasGenerated && (
          <div className="template-section">
            <p className="templates-label">레이아웃 템플릿</p>
            <div className="template-cards">
              {TEMPLATES.map((t) => (
                <button key={t.id} className={`template-card ${selectedTemplate === t.id ? "selected" : ""}`}
                  onClick={() => setSelectedTemplate(t.id)}>
                  <span className="template-name">{t.name}</span>
                  <span className="template-desc">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 첨부 이미지 미리보기 */}
        {images.length > 0 && (
          <div className="attached-images">
            {images.map((img, i) => (
              <div key={i} className="attached-img-item">
                <span className="img-number">{i + 1}번</span>
                <img src={URL.createObjectURL(img)} alt="" className="attach-thumb" />
                <span className="img-name">{img.name}</span>
                <button onClick={() => removeImage(i)}>X</button>
              </div>
            ))}
          </div>
        )}

        <div className="chat-input-area">
          <div className="input-row">
            <button className="attach-btn" onClick={() => fileRef.current?.click()}
              disabled={images.length >= 5} title={`이미지 첨부 (${images.length}/5)`}>
              +{images.length > 0 ? images.length : ""}
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleImageSelect} hidden />
            <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder={hasGenerated ? "수정 요청을 입력하세요..." : "상품을 설명하세요... (Enter로 전송)"}
              disabled={isLoading} rows={1} />
            <button className="send-btn" onClick={sendMessage} disabled={!input.trim() || isLoading}>전송</button>
          </div>
        </div>
      </aside>

      {/* 오른쪽 미리보기 */}
      <main className="preview-panel">
        {html ? (
          <>
            <div className="preview-toolbar">
              <span>Gemini 생성</span>
              <button onClick={downloadAsImage} className="download-btn">이미지 다운로드</button>
            </div>
            <PreviewIframe html={html} iframeRef={iframeRef} />
          </>
        ) : (
          <div className="empty-state">
            <h2>상세페이지 미리보기</h2>
            <p>왼쪽에서 상품을 설명하면 여기에 결과가 표시됩니다</p>
          </div>
        )}
      </main>
    </div>
  );
});

export default MainApp;

// iframe을 1200px 고정 너비로 렌더링하고 컨테이너에 맞게 축소
function PreviewIframe({ html, iframeRef }) {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        setScale(Math.min(containerWidth / 1200, 1));
      }
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  return (
    <div className="preview-scroll" ref={containerRef}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: 1200, height: `${100 / scale}%` }}>
        <iframe ref={iframeRef} title="미리보기" srcDoc={html} className="preview-iframe" sandbox="allow-same-origin" />
      </div>
    </div>
  );
}
