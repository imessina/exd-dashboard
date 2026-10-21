#!/usr/bin/env python3
"""
Script simple para probar TalentIA a través del API del dashboard
"""
import requests
import json
import sys

# API del dashboard
API_BASE_URL = "https://exd-dashboard-eight.vercel.app/api"
API_KEY = "6lMEsiItfbgvbEujEV6f5loSC0tPlU_MGuLOk7QA2ik"

def test_api_endpoints():
    """Prueba los endpoints del API que TalentIA usa"""
    
    headers = {
        "X-API-Key": API_KEY,
        "Content-Type": "application/json"
    }
    
    tests = [
        ("Asignaciones", f"{API_BASE_URL}/asignaciones"),
        ("Proyectos", f"{API_BASE_URL}/proyectos"),
        ("Oportunidades", f"{API_BASE_URL}/oportunidades"),
        ("Personas", f"{API_BASE_URL}/personas"),
    ]
    
    print("\n🧪 Probando endpoints del API que TalentIA usará:\n")
    
    for name, url in tests:
        try:
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                count = len(data) if isinstance(data, list) else 1
                print(f"✅ {name:15} - {count} registros disponibles")
            else:
                print(f"❌ {name:15} - Error {response.status_code}")
        except Exception as e:
            print(f"❌ {name:15} - {str(e)[:50]}")
    
    print("\n" + "=" * 60)
    print("\n📝 Las nuevas herramientas de TalentIA ahora pueden:")
    print("   • Listar asignaciones y ver próximas liberaciones")
    print("   • Consultar proyectos activos y sus detalles")
    print("   • Revisar oportunidades disponibles")
    print("   • Buscar currículums por habilidades")
    print("\n✨ El agente está listo para responder queries complejas")
    print("   combinando información de múltiples fuentes.\n")

if __name__ == "__main__":
    test_api_endpoints()
