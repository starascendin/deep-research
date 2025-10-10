#!/usr/bin/env python3
import argparse
import json
import sys
import time
from typing import Any, Dict, Optional, Tuple

import requests


def fetch_openapi(base_url: str) -> Dict[str, Any]:
    url = base_url.rstrip("/") + "/openapi.json"
    r = requests.get(url, timeout=10)
    r.raise_for_status()
    return r.json()


def find_path(openapi: Dict[str, Any], *, contains: Tuple[str, ...], method: Optional[str] = None) -> Tuple[str, str]:
    paths = openapi.get("paths", {})
    candidates = []
    for path, methods in paths.items():
        for mtd, op in methods.items():
            if method and mtd.lower() != method.lower():
                continue
            p = path.lower()
            if all(c in p for c in contains):
                candidates.append((path, mtd.upper(), op))
    if not candidates:
        # Try operationId search if available
        for path, methods in paths.items():
            for mtd, op in methods.items():
                if method and mtd.lower() != method.lower():
                    continue
                opid = (op.get("operationId") or "").lower()
                if all(c in opid for c in contains):
                    return path, mtd.upper()
        raise RuntimeError(f"Could not find endpoint containing {contains} with method={method}")
    # Prefer longer/more specific matches
    candidates.sort(key=lambda x: (len(x[0]), x[1] == (method or "").upper()), reverse=True)
    return candidates[0][0], candidates[0][1]


def substitute_path_params(path: str, **params) -> str:
    out = path
    for k, v in params.items():
        out = out.replace("{" + k + "}", str(v))
    return out


def create_run(base_url: str, openapi: Dict[str, Any], workflow_id: str) -> str:
    # Look for POST create-run or runs
    try:
        path, method = find_path(openapi, contains=("workflows", "create", "run"), method="post")
    except Exception:
        path, method = find_path(openapi, contains=("workflows", "runs"), method="post")
    url_path = substitute_path_params(path, workflowId=workflow_id)
    url = base_url.rstrip("/") + url_path
    resp = requests.post(url, json={}, timeout=30)
    resp.raise_for_status()
    data = resp.json() if resp.content else {}
    run_id = data.get("runId") or data.get("id") or data.get("run_id")
    if not run_id:
        raise RuntimeError(f"Create run did not return runId. Response: {data}")
    return run_id


def start_stream_vnext(base_url: str, openapi: Dict[str, Any], workflow_id: str, run_id: str, input_data: Dict[str, Any]):
    # Kick off the vNext stream (server caches chunks for observe)
    try:
        path, method = find_path(openapi, contains=("workflows", "stream", "vnext"), method="post")
    except Exception:
        # Fallback: start async run (no chunk cache for observe-stream-vnext)
        path, method = find_path(openapi, contains=("workflows", "start"), method="post")
    url_path = substitute_path_params(path, workflowId=workflow_id, runId=run_id)
    url = base_url.rstrip("/") + url_path
    payload = {"inputData": input_data}
    # Some servers accept closeOnSuspend
    payload["closeOnSuspend"] = False
    try:
        # Fire-and-forget; server will cache chunks
        requests.post(url, json=payload, timeout=5)
    except requests.exceptions.ReadTimeout:
        # It's okay if it times out quickly; background run continues server-side
        pass


def observe_stream_vnext(base_url: str, openapi: Dict[str, Any], workflow_id: str, run_id: str):
    # Try observe vNext stream first
    try:
        path, method = find_path(openapi, contains=("workflows", "observe", "stream", "vnext"))
    except Exception:
        # Fallback to generic watch
        path, method = find_path(openapi, contains=("workflows", "watch"))
    url_path = substitute_path_params(path, workflowId=workflow_id, runId=run_id)
    url = base_url.rstrip("/") + url_path
    with requests.request(method, url, stream=True) as r:
        r.raise_for_status()
        for raw in r.iter_lines(decode_unicode=True):
            if not raw:
                continue
            line = raw
            if line.startswith("data:"):
                line = line.split(":", 1)[1].strip()
            try:
                obj = json.loads(line)
                yield obj
            except Exception:
                # Not JSON? Just echo the line
                yield {"raw": line}


def resume_stream_vnext(base_url: str, openapi: Dict[str, Any], workflow_id: str, run_id: str, step: str, resume_data: Dict[str, Any]) -> bool:
    try:
        path, method = find_path(openapi, contains=("workflows", "resume", "stream", "vnext"), method="post")
    except Exception:
        # Fallback to generic resume
        path, method = find_path(openapi, contains=("workflows", "resume"), method="post")
    url_path = substitute_path_params(path, workflowId=workflow_id, runId=run_id)
    url = base_url.rstrip("/") + url_path
    payload = {"step": step, "resumeData": resume_data}
    resp = requests.post(url, json=payload, stream=False)
    if resp.status_code // 100 == 2:
        return True
    return False


def main():
    parser = argparse.ArgumentParser(description="Stream research workflow results from Mastra server using OpenAPI.")
    parser.add_argument("--server", default="http://localhost:4111", help="Mastra server base URL (default: http://localhost:4111)")
    parser.add_argument("--workflow-id", default="research-workflow", help="Workflow ID to run (default: research-workflow)")
    parser.add_argument("--query", default=None, help="Research query (e.g., 'give me the news on nvda')")
    parser.add_argument("--auto-approve", action="store_true", help="Auto-approve at approval step")
    args = parser.parse_args()

    user_query = args.query or input("Enter your research query: ").strip()
    if not user_query:
        print("Empty query; exiting.")
        sys.exit(1)

    base = args.server.rstrip("/")
    try:
        openapi = fetch_openapi(base)
    except Exception as e:
        print(f"Failed to fetch OpenAPI from {base}/openapi.json: {e}")
        sys.exit(1)

    workflow_id = args.workflow_id
    print(f"Using workflow: {workflow_id}")

    # 1) Create run
    run_id = create_run(base, openapi, workflow_id)
    print(f"Run created: {run_id}")

    # 2) Start streaming run (server-side)
    #    We pass empty inputData to start; the workflow will suspend for user query.
    start_stream_vnext(base, openapi, workflow_id, run_id, input_data={})
    print("Started workflow stream (server-side). Observing stream...")

    # 3) Resume get-user-query with the user query (retry until accepted)
    for i in range(15):
        ok = resume_stream_vnext(base, openapi, workflow_id, run_id, step="get-user-query", resume_data={"query": user_query})
        if ok:
            print("Supplied user query to workflow.")
            break
        time.sleep(0.5)
    else:
        print("Warning: Could not resume 'get-user-query' step automatically. Continuing to observe stream.")

    # 4) Consume observe/watch stream and auto-approve at the end if requested
    try:
        for evt in observe_stream_vnext(base, openapi, workflow_id, run_id):
            # Print the event incrementally
            if "raw" in evt:
                print(evt["raw"])  # raw text line
            else:
                print(json.dumps(evt, ensure_ascii=False))

            # If we detect a suspend for approval, auto-approve if requested
            if args.auto_approve:
                blob = json.dumps(evt).lower()
                if "\"type\":\"suspend\"" in blob and "approval" in blob:
                    for _ in range(10):
                        ok = resume_stream_vnext(base, openapi, workflow_id, run_id, step="approval", resume_data={"approved": True})
                        if ok:
                            print("Auto-approved research results.")
                            break
                        time.sleep(0.5)
    except KeyboardInterrupt:
        print("Interrupted by user.")


if __name__ == "__main__":
    main()

