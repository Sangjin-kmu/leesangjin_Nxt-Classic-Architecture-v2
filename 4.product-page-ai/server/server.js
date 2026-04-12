require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
const port = 80;
const JWT_SECRET = process.env.JWT_SECRET || "product-page-ai-secret";
const JWT_EXPIRES = "24h";

app.use(cors());
app.use(express.json({ limit: "50mb" }));

const UPLOAD_DIR = path.join(__dirname, "uploads");
const IMAGES_DIR = path.join(__dirname, "generated-images");
[UPLOAD_DIR, IMAGES_DIR].forEach((d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });
app.use("/images", express.static(IMAGES_DIR));
app.use("/uploads", express.static(UPLOAD_DIR));

const upload = multer({ dest: UPLOAD_DIR, limits: { fileSize: 20 * 1024 * 1024 } });

let db;
async function initDB() {
  db = await mysql.createConnection({
    host: process.env.DB_HOST, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  });
  await db.execute(`CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY, nickname VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL, onboarded BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS generated_pages (
    id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL,
    product_name VARCHAR(255), ai_type VARCHAR(20), result_html LONGTEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS chat_messages (
    id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL,
    role VARCHAR(20) NOT NULL, content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
  console.log("DB 준비 완료");
}

function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "로그인 필요" });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: "토큰 만료" }); }
}

// ===== 인증 =====
app.post("/auth/register", async (req, res) => {
  const { nickname, password } = req.body;
  if (!nickname?.trim() || !password?.trim()) return res.status(400).json({ error: "닉네임과 비밀번호 입력" });
  if (nickname.length < 2) return res.status(400).json({ error: "닉네임 2자 이상" });
  if (password.length < 4) return res.status(400).json({ error: "비밀번호 4자 이상" });
  try {
    const [ex] = await db.execute("SELECT id FROM users WHERE nickname=?", [nickname]);
    if (ex.length > 0) return res.status(409).json({ error: "이미 사용 중" });
    const hash = await bcrypt.hash(password, 10);
    const [r] = await db.execute("INSERT INTO users (nickname,password) VALUES (?,?)", [nickname, hash]);
    const token = jwt.sign({ id: r.insertId, nickname }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    res.status(201).json({ token, nickname, onboarded: false });
  } catch (err) { console.error(err); res.status(500).json({ error: "회원가입 실패" }); }
});

app.post("/auth/login", async (req, res) => {
  const { nickname, password } = req.body;
  if (!nickname?.trim() || !password?.trim()) return res.status(400).json({ error: "입력 필요" });
  try {
    const [rows] = await db.execute("SELECT * FROM users WHERE nickname=?", [nickname]);
    if (rows.length === 0) return res.status(401).json({ error: "닉네임 또는 비밀번호 오류" });
    const user = rows[0];
    if (!(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: "닉네임 또는 비밀번호 오류" });
    const token = jwt.sign({ id: user.id, nickname: user.nickname }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    res.json({ token, nickname: user.nickname, onboarded: !!user.onboarded });
  } catch (err) { console.error(err); res.status(500).json({ error: "로그인 실패" }); }
});

app.get("/auth/verify", auth, async (req, res) => {
  try {
    const [rows] = await db.execute("SELECT onboarded FROM users WHERE id=?", [req.user.id]);
    res.json({ nickname: req.user.nickname, onboarded: !!(rows[0]?.onboarded) });
  } catch { res.json({ nickname: req.user.nickname, onboarded: true }); }
});

app.post("/auth/onboarded", auth, async (req, res) => {
  try { await db.execute("UPDATE users SET onboarded=TRUE WHERE id=?", [req.user.id]); res.json({ ok: true }); }
  catch { res.status(500).json({ error: "실패" }); }
});

// ===== SD 이미지 생성 =====
async function generateSDImage(prompt) {
  const sdUrl = process.env.SD_API_URL;
  if (!sdUrl) return null;
  const authOpt = (process.env.SD_USER && process.env.SD_PASS)
    ? { auth: { username: process.env.SD_USER, password: process.env.SD_PASS } }
    : {};
  try {
    // 체크포인트 설정 (Juggernaut XL)
    const sdModel = process.env.SD_MODEL || "juggernautXL_v9Rundiffusionphoto2";
    try {
      await axios.post(`${sdUrl}/sdapi/v1/options`, {
        sd_model_checkpoint: sdModel,
      }, { timeout: 30000, ...authOpt });
    } catch (e) { console.log("SD 모델 설정 스킵:", e.message); }

    const res = await axios.post(`${sdUrl}/sdapi/v1/txt2img`, {
      prompt, negative_prompt: "text, watermark, low quality, blurry, deformed, nsfw, nude, naked, sexual, erotic, pornographic, violence, blood, gore, weapon, gun, knife, disturbing, grotesque",
      steps: 20, width: 1024, height: 576, cfg_scale: 7,
    }, { timeout: 180000, ...authOpt });
    if (res.data?.images?.[0]) {
      const name = `sd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.png`;
      fs.writeFileSync(path.join(IMAGES_DIR, name), Buffer.from(res.data.images[0], "base64"));
      return name;
    }
  } catch (err) { console.error("SD 오류:", err.message); }
  return null;
}
async function callNovaForPrompts(message, imageDescriptions) {
  const url = process.env.BEDROCK_LAMBDA_URL;
  if (!url) return { prompts: [], productImageCount: 0 };
  try {
    const res = await axios.post(url, { message, imageDescriptions }, { timeout: 60000 });
    let data = res.data;
    if (typeof data === "string") { try { data = JSON.parse(data); } catch {} }
    if (data.body) { try { data = JSON.parse(data.body); } catch { data = data.body; } }
    return { prompts: data.prompts || [], productImageCount: data.productImageCount || 0 };
  } catch (err) { console.error("Nova 오류:", err.message); return { prompts: [], productImageCount: 0 }; }
}

// ===== Gemini Lambda 호출 =====
async function callGemini(payload) {
  const url = process.env.GEMINI_LAMBDA_URL;
  if (!url) throw new Error("Gemini Lambda URL 미설정");
  console.log(`[Gemini] 호출 (페이로드: ${JSON.stringify(payload).length} bytes)`);
  const res = await axios.post(url, payload, { timeout: 90000, maxBodyLength: Infinity });
  let data = res.data;
  if (typeof data === "string") { try { data = JSON.parse(data); } catch {} }
  if (data.body) { try { data = JSON.parse(data.body); } catch { data = data.body; } }
  return data;
}

// ===== 메인 생성 API =====
app.post("/generate", auth, upload.array("images", 5), async (req, res) => {
  try {
    const { message, template, prevHtml } = req.body;
    const userId = req.user.id;
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    // 1. 업로드된 이미지 처리
    const userImages = (req.files || []).map((f, i) => ({
      number: i + 1,
      url: `${baseUrl}/uploads/${f.filename}`,
      originalName: Buffer.from(f.originalname, "latin1").toString("utf8"),
    }));

    // 수정 모드면 기존 이미지 URL 보존 + Gemini 호출
    if (prevHtml) {
      const sharp = require("sharp");
      const userImagesBase64 = [];
      for (const img of userImages) {
        try {
          const filePath = path.join(UPLOAD_DIR, path.basename(img.url));
          const resized = await sharp(filePath).resize(512, 512, { fit: "inside" }).jpeg({ quality: 70 }).toBuffer();
          userImagesBase64.push({ number: img.number, url: img.url, base64: resized.toString("base64"), mimeType: "image/jpeg" });
        } catch { userImagesBase64.push({ number: img.number, url: img.url }); }
      }

      // 기존 HTML에서 이미지 URL 추출
      const existingImages = [];
      const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/gi;
      let match;
      while ((match = imgRegex.exec(prevHtml)) !== null) {
        existingImages.push(match[1]);
      }
      const bgRegex = /background-image:\s*url\(['"]?([^'")\s]+)['"]?\)/gi;
      while ((match = bgRegex.exec(prevHtml)) !== null) {
        existingImages.push(match[1]);
      }

      const result = await callGemini({
        mode: "edit",
        message,
        prevHtml: prevHtml.slice(0, 6000),
        userImages: userImagesBase64,
        existingImages,
      });

      const html = result.html || "";
      await db.execute("INSERT INTO chat_messages (user_id, role, content) VALUES (?,?,?)", [userId, "user", message || ""]);
      await db.execute("INSERT INTO chat_messages (user_id, role, content) VALUES (?,?,?)", [userId, "assistant", "수정이 반영되었습니다."]);
      return res.json({ html });
    }

    // === 새 생성: 2단계 프로세스 ===

    // STEP 1: Gemini 1차 호출 - 필요한 이미지 목록 요청
    console.log("[STEP 1] Gemini에게 필요한 이미지 목록 요청...");
    const sharp = require("sharp");
    const userImagesBase64 = [];
    for (const img of userImages) {
      try {
        const filePath = path.join(UPLOAD_DIR, path.basename(img.url));
        const resized = await sharp(filePath).resize(512, 512, { fit: "inside" }).jpeg({ quality: 70 }).toBuffer();
        userImagesBase64.push({ number: img.number, url: img.url, base64: resized.toString("base64"), mimeType: "image/jpeg" });
      } catch { userImagesBase64.push({ number: img.number, url: img.url }); }
    }

    const imageListResult = await callGemini({
      mode: "plan",
      message,
      template: template || "hero",
      userImages: userImagesBase64,
    });

    const neededImages = imageListResult.images || [];
    console.log(`[STEP 1] 필요한 이미지 ${neededImages.length}개: ${neededImages.map(i => i.description).join(", ")}`);

    // STEP 2: Nova → SD 이미지 생성
    let generatedImages = [];
    if (process.env.SD_API_URL && neededImages.length > 0) {
      console.log("[STEP 2] Nova에게 SD 프롬프트 요청...");
      const novaResult = await callNovaForPrompts(message, neededImages.map(i => i.description).join("\n"));
      const sdPrompts = novaResult.prompts || [];
      console.log(`[STEP 2] SD 프롬프트 ${sdPrompts.length}개`);

      for (let i = 0; i < sdPrompts.length; i++) {
        const fileName = await generateSDImage(sdPrompts[i]);
        if (fileName) {
          generatedImages.push({
            role: neededImages[i]?.role || "배경",
            description: neededImages[i]?.description || "",
            url: `${baseUrl}/images/${fileName}`,
          });
        }
      }
      console.log(`[STEP 2] SD 이미지 ${generatedImages.length}개 생성`);
    }

    // STEP 3: Gemini 2차 호출 - 최종 HTML 생성
    console.log("[STEP 3] Gemini에게 최종 HTML 생성 요청...");
    const finalResult = await callGemini({
      mode: "generate",
      message,
      template: template || "hero",
      userImages: userImagesBase64,
      generatedImages,
    });

    let html = finalResult.html || "";

    // 강제 이미지 삽입 (Gemini가 누락한 경우)
    const allImgUrls = [...userImages.map(i => i.url), ...generatedImages.map(i => i.url)];
    for (const imgUrl of allImgUrls) {
      const ph = /<div[^>]*[^<]*(?:이미지|image|placeholder|상품|제품|사진)[^<]*<\/div>/i;
      if (ph.test(html)) {
        html = html.replace(ph, `<img src="${imgUrl}" alt="" style="max-width:100%;max-height:400px;object-fit:contain;display:block;margin:0 auto;" />`);
      }
    }

    console.log(`[STEP 3] 완료`);

    await db.execute("INSERT INTO generated_pages (user_id, product_name, ai_type, result_html) VALUES (?,?,?,?)",
      [userId, message?.slice(0, 50) || "상품", "gemini", html]);
    await db.execute("INSERT INTO chat_messages (user_id, role, content) VALUES (?,?,?)", [userId, "user", message || ""]);
    const imgMsg = generatedImages.length > 0 ? ` (AI 이미지 ${generatedImages.length}장 생성)` : "";
    await db.execute("INSERT INTO chat_messages (user_id, role, content) VALUES (?,?,?)",
      [userId, "assistant", `상세페이지가 생성되었습니다.${imgMsg}`]);

    res.json({ html, generatedImages });
  } catch (err) { console.error("생성 오류:", err); res.status(500).json({ error: "페이지 생성 실패" }); }
});

// 채팅 기록
app.get("/chat/history", auth, async (req, res) => {
  try {
    const [rows] = await db.execute("SELECT role, content FROM chat_messages WHERE user_id=? ORDER BY created_at ASC", [req.user.id]);
    res.json({ messages: rows });
  } catch { res.json({ messages: [] }); }
});

app.delete("/chat/history", auth, async (req, res) => {
  try { await db.execute("DELETE FROM chat_messages WHERE user_id=?", [req.user.id]); res.json({ ok: true }); }
  catch { res.status(500).json({ error: "삭제 실패" }); }
});

app.get("/", (req, res) => {
  res.json({ message: "AI 상품 페이지 빌더", sd: !!process.env.SD_API_URL });
});

async function startServer() {
  try {
    await initDB();
    app.listen(port, () => {
      console.log(`서버 시작 (포트: ${port})`);
      console.log(`SD API: ${process.env.SD_API_URL || "미설정"}`);
    });
  } catch (err) { console.error("서버 시작 실패:", err); process.exit(1); }
}
startServer();

