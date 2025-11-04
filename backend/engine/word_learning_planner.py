# NOTE: Currently incomplete development. This file will be worked on telehealth phase.

import random
import logging

logger = logging.getLogger(__name__)

class WordLearningPlanner:
    def __init__(self, story_target_words):
        self.story_target_words = story_target_words
        self.learned_words = {word: 0 for word in story_target_words}

    def extract_target_words(self, scene):
        # """Select the next unlearned target word"""
        # return [w for w in scene["target_words"] if w not in self.learned_words]
        return scene["target_words"]

    def count_pronunced_word(self, child_input_word):
        if child_input_word in self.story_target_words:
            self.learned_words[child_input_word] += 1

    def is_word_learned(self, word):
        return word in self.learned_words

    def all_words_learned(self, scene):
        return all(w in self.learned_words for w in scene["target_words"])
