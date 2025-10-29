from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable, List, Optional, Sequence


WORD_SPLIT_RE = re.compile(r"\s+")
PUNCT_RE = re.compile(r"^[^\w']+|[^\w']+$")
CONFIDENCE_THRESHOLD = 0.85

ACCENT_R_SENSITIVE = {
    "car",
    "far",
    "weather",
    "colour",
    "color",
    "near",
    "door",
    "floor",
}

BRITISH_FLAP_WORDS = {"water", "butter", "city", "better"}
BRITISH_BROAD_A = {"bath", "path", "glass", "can't", "dance"}


@dataclass
class RecognisedWord:
    word: str
    confidence: float


@dataclass
class WordFeedback:
    text: str
    status: str
    note: Optional[str] = None
    spoken: Optional[str] = None
    confidence: Optional[float] = None
    issue_code: Optional[str] = None

    def to_response(self) -> dict:
        payload = {"text": self.text, "status": self.status}
        if self.note:
            payload["note"] = self.note
        if self.spoken is not None:
            payload["spoken"] = self.spoken
        if self.confidence is not None:
            payload["confidence"] = self.confidence
        return payload


def _strip_punct(token: str) -> str:
    return PUNCT_RE.sub("", token).lower()


def _tokenise(text: str) -> List[str]:
    return [token for token in WORD_SPLIT_RE.split(text.strip()) if token]


def evaluate_attempt(
    expected_text: str,
    recognised: Sequence[RecognisedWord],
    *,
    accent_target: str,
) -> tuple[List[WordFeedback], float]:

    expected_tokens = _tokenise(expected_text)
    spoken_tokens = list(recognised)

    feedback: List[WordFeedback] = []
    spoken_index = 0
    accent_label = accent_target.capitalize()

    for expected in expected_tokens:
        stripped_expected = _strip_punct(expected)

        if not stripped_expected:
            feedback.append(WordFeedback(text=expected, status="ok"))
            continue

        if spoken_index >= len(spoken_tokens):
            feedback.append(
                WordFeedback(
                    text=expected,
                    status="bad",
                    note=f"The word '{expected}' was missing. Include it when you deliver the {accent_label} line.",
                    issue_code="word_missing",
                )
            )
            continue

        spoken = spoken_tokens[spoken_index]
        spoken_index += 1

        normalised_spoken = _strip_punct(spoken.word)

        if normalised_spoken == stripped_expected:
            if spoken.confidence >= CONFIDENCE_THRESHOLD:
                feedback.append(
                    WordFeedback(
                        text=expected,
                        status="ok",
                        spoken=spoken.word,
                        confidence=spoken.confidence,
                    )
                )
            else:
                feedback.append(
                    WordFeedback(
                        text=expected,
                        status="bad",
                        note=(
                            f"'{spoken.word}' sounded unclear (confidence {spoken.confidence:.0%}). "
                            f"Enunciate it a bit more for {accent_label} English."
                        ),
                        spoken=spoken.word,
                        confidence=spoken.confidence,
                        issue_code="low_confidence",
                    )
                )
        else:
            feedback.append(
                WordFeedback(
                    text=expected,
                    status="bad",
                    note=(
                        f"Heard '{spoken.word}' instead of '{expected}'. "
                        f"Revisit the {accent_label} pronunciation of '{expected}'."
                    ),
                    spoken=spoken.word,
                    confidence=spoken.confidence,
                    issue_code="mismatch",
                )
            )

    _apply_accent_rules(feedback, accent_target)

    ok_count = sum(1 for item in feedback if item.status == "ok")
    total = sum(1 for item in feedback if _strip_punct(item.text))
    score = 0.0 if total == 0 else round((ok_count / total) * 100, 2)
    return feedback, score


def _apply_accent_rules(feedback: Iterable[WordFeedback], accent_target: str) -> None:
    accent_target = accent_target.lower()

    for item in feedback:
        stripped = _strip_punct(item.text)
        if not stripped or item.spoken is None:
            continue

        confidence = item.confidence or 0.0

        if accent_target == "american":
            if stripped.endswith("r") or stripped in ACCENT_R_SENSITIVE:
                if item.status == "ok" and confidence < 0.92:
                    item.status = "accent_mismatch"
                    item.issue_code = "american_soft_r"
                    note = f"Keep the American R fully pronounced in '{item.text}'."
                    if item.spoken:
                        note += f" It came through closer to '{item.spoken}'."
                    item.note = note
                elif item.status == "bad" and item.issue_code == "low_confidence":
                    item.status = "accent_mismatch"
                    item.issue_code = "american_soft_r"
                    note = f"The R in '{item.text}' faded away. Exaggerate it for American English."
                    if item.spoken:
                        note += f" We caught it as '{item.spoken}'."
                    item.note = note
            if stripped in BRITISH_BROAD_A and item.status == "ok" and confidence < 0.9:
                item.status = "accent_mismatch"
                item.issue_code = "american_broad_a"
                item.note = (
                    f"Give '{item.text}' the flatter American vowel. Avoid the rounded British 'a' sound."
                )

        elif accent_target == "british":
            if stripped in BRITISH_FLAP_WORDS and confidence > 0.88:
                item.status = "accent_mismatch"
                item.issue_code = "british_flap_t"
                item.note = (
                    f"Snap the /t/ in '{item.text}' for British English instead of using an American flap."
                )
            elif (stripped.endswith("r") or stripped in ACCENT_R_SENSITIVE) and confidence > 0.9:
                item.status = "accent_mismatch"
                item.issue_code = "british_r"
                note = f"Soften the ending R in '{item.text}' to keep the British tone."
                if item.spoken:
                    note += f" It sounded closer to the American '{item.spoken}'."
                item.note = note


def build_tip(feedback: Sequence[WordFeedback], accent_target: str) -> str:
    accent_target = accent_target.lower()
    accent_issues = [item for item in feedback if item.status == "accent_mismatch"]
    if accent_issues:
        word = accent_issues[0]
        if accent_target == "american":
            return (
                f"Focus on the American pronunciation of \"{word.text}\" — hold the R sound clearly."
            )
        return (
            f"Try softening the consonants in \"{word.text}\" to lean into the British tone."
        )

    general_issues = [item for item in feedback if item.status == "bad"]
    if general_issues:
        word = general_issues[0]
        if word.issue_code == "low_confidence":
            return f"Articulate \"{word.text}\" a bit more clearly for the microphone."
        if word.issue_code == "word_missing":
            return f"Don't forget to include \"{word.text}\" when you read the prompt."
        return f"Double-check the wording around \"{word.text}\" next time."

    if accent_target == "american":
        return "Great job! Keep building that crisp American rhythm."
    return "Sounding polished — keep refining those British vowel shapes."
