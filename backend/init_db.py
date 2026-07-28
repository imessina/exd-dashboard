#!/usr/bin/env python
"""
Initialize database tables. Run this once after deployment.
Usage: python init_db.py
"""

from database import Base, engine
import models  # Importa los modelos para registrarlos en Base.metadata


if __name__ == "__main__":
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("✓ Database tables created successfully!")