from openai import OpenAI, AsyncOpenAI
from PIL import Image, ImageFilter
import io
import base64 
import re
import os

class VisualInteractionHandler:
    def __init__(self, api_key, story_data):
        self.client = OpenAI(api_key=api_key)
        self.openai_async = AsyncOpenAI(api_key=api_key)
        self.openai_sync = OpenAI(api_key=api_key)
        self.voices = ["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer"]
        self.story_data = story_data

    def route_dialogue_image(self, dialogue_type, dialogue, base_dir):
        if dialogue_type == 'character_dialogue':
            return self.load_image(os.path.join(base_dir, dialogue['image_path']))
        elif dialogue_type == 'user_turn':
            return self.load_image_blurred(os.path.join(base_dir, dialogue['image_path']))

    def route_interaction(self, interaction_type, dialogue, base_dir):
        background_image_data, btn_image_data, btn_words = None, None, None

        background_image_path = os.path.join(base_dir, dialogue['image_path']) # always exists
        if dialogue.get('interact_image'): interact_image_paths = dialogue['interact_image']

        if interaction_type == 'select_destination':
            background_image_data, btn_image_data, btn_words = self.load_select_destination_images(background_image_path, interact_image_paths)
        elif interaction_type == 'choose':
            background_image_data, btn_image_data, btn_words = self.load_choose_images(background_image_path, interact_image_paths)
        elif interaction_type == 'click':    
            background_image_data, btn_image_data, btn_words = self.load_click_images(background_image_path, interact_image_paths)
        elif interaction_type == 'shout':
            background_image_data = self.load_shout_images(background_image_path)
        elif interaction_type == 'touch':
            background_image_data = self.load_touch_images(background_image_path)
        
        return background_image_data, btn_image_data, btn_words

    def load_select_destination_images(self, background_image_path, interact_image_paths):
        """
        Select destination from the background image and the interact images.
        """
        background_size = None
        with Image.open(background_image_path) as img:
            background_size = img.size
            blurred_img_gaussian = img.filter(ImageFilter.GaussianBlur(5))
            buffer = io.BytesIO()
            blurred_img_gaussian.save(buffer, format='PNG')
            background_image_data = base64.b64encode(buffer.getvalue()).decode()

        interact_image_data = []

        for interact_image_path in interact_image_paths:
            with Image.open(interact_image_path) as img:
                # if img.size[0] != background_size[0]//3:
                #     img = img.resize(background_size[0]//3, background_size[1]//3)
                buffer = io.BytesIO()
                img.save(buffer, format='PNG')
                interact_image_data.append(base64.b64encode(buffer.getvalue()).decode())

        interact_words = [re.sub(r'.*\{([^}]+)\}.*', r'\1', interact_image_path.split('/')[-1]) for interact_image_path in interact_image_paths]

        return background_image_data, interact_image_data, interact_words

    def load_click_images(self, background_image_path, interact_image_paths):
        """
        Click on the props from the background image and the button images.
        """
        background_size = None
        with Image.open(background_image_path) as img:
            background_size = img.size
            blurred_img_gaussian = img.filter(ImageFilter.GaussianBlur(5))
            buffer = io.BytesIO()
            blurred_img_gaussian.save(buffer, format='PNG')
            background_image_data = base64.b64encode(buffer.getvalue()).decode()

        interact_image_data = []
        
        for interact_image_path in interact_image_paths:
            with Image.open(interact_image_path) as img:
                buffer = io.BytesIO()
                img.save(buffer, format='PNG')
                interact_image_data.append(base64.b64encode(buffer.getvalue()).decode())

        interact_words = [re.sub(r'.*\{([^}]+)\}.*', r'\1', interact_image_path.split('/')[-1]) for interact_image_path in interact_image_paths]

        return background_image_data, interact_image_data, interact_words

    def load_shout_images(self, image_path):
        return self.load_image(image_path)

    def load_choose_images(self, background_image_path, interact_image_paths):
        """
        Choose props from the background image and the button images.
        """
        background_size = None
        with Image.open(background_image_path) as img:
            background_size = img.size
            blurred_img_gaussian = img.filter(ImageFilter.GaussianBlur(5))
            buffer = io.BytesIO()
            blurred_img_gaussian.save(buffer, format='PNG')
            background_image_data = base64.b64encode(buffer.getvalue()).decode()

        interact_image_data = []

        for interact_image_path in interact_image_paths:
            with Image.open(interact_image_path) as img:
                buffer = io.BytesIO()
                img.save(buffer, format='PNG')
                interact_image_data.append(base64.b64encode(buffer.getvalue()).decode())

        interact_words = [re.sub(r'.*\{([^}]+)\}.*', r'\1', interact_image_path.split('/')[-1]) for interact_image_path in interact_image_paths]

        return background_image_data, interact_image_data, interact_words
    
    def load_touch_images(self, image_path):
        return self.load_image(image_path)

    def load_image(self, image_path):
        with Image.open(image_path) as img:
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            current_image_data = base64.b64encode(buffer.getvalue()).decode()
        
        return current_image_data
    
    def load_image_blurred(self, image_path):
        with Image.open(image_path) as img:
            blurred_img_gaussian = img.filter(ImageFilter.GaussianBlur(5))
            buffer = io.BytesIO()
            blurred_img_gaussian.save(buffer, format='PNG')
            current_image_data = base64.b64encode(buffer.getvalue()).decode()
        
        return current_image_data
    