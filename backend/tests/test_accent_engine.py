import unittest
from services.accent_engine import (
    RecognisedWord,
    WordFeedback,
    evaluate_attempt,
    build_tip,
    _tokenise,
    _strip_punct,
)


class TestAccentEngine(unittest.TestCase):
    def test_strip_punct_and_tokenise(self):
        self.assertEqual(_strip_punct("Hello,"), "hello")
        self.assertEqual(_strip_punct("...world!"), "world")
        self.assertEqual(_strip_punct("can't"), "can't")

        tokens = _tokenise("  The quick   brown fox!  ")
        self.assertEqual(tokens, ["The", "quick", "brown", "fox!"])

    def test_perfect_match_american(self):
        expected = "The weather is clear today"
        recognised = [
            RecognisedWord(word="The", confidence=0.96),
            RecognisedWord(word="weather", confidence=0.95),
            RecognisedWord(word="is", confidence=0.97),
            RecognisedWord(word="clear", confidence=0.96),
            RecognisedWord(word="today", confidence=0.95),
        ]

        feedback, score = evaluate_attempt(expected, recognised, accent_target="american")
        self.assertEqual(score, 100.0)
        self.assertTrue(all(item.status == "ok" for item in feedback))
        tip = build_tip(feedback, "american")
        self.assertIn("American rhythm", tip)

    def test_missing_word_detection(self):
        expected = "The cat sat on the mat"
        recognised = [
            RecognisedWord(word="The", confidence=0.95),
            RecognisedWord(word="cat", confidence=0.95),
            RecognisedWord(word="the", confidence=0.95),
            RecognisedWord(word="mat", confidence=0.95),
        ]

        feedback, score = evaluate_attempt(expected, recognised, accent_target="american")
        missing_items = [item for item in feedback if item.issue_code == "word_missing"]
        self.assertGreater(len(missing_items), 0)
        self.assertLess(score, 100.0)

    def test_american_accent_soft_r(self):
        expected = "Drive the car near the floor"
        recognised = [
            RecognisedWord(word="Drive", confidence=0.95),
            RecognisedWord(word="the", confidence=0.95),
            # 'car' ends in r, confidence 0.88 (< 0.92)
            RecognisedWord(word="car", confidence=0.88),
            RecognisedWord(word="near", confidence=0.86),
            RecognisedWord(word="the", confidence=0.95),
            RecognisedWord(word="floor", confidence=0.89),
        ]

        feedback, score = evaluate_attempt(expected, recognised, accent_target="american")
        r_issues = [item for item in feedback if item.issue_code == "american_soft_r"]
        self.assertGreater(len(r_issues), 0)
        self.assertTrue(any(item.status == "accent_mismatch" for item in feedback))
        tip = build_tip(feedback, "american")
        self.assertTrue("R sound clearly" in tip or "American pronunciation" in tip)

    def test_british_accent_flap_t(self):
        expected = "Please pass the water and better butter"
        recognised = [
            RecognisedWord(word="Please", confidence=0.95),
            RecognisedWord(word="pass", confidence=0.95),
            RecognisedWord(word="the", confidence=0.95),
            # 'water', 'better', 'butter' in BRITISH_FLAP_WORDS with confidence > 0.88
            RecognisedWord(word="water", confidence=0.95),
            RecognisedWord(word="and", confidence=0.95),
            RecognisedWord(word="better", confidence=0.94),
            RecognisedWord(word="butter", confidence=0.93),
        ]

        feedback, score = evaluate_attempt(expected, recognised, accent_target="british")
        flap_issues = [item for item in feedback if item.issue_code == "british_flap_t"]
        self.assertGreater(len(flap_issues), 0)
        self.assertTrue(any("Snap the /t/" in (item.note or "") for item in flap_issues))
        tip = build_tip(feedback, "british")
        self.assertIn("British", tip)

    def test_word_mismatch(self):
        expected = "Hello world"
        recognised = [
            RecognisedWord(word="Yellow", confidence=0.90),
            RecognisedWord(word="world", confidence=0.95),
        ]

        feedback, score = evaluate_attempt(expected, recognised, accent_target="american")
        mismatches = [item for item in feedback if item.issue_code == "mismatch"]
        self.assertEqual(len(mismatches), 1)
        self.assertEqual(mismatches[0].text == "Hello", True)
        self.assertEqual(mismatches[0].status == "bad", True)
        self.assertEqual(score, 50.0)

    def test_skipped_word_alignment(self):
        # User skips 'sat' and 'on' in the middle of the sentence
        expected = "The cat sat on the mat"
        recognised = [
            RecognisedWord(word="The", confidence=0.96),
            RecognisedWord(word="cat", confidence=0.95),
            RecognisedWord(word="the", confidence=0.95),
            RecognisedWord(word="mat", confidence=0.95),
        ]

        feedback, score = evaluate_attempt(expected, recognised, accent_target="american")
        # 'The', 'cat', 'the', 'mat' should be ok
        ok_items = [item for item in feedback if item.status == "ok"]
        self.assertEqual(len(ok_items), 4)

        missing_items = [item for item in feedback if item.issue_code == "word_missing"]
        self.assertEqual(len(missing_items), 2)
        self.assertEqual([m.text for m in missing_items], ["sat", "on"])
        self.assertEqual(score, 66.67)

    def test_extra_word_alignment(self):
        # User inserts filler words 'um' and 'like'
        expected = "The weather is nice"
        recognised = [
            RecognisedWord(word="The", confidence=0.95),
            RecognisedWord(word="um", confidence=0.90),
            RecognisedWord(word="weather", confidence=0.95),
            RecognisedWord(word="like", confidence=0.88),
            RecognisedWord(word="is", confidence=0.96),
            RecognisedWord(word="nice", confidence=0.95),
        ]

        feedback, score = evaluate_attempt(expected, recognised, accent_target="american")
        # All 4 expected words should be matched and ok
        ok_items = [item for item in feedback if item.status == "ok"]
        self.assertEqual(len(ok_items), 4)
        self.assertEqual(score, 100.0)


if __name__ == "__main__":
    unittest.main()
