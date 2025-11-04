from google import genai
from google.genai import types
import panphon.distance
import eng_to_ipa
import os
import json
import re
import logging
from typing import Dict, List, Tuple, Optional

logger = logging.getLogger(__name__)

class PronunciationDistanceCalculator:
    """Calculate phoneme distance between target words and actual pronunciations"""
    
    def __init__(self):
        self.client = genai.Client(api_key="AIzaSyBzWB6Jeslbzpby3263i4CufiJNdmbKsr4")
        self.distance_calculator = panphon.distance.Distance()
        self.generate_content_config = types.GenerateContentConfig(
            temperature = 1,
            top_p = 1,
            seed = 0,
            max_output_tokens = 65535,
            safety_settings = [types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="OFF"), types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="OFF"), types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="OFF"), types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="OFF")],
            thinking_config=types.ThinkingConfig(thinking_budget=-1),
        )
    
    def get_ground_truth_ipa(self, word: str) -> str:
        """Convert English word to IPA using eng_to_ipa"""
        try:
            # Remove braces and clean the word
            clean_word = word.replace('{', '').replace('}', '').replace('ˈ', '').replace('ˌ', '').replace('.', '').strip().lower()
            ipa = eng_to_ipa.convert(clean_word) 
            ipa = self.normalize_ipa_for_panphon(ipa)    

            return ipa
        except Exception as e:
            print(f"Error converting {word} to IPA: {e}")
            return ""
    
    def process_r_colored_vowel(self, ipa: str, rcolored: str="to_seq") -> str:
        """Process colored vowel in IPA"""
        # r-colored 모음 매핑 표 (양방향 지원)
        RCOLORED_TO_SEQ = {
            "ɚ": "əɹ",
            "ɝ": "ɜɹ",
            "iɚ": "ir",
            "ɛɹ": "er",
            "ɑɚ": "ɛr",
            "ɔɹ": "or",
            "ɑɪɚ": "ɑɪr"
        }
        SEQ_TO_RCOLORED = {v: k for k, v in RCOLORED_TO_SEQ.items()}

        if rcolored == "to_seq":
        # ɚ→əɹ, ɝ→ɜɹ
            for k, v in RCOLORED_TO_SEQ.items():
                ipa = ipa.replace(k, v)
        elif rcolored == "to_rcolored":
            # əɹ→ɚ, ɜɹ→ɝ (길이가 2인 시퀀스부터 치환)
            for seq, rc in sorted(SEQ_TO_RCOLORED.items(), key=lambda x: len(x[0]), reverse=True):
                ipa = ipa.replace(seq, rc)

        return ipa
    
    def normalize_affricates(self, ipa: str) -> str:
        AFFRICATE_TIEBAR = {
            "ʧ": "tʃ",
            "ʤ": "dʒ",
            "ʦ": "ts",
            "ʣ": "dz",
        }
        """Remove tie bar from t͡ʃ, d͡ʒ to convert to single double consonant form"""
        for k, v in AFFRICATE_TIEBAR.items():
            ipa = ipa.replace(k, v)
        # 일부 엔진은 결합 부호를 분리해서 찍기도 함: t̚͡ʃ 같은 케이스를 느슨하게 정리
        ipa = re.sub(r"(?<=t)[\u035C\u0361\u035D\u035E\u035F]?(?=ʃ)", "ʃ", ipa)  # t͡ʃ 변종
        ipa = re.sub(r"(?<=d)[\u035C\u0361\u035D\u035E\u035F]?(?=ʒ)", "ʒ", ipa)  # d͡ʒ 변종
        return ipa

    def normalize_syllabic_cons(self, ipa: str) -> str:
        """Convert n̩, l̩, m̩, ɹ̩ to schwa+consonant (Great for English comparison)"""
        # 길이 2 문자(베이스+combining) 처리
        ipa = ipa.replace("n̩", "ən").replace("l̩", "əl").replace("m̩", "əm").replace("ɹ̩", "əɹ")
        # 혹시 모를 다른 조합도 정리
        ipa = re.sub(r"([nlmɹ])\u0329", r"ə\1", ipa)  # \u0329 = COMBINING VERTICAL LINE BELOW
        return ipa

    def normalize_diacritics(self, ipa: str) -> str:
        """Remove diacritics that don't contribute to comparison (can be extended if needed)"""
        # 강세 표식, 음절점, 장단/반장, tie bar류, 방출/유기음 등 광범위 제거
        ipa = re.sub(r"[ˈˌ.ːˑ˘˔˕˞˳˺ʰʷʲⁿˠˤ̴̥̬̩̯̠̟̪̺̝̞̹̜̻̘̙̤̘̝̞̃̈̚̚ˡ]+", "", ipa)
        return ipa

    def normalize_allophones(self, ipa: str) -> str:
        """Normalize common English allophones"""
        # dark l → l
        ipa = ipa.replace("ɫ", "l")
        # flap을 그대로 둘 수도 있지만, T/D와 혼동 줄이려면 유지 권장
        # ɾ을 유지하면 panphon이 적절한 중간거리로 평가
        return ipa

    def normalize_r_symbol(self, ipa: str, r_to_approximant: bool = True) -> str:
        """Convert r(voiced) to ɹ(approximant) to unify English /r/ (or vice versa)"""
        if r_to_approximant:
            # 단, 이미 ɹ인 것은 그대로. 'tr', 'dr' 같은 클러스터에서 r도 치환.
            # 단어 경계/임의 위치 모두 적용
            ipa = ipa.replace("r", "ɹ")
        else:
            ipa = ipa.replace("ɹ", "r")
        return ipa
    
    def normalize_ipa(self, s: str) -> str:
        """
        IPA 문자열 전처리: Convert ASCII 'g' (U+0067) to IPA 'ɡ' (U+0261)
        - 필요시 추가 매핑을 확장할 수 있도록 dict 사용
        """
        mapping = {
            "g": "ɡ",   # ASCII g -> IPA ɡ
        }
        return "".join(mapping.get(ch, ch) for ch in s)

    def strip_spaces(self, ipa: str) -> str:
        """Remove occasional spaces mixed in"""
        return ipa.strip().replace(" ", "")

    def normalize_ipa_for_panphon(
        self,
        ipa: str,
        *,
        rcolored_mode: str = "to_seq",
        r_to_approximant: bool = True,
    ) -> str:
        """
        panphon 거리 비교 전용 IPA 정규화 파이프라인.
        - rcolored_mode: 'to_seq'|'to_rcolored'|'none'
        - r_to_approximant: True면 r→ɹ, False면 ɹ→r
        """
        if not ipa:
            return ipa
        ipa = ipa.lower()
        ipa = self.strip_spaces(ipa)
        ipa = self.normalize_affricates(ipa)
        ipa = self.process_r_colored_vowel(ipa, rcolored=rcolored_mode)
        ipa = self.normalize_syllabic_cons(ipa)
        ipa = self.normalize_diacritics(ipa)
        ipa = self.normalize_allophones(ipa)
        ipa = self.normalize_r_symbol(ipa, r_to_approximant=r_to_approximant)
        ipa = self.normalize_ipa(ipa)
        return ipa
    
    def process_transcripted_ipa(self, ipa: str) -> str:
        """Process transcripted IPA"""
        ipa = self.normalize_ipa_for_panphon(ipa)
        return ipa

    def calculate_distance(self, actual_ipa: str, target_ipa: str, mode: str = "weighted_feature_edit_distance") -> float:
        """Calculate weighted feature edit distance between two IPA strings"""
        try:
            if not actual_ipa or not target_ipa:
                return float('inf')  # Return infinity for invalid inputs
            
            if mode == "weighted_feature_edit_distance":
                distance = self.distance_calculator.weighted_feature_edit_distance(
                actual_ipa.strip(), 
                target_ipa.strip()
            )
            elif mode == 'hamming_feature_edit_distance':
                distance = self.distance_calculator.hamming_feature_edit_distance(
                    actual_ipa.strip(),
                    target_ipa.strip()
                )
            return distance
        except Exception as e:
            print(f"Error calculating distance: {e}")
            return float('inf')
    
    def analyze_recording_pronunciation(self, recording_dir: str, target_words: List[str]) -> Dict:
        """Analyze pronunciation accuracy for all recordings in a directory"""
        results = {
            'word_mode': {},
            'sentence_mode': {},
            'overall_statistics': {}
        }
        
        if not os.path.exists(recording_dir):
            return results
        
        # Process word mode recordings
        word_mode_dir = os.path.join(recording_dir, 'mode_word')
        if os.path.exists(word_mode_dir):
            results['word_mode'] = self._analyze_mode_recordings(word_mode_dir, target_words, 'word')
        
        # Process sentence mode recordings
        sentence_mode_dir = os.path.join(recording_dir, 'mode_sentence')
        if os.path.exists(sentence_mode_dir):
            results['sentence_mode'] = self._analyze_mode_recordings(sentence_mode_dir, target_words, 'sentence')
        
        # Calculate overall statistics
        results['overall_statistics'] = self._calculate_overall_statistics(results)
        
        return results
    
    def _analyze_mode_recordings(self, mode_dir: str, target_words: List[str], mode: str) -> Dict:
        """Analyze recordings in a specific mode directory"""
        mode_results = {}
        
        for filename in os.listdir(mode_dir):
            if filename.endswith('_phoneme.txt'):
                # Extract recording info from filename
                base_name = filename.replace('_phoneme.txt', '')
                
                # Read phoneme transcription
                phoneme_file = os.path.join(mode_dir, filename)
                try:
                    with open(phoneme_file, 'r', encoding='utf-8') as f:
                        full_phoneme_transcription = f.read().strip()
                except Exception as e:
                    print(f"Error reading {phoneme_file}: {e}")
                    continue
                
                # Read text transcription if available
                text_file = os.path.join(mode_dir, base_name + '_transcript.txt')
                text_transcription = ""
                if os.path.exists(text_file):
                    try:
                        with open(text_file, 'r', encoding='utf-8') as f:
                            text_transcription = f.read().strip()
                    except Exception as e:
                        print(f"Error reading {text_file}: {e}")
                
                # Determine target word based on mode
                if mode == 'word':
                    # Extract target word from filename
                    # Filename format: recording_YYYYMMDD_HHMMSS_targetword.wav
                    # base_name format: recording_YYYYMMDD_HHMMSS_targetword (without .wav)
                    parts = base_name.split('_')
                    logger.debug(f"Parsing filename: {base_name}, parts: {parts}")
                    if len(parts) >= 4:  # recording + date + time + target_word
                        target_word = '_'.join(parts[3:])  # Everything after timestamp
                        logger.debug(f"Extracted target_word: {target_word}")
                        # For word mode, the entire phoneme transcription should be the target word
                        target_words_list = [target_word]
                        target_word_phonemes = {target_word: full_phoneme_transcription}
                    else:
                        logger.warning(f"Not enough parts in filename for word mode: {base_name} (parts: {len(parts)})")
                        target_word = None
                        target_words_list = []
                        target_word_phonemes = {}
                else:  # sentence mode
                    # Find target words in text transcription
                    target_words_found = self._find_target_words_in_transcription(text_transcription, target_words)
                    target_words_list = target_words_found if target_words_found else []
                    
                    # Extract phonemes for each target word found in the sentence
                    target_word_phonemes = self._extract_target_word_phonemes(
                        text_transcription, full_phoneme_transcription, target_words_list
                    )
                
                if target_words_list:
                    recording_results = []
                    for tw in target_words_list:
                        ground_truth_ipa = self.get_ground_truth_ipa(tw)
                        actual_word_ipa = self.process_transcripted_ipa(target_word_phonemes.get(tw, ""))
                        
                        if ground_truth_ipa and actual_word_ipa:
                            distance = self.calculate_distance(actual_word_ipa, ground_truth_ipa, mode="hamming_feature_edit_distance")
                            recording_results.append({
                                'target_word': tw,
                                'ground_truth_ipa': ground_truth_ipa,
                                'actual_ipa': actual_word_ipa,
                                'full_phoneme_transcription': full_phoneme_transcription,
                                'distance': distance,
                                'text_transcription': text_transcription
                            })
                    
                    if recording_results:
                        mode_results[base_name] = recording_results
        
        return mode_results
    
    def _find_target_words_in_transcription(self, transcription: str, target_words: List[str]) -> List[str]:
        """Find target words present in the transcription"""
        if not transcription or not target_words:
            return []
        
        found_words = []
        transcription_lower = transcription.lower()
        
        for target_word in target_words:
            clean_target = target_word.replace('{', '').replace('}', '').strip().lower()
            if clean_target in transcription_lower:
                found_words.append(clean_target)
        
        return found_words
    
    def _extract_target_word_phonemes(self, text_transcription: str, phoneme_transcription: str, target_words: List[str]) -> Dict[str, str]:
        """Extract phonemes for specific target words from full phoneme transcription"""
        if not text_transcription or not phoneme_transcription or not target_words:
            return {}
        
        # Split text and phonemes into words/phonemes
        text_words = self._tokenize_text(text_transcription)
        phoneme_tokens = phoneme_transcription.split()
        
        # Create word-to-phoneme alignment
        word_phoneme_mapping = self._align_words_to_phonemes(text_words, phoneme_tokens)
        
        # Extract phonemes for target words
        target_word_phonemes = {}
        for target_word in target_words:
            clean_target = target_word.lower()
            
            # Find the target word in the text
            for i, word in enumerate(text_words):
                if word.lower() == clean_target:
                    # Get phonemes for this word
                    word_phonemes = word_phoneme_mapping.get(i, [])
                    if word_phonemes:
                        target_word_phonemes[clean_target] = ' '.join(word_phonemes)
                    break
        
        return target_word_phonemes
    
    def _tokenize_text(self, text: str) -> List[str]:
        """Tokenize text into words, handling punctuation"""
        import re
        # Remove punctuation and split into words
        words = re.findall(r'\b\w+\b', text.lower())
        return words
    
    def _align_words_to_phonemes(self, text_words: List[str], phoneme_tokens: List[str]) -> Dict[int, List[str]]:
        """Align text words to phoneme tokens using improved heuristics"""
        if not text_words or not phoneme_tokens:
            return {}
        
        alignment = {}
        num_words = len(text_words)
        num_phonemes = len(phoneme_tokens)
        
        if num_words == 1:
            # Single word gets all phonemes
            alignment[0] = phoneme_tokens
        else:
            # Use word length and expected phoneme count to guide alignment
            word_lengths = [len(word) for word in text_words]
            total_length = sum(word_lengths)
            
            # Get expected phoneme counts for each word based on ground truth
            expected_phoneme_counts = []
            for word in text_words:
                ground_truth_ipa = self.get_ground_truth_ipa(word)
                if ground_truth_ipa:
                    # Count phonemes in ground truth (rough estimate)
                    # Remove stress marks and syllable boundaries
                    clean_ipa = ground_truth_ipa.replace('ˈ', '').replace('ˌ', '').replace('.', '')
                    expected_count = max(1, len(clean_ipa) // 2)  # Rough estimate
                else:
                    # Fallback: use word length
                    expected_count = max(1, len(word) // 2)
                expected_phoneme_counts.append(expected_count)
            
            total_expected = sum(expected_phoneme_counts)
            
            # Distribute phonemes based on expected counts
            phoneme_idx = 0
            for word_idx in range(num_words):
                if total_expected > 0:
                    # Calculate proportional phoneme count
                    proportion = expected_phoneme_counts[word_idx] / total_expected
                    word_phoneme_count = max(1, round(num_phonemes * proportion))
                else:
                    # Fallback to even distribution
                    word_phoneme_count = num_phonemes // num_words
                
                # Ensure we don't exceed available phonemes
                remaining_phonemes = num_phonemes - phoneme_idx
                word_phoneme_count = min(word_phoneme_count, remaining_phonemes)
                
                # For the last word, take all remaining phonemes
                if word_idx == num_words - 1:
                    word_phoneme_count = remaining_phonemes
                
                # Assign phonemes to this word
                word_phonemes = phoneme_tokens[phoneme_idx:phoneme_idx + word_phoneme_count]
                alignment[word_idx] = word_phonemes
                phoneme_idx += word_phoneme_count
        
        return alignment
    
    def _calculate_overall_statistics(self, results: Dict) -> Dict:
        """Calculate overall pronunciation statistics"""
        stats = {
            'total_recordings': 0,
            'word_mode_recordings': 0,
            'sentence_mode_recordings': 0,
            'average_distance_by_word': {},
            'best_pronunciations': {},
            'worst_pronunciations': {}
        }
        
        all_distances = {}
        
        # Collect distances from both modes
        for mode_name, mode_data in results.items():
            if mode_name in ['word_mode', 'sentence_mode'] and mode_data:
                for recording_name, recording_results in mode_data.items():
                    stats['total_recordings'] += 1
                    if mode_name == 'word_mode':
                        stats['word_mode_recordings'] += 1
                    else:
                        stats['sentence_mode_recordings'] += 1
                    
                    for result in recording_results:
                        target_word = result['target_word']
                        distance = result['distance']
                        
                        if target_word not in all_distances:
                            all_distances[target_word] = []
                        all_distances[target_word].append({
                            'distance': distance,
                            'recording': recording_name,
                            'mode': mode_name,
                            'result': result
                        })
        
        # Calculate averages and find best/worst
        for word, distances in all_distances.items():
            if distances:
                valid_distances = [d['distance'] for d in distances if d['distance'] != float('inf')]
                if valid_distances:
                    stats['average_distance_by_word'][word] = sum(valid_distances) / len(valid_distances)
                    
                    # Find best (lowest distance) and worst (highest distance)
                    sorted_distances = sorted(distances, key=lambda x: x['distance'])
                    stats['best_pronunciations'][word] = sorted_distances[0]
                    stats['worst_pronunciations'][word] = sorted_distances[-1]
        
        return stats

# Test the functionality
def test_pronunciation_analysis():
    """Test function for pronunciation analysis"""
    calculator = PronunciationDistanceCalculator()
    
    # Test with existing recording
    target_word = 'jam'
    actual_ipa = 'tʰaːm'
    # phoneme_file = 'story_recordings/user_expert5/story_850518/mode_word/recording_20250927_151112_phoneme.txt'

    
    
    # if os.path.exists(phoneme_file):
    #     with open(phoneme_file, 'r') as f:
    #         actual_ipa = f.read().strip()

        
    ground_truth_ipa = calculator.get_ground_truth_ipa(target_word)
    actual_ipa = calculator.normalize_ipa_for_panphon(actual_ipa)
    ground_truth_ipa = calculator.normalize_ipa_for_panphon(ground_truth_ipa)
    distance = calculator.calculate_distance(actual_ipa, ground_truth_ipa)
    
    print(f"Target word: {target_word}")
    print(f"Ground truth IPA: {ground_truth_ipa}")
    print(f"Actual IPA: {actual_ipa}")
    print(f"Distance: {distance}")
    
    # Test perfect match
    perfect_distance = calculator.calculate_distance(ground_truth_ipa, ground_truth_ipa)
    print(f"Perfect match distance: {perfect_distance}")

if __name__ == "__main__":
    test_pronunciation_analysis()

