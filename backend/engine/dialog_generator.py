# LLM 호출해 대사 생성

from openai import OpenAI

class DialogGenerator:
    def __init__(self, api_key, character_profiles):
        self.client = OpenAI(api_key=api_key)
        self.character_profiles = character_profiles  # 캐릭터 성격 데이터

    def _build_scene_info(self, scene, destination=None):
        """공통: scene_info 문자열 생성"""
        scene_info = f"""Scene information: \n-Scene: {scene['description']}"""
        scene_info += f"""\n-Characters: {scene['characters']}"""
        if scene.get('location'):
            # location 이 리스트일 수도 있고 전체가 필요할 수도 있어 문자열로 안전 변환
            places = scene['location']
            if isinstance(places, (list, tuple)):
                # next_dialogue 쪽 기존 동작은 첫 장소만 사용했음
                place_str = places[0] if places else None
            else:
                place_str = places
            if place_str:
                scene_info += f"""\n-Places: {place_str}"""

        if destination:
            scene_info.replace("{destination}", destination)
        return scene_info


    def generate_dialogue(self, scene, dialogue, conversation_history, target_sounds, destination=None, chosen_item=None):
        dialogue_prompt = ""
        character_info = next((char for char in self.character_profiles if char['name'] == dialogue['character']), {})
        character_prompt = f"""\nYou are a {dialogue['character']}, {character_info['description']}."""


        dialogue_prompt += self._build_scene_info(scene, destination)
        dialogue_prompt += f"""\nThese are the main information of the dialogue: """
        dialogue_prompt += f"""\n-Diaglogue Prompt:{dialogue['prompt']}"""
        dialogue_prompt += f"""\n-Conversation History: {conversation_history}"""

        if destination:
            dialogue_prompt = dialogue_prompt.replace("{destination}", '{' + destination + '}')
        if chosen_item:
            dialogue_prompt = dialogue_prompt.replace("{chosen_item}", '{' + chosen_item + '}')
            
        # Prepare target sounds text safely for f-strings
        sounds_text = ", ".join(target_sounds) if target_sounds else ""

        response = self.client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[
                {"role": "system", "content": f"{character_prompt}. You are talking to kids. Say simple and short sentences. Just say your lines. Refer the conversation history to make the dialogue more natural. Don't say too much. Try to use words that contain {sounds_text}, by using minimal pairs and multiple oppositions in the dialogue."},
                
                {"role": "user", "content": """Scene information: 
                 -Scene: User arrives at {library} where {rose} greets the user.
                 -Characters: ['{rose}', '{rocket}']
                 -Places: {library},  a friendly and welcoming place where characters can find books and read; props include {calendar} for event planning
                 Main information of the dialogue: 
                 -Diaglogue Prompt: Greet the user warmly and introduce yourself.
                 -Conversation History: ['scene_0: User arrives at {library} where {rose} greets the user.']"""},
                
                {"role": "assistant", "content": "Rose: Welcome to the library! I'm Rose - not Hose! How are you doing?"},
                {"role": "user", "content": dialogue_prompt}
            ],
            max_tokens=60,
            temperature=0.8
        )
    # question 형태로 대사 재구성
        return response.choices[0].message.content.strip()    

    def generate_madlib_for_word_mode(self, scene, dialogue, target_sounds, destination=None, chosen_item=None):
        dialogue_prompt = ""

        dialogue_prompt += f"""\nMain information of the dialogue: """
        dialogue_prompt += f"""\n-User Answer Prompt:{dialogue['prompt']}"""
        dialogue_prompt += f"""\n Target Sounds: {", ".join(target_sounds)}"""

        dialogue_prompt += self._build_scene_info(scene, destination)
        
        if destination:
            dialogue_prompt = dialogue_prompt.replace("{destination}", '{' + destination + '}')
        if chosen_item:
            dialogue_prompt = dialogue_prompt.replace("{chosen_item}", '{' + chosen_item + '}')

        response = self.client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[
            {"role": "system", "content": f"You are a child user who is playing a story game. Please generate the one or two sentences of dialogue in user's viewpoint. If you need to introduce yourself, DON'T ADD YOUR NAME IN THE DIALOGUE. KEEP words with curley braces as is. Follow the given User Answer Prompt strictly:"},
                
                {"role": "user", "content": """
                 Main information of the user's dialogue: 
                 -User Answer Prompt: Say hi to {lizard}. Introduce yourself as well.
                 -Target Sounds: {words_with_l_initial}, {words_with_r_initial}
                 
                 Scene information: 
                 -Scene: {lizard} notices the user and introduces themselves.
                 -Characters: ['{lizard}']
                 -Places: {library}, a quiet and welcoming place where the story begins;
                 """},
                {"role": "assistant", "content": "Hi {lizard}! Nice to meet you!"},

                {"role": "user", "content": """
                Main information of the user's dialogue: 
                -User Answer Prompt: Answer {champion}'s question about the adventure to destination {rainbow}.
                -Target Sounds: {words_with_ch_initial}, {words_with_r_initial}
                
                Scene information: 
                -Scene: {champion} walks with user in {river}, on the way to destination {rainbow}
                -Characters: ['{champion}']
                -Places: {river}, on the way to destination {rainbow};
                """},
                {"role": "assistant", "content": "Hey {champion}, I'm excited to go {rainbow} with you!"},

                {"role": "user", "content": dialogue_prompt}
            ],
            max_tokens=60,
            temperature=0.8
        )

        return response.choices[0].message.content.strip()   
    
    def generate_exploration_dialogue(self, scene, item, available_items, target_sounds):
        """Generate exploration dialogue when user clicks on screen during click interaction"""
        character = scene.get('characters', ['Character'])[0]  # Use first character
        character_info = next((char for char in self.character_profiles if char['name'] == character), {})
        character_prompt = f"""\nYou are a {character}, {character_info.get('description', 'a friendly character')}."""
        
        scene_info = self._build_scene_info(scene)
        
        dialogue_prompt = f"""{scene_info}
        
The user is exploring items in this scene. Available items: {", ".join(available_items)}
The user clicked on the screen and we randomly selected: {item}

Generate a short, encouraging dialogue where the character suggests exploring the {item}. 
Use phrases like "Explore the item, how about {item}?" or "Let's check out the {item}!" or "What about that {item}?"
Keep it short and friendly. Try to use words related to {", ".join(target_sounds) if target_sounds else "the scene"}."""
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": f"{character_prompt} Be encouraging and suggest exploring items. Keep responses short and friendly."},
                    {"role": "user", "content": dialogue_prompt}
                ]
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            # Fallback if API fails
            return f"Explore the item, how about {item}?"