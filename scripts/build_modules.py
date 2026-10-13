#!/usr/bin/env python3
"""Assemble modules/index.json and modules/0N.json from:
  modules/videos.json          lesson titles, YouTube URLs, durations (ground truth)
  Content/drafts/0N.json       module title/teaser/intro + lesson summary/points (+ quiz for 04)
  Content/drafts/images.json   photo ids + captions per lesson ("01-1": [[id, caption], ...])
  assets/img/media.json        photo ids -> compressed files (scripts/build_media.py)
  Content/drafts/quiz/0N.json   per-lesson quizzes: {"lessons": [[{q, options, answer, explain}, ...], ...]}
Run from the repo root: python3 scripts/build_modules.py"""
import json
import re
from pathlib import Path

def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def clean_title(t):
    return re.sub(r"[\s.!]+$", "", t).strip()


def main():
    videos, index = load("modules/videos.json"), []
    photos = {m["id"]: m["src"] for m in load("assets/img/media.json")}
    picks = load("Content/drafts/images.json")
    for mid, vids in videos.items():
        draft = load(f"Content/drafts/{mid}.json")
        assert len(draft["lessons"]) == len(vids), f"{mid}: lesson count mismatch"
        quizzes = load(f"Content/drafts/quiz/{mid}.json")["lessons"]
        assert len(quizzes) == len(vids), f"{mid}: quiz lesson count mismatch"
        for k, qs in enumerate(quizzes, 1):
            assert all(len(q["options"]) == 4 and 0 <= q["answer"] < 4 for q in qs), f"{mid}-{k}: bad question"
        lessons = [{
            "title": clean_title(v["title"]),
            "duration": v.get("duration", ""),
            "video": v["url"],
            "summary": d["summary"],
            "points": d["points"],
            "images": [{"src": photos[pid], "caption": cap} for pid, cap in picks.get(f"{mid}-{i}", [])],
            "quiz": quizzes[i - 1],
            **({"links": d["links"]} if d.get("links") else {}),
        } for i, (v, d) in enumerate(zip(vids, draft["lessons"]), 1)]
        module = {"id": mid, "title": draft["title"], "intro": draft["intro"],
                  "lessons": lessons}
        Path(f"modules/{mid}.json").write_text(json.dumps(module, ensure_ascii=False, indent=1), encoding="utf-8")
        index.append({"id": mid, "title": draft["title"], "teaser": draft["teaser"], "ready": True})
        print(mid, draft["title"], "|", len(lessons), "lessons,", sum(map(len, quizzes)), "questions")
    Path("modules/index.json").write_text(
        "[\n" + ",\n".join(" " + json.dumps(m, ensure_ascii=False) for m in index) + "\n]\n", encoding="utf-8")


if __name__ == "__main__":
    main()
