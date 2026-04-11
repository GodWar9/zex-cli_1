"""
sentinel/models.py — Data models for CortexSentinel.
"""
from pydantic import BaseModel
from typing import Optional
import time


class SentinelAlert(BaseModel):
    timestamp: float
    alert: str
    action: str
    reason: str
    severity: str = "warning"  # "info", "warning", "critical"
