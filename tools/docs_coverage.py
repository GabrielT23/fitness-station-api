"""Checks that `docs/system/` keeps up with the code. Python 3 standard library only.

Three checks:

- DOC001 undocumented: every module folder in `src/modules/*` (except `prisma`) is cited
  between backticks in some file of `docs/system/`. A directory counts as cited when it, or
  a path inside it, appears.
- DOC002 dead path: every repository path cited between backticks in the documentation
  (`docs/`, `README.md`, `CLAUDE.md`) exists. Globs, placeholders (`<name>`, `...`) and
  snippets with spaces are examples, not paths, and are ignored.
- DOC003 unindexed: every file of `docs/system/` is listed in `docs/system/README.md`.

Usage:

    python3 tools/docs_coverage.py

Exits with 1 when it finds anything. The settings are the constants below; change them
when a module folder or a documentation root moves.
"""

from __future__ import annotations

import re
import sys
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS_SYSTEM = ROOT / "docs" / "system"
INDEX = DOCS_SYSTEM / "README.md"
#: Documentation read for DOC002 (dead paths), in addition to `docs/system/`.
EXTRA_DOCS = (ROOT / "README.md", ROOT / "CLAUDE.md", ROOT / "docs" / "glossary.md")
#: Folders matched by DOC001. Each direct child folder must be documented.
REQUIRE_GLOB = "src/modules/*"
REQUIRE_EXCLUDE = frozenset({"prisma"})
#: A backticked snippet is a repository path only when it starts with one of these.
REPO_ROOTS = ("src/", "prisma/", "tools/", "docs/", ".github/")

BACKTICKED = re.compile(r"`([^`\n]+)`")


@dataclass(frozen=True)
class Citation:
    file: Path
    line: int
    path: str


def repo_path(snippet: str) -> str | None:
    """`src/x.ts::name` -> `src/x.ts`; anything that is not a concrete repository path -> None."""
    if not snippet.startswith(REPO_ROOTS):
        return None
    if any(char in snippet for char in "*{<> ") or "..." in snippet:
        return None
    path = snippet.partition("::")[0]
    path = re.sub(r":\d+$", "", path)
    return path.rstrip("/")


def doc_files() -> list[Path]:
    system = sorted(DOCS_SYSTEM.glob("*.md"))
    return system + [path for path in EXTRA_DOCS if path.exists()]


def citations(files: list[Path]) -> Iterator[Citation]:
    for file in files:
        for number, text in enumerate(file.read_text(encoding="utf-8").splitlines(), start=1):
            for snippet in BACKTICKED.findall(text):
                path = repo_path(snippet.strip())
                if path:
                    yield Citation(file, number, path)


def required_modules() -> list[str]:
    modules = []
    for folder in sorted(ROOT.glob(REQUIRE_GLOB)):
        if folder.is_dir() and folder.name not in REQUIRE_EXCLUDE:
            modules.append(folder.relative_to(ROOT).as_posix())
    return modules


def is_cited(path: str, cited: set[str]) -> bool:
    return path in cited or any(item.startswith(path + "/") for item in cited)


def check_undocumented(cited: set[str]) -> list[str]:
    return [
        f"{module}/: DOC001 is not cited in any file of docs/system/"
        for module in required_modules()
        if not is_cited(module, cited)
    ]


def check_dead_paths(found: list[Citation]) -> list[str]:
    errors = []
    for citation in found:
        if not (ROOT / citation.path).exists():
            where = citation.file.relative_to(ROOT).as_posix()
            errors.append(f"{where}:{citation.line}: DOC002 cites `{citation.path}`, which does not exist")
    return errors


def check_index() -> list[str]:
    if not INDEX.exists():
        return [f"{INDEX.relative_to(ROOT).as_posix()}: DOC003 index is missing"]
    index_text = INDEX.read_text(encoding="utf-8")
    errors = []
    for file in sorted(DOCS_SYSTEM.glob("*.md")):
        if file == INDEX:
            continue
        name = re.escape(file.name)
        if not re.search(rf"`{name}`|\]\({name}\)", index_text):
            errors.append(f"docs/system/README.md: DOC003 does not list `{file.name}`")
    return errors


def main() -> int:
    found = list(citations(doc_files()))
    cited = {citation.path for citation in found}
    errors = check_undocumented(cited) + check_dead_paths(found) + check_index()
    for error in errors:
        print(error)
    if errors:
        print(f"Found {len(errors)} documentation error(s). Update the documentation (CLAUDE.md, Documentation section).")
        return 1
    print(f"docs OK: {len(required_modules())} module folders documented, {len(found)} repository paths checked.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
