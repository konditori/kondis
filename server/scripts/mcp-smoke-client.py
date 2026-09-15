"""Independent JSON-RPC smoke client for the disposable MCP test server.

Usage: python3 scripts/mcp-smoke-client.py /path/to/temporary/credentials.json
Only run against the server created by mcp-smoke-server.ts: this creates test workouts.
"""
import json
import sys
import time
import urllib.request
import uuid

with open(sys.argv[1], encoding="utf-8") as handle:
    credentials = json.load(handle)
endpoint = credentials["endpoint"]
sequence = 0


def http(url, data, extra_headers=None):
    headers = {
        "Authorization": "Bearer " + credentials["key"],
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        "MCP-Protocol-Version": "2025-11-25",
        **(extra_headers or {}),
    }
    with urllib.request.urlopen(urllib.request.Request(url, data=data, headers=headers), timeout=15) as response:
        return json.load(response)


def rpc(method, params):
    global sequence
    sequence += 1
    response = http(endpoint, json.dumps({"jsonrpc": "2.0", "id": sequence, "method": method, "params": params}).encode())
    assert "error" not in response, response
    assert not response["result"].get("isError"), response
    return response["result"]


def call(name, arguments):
    return rpc("tools/call", {"name": name, "arguments": arguments})["structuredContent"]["data"]


rpc("initialize", {"protocolVersion": "2025-11-25", "capabilities": {}, "clientInfo": {"name": "kondis-python-smoke", "version": "1"}})
tools = rpc("tools/list", {})["tools"]
assert len(tools) == 12, len(tools)
activity = {"idempotencyKey": str(uuid.uuid4()), "name": "Python smoke workout", "sport": "run", "startedAt": "2026-09-15T08:00:00Z", "elapsedTime": 2400, "distance": 6000}
created = call("create_manual_activity", activity)
replayed = call("create_manual_activity", activity)
assert created["activityId"] == replayed["activityId"]
detail = call("get_activity", {"id": created["activityId"]})
call("update_activity", {"id": detail["id"], "revision": detail["revision"], "idempotencyKey": str(uuid.uuid4()), "name": "Edited by Python"})
summary = call("summarize_training", {"from": "2026-09-01T00:00:00Z", "to": "2026-10-01T00:00:00Z", "timezone": "Europe/Lisbon"})
assert summary["periods"]
rpc("resources/read", {"uri": "kondis://metrics"})
rpc("prompts/get", {"name": "weekly_training_review", "arguments": {"request": "Review this week"}})

gpx = b'''<?xml version="1.0"?><gpx version="1.1" creator="Kondis smoke"><trk><name>Smoke GPX</name><type>running</type><trkseg><trkpt lat="38.7" lon="-9.1"><time>2026-09-15T10:00:00Z</time></trkpt><trkpt lat="38.71" lon="-9.11"><time>2026-09-15T10:10:00Z</time></trkpt></trkseg></trk></gpx>'''
staged = http(endpoint + "/uploads", gpx, {"Content-Type": "application/octet-stream", "X-Filename": "smoke.gpx"})
operation = call("start_activity_import", {"uploadId": staged["uploadId"], "idempotencyKey": str(uuid.uuid4())})
for attempt in range(30):
    progress = call("get_operation", {"id": operation["operationId"]})
    if progress["status"] in ("completed", "failed"):
        break
    time.sleep(0.5)
assert progress["status"] == "completed", progress
assert progress["activityIds"], progress
print("Python client: discovery, creation/retry, revisioned edit, summary, resources, prompt, staged GPX import and completion passed.")
