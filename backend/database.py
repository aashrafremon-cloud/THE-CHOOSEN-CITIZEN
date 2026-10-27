"""
FIREGUARD AI - SQLite Database Engine
Stores real-time ESP32 sensor telemetry, alert events, and AI detection history.
"""

import sqlite3
import json
import os
from datetime import datetime
from typing import List, Dict, Any, Optional

DB_PATH = os.environ.get("FIREGUARD_DB_PATH", "fireguard.db")

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    # 1. Telemetry table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS telemetry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL,
        temperature REAL NOT NULL,
        humidity REAL NOT NULL,
        mq7_co_ppm REAL NOT NULL,
        flame_detected INTEGER NOT NULL,
        flame_raw INTEGER NOT NULL,
        sound_db REAL NOT NULL,
        gps_lat REAL DEFAULT 0.0,
        gps_lng REAL DEFAULT 0.0,
        gps_altitude REAL DEFAULT 0.0,
        gps_satellites INTEGER DEFAULT 0,
        battery_mv INTEGER DEFAULT 0,
        relay_active INTEGER DEFAULT 0,
        status TEXT DEFAULT 'NORMAL',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 2. Alert Events table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        source TEXT NOT NULL,
        value TEXT,
        acknowledged INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 3. AI Detections table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS detections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        label TEXT NOT NULL,
        confidence REAL NOT NULL,
        x REAL,
        y REAL,
        w REAL,
        h REAL,
        inference_time_ms REAL,
        engine TEXT,
        snapshot_path TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 4. Settings key-value store
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );
    """)

    conn.commit()
    conn.close()

def save_telemetry(data: Dict[str, Any]) -> int:
    conn = get_connection()
    cursor = conn.cursor()
    gps = data.get("gps", {}) or {}
    
    cursor.execute("""
        INSERT INTO telemetry (
            device_id, temperature, humidity, mq7_co_ppm,
            flame_detected, flame_raw, sound_db,
            gps_lat, gps_lng, gps_altitude, gps_satellites,
            battery_mv, relay_active, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        data.get("deviceId", "ESP32-NODE-01"),
        float(data.get("temperature", 25.0)),
        float(data.get("humidity", 50.0)),
        float(data.get("mq7_co_ppm", 15.0)),
        1 if data.get("flame_detected") else 0,
        int(data.get("flame_raw", 4095)),
        float(data.get("sound_db", 45.0)),
        float(gps.get("lat", 37.7749)),
        float(gps.get("lng", -122.4194)),
        float(gps.get("altitude", 15.0)),
        int(gps.get("satellites", 6)),
        int(data.get("battery_mv", 3700)),
        1 if data.get("relay_active") else 0,
        data.get("status", "NORMAL"),
        data.get("timestamp", datetime.utcnow().isoformat())
    ))
    
    rec_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return rec_id

def get_latest_telemetry() -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM telemetry ORDER BY id DESC LIMIT 1")
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    return dict(row)

def get_telemetry_history(limit: int = 100) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM telemetry ORDER BY id DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows][::-1]

def log_event(event_type: str, severity: str, title: str, description: str, source: str, value: Any = None) -> int:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO events (event_type, severity, title, description, source, value)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (event_type, severity, title, description, source, str(value) if value is not None else None))
    rec_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return rec_id

def get_events(limit: int = 100, severity: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    if severity:
        cursor.execute("SELECT * FROM events WHERE severity = ? ORDER BY id DESC LIMIT ?", (severity, limit))
    else:
        cursor.execute("SELECT * FROM events ORDER BY id DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]
