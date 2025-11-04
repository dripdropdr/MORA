'''
Test the story engine with a story file;
'''

from backend.engine.story_graph_manager import StoryGraphManager
from backend.engine.word_learning_planner import WordLearningPlanner
from backend.engine.dialog_generator import DialogGenerator
from backend.engine.audio_creator import AudioCreator
import json
import re
from PIL import Image
from time import sleep
import asyncio

# 초기화
# story_path = 'backend/story/story_402545.json'
story_path = 'backend/story/story_967781.json'
graph_manager = StoryGraphManager(story_path)
learning_planner = WordLearningPlanner(
    story_target_words=json.load(open(story_path))["target_words"]
)
dialog_gen = DialogGenerator(
    api_key="sk-RFDhyyJpo0SBUcJdVW-0cIWaifqLeuyyVzsuqM9iqBT3BlbkFJTZRxrTgoeynyQHf4wg2BwW1m9Rhf5qlk2ZUF_P1EAA",
    character_profiles=json.load(open(story_path))["characters"]
)
audio_creator = AudioCreator(
    api_key="sk-RFDhyyJpo0SBUcJdVW-0cIWaifqLeuyyVzsuqM9iqBT3BlbkFJTZRxrTgoeynyQHf4wg2BwW1m9Rhf5qlk2ZUF_P1EAA",
    character_profiles=json.load(open(story_path))["characters"]
)
conversation_history = []
target_sounds = json.load(open(story_path))['metadata']['themes']

print("="*20+"="*20)
print(f"The story is targeting for {json.load(open(story_path))['metadata']['themes']}")
print(f"The words we want to learn today: {", ".join(learning_planner.story_target_words)}")
print("Let's start the story!")
print("="*20+"="*20)

for idx in range(len(graph_manager.story_data["scenes"])):
    scene = graph_manager.get_current_scene()
    print(f"\n📖 {scene['id']}: {scene['description']}")
    conversation_history = []
 
    scene_info = f"""Scene information: \n-Scene: {scene['description']}"""
    scene_info += f"""\n-Characters: {scene['characters']}"""
    scene_info += f"""\n-Places: {scene['places'][0]}, {[place for place in graph_manager.story_data['places'] if place['name'] == scene['places'][0]][0]['description']}"""
    # scene_info += f"""\nTarget Words: {scene['target_words']}"""
    # scene_info += f"""\nDialogue Templates: {scene['dialogue_templates']}"""
    
    for dialogue in scene['dialogue_templates']:
        # If it's turn of characters, generate dialogue
        if dialogue['character'] != "{user}":
            dialogue_text = dialog_gen.generate_dialogue(scene_info, dialogue, conversation_history, target_sounds)
            if dialogue['image'] != "":
                img = Image.open(dialogue['image'])
                img = img.resize((int(img.size[0]*(0.5)), int(img.size[1]*(0.5))))
                img.show()
            print(f"{dialogue_text}")
            asyncio.run(audio_creator.generate_speech_with_dialogue(dialogue['character'], dialogue_text))
            conversation_history.append(dialogue_text)
            # sleep(3)

        # If it's turn of user, get child input
        elif dialogue['character'] == "{user}":
            if dialogue['image'] != "":
                img = Image.open(dialogue['image'])
                img = img.resize((int(img.size[0]*(0.5)), int(img.size[1]*(0.5))))
                img.show()
            print(f"===> {dialogue['prompt']}")
            # child_input = input("👶 Child says: ")
            child_input = audio_creator.transcribe_user_speech()
            print(f"👶 Child said: {child_input}")
            conversation_history.append({"speaker": "{user}", "line": child_input})
            child_input_words = [re.sub(r'[^\w\s]', '', word) for word in child_input.split()]
            for word in child_input_words:
                learning_planner.count_pronunced_word(word)

        # close image
        if dialogue['image'] != "":
            img.close()
    
    # dialogue are done
    if graph_manager.move_to_next_scene():
       continue
    
    else:
        print(f"How many words did you learn? {learning_planner.learned_words}")
        print("🏁 Story finished!")
        break

# prompt = (
#                     f"You are {character}, a character who is {personality}. "
#                     f"Speak in a way that is {style}. "
#                     f"Your goal is to let the child mention '{target_word}' naturally. "
#                     f"Here’s the situation: {conversation_history_str}"
#                 )

# target_words_flag = []
# conversation_history = []

# # 메인 루프
# while True:
#     scene = graph_manager.get_current_scene()
#     print(f"\n📖 Scene: {scene['description']}")

#     if target_words_flag == []: # move to the next scene or start the story
#         target_word = learning_planner.extract_target_words(scene)
#         target_words_flag = copy.deepcopy(target_word)
#     else:
#         target_word = target_words_flag
    

#     dialogues = dialog_gen.generate_dialogues(scene, target_word, conversation_history)
#     for d in dialogues:
#         print(f"{d['character']}: {d['line']}")
#         conversation_history.append({"speaker": d['character'], "line": d['line']})

#     # 어린이 발화 시뮬레이션
#     child_input = input("👶 Child says: ")
#     conversation_history.append({"speaker": "{user}", "line": child_input})
#     child_input_words = [re.sub(r'[^\w\s]', '', word) for word in child_input.split()]
    
#     for word in target_word:
#         if word in child_input_words:
#             learning_planner.count_pronunced_word(word)
#             target_words_flag.remove(word)

#     if len(target_words_flag) == 0:
#         print("🎉 All words learned in this scene.")
#         if graph_manager.move_to_next_scene():
#             conversation_history = []
#             continue
#         else: # 스토리 끝! 프로그램 종료 처리
#             # TODO: add reaction to child input
#             print("🏁 Story finished!")
#             break