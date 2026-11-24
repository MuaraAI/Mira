#!/usr/bin/env python3
"""CI policy & security guard enforcing AGENT.md and CONTRIBUTING.md rules.

Checks run against git diff (PR base..HEAD) and tracked files:
1. Forbidden files (.env, *.db, internal planning/spec docs, etc.)
2. Zero secrets & hardcoded secret fallbacks in added lines
3. Anti-slop rules for landing-page/src (no Google Fonts CDN, no em-dash in UI copy)
4. Dual-schema reminder/gate when app/social/db.py alters tables/columns
5. No AI Co-authored-by trailers in PR commits
"""

from __future__ import annotations

import os
import re
import subprocess  # noqa: S404
import sys

FORBIDDEN_PATH_PATTERNS = [
    re.compile(r"(^|/)\.env($|\.(?!example$))"),
    re.compile(r"\.(db|sqlite|sqlite3|pem|key)$", re.IGNORECASE),
    re.compile(r"^docs/(specs|superpowers|prd|releases)/"),
    re.compile(r"^docs/.*-(plan|design)\.md$"),
    re.compile(r"^docs/login-captcha-recovery\.md$"),
    re.compile(r"^(h\.md|h\.mdt|anti-slop/|graphify-out/|\.superpowers/)"),
]

SECRET_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("Personal API key Mira/UBSI real", re.compile(r"\bmuara_(mira|ubsi)_[0-9a-f]{24,}\b")),
    ("GitHub personal access token", re.compile(r"\b(ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b")),
    ("OpenAI / Anthropic API key", re.compile(r"\b(sk-proj-[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,})\b")),
    ("Google API key", re.compile(r"\bAIza[0-9A-Za-z\-_]{35}\b")),
    ("Private key PEM block", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    (
        "Discord webhook URL dengan token nyata",
        re.compile(r"https://(canary\.|ptb\.)?discord(app)?\.com/api/webhooks/\d{17,20}/[A-Za-z0-9_-]{50,}"),
    ),
    (
        "Hardcoded fallback untuk env rahasia",
        re.compile(
            r"""os\.(?:getenv|environ\.get)\(\s*["'](API_KEY|SUPABASE_DB_URL|VAPID_PRIVATE_KEY|ELEARNING_PW|STUDENTS_PW|STUDENTV2_PASS|ELEARNING_PASS)["']\s*,\s*["'][^"']+["']\s*\)"""
        ),
    ),
]

DUMMY_ALLOWLIST = (
    "example.com",
    "dummy",
    "placeholder",
    "your_key",
    "your-key",
    "xxxx",
    "1234567890123",
    "abcdef1234567890",
)

COAUTHOR_AI_PATTERN = re.compile(
    r"^\s*co-authored-by:\s*.*(claude|anthropic|chatgpt|openai|copilot|gemini)",
    re.IGNORECASE | re.MULTILINE,
)

SOCIAL_SCHEMA_PATTERN = re.compile(r"\b(CREATE TABLE|ALTER TABLE|_ADDED_COLUMNS|_PG_EXTRA_TABLES)\b")
GOOGLE_FONTS_CDN_PATTERN = re.compile(r"fonts\.(googleapis|gstatic)\.com", re.IGNORECASE)


def run_git(*args: str) -> str:
    result = subprocess.run(["git", *args], capture_output=True, text=True, check=False)  # noqa: S603, S607
    if result.returncode != 0:
        return ""
    return result.stdout


def get_diff_range() -> str:
    base_sha = os.getenv("PR_BASE_SHA", "").strip()
    head_sha = os.getenv("PR_HEAD_SHA", "HEAD").strip() or "HEAD"
    if base_sha and base_sha != "0" * 40:
        return f"{base_sha}...{head_sha}"
    return "HEAD~1..HEAD"


def check_forbidden_tracked_files() -> list[str]:
    errors: list[str] = []
    tracked = run_git("ls-files").splitlines()
    for path in tracked:
        for pat in FORBIDDEN_PATH_PATTERNS:
            if pat.search(path):
                errors.append(f"[FORBIDDEN FILE] `{path}` tidak boleh di-commit ke git (lihat AGENT.md & .gitignore).")
                break
    return errors


def parse_added_lines(diff_text: str) -> list[tuple[str, int, str]]:
    added: list[tuple[str, int, str]] = []
    current_file = ""
    line_no = 0
    for raw in diff_text.splitlines():
        if raw.startswith("+++ b/"):
            current_file = raw[6:]
            continue
        if raw.startswith("@@ "):
            m = re.search(r"\+(\d+)", raw)
            line_no = int(m.group(1)) - 1 if m else 0
            continue
        if raw.startswith("+") and not raw.startswith("+++"):
            line_no += 1
            added.append((current_file, line_no, raw[1:]))
        elif not raw.startswith("-"):
            line_no += 1
    return added


def check_diff_rules(diff_range: str) -> list[str]:
    errors: list[str] = []
    changed_files = [f for f in run_git("diff", "--name-only", diff_range).splitlines() if f]
    if not changed_files:
        return errors

    diff_text = run_git("diff", "--unified=0", diff_range)
    added_lines = parse_added_lines(diff_text)

    social_schema_touched = False

    for file_path, line_no, line in added_lines:
        # Skip self-checks in this policy script
        if file_path == "scripts/ci_policy_check.py":
            continue

        lower_line = line.lower()

        # 1. Secret & hardcoded fallback scan
        if not any(marker in lower_line for marker in DUMMY_ALLOWLIST):
            for label, pat in SECRET_PATTERNS:
                if pat.search(line):
                    errors.append(f"[SECRET] {file_path}:{line_no} terdeteksi pola sensitif ({label}).")

        # 2. Anti-slop frontend checks
        if file_path.startswith("landing-page/src/") and file_path.endswith((".ts", ".tsx", ".css")):
            if GOOGLE_FONTS_CDN_PATTERN.search(line):
                errors.append(f"[ANTI-SLOP] {file_path}:{line_no} dilarang memakai CDN Google Fonts (wajib self-hosted .woff2).")
            stripped = line.lstrip()
            is_comment = stripped.startswith("//") or stripped.startswith("*") or stripped.startswith("/*")
            if "—" in line and not is_comment:
                errors.append(f"[ANTI-SLOP] {file_path}:{line_no} dilarang memakai em-dash (—) di UI copy (pakai ':' atau '.').")

        # 3. Social dual-schema check
        if file_path == "app/social/db.py" and SOCIAL_SCHEMA_PATTERN.search(line):
            social_schema_touched = True

    if social_schema_touched:
        has_migration = any(f.startswith("supabase/migrations/") and f.endswith(".sql") for f in changed_files)
        if not has_migration:
            errors.append(
                "[DUAL-SCHEMA] Perubahan skema di `app/social/db.py` wajib disertai file migration baru di `supabase/migrations/` (lihat supabase/README.md)."
            )

    return errors


def check_commit_trailers(diff_range: str) -> list[str]:
    errors: list[str] = []
    # For range A...B, log A..B lists commits introduced by the PR
    log_range = diff_range.replace("...", "..")
    commits = run_git("log", log_range, "--format=%H%x1f%s%x1f%b%x1e")
    for entry in commits.split("\x1e"):
        if not entry.strip():
            continue
        parts = entry.split("\x1f")
        sha = parts[0].strip()[:7]
        body = parts[2] if len(parts) > 2 else ""
        if COAUTHOR_AI_PATTERN.search(body):
            errors.append(f"[COMMIT] Commit `{sha}` mengandung trailer `Co-authored-by` AI; hapus sebelum merge.")
    return errors


def check_pr_title() -> list[str]:
    title = os.getenv("PR_TITLE", "").strip()
    if not title:
        return []
    pattern = re.compile(r"^(feat|fix|docs|refactor|chore|perf|test|ci|build|style|revert)(\([a-z0-9,._/-]+\))?!?: .+")
    if not pattern.match(title):
        return [
            f"[PR TITLE] Judul PR `{title}` harus mengikuti Conventional Commits (contoh: `feat(elearning): ...`, `fix(auth): ...`, `docs: ...`)."
        ]
    return []


def main() -> int:
    diff_range = get_diff_range()
    errors: list[str] = []
    errors.extend(check_pr_title())
    errors.extend(check_forbidden_tracked_files())
    errors.extend(check_diff_rules(diff_range))
    errors.extend(check_commit_trailers(diff_range))

    if errors:
        print("❌ CI Policy & Security Guard menemukan pelanggaran:\n")
        for err in errors:
            print(f"  - {err}")
        return 1

    print(f"✅ CI Policy & Security Guard lulus ({diff_range}).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
