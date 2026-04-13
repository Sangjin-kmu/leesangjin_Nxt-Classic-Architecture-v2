const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async (event) => {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  let input;
  try { input = JSON.parse(event.body); } catch { return { statusCode: 400, body: "Invalid JSON" }; }

  const mode = input.mode || "generate";
  const message = input.message || "";
  const userImages = input.userImages || [];

  // 멀티모달 파트 구성
  function buildParts(textPrompt) {
    const parts = [{ text: textPrompt }];
    for (const img of userImages) {
      if (img.base64 && img.mimeType) {
        parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
        parts.push({ text: `(위 이미지는 ${img.number}번 이미지, HTML에는 src="${img.url}"로 삽입)` });
      }
    }
    return parts;
  }

  try {
    // ===== PLAN 모드: 필요한 이미지 목록 반환 =====
    if (mode === "plan") {
      const template = input.template || "hero";
      const prompt = `당신은 전문 웹 디자이너입니다.
아래 상품 정보로 상세페이지를 만들 때 필요한 이미지 목록을 JSON으로 알려주세요.
사용자가 올린 이미지가 있으면 그것을 고려하여 추가로 필요한 이미지만 요청하세요.

[상품 정보] ${message}
[사용자 업로드 이미지] ${userImages.length}장
[레이아웃] ${template}

반드시 아래 JSON 형식으로만 응답하세요:
{"images": [
  {"role": "hero_bg", "description": "히어로 섹션 배경 - 어두운 테크 느낌"},
  {"role": "product", "description": "상품 정면 이미지"},
  {"role": "section_bg", "description": "특징 섹션 배경"}
]}
최대 5개까지. 사용자가 이미 올린 이미지로 커버되는 건 제외.
JSON 외 텍스트 금지.`;

      const result = await model.generateContent(buildParts(prompt));
      let text = result.response.text().replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(text);
      return { statusCode: 200, body: JSON.stringify(parsed) };
    }

    // ===== GENERATE 모드: 최종 HTML 생성 =====
    if (mode === "generate") {
      const template = input.template || "hero";
      const generatedImages = input.generatedImages || [];

      let imageInfo = "";
      if (userImages.length > 0) {
        imageInfo += "[사용자 업로드 이미지]\n";
        userImages.forEach((img) => { imageInfo += `${img.number}번: ${img.url}\n`; });
      }
      if (generatedImages.length > 0) {
        imageInfo += "[AI 생성 이미지]\n";
        generatedImages.forEach((img, i) => { imageInfo += `${img.role}(${img.description}): ${img.url}\n`; });
      }

      const templateGuide = {
        hero: "히어로 중심형: 큰 전체화면 배너, 스크롤 나열, 다크 배경",
        card: "카드 그리드형: 밝은 배경, 카드 형태 그리드",
        story: "스토리텔링형: 풀블랙, 큰 타이포, 좌우 교차",
      };

      const prompt = `당신은 전문 웹 디자이너이자 카피라이터입니다.

[사용자 요청] ${message}

${imageInfo}

[레이아웃] ${templateGuide[template] || templateGuide.hero}

[규칙]
1. 완전한 HTML (<!DOCTYPE html> ~ </html>), CSS는 <style> 안에
2. 제공된 이미지 URL을 반드시 <img src="URL"> 또는 background-image:url('URL')로 삽입
3. 모든 이미지를 빠짐없이 사용하세요
4. 포함: 히어로, 특징 4개, 상세 3개, 사양 표, 가격/CTA
5. 한국어, 이모지 금지, 고급 카피
6. 반응형
7. HTML 외 텍스트 금지, 코드블록 금지
8. JavaScript 절대 금지. <script> 태그 금지. onclick 등 이벤트 핸들러 금지.
9. 애니메이션, transition, hover 효과, transform 등 동적 효과 금지. 정적인 페이지만 만드세요.
10. 버튼, 링크, 폼 등 인터랙티브 요소 금지. 클릭 가능한 요소를 만들지 마세요.
11. 이 페이지는 이미지로 다운로드할 정적 상세페이지입니다. 인쇄물처럼 만드세요.`;

      const result = await model.generateContent(buildParts(prompt));
      let html = result.response.text().replace(/```html\n?/gi, "").replace(/```\n?/g, "").trim();
      const idx = html.indexOf("<!DOCTYPE");
      const idx2 = html.indexOf("<html");
      html = html.slice(idx >= 0 ? idx : (idx2 >= 0 ? idx2 : 0));
      return { statusCode: 200, body: JSON.stringify({ html }) };
    }

    // ===== EDIT 모드: 기존 HTML 수정 =====
    if (mode === "edit") {
      const prevHtml = input.prevHtml || "";
      const existingImages = input.existingImages || [];

      let imageInfo = "";
      if (userImages.length > 0) {
        imageInfo += "[새로 첨부된 이미지]\n";
        userImages.forEach((img) => { imageInfo += `${img.number}번: ${img.url}\n`; });
      }
      if (existingImages.length > 0) {
        imageInfo += "[기존 페이지에 사용된 이미지 - 반드시 유지]\n";
        existingImages.forEach((url, i) => { imageInfo += `기존이미지${i + 1}: ${url}\n`; });
      }

      const prompt = `당신은 HTML 편집 전문가입니다.

중요 규칙:
- 사용자가 요청한 부분만 정확히 수정하세요.
- 요청하지 않은 부분은 한 글자도 변경하지 마세요.
- HTML 구조, CSS 스타일, 이미지, 레이아웃을 절대 변경하지 마세요.
- 기존 HTML을 그대로 복사하고, 요청된 부분만 찾아서 바꾸세요.
- 모든 이미지 URL을 그대로 유지하세요.

${imageInfo}

[기존 HTML - 이것을 기반으로 수정]
${prevHtml}

[사용자 수정 요청]
${message}

위 기존 HTML에서 사용자가 요청한 부분만 수정한 완전한 HTML을 출력하세요.
<!DOCTYPE html>부터 </html>까지 전체를 출력하세요.
HTML 외 텍스트 금지, 코드블록 금지.`;

      const result = await model.generateContent(buildParts(prompt));
      let html = result.response.text().replace(/```html\n?/gi, "").replace(/```\n?/g, "").trim();
      const idx = html.indexOf("<!DOCTYPE");
      const idx2 = html.indexOf("<html");
      html = html.slice(idx >= 0 ? idx : (idx2 >= 0 ? idx2 : 0));
      return { statusCode: 200, body: JSON.stringify({ html }) };
    }

    return { statusCode: 400, body: JSON.stringify({ error: "Unknown mode" }) };
  } catch (err) {
    console.error("Gemini 오류:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "생성 실패" }) };
  }
};
