# AI 상품 상세페이지 자동 생성기

대화형 AI가 상품 정보와 이미지를 분석하여 전문적인 상품 상세페이지를 자동으로 생성하는 웹 서비스입니다.

사이트 주소: http://kmucloud-17-s3.s3-website-us-east-1.amazonaws.com

## 사용한 AWS 리소스

| 리소스 | 이름 | 용도 |
|--------|------|------|
| S3 | kmucloud-17-s3 | 프론트엔드 정적 웹 호스팅 |
| EC2 | kmucloud-17-ec2 | Express 서버 (API 중계, 이미지 처리, 인증) |
| RDS | 기존 DB 사용 | 사용자 계정, 채팅 기록, 생성 기록 저장 |
| Lambda | kmucloud-17-gemini (Node.js) | Gemini API를 호출하여 상세페이지 HTML 생성 |
| Lambda | kmucloud-17-nova (Python) | Bedrock Nova를 호출하여 Stable Diffusion용 이미지 프롬프트 생성 |
| Bedrock | Amazon Nova Lite | 이미지 생성용 프롬프트 생성 |

## 이미지 생성에 대해

처음에는 텍스트 기반으로만 상세페이지를 생성했지만, 이미지가 없으니 페이지가 너무 심심해서 Stable Diffusion을 연동하여 배경/상품 이미지를 자동 생성하는 기능을 추가해봤습니다. 이미지 생성은 집 PC에서 로컬로 Stable Diffusion를 실행하여 처리하고 있습니다.

## 주요 기능

- 채팅 기반 상세페이지 생성 (상품명만 입력해도 동작)
- 이미지 최대 5장 첨부 (번호 자동 부여, Gemini가 이미지를 직접 분석)
- Stable Diffusion 연동으로 배경/상품 이미지 자동 생성 (로컬 PC)
- 3가지 레이아웃 템플릿 (히어로 중심형, 카드 그리드형, 스토리텔링형)
- 생성 후 대화로 수정 요청 가능
- 회원가입/로그인 (JWT 기반, 24시간 유지)
- 로그인 시 인터랙티브 튜토리얼

## 테스트 방법

1. http://kmucloud-17-s3.s3-website-us-east-1.amazonaws.com 접속
2. 간단한 회원가입 (닉네임 + 비밀번호)
3. 이후 내부 튜토리얼에 따라 진행

## 실행 방법 (직접 배포 시)

### Lambda 배포

**kmucloud-17-gemini (Node.js 20.x)**
- `4.product-page-ai/gemini-lambda/` 폴더에서 `npm install` 후 zip 압축하여 업로드
- 환경변수: `GEMINI_API_KEY` 설정

**kmucloud-17-nova (Python 3.12)**
- `4.product-page-ai/bedrock-lambda/lambda_function.py` 코드 붙여넣기


### EC2 서버 (kmucloud-17-ec2)

```bash
cd server
npm install
cp .env.example .env  # Lambda URL, DB 정보, SD API 정보 입력
sudo node server.js
```

### 프론트엔드 (kmucloud-17-s3)

```bash
cd client
npm install
npm run build
# build/ 폴더 내용을 S3 버킷에 업로드
```


## 프로젝트 구조

```
4.product-page-ai/
├── client/           # React 프론트엔드 (S3 호스팅)
├── server/           # Express 서버 (EC2)
├── gemini-lambda/    # Gemini 카피라이팅 Lambda
└── bedrock-lambda/   # Nova 이미지 프롬프트 Lambda
```
