import React, { useState } from "react";

const STEPS = [
  {
    target: null,
    title: "AI 상품 페이지 빌더에 오신 것을 환영합니다",
    desc: "이 서비스는 상품 정보를 입력하면 AI가 전문적인 상세페이지를 자동으로 만들어줍니다. 간단한 튜토리얼을 따라해보세요.",
    position: "center",
  },
  {
    target: ".template-section",
    title: "레이아웃 템플릿 선택",
    desc: "3가지 레이아웃 중 원하는 스타일을 선택하세요. 히어로 중심형이 기본 선택되어 있습니다.",
    position: "right",
  },
  {
    target: ".attach-btn",
    title: "이미지 첨부",
    desc: "+ 버튼을 눌러 상품 이미지를 최대 5장까지 첨부할 수 있습니다. 각 이미지에 번호가 자동 부여되며, AI가 이미지를 분석하여 페이지에 반영합니다.",
    position: "top",
  },
  {
    target: ".chat-input-area",
    title: "상품 설명 입력",
    desc: "입력창에 만들고 싶은 상품을 설명하세요. 지금 '게이밍 마우스 상세페이지 만들어줘'를 자동으로 전송합니다. 생성이 완료되면 오른쪽에 결과가 표시됩니다.",
    position: "top",
    action: "input",
    inputText: "게이밍 마우스 상세페이지 만들어줘",
    isLast: true,
  },
];

export default function Onboarding({ onDone, onInput }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];

  const next = () => {
    // 입력 액션이 있으면 실행하고 튜토리얼 종료
    if (current.action === "input" && current.inputText) {
      onInput(current.inputText);
      onDone();
      return;
    }

    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      onDone();
    }
  };

  const getTargetRect = () => {
    if (!current.target) return null;
    const el = document.querySelector(current.target);
    if (!el) return null;
    return el.getBoundingClientRect();
  };

  const rect = getTargetRect();

  // 툴팁 위치 계산 (화면 밖으로 안 나가게)
  const getTooltipStyle = () => {
    if (!rect) return {};
    let top, left;
    const tw = 320; // 툴팁 너비
    const th = 200; // 툴팁 대략 높이
    const pad = 16;

    if (current.position === "top") {
      top = rect.top - th - pad;
      left = rect.left + rect.width / 2 - tw / 2;
    } else if (current.position === "right") {
      top = rect.top + rect.height / 2 - th / 2;
      left = rect.right + pad;
    } else if (current.position === "left") {
      top = rect.top + rect.height / 2 - th / 2;
      left = rect.left - tw - pad;
    } else {
      top = rect.top + rect.height + pad;
      left = rect.left + rect.width / 2 - tw / 2;
    }

    // 화면 경계 보정
    if (top < pad) top = pad;
    if (top + th > window.innerHeight - pad) top = window.innerHeight - th - pad;
    if (left < pad) left = pad;
    if (left + tw > window.innerWidth - pad) left = window.innerWidth - tw - pad;

    return { top, left };
  };

  return (
    <div className="onboarding-overlay">
      {rect && (
        <div className="onboarding-highlight" style={{
          top: rect.top - 4, left: rect.left - 4,
          width: rect.width + 8, height: rect.height + 8,
        }} />
      )}

      <div className={`onboarding-tooltip ${current.position}`} style={rect ? getTooltipStyle() : {}}>
        <div className="tooltip-step">{step + 1} / {STEPS.length}</div>
        <h3>{current.title}</h3>
        <p>{current.desc}</p>

        <div className="tooltip-actions">
          {step > 0 && (
            <button className="tooltip-back" onClick={() => setStep(step - 1)}>이전</button>
          )}
          <button className="tooltip-next" onClick={next}>
            {current.isLast ? "생성하기" : "다음"}
          </button>
          <button className="tooltip-skip" onClick={onDone}>건너뛰기</button>
        </div>
      </div>
    </div>
  );
}
