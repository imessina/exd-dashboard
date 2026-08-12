import time

import boto3


MODEL_ID = "global.anthropic.claude-sonnet-4-5-20250929-v1:0"
REGION = "us-east-1"


client = boto3.client(
    "bedrock-runtime",
    region_name=REGION,
)


def main():
    print("Probando Bedrock directamente...")
    print(f"Modelo: {MODEL_ID}")
    print()

    inicio = time.perf_counter()

    response = client.converse(
        modelId=MODEL_ID,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "text": "Hola"
                    }
                ],
            }
        ],
        inferenceConfig={
            "maxTokens": 100,
            "temperature": 0.2,
        },
    )

    fin = time.perf_counter()

    texto = response["output"]["message"]["content"][0]["text"]

    print("RESPUESTA:")
    print(texto)
    print()
    print(f"Tiempo total Bedrock: {fin - inicio:.2f} segundos")


if __name__ == "__main__":
    main()