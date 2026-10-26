"""Deterministic mystery construction and a small constraint-based solvability check.

No LLM, credentials, third-party services, or network calls are needed. The seed is
part of the versioned case contract; identical seeds produce identical cases.
"""
from __future__ import annotations

import argparse
import json
import random
from copy import deepcopy

PEOPLE = [
    {"id": "mara", "name": "Mara Vale", "role": "The curator", "badge": "M-17", "locker": "04", "avatar": "mara", "color": "#b99b7a", "quote": "Some things belong in a museum. Others don't.", "motive": "Her exhibition was about to lose its funding."},
    {"id": "elias", "name": "Elias Reed", "role": "The security chief", "badge": "N-41", "locker": "12", "avatar": "elias", "color": "#91a59c", "quote": "Nothing gets past me. Usually.", "motive": "A private collector had offered to clear his debts."},
    {"id": "june", "name": "June Park", "role": "The conservator", "badge": "C-26", "locker": "08", "avatar": "june", "color": "#b6a8b8", "quote": "Look closely. The details always survive.", "motive": "She believed the prototype had been acquired illegally."},
    {"id": "theo", "name": "Theo Cross", "role": "The event technician", "badge": "T-09", "locker": "21", "avatar": "theo", "color": "#b6ad87", "quote": "I keep the lights on. That's the job.", "motive": "The museum had withheld three months of his pay."},
]


def candidates(case: dict) -> set[str]:
    """Intersect independent access and physical-custody constraints."""
    facts = case["facts"]
    access = {p["id"] for p in case["suspects"] if p["badge"] == facts["accessBadge"]}
    custody = {p["id"] for p in case["suspects"] if p["locker"] == facts["locker"]}
    return access & custody


def generate_case(seed: int = 41) -> dict:
    rng = random.Random(seed)
    people = deepcopy(PEOPLE)
    culprit = people[rng.randrange(len(people))]
    # Seed 41 is the curated introductory case; other seeds vary the culprit.
    if seed == 41:
        culprit = people[1]
    for person in people:
        person["statement"] = (
            f"I was in the east gallery from 21:00 until the alarm. My badge, {person['badge']}, "
            f"never left my pocket. Locker {person['locker']} stayed locked all night. "
            "If someone used either, it wasn't me."
            if person == culprit else
            f"At 21:05 I was in the main atrium, waiting for the power to return. "
            f"My badge is {person['badge']} and my assigned locker is {person['locker']}. "
            "The east gallery was closed for the evening. You can check the floor plan."
        )
        person["alibi"] = "Claims to have stayed in the east gallery." if person == culprit else "Reports waiting in the main atrium."

    def evidence(id: str, title: str, kind: str, label: str, summary: str, body: str,
                 timestamp: str, source: str, x: int, y: int, rotation: int) -> dict:
        return dict(id=id, title=title, kind=kind, label=label, summary=summary,
                    body=body, timestamp=timestamp, source=source, x=x, y=y, rotation=rotation)

    result = {
        "id": f"MX-{seed}", "title": "The Midnight Exchange", "subtitle": "Nothing disappears without a trace.",
        "location": "Meridian Museum, Lagos", "incidentTime": "21:10", "seed": seed,
        "difficulty": "Rookie detective",
        "briefing": "At 21:10, the lights went out at the Meridian Museum. Ninety seconds later, the Aster prototype was gone. Four people had access. Everyone has an alibi. Someone is lying. Follow the paper trail, question the suspects, and find out who made the exchange.",
        "suspects": people,
        "evidence": [
            evidence("security-still", "90 seconds of darkness", "photo", "EXHIBIT 01 · CCTV", "Camera 04. East corridor. 21:10.",
                     "The feed shows the east corridor before the blackout. The east gallery shutters are already down. The camera loses power at 21:10:00 and returns at 21:11:30. The archive door is open when the feed returns. No face is visible; this image alone identifies nobody.", "21:10", "Security camera 04", 52, 35, -4),
            evidence("access-log", "The door remembers", "log", "EXHIBIT 02 · ACCESS LOG", f"One badge. One very convenient visit.",
                     f"OFFLINE CONTROLLER EXPORT\n21:07:51  MAIN ATRIUM   emergency lights ON\n21:08:14  ARCHIVE A     badge {culprit['badge']} — ACCESS GRANTED\n21:10:00  CAMERA GRID   power lost\n21:11:30  CAMERA GRID   power restored\n\nThe archive controller has a backup battery. Its records survived. A badge can be borrowed: corroborate this record with physical evidence.", "21:08", "Battery-backed access controller", 350, 57, 3),
            evidence("floor-plan", "A way out", "map", "EXHIBIT 03 · FLOOR PLAN", "The service corridor wasn't on the tour.",
                     "The archive connects to the cloakroom through a staff-only service corridor. The east gallery was shuttered at 20:45 and cannot be entered from that corridor. The main atrium remained open. A trip from archive to cloakroom takes approximately one minute.", "20:45", "Facilities evacuation plan", 650, 22, -3),
            evidence("locker-receipt", "A paper trail", "receipt", "EXHIBIT 04 · CLOAKROOM", f"A transfer somebody hoped you'd miss.",
                     f"MERIDIAN CLOAKROOM — MANUAL TRANSFER\nItem: ASTER / transport case 001\nDestination: assigned locker {culprit['locker']}\nReceived: 21:09\nSeal: intact\n\nThe attendant saw the locker holder place the case inside, using their personal locker key. Locker assignments are listed in the suspect dossiers. The case was later recovered there, empty.", "21:09", "Cloakroom attendant's duplicate", 80, 355, 3),
            evidence("voice-note", "An unfinished message", "audio", "EXHIBIT 05 · TRANSCRIPT", '“We only need a minute and a half.”',
                     "Recovered voicemail transcript, 20:38:\n\"The cameras don't have backup power. We only need a minute and a half. The service corridor gets us to the lockers. Don't call me again.\"\n\nThe recording is distorted. The caller cannot be identified by voice. It establishes preparation and the intended route, not the caller's identity.", "20:38", "Unlisted number · voicemail export", 365, 370, -3),
            evidence("exhibition-note", "More than a prototype", "note", "EXHIBIT 06 · CURATOR'S NOTE", "An object with a complicated past.",
                     "The Aster prototype was due to be unveiled tomorrow. Its ownership is disputed; its insurance valuation is substantial. An unsigned note reads: \"Before you ask who wanted it, ask who could actually move it.\" Several suspects had motives. Motive alone is not proof.", "18:20", "Exhibition preparation desk", 660, 335, 4),
        ],
        "facts": {"accessBadge": culprit["badge"], "locker": culprit["locker"]},
        "solution": {
            "suspectId": culprit["id"], "proofIds": ["access-log", "locker-receipt"],
            "explanation": f"{culprit['name']}'s badge ({culprit['badge']}) opened the archive at 21:08. Independently, the cloakroom attendant recorded the Aster case entering their assigned locker ({culprit['locker']}) at 21:09, in the holder's presence. Together these contradict the claim of remaining in the shuttered east gallery. Neither motive nor the anonymous voicemail identifies the culprit by itself."
        },
    }
    if candidates(result) != {culprit["id"]}:
        raise ValueError("Generator produced an ambiguous case")
    return result


def public_case(case: dict) -> dict:
    """Never return solutions or machine-readable constraint facts to game clients."""
    return {key: deepcopy(value) for key, value in case.items() if key not in {"solution", "facts"}}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", type=int, default=41)
    parser.add_argument("--public", action="store_true")
    args = parser.parse_args()
    case = generate_case(args.seed)
    print(json.dumps(public_case(case) if args.public else case, indent=2))
