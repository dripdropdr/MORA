import json
import re
from copy import deepcopy
import random
from openai import OpenAI
import base64
from config import config_words
from assign import assign_target_words, assign_image_in_story

# OpenAI API key 설정 (환경변수나 파일에서 가져오는 것이 안전)
client = OpenAI(api_key="sk-RFDhyyJpo0SBUcJdVW-0cIWaifqLeuyyVzsuqM9iqBT3BlbkFJTZRxrTgoeynyQHf4wg2BwW1m9Rhf5qlk2ZUF_P1EAA")

# Load story template
json_file_path = "story_template/template_2.json"
with open(json_file_path, 'r') as f:
    story_data = json.load(f)
print("INFO: Story Template Loaded."+"="*20)

# Word database
words_dict = json.load(open("builder/word_base.json", "r"))

# Get target words and available verbs for interaction words
target_sounds = ["words_with_l_initial", "words_with_r_initial"]
print("INFO: Words Loaded."+"="*20)

# Generate story id
story_id = random.randint(100000, 999999)

# Config words in story
print("INFO: Story Configuration..."+"="*20)
story_data['metadata']['themes'] = target_sounds
character_config, place_config, prop_config = config_words(client, words_dict, story_data, target_sounds)
# print(character_config, place_config, prop_config)
print("INFO: Story Config Done."+"="*20)

print("INFO: Story Update..."+"="*20)
assign_target_words(character_config, place_config, prop_config, story_data)
print("INFO: Story Update Done."+"="*20)

# Save story data
json.dump(story_data, open(f'story/story_{story_id}.json', 'w'), indent=4)
print("INFO: Half-baked Story Saved."+"="*20)

config_image()
print("INFO: Image Integration to Story"+"="*20)
assign_image_in_story(story_data, story_id)
print("INFO: Image Integration Done."+"="*20)

# Save story data
json.dump(story_data, open(f'story/story_{story_id}.json', 'w'), indent=4)
print("INFO: Story Saved."+"="*20)




# for scene in story_data['scenes']:
#     place_description = story_data['places'][scene['places'][0]]['description']
#     target_words = scene['target_words']

#     all_dialogues = ""


# # 각 scene마다 대화와 행동 생성
# for scene in story_data['scenes']:
#     print(f"\n=== Scene: {scene['id']} ===")
#     print(scene['description'])
    
#     for dialogue in scene['dialogue_templates']:
#         character_name = dialogue['character']
#         prompt_text = dialogue['prompt']
        
#         # 프롬프트에 타겟 단어 삽입
#         prompt = (
#             f"Character: {character_name}\n"
#             f"Character's personality and style: {next((c['personality'] + ', ' + c['style'] for c in story_data['characters'] if c['name'] == character_name), '기본 성격')}\n"
#             f"Scene description: {scene['description']}\n"
#             f"Target words: {', '.join(target_words)}\n"
#             f"Prompt template: {prompt_text}\n"
#             f"Transform the prompt template to fit the target words. Make it short and concise."
#         )

#         # OpenAI API 호출
#         response = client.chat.completions.create(
#             model="gpt-4",
#             messages=[
#                 {"role": "system", "content": "You are improving the prompt template to fit the target words - put target words in {character1}, {place1}, {word1}, {word2}, {word3}, {word4}, {word5}, {word6}, {word7}, {word8}, {word9}, {word10}"},
#                 {"role": "user", "content": prompt}
#             ]
#         )

#         generated_text = response.choices[0].message.content
#         print(f"\n{character_name}: {generated_text}")
