import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from server import app

# Export WSGI application for Vercel serverless function at /api/update_account
app = app
