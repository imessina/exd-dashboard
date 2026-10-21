import asyncio
import json
import sys
from pathlib import Path


# Permite importar main.py desde la carpeta raíz del proyecto
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from main import get_or_create_agent


GOLDEN_SET_PATH = Path(__file__).parent / "golden_set.json"


def cargar_golden_set():
    with open(GOLDEN_SET_PATH, "r", encoding="utf-8") as archivo:
        return json.load(archivo)


async def ejecutar_caso(caso):
    print("\n==============================")
    print(f"Ejecutando: {caso['id']}")
    print(f"Pregunta: {caso['question']}")
    print("==============================")

    # Creamos/obtenemos el mismo agente que utiliza TalentIA
    agent = get_or_create_agent("ragas-evaluation")

    print("\nRespuesta de TalentIA:\n")

    async for event in agent.stream_async(caso["question"]):
        print(event)


async def main():
    casos = cargar_golden_set()

    print(f"Casos cargados: {len(casos)}")

    for caso in casos:
        await ejecutar_caso(caso)


if __name__ == "__main__":
    asyncio.run(main())