#!/usr/bin/env python3
"""
Script para probar TalentIA con las nuevas herramientas
"""
import boto3
import json
import sys

# Runtime ID del deploy
RUNTIME_ID = "DxTalentAI_DxTalentAI-FCGq0z5s5F"
REGION = "us-east-1"

def invoke_agent(prompt: str):
    """Invoca el agente TalentIA con un prompt"""
    try:
        client = boto3.client('bedrock-agentcore-runtime', region_name=REGION)
        
        print(f"\n🤖 Enviando query a TalentIA:")
        print(f"   '{prompt}'")
        print(f"\n⏳ Esperando respuesta...\n")
        
        response = client.invoke_runtime(
            runtimeIdentifier=RUNTIME_ID,
            inputText=prompt
        )
        
        # Procesar respuesta streaming
        event_stream = response.get('completion', response.get('EventStream', []))
        full_response = ""
        
        for event in event_stream:
            if 'chunk' in event:
                chunk = event['chunk']
                if 'bytes' in chunk:
                    text = chunk['bytes'].decode('utf-8')
                    full_response += text
                    print(text, end='', flush=True)
            elif 'messageComplete' in event:
                # Último evento del stream
                continue
        
        print("\n")
        return full_response
        
    except Exception as e:
        print(f"\n❌ Error al invocar el agente: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    queries = [
        "¿Quién se libera en los próximos 30 días?",
        "¿Qué proyectos tenemos activos actualmente?",
        "Muéstrame las oportunidades abiertas",
    ]
    
    # Usar query del argumento si se provee
    if len(sys.argv) > 1:
        queries = [" ".join(sys.argv[1:])]
    
    for query in queries:
        result = invoke_agent(query)
        if result:
            print("=" * 80)
        print()
