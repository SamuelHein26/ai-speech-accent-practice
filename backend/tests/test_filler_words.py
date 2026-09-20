import unittest
from routers.sessions import count_filler_words


class TestFillerWords(unittest.TestCase):
    def test_empty_or_none(self):
        self.assertEqual(count_filler_words(None), 0)
        self.assertEqual(count_filler_words(""), 0)
        self.assertEqual(count_filler_words("   "), 0)

    def test_single_word_fillers(self):
        text = "Um, I think uh that we should like go now."
        # fillers: um, uh, like -> 3
        self.assertEqual(count_filler_words(text), 3)

    def test_multi_word_fillers(self):
        text = "I mean, it is kind of cool, you know, sort of interesting."
        # fillers: i mean, kind of, you know, sort of -> 4
        self.assertEqual(count_filler_words(text), 4)

    def test_mixed_fillers_with_punctuation(self):
        text = "Actually! Basically... literally, so hmm."
        # fillers: actually, basically, literally, so, hmm -> 5
        self.assertEqual(count_filler_words(text), 5)

    def test_no_fillers(self):
        text = "The quick brown fox jumps over the lazy dog."
        self.assertEqual(count_filler_words(text), 0)

    def test_substring_not_matched(self):
        # 'somewhere' contains 'so', 'dislike' contains 'like' -> should not count as fillers
        text = "Somewhere out there, they dislike this idea."
        self.assertEqual(count_filler_words(text), 0)


if __name__ == "__main__":
    unittest.main()
