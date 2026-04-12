import json
import boto3
from botocore.exceptions import ClientError


def lambda_handler(event, context):
    bedrock = boto3.client(service_name="bedrock-runtime", region_name="us-east-1")

    try:
        input_data = json.loads(event["body"])
    except (json.JSONDecodeError, KeyError):
        return {"statusCode": 400, "body": "Invalid JSON"}

    message = input_data.get("message", "")
    image_descriptions = input_data.get("imageDescriptions", "")

    prompt = (
        "당신은 Stable Diffusion 이미지 생성 전문가입니다.\n"
        "아래 상품 정보를 바탕으로, 상품 상세페이지에 사용할 이미지를 생성하기 위한 "
        "Stable Diffusion 프롬프트를 만들어주세요.\n\n"
        f"[상품 정보]\n{message}\n\n"
    )

    if image_descriptions:
        prompt += f"[필요한 이미지 설명]\n{image_descriptions}\n\n"

    prompt += (
        "규칙:\n"
        "1. 영어로 작성하세요\n"
        "2. 각 이미지 설명에 맞는 Stable Diffusion 프롬프트를 만드세요\n"
        "3. 고품질 키워드를 포함하세요 (8k, professional, studio lighting 등)\n"
        "4. 반드시 아래 JSON 형식으로만 응답하세요:\n"
        '{"prompts": ["프롬프트1", "프롬프트2", ...]}\n'
        "JSON 외의 텍스트는 절대 포함하지 마세요."
    )

    try:
        response = bedrock.converse(
            modelId="amazon.nova-lite-v1:0",
            messages=[{"role": "user", "content": [{"text": prompt}]}],
            inferenceConfig={"maxTokens": 1000, "temperature": 0.8},
        )

        text = response["output"]["message"]["content"][0]["text"]
        text = text.replace("```json", "").replace("```", "").strip()
        parsed = json.loads(text)
        return {"statusCode": 200, "body": json.dumps(parsed, ensure_ascii=False)}

    except (ClientError, json.JSONDecodeError, Exception) as e:
        print(f"Nova 오류: {e}")
        return {"statusCode": 200, "body": json.dumps({"prompts": []})}
