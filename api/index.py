import sys
import os

# Add parent directory to path so server.py imports properly
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server import app

# Vercel Serverless Function entrypoint
app = app
