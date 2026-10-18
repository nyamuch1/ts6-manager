#!/usr/bin/env python3
"""Validate frontend locale resources.

Checks used by repo hygiene:
  * every locale has the same namespace files;
  * no duplicate keys inside a JSON object (json.load would silently keep the last);
  * English and Chinese expose the same flattened key set;
  * every value is a non-empty string;
  * both locales use the same {{placeholders}} for a key.

The English files are the source of truth; Chinese must mirror them.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LOCALES_DIR = ROOT / "packages" / "frontend" / "src" / "i18n" / "locales"
SOURCE_LOCALE = "en"
TRANSLATED_LOCALE = "zh-CN"
PLACEHOLDER = re.compile(r"\{\{\s*([\w.]+)\s*\}\}")


def fail(messages: list[str]) -> int:
    print("i18n check failed:", file=sys.stderr)
    for message in messages:
        print(f"  {message}", file=sys.stderr)
    return 1


def load_without_duplicates(path: Path, errors: list[str]) -> object:
    def no_duplicates(pairs: list[tuple[str, object]]) -> dict[str, object]:
        result: dict[str, object] = {}
        for key, value in pairs:
            if key in result:
                errors.append(f"{path.relative_to(ROOT)}: duplicate key {key!r}")
            result[key] = value
        return result

    try:
        return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=no_duplicates)
    except json.JSONDecodeError as error:
        errors.append(f"{path.relative_to(ROOT)}: invalid JSON: {error}")
        return {}


def flatten(value: object, prefix: str = "") -> dict[str, object]:
    if not isinstance(value, dict):
        return {prefix: value}
    result: dict[str, object] = {}
    for key, child in value.items():
        result.update(flatten(child, f"{prefix}.{key}" if prefix else key))
    return result


def placeholders(value: object) -> list[str]:
    if not isinstance(value, str):
        return []
    return sorted(PLACEHOLDER.findall(value))


def main() -> int:
    errors: list[str] = []
    source_dir = LOCALES_DIR / SOURCE_LOCALE
    translated_dir = LOCALES_DIR / TRANSLATED_LOCALE
    if not source_dir.is_dir() or not translated_dir.is_dir():
        return fail([f"missing locale directory under {LOCALES_DIR.relative_to(ROOT)}"])

    source_files = sorted(path.name for path in source_dir.glob("*.json"))
    translated_files = sorted(path.name for path in translated_dir.glob("*.json"))
    if source_files != translated_files:
        errors.append(
            "namespace files differ: "
            f"en={source_files} zh-CN={translated_files}"
        )

    for name in source_files:
        source_path = source_dir / name
        translated_path = translated_dir / name
        if not translated_path.is_file():
            continue

        en = flatten(load_without_duplicates(source_path, errors))
        zh = flatten(load_without_duplicates(translated_path, errors))

        missing = sorted(set(en) - set(zh))
        extra = sorted(set(zh) - set(en))
        if missing:
            errors.append(f"{name}: missing zh-CN keys: {missing[:10]}")
        if extra:
            errors.append(f"{name}: extra zh-CN keys: {extra[:10]}")

        for key in sorted(set(en) & set(zh)):
            en_value = en[key]
            zh_value = zh[key]
            if not isinstance(en_value, str) or not en_value.strip():
                errors.append(f"{name}: {key} is empty or not a string in en")
                continue
            if not isinstance(zh_value, str) or not zh_value.strip():
                errors.append(f"{name}: {key} is empty or not a string in zh-CN")
                continue
            if placeholders(en_value) != placeholders(zh_value):
                errors.append(
                    f"{name}: {key} placeholders differ "
                    f"(en={placeholders(en_value)}, zh-CN={placeholders(zh_value)})"
                )

    if errors:
        return fail(errors)
    print(
        f"OK: {len(source_files)} i18n namespace(s) match in "
        f"{SOURCE_LOCALE} and {TRANSLATED_LOCALE}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
