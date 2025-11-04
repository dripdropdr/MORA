import base64
import os
from tqdm import tqdm
from openai import OpenAI
import json
from glob import glob
import os
from PIL import Image
import io
import logging
import re

logger = logging.getLogger(__name__)

OPENAI_API_KEY = "sk-RFDhyyJpo0SBUcJdVW-0cIWaifqLeuyyVzsuqM9iqBT3BlbkFJTZRxrTgoeynyQHf4wg2BwW1m9Rhf5qlk2ZUF_P1EAA"

client = OpenAI(api_key=OPENAI_API_KEY)

def config_story(template_id, target_sounds):
    # Import necessary modules
    # Template file path
    template_path = f'story_template/{template_id}.json'
    if not os.path.exists(template_path):
        raise Exception('Template file not found')
    
    # Load template
    with open(template_path, 'r', encoding='utf-8') as f:
        story_data = json.load(f)
    
    # Load word database
    #NOTE: Will be updated to Pheonix Word Database API.
    words_dict = json.load(open("builder/word_base.json", "r"))
    
    # Configure story
    logger.info("Configure story...")
    story_data['metadata']['themes'] = target_sounds
    character_config, place_config, prop_config = config_words(words_dict, story_data, target_sounds)
    logger.info("Done: Story configuration")
    
    # Update story
    logger.info("Update story...")
    assign_target_words(character_config, place_config, prop_config, story_data)
    logger.info("Done: Update story")

    # collect target words
    configured_target_words = story_data['metadata'].get('target_words', [])
    
    logger.info(f"Story configuration done: {len(configured_target_words)} target words")
    return story_data, configured_target_words

def config_words(words_dict, story_template, target_sounds):
    '''
    client: OpenAI client
    words_dict: Dict : wordbase dictionary
    story_template: Json : story template
    target_sounds: List : target sounds
    return: List : config_list
    '''
    def _format_prompt(object_type, props_prompt=None):
        '''
        object_type: String : such as 'characters', 'places', 'props'
        return: String : prompt
        '''
        prompt = ""
        if props_prompt is not None:
            prompt += props_prompt
        else:
            for object in story_template[object_type]:
                prompt += f"{object['name']} {object['description']}\n"
            prompt += prompt
        prompt += f"Target words: "
        for s in target_sounds:
            prompt += f"{s}: {', '.join(words_dict[s][object_type])}\n"
        return prompt


    character_prompt = _format_prompt('characters')
    character_response = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
        {"role": "system", "content": "I want to select words for each character. Among the target words, select a word for each character that are related to the character style. **FOLLOW THE FORMAT STRICTLY**"},
            {"role": "user", "content": "{character1} is a cute and energetic character who uses short, excited sentences.\n {character2} is a kind and friendly character who uses friendly sentences.\n\n Target words:"+", ".join(words_dict['words_with_s_initial']['characters'])+"\n"},
            {"role": "assistant", "content": "{character1}: {squirrel}: acts cute and energetic;\n {character2}: {sister}: can be kind and friendly character;"},
            {"role": "user", "content": "{character1} is a kind and friendly character who uses short, excited sentences.\n {character2} is a energetic and delightful character who uses short sentences.\n\n Target words:"+", ".join(words_dict['words_with_l_initial']['characters']+words_dict['words_with_l_final']['characters'])+"\n"},
            {"role": "assistant", "content": "{character1}: {angel}: can be kind and friendly character, showing loyalty;\n {character2}: {ladybug}: has excited and energetic vibe;"},
            {"role": "user", "content": character_prompt},
        ],
        temperature=1
    )
    character_config = character_response.choices[0].message.content
    character_config_list = [config for config in character_config.split("\n") if config.strip()]

    # Place configuration
    place_prompt = _format_prompt('places')
    place_response = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
        {"role": "system", "content": "I want to select word for each place. Among the target words, select a word for each place that are related to the place description. **FOLLOW THE FORMAT STRICTLY**"},
            {"role": "user", "content": "{place1} where all characters are exploring.\n {place2} where {character1} and {character2} are wrapping up the story.\n Target words:"+", ".join(words_dict['words_with_s_initial']['places'])+"\n"},
            {"role": "assistant", "content": "{place1}: {school}: matched with all characters exploring;\n {place2}: {street}: has calm and relaxing vibe, good for wrapping up the story;\n"},
            {"role": "user", "content": "{place1} where friendly and welcoming place.\n {place2} where all characters are exploring. \n {place3} where {character1} and {character2} are wrapping up the story.\n Target words:"+", ".join(words_dict['words_with_l_initial']['places']+words_dict['words_with_l_final']['places'])+"\n"},
            {"role": "assistant", "content": "{place1}: {library}: a friendly and welcoming place filled with books and cozy reading nooks;\n {place2}: {jungle}: a place where all characters are exploring, full of vibrant plants, leaf and wildlife;\n {place3}: {lake}: a peaceful place where {character1} and {character2} are wrapping up the story, with gentle water and soft grass;\n"},
            {"role": "user", "content": place_prompt},
        ],  
        temperature=1
    )
    place_config = place_response.choices[0].message.content
    place_config_list = [config for config in place_config.split("\n") if config.strip()]
    
    # Props configuration
    prop_prompt = _format_prompt('props', props_prompt=place_config)
    prop_response = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
        {"role": "system", "content": "I want to choose three props for each place among the target words. It should be matched with the place. **FOLLOW THE FORMAT STRICTLY**"},
            {"role": "user", "content": "{place1}: {school}: matched with all characters exploring;\n {place2}: {street}: has calm and relaxing vibe, good for wrapping up the story;\n\n Target words:"+", ".join(words_dict['words_with_s_initial']['places'])+"\n"},
            {"role": "assistant", "content": "{place1}: {school}: {stamp}, {soap}, {shirt};\n {place2}: {street}: {sun}, {sticker}, {shoes};\n"},
            {"role": "user", "content": "{place1}: {library}: a friendly and welcoming place filled with books and cozy reading nooks;\n {place2}: {jungle}: a place where all characters are exploring, full of vibrant plants, leaf and wildlife;\n {place3}: {lake}: a peaceful place where {character1} and {character2} are wrapping up the story, with gentle water and soft grass;\n\n Target words:"+", ".join(words_dict['words_with_l_initial']['props']+words_dict['words_with_l_final']['props'])+"\n"},
            {"role": "assistant", "content": "{place1}: {library}: {lamp}, {laptop}, {letter};\n {place2}: {jungle}: {leaf}, {lime}, {log};\n {place3}: {lake}: {ball}, {snail}, {leaf};\n"},
            {"role": "user", "content": prop_prompt},
        ],  
        temperature=1
    )
    prop_config = prop_response.choices[0].message.content
    prop_config_list = [config for config in prop_config.split("\n") if config.strip()] 
    # TODO: assign props to places in story_data
    
    return character_config_list, place_config_list, prop_config_list

def generate_character_sheets(story_id, character):

    tools = [{
        "type": "image_generation",
        "size": "1536x1024",
        # "background": "transparent",
        # "quality": "high"
        }]
    
    # Character sheet
    character_prompts = [
        {"type": "input_text", "text": f"Draw a character sheet of a random {character['name']} {character['description']}. Use a bright, colorful illustration style."},
    ]
    character_response, character_data = run_image_generation(tools, None, character_prompts)
    save_image(character_data[0], story_id, f"character_sheet_{character['name']}")

    # More angles Character sheet
    more_angles_character_prompts = [
        {"type": "input_text", "text": f"Now give me more dynamic and various angles for this character. Use a bright, colorful illustration style."},
    ]
    more_angles_character_response, more_angles_character_data = run_image_generation(tools, character_response.id, more_angles_character_prompts)
    save_image(more_angles_character_data[0], story_id, f"character_sheet_{character['name']}_more_angles")

    # Emotion sheet
    emotion_prompts = [
        {"type": "input_text", "text": "Now give me emotion sheet for this character, {head} showing various emotions. Use a bright, colorful illustration style."},
    ]
    emotion_response, emotion_data = run_image_generation(tools, more_angles_character_response.id, emotion_prompts)
    save_image(emotion_data[0], story_id, f"character_sheet_{character['name']}_emotion")

    # Exaggrated Emotion sheet
    exaggrated_emotion_prompts = [
        {"type": "input_text", "text": "Now give me exaggrated emotion sheet for this character. so the same characters {head} showing various emotions. Use a bright, colorful illustration style."},
    ]
    exaggrated_emotion_response, exaggrated_emotion_data = run_image_generation(tools, emotion_response.id, exaggrated_emotion_prompts)
    save_image(exaggrated_emotion_data[0], story_id, f"character_sheet_{character['name']}_exaggrated_emotion")

    # Action sheet
    action_prompts = [
        {"type": "input_text", "text": "Now give me action sheet for this character. Various actions and poses. Use a bright, colorful illustration style."},
    ]   
    action_response, action_data = run_image_generation(tools, exaggrated_emotion_response.id, action_prompts)
    save_image(action_data[0], story_id, f"character_sheet_{character['name']}_action")

    return action_response

def generate_interaction_buttons(story_id, story_data, scene, dialogue, idx):

    if dialogue['interaction'] == 'select_destination':
        destinations = [place['name'] for place in story_data['places'] if place['destination']]
        tools_for_destination = [{
                "type": "image_generation",
                "size": "1024x1024",
                "background": "transparent",
            }]
        for destination in destinations:
            prompts = [{"type": "input_text", "text": f"Create a scene of {destination}. This will be a button image for destination selection. Use a bright, colorful illustration style."}]
            response, image_data = run_image_generation(tools_for_destination, None, prompts)
            save_image(image_data[0], story_id, f"{scene['id']}_{idx}_{destination}", size_ratio=0.3) # btn image for destination
        
        return None

    elif dialogue['interaction'] == 'choose' or dialogue['interaction'] == 'click':
        props = scene['props']
        tools_for_props = [{
            "type": "image_generation",
            "size": "1024x1024",
            "background": "transparent",
        }]
        for prop in props:
            prompts = [{"type": "input_text", "text": f"Create a icon of {prop} as object. This should be one single object. transparent background. Use a bright, colorful illustration style."}]
            response, image_data = run_image_generation(tools_for_props, None, prompts)
            save_image(image_data[0], story_id, f"{scene['id']}_{idx}_{prop}", size_ratio=0.3) # btn image for prop

        prop_img_filename = []
        if dialogue['interaction'] == 'choose':
            for prop in scene['props']:
                prop_img_filename.append(f"{scene['id']}_{idx}_{prop}")
        return prop_img_filename

def generate_scene_with_chosen_item(story_id, scene, dialogue, character_ref_images, idx, prop_img_filenames=None):

    tools = [{
        "type": "image_generation",
        "size": "1536x1024",
    }]
    for prop in scene['props'][1:]:
        p = f"Now draw a scene of {", ".join(scene['characters'])} in {scene['location'][0]}. "
        # prompt += f"The characters interact with each other and with user who is reading the book. \n"
        p += f"{dialogue['character']} {dialogue['prompt'].replace("{chosen_item}", prop).lower()}\n"
        p += f"If {dialogue['character']} asks the user, it should face the front. \n"
        p += f"Use the reference pictures of the {", ".join(scene['characters'])} character sheets to draw the scene. \n"
        p += f"Use the reference pictures of the {prop} to draw the scene. \n"
        p += "Use a bright, colorful illustration style.\n"
        p += "Try not to add speech bubble or text. \n"
        prompts = [{"type": "input_text", "text": p}]
        for character in scene['characters']:
            for base64_image in character_ref_images[character]:
                prompts.append({
                    "type": "input_image",
                    "image_url": f"data:image/jpeg;base64,{base64_image}",
                })
        if prop_img_filenames is not None:
            for filename in prop_img_filenames:
                if prop in filename:
                    prop_img = encode_image(story_id, filename)
                    prompts.append({
                        "type": "input_image",
                        "image_url": f"data:image/jpeg;base64,{prop_img}",
                    })
                    break
        response, image_data = run_image_generation(tools, None, prompts)
        save_image(image_data[0], story_id, f"{scene['id']}_{idx}_with_{prop}")

def generate_scene(story_id, story_data, scene):
    tools = [{
        "type": "image_generation",
        "size": "1536x1024",
        }]
    
    # Character reference images setup
    character_ref_images = {}
    for character in scene['characters']:
        tmp = []
        for filename in glob(f"story_img_{story_id}/character_sheet_{character}*.png"):
            tmp.append(encode_image(story_id, os.path.basename(filename)))
        character_ref_images[character] = tmp
    del tmp

    # Scene image generation
    for idx, dialogue in tqdm(enumerate(scene['dialogue_templates']), desc=f"Generating {scene['id']}"):
        if 'interaction' in dialogue.keys(): # user interaction turn
            save_image(image_data[0], story_id, f"{scene['id']}_{idx}") # background image for interaction
            prop_img_filenames = generate_interaction_buttons(story_id, story_data, scene, dialogue, idx) # return prop_img_filenames only if interaction is choose

        elif dialogue['character'] != '{user}' and 'chosen_item' not in dialogue['prompt']: # normal character turn
            p = f"Now draw a scene of {", ".join(scene['characters'])} in {scene['location'][0]}. "
            # prompt += f"The characters interact with each other and with user who is reading the book. \n"
            p += f"{dialogue['character']} {dialogue['prompt'].lower()}\n"
            p += f"If {dialogue['character']} asks the user, it should face the front. \n"
            p += f"Use the reference pictures of the {", ".join(scene['characters'])} character sheets to draw the scene. \n"
            p += "Use a bright, colorful illustration style.\n"
            p += "Try not to add speech bubble or text. \n"
            prompts = [{"type": "input_text", "text": p}]
            for character in scene['characters']:
                for base64_image in character_ref_images[character]:
                    prompts.append({
                        "type": "input_image",
                        "image_url": f"data:image/jpeg;base64,{base64_image}",
                    })
            response, image_data = run_image_generation(tools, None, prompts)
            save_image(image_data[0], story_id, f"{scene['id']}_{idx}")

        elif dialogue['character'] != '{user}' and 'chosen_item' in dialogue['prompt']: # chosen item turn, interaction choose affected by chosen item
            generate_scene_with_chosen_item(story_id, scene, dialogue, character_ref_images, idx, prop_img_filenames)

        else: # default user turn
            save_image(image_data[0], story_id, f"{scene['id']}_{idx}")

def run_image_generation(tools, previous_response_id, prompts):
    '''
    tools: list of tools
    prompts: list of prompts, each is a dict with "type": "input_text", "text": str
    return: response.output
    '''
    input_content = prompts
    if previous_response_id is not None:
        while True:
            try:
                response = client.responses.create(
                    model="gpt-4.1-mini",
                    previous_response_id=previous_response_id,
                    input=[{ "role": "user", "content": input_content }],
                    tools=tools,
                )

                image_data = [
                    output.result
                    for output in response.output
                    if output.type == "image_generation_call"
                ]
                if not image_data:
                    continue  # if image_data is empty, repeat the loop
                break
            
            except Exception as e:
                    print(e)
                    continue

    else:
        while True:
            try:
                response = client.responses.create(
                model="gpt-4.1-mini",
                input=[{ "role": "user", "content": input_content }],
                tools=tools,
                )
                image_data = [
                    output.result
                    for output in response.output
                    if output.type == "image_generation_call"
                ]
                if not image_data:
                    continue
                break  # if image_data is not empty, break the loop

            except Exception as e:
                print(e)
                continue
    
    return response, image_data

def save_image(image_data, story_id, filename, size_ratio=1):
    os.makedirs(f"story_img_{story_id}", exist_ok=True)
    
    # base64를 디코딩하여 PIL Image로 로드
    image_bytes = base64.b64decode(image_data)
    image = Image.open(io.BytesIO(image_bytes))
    
    # 사이즈 조정
    if size_ratio != 1:
        original_width, original_height = image.size
        new_width = int(original_width * size_ratio)
        new_height = int(original_height * size_ratio)
        image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
    
    # 이미지 저장
    image.save(f"story_img_{story_id}/{filename}.png", "PNG")

def encode_image(story_id, filename):
    file_path = f"story_img_{story_id}/{filename}"
    with open(file_path, "rb") as f:
        base64_image = base64.b64encode(f.read()).decode("utf-8")
    return base64_image

def assign_target_words(character_config, place_config, prop_config, story_data):
    """
    character_config: List[str] like ["{character1}: {angel}: kind and friendly;", ...]
    place_config: List[str] like ["{place1}: {library}: a friendly and welcoming place;", ...]
    prop_config: List[str] like ["{place1}: {library}: {lamp}, {laptop}, {letter};", ...]
    story_data: dict loaded from template json

    1) assign characters and places in story_data template
    2) assign props for each place and update scene props to the place props
    """

    # 1) characters and places
    combined_configs = []
    combined_configs.extend(character_config or [])
    combined_configs.extend(place_config or [])
    assign_characters_places(combined_configs, story_data)

    # 2) props for each place
    assign_props(prop_config, story_data)
        
    # update target words in metadata
    target_words = []
    for c in combined_configs:
        target_words.extend([word for word in re.findall(r'\{[^}]*\}', c) if not word.startswith('{character') and not word.startswith('{place')])
    for s in story_data['scenes']:
        target_words.extend(s['props'])
    story_data['metadata']['target_words'] = list(set(target_words))

    return story_data

def assign_characters_places(config_list, story_data):
    '''
            iterate by each config in config_list
            config_indicator: {character1} or {place1}
            config_name: character1 or place1
            config_description: character1 description or place1 description with props
        '''
    for config in config_list:
        config_indicator, config_name, config_description = re.split(r':| - ', config)
        config_indicator = config_indicator.strip()
        config_name = config_name.strip()
        config_description = config_description.strip()

        if config_indicator.startswith('{character'):
            for character in story_data['characters']:
                if config_indicator == character['name']:
                    character['name'] = config_name
                    character['description'] = config_description
                    for scene in story_data['scenes']:
                        # if config_indicator in scene['characters']:
                        scene['characters'] = [config_name if char == config_indicator else char for char in scene['characters']]
                        scene['description'] = scene['description'].replace(config_indicator, config_name)
                        for dialogue in scene['dialogue_templates']:
                            if config_indicator in dialogue['character']:
                                dialogue['character'] = config_name
                            dialogue['prompt'] = dialogue['prompt'].replace(config_indicator, config_name)
            for place in story_data['places']:
                # if config_indicator in place['description']:
                place['description'] = place['description'].replace(config_indicator, config_name)
        
        elif config_indicator.startswith('{place'):
            for place in story_data['places']:
                if config_indicator == place['name']:
                    place['name'] = config_name
                    place['description'] = f" {config_description}"
                    place['props'] = [prop for prop in re.findall(r'\{[^}]*\}', config_description) if not prop.startswith('{character')]
                    for scene in story_data['scenes']:
                        # if config_indicator in scene['places']:
                        scene['location'] = [config_name if config_indicator == s else s for s in scene['location']]
                        scene['description'] = scene['description'].replace(config_indicator, config_name)
                        for dialogue in scene['dialogue_templates']:
                            dialogue['prompt'] = dialogue['prompt'].replace(config_indicator, config_name)
                else:
                    place['description'] = place['description'].replace(config_indicator, config_name)

        elif config_indicator.startswith('{destination'):
            for place in story_data['places']: # Update other destination after user's selection
                if config_indicator == place['name']:
                    place['destination'] = True
                    place['description'] = f" {config_description}"
                    place['props'] = [prop for prop in re.findall(r'\{[^}]*\}', config_description) if not prop.startswith('{character')]

def assign_destination(config_list, story_data):
    for config in config_list:
        config_indicator, config_name, config_description = re.split(r':| - ', config)
        config_indicator = config_indicator.strip()
        config_name = config_name.strip()
        config_description = config_description.strip()
    
def assign_props(prop_config, story_data):

    def _parse_line(config_line):
        # remove trailing semicolons and trim
        line = config_line.strip().rstrip(';')
        # split by ':' first two occurrences
        parts = [p.strip() for p in re.split(r":", line, maxsplit=2)]
        # Ensure three parts: indicator, chosen_name, description_or_props
        indicator = parts[0] if len(parts) > 0 else ""
        chosen = parts[1] if len(parts) > 1 else ""
        rest = parts[2] if len(parts) > 2 else ""
        return indicator, chosen, rest
    
    # place_name_map: {placeholder -> resolved_place_name}
    place_name_map = {}
    for place in story_data.get('places', []):
        # since template is already replaced, we cannot know the placeholder, so match by name only
        place_name_map[place['name']] = place['name']

    for cfg in (prop_config or []):
        indicator, place_name, rest = _parse_line(cfg)
        # extract props: {...} pattern only
        props = re.findall(r"\{[^}]*\}", rest)

        # find place (first try place_name, then indicator)
        target_place = next((p for p in story_data.get('places', []) if p['name'] == place_name), None)
        if target_place is None:
            target_place = next((p for p in story_data.get('places', []) if p['name'] == indicator), None)

        if target_place is None:
            continue  # if matching fails, skip

        # set props to the place
        target_place['props'] = props

    # 3) synchronize scene props: set the props of the first place in the scene
    for scene in story_data.get('scenes', []):
        # scene structure has 'location' key or 'places' key
        place_candidates = []
        if 'places' in scene and scene['places']:
            place_candidates = scene['places']
        elif 'location' in scene and scene['location']:
            place_candidates = scene['location']

        if not place_candidates:
            continue

        scene_place_name = place_candidates[0]
        place_obj = next((p for p in story_data.get('places', []) if p['name'] == scene_place_name), None)
        if place_obj is None:
            continue

        # replace scene props with the place props
        if place_obj.get('props'):
            scene['props'] = list(place_obj['props'])

def assign_image_in_story(story_data, story_id):    
    for scene in story_data['scenes']:
        for idx, dialogue in enumerate(scene['dialogue_templates']):
            if os.path.exists(f"story_img_{story_id}/{scene['id']}_{idx}.png") and dialogue.get('interaction'):
                dialogue['image'] = f"story_img_{story_id}/{scene['id']}_{idx}.png"
                dialogue['interact_image'] = glob(f"story_img_{story_id}/{scene['id']}_{idx}_*.png")
            elif os.path.exists(f"story_img_{story_id}/{scene['id']}_{idx}.png"):
                dialogue['image'] = f"story_img_{story_id}/{scene['id']}_{idx}.png"
            else:
                dialogue['image'] = ""
    
    return story_data

if __name__ == "__main__":
    client = OpenAI(api_key="sk-RFDhyyJpo0SBUcJdVW-0cIWaifqLeuyyVzsuqM9iqBT3BlbkFJTZRxrTgoeynyQHf4wg2BwW1m9Rhf5qlk2ZUF_P1EAA")
    words_dict = json.load(open("builder/word_base.json", "r"))
    template_id = "template_2"
    target_sounds = ["words_with_s_initial", "words_with_r_initial"]
    import random
    # story_data, configured_target_words = config_story(template_id, target_sounds)
    # story_id = random.randint(100000, 999999)
    # json.dump(story_data, open(f"story/story_{story_id}.json", "w"), indent=4)

    # os.makedirs(f"story_img_{story_id}", exist_ok=True)

    # for character in tqdm(story_data['characters'], desc="Generating character sheets"):
    #     generate_character_sheets(story_id, character)

    story_data = json.load(open(f"story/story_855298.json", "r"))
    # for scene in story_data['scenes']:
    #     generate_scene(855298, story_data, scene)

    story_data = assign_image_in_story(story_data, 855298)
    json.dump(story_data, open(f"story/story_855298.json", "w"), indent=4)