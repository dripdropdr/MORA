from glob import glob
from tqdm import tqdm
import json
import pandas as pd
import random

try:
    from backend.engine.error_detector import PronunciationDistanceCalculator
    from backend.engine.audio_creator import AudioCreator
except ImportError:
    print("Warning: Some modules not available. Only basic functions will work.")

def draw_boxplot():
    import matplotlib.pyplot as plt
    import matplotlib.font_manager as fm
    import numpy as np
    
    try:
        plt.rcParams['font.family'] = 'AppleGothic'
    except:
        try:
            plt.rcParams['font.family'] = 'Malgun Gothic'
        except:
            plt.rcParams['font.family'] = 'DejaVu Sans'
    plt.rcParams['axes.unicode_minus'] = False
    
    paths = glob("evaluated_result/*.csv")
    
    hamming_data = {}
    weighted_data = {}
    
    for path in paths:
        filename = path.split("/")[-1].replace(".csv", "")
        
        df = pd.read_csv(path)
        
        distances = df[df["distance"] != float('inf')]["distance"].values
        
        if "hamming_gemini" in filename:
            hamming_data["Gemini"] = distances
        elif "hamming_hf" in filename:
            hamming_data["XLSR-TIMIT-B0"] = distances
        elif "weighted_gemini" in filename:
            weighted_data["Gemini"] = distances
        elif "weighted_hf" in filename:
            weighted_data["XLSR-TIMIT-B0"] = distances
        elif "hamming_ginic" in filename:
            hamming_data["Ginic-gender-split"] = distances
        elif "weighted_ginic" in filename:
            weighted_data["Ginic-gender-split"] = distances
    
    method_colors = {
        'Gemini': 'lightblue',
        'Ginic-gender-split': 'lightgreen', 
        'XLSR-TIMIT-B0': 'lavender'
    }
    
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 8))
    
    if hamming_data:
        hamming_labels = sorted(hamming_data.keys())
        hamming_data = {label: hamming_data[label] for label in hamming_labels}
        hamming_labels = list(hamming_data.keys())
        hamming_values = [hamming_data[label] for label in hamming_labels]
        
        box_plot1 = ax1.boxplot(hamming_values, tick_labels=hamming_labels, patch_artist=True)
        
        for patch, label in zip(box_plot1['boxes'], hamming_labels):
            patch.set_facecolor(method_colors.get(label, 'lightgray'))
        
        for i, (label, data) in enumerate(hamming_data.items()):
            median_val = np.median(data)
            ax1.text(i+1, median_val, f'{median_val:.3f}', 
                    horizontalalignment='center', verticalalignment='bottom',
                    fontsize=10, fontweight='bold', color='red')
        
        ax1.set_title('Hamming Distance', fontsize=16, pad=20)
        ax1.set_ylabel('Distance', fontsize=14)
        ax1.set_xlabel('Method', fontsize=14)
        ax1.grid(True, alpha=0.3)
        ax1.tick_params(axis='both', which='major', labelsize=12)
    
    if weighted_data:
        weighted_labels = sorted(weighted_data.keys())
        weighted_data = {label: weighted_data[label] for label in weighted_labels}
        weighted_labels = list(weighted_data.keys())
        weighted_values = [weighted_data[label] for label in weighted_labels]
        
        box_plot2 = ax2.boxplot(weighted_values, tick_labels=weighted_labels, patch_artist=True)
        
        for patch, label in zip(box_plot2['boxes'], weighted_labels):
            patch.set_facecolor(method_colors.get(label, 'lightgray'))
        
        # for i, (label, data) in enumerate(weighted_data.items()):
        #     median_val = np.median(data)
        #     ax2.text(i+1, median_val, f'{median_val:.3f}', 
        #             horizontalalignment='center', verticalalignment='bottom',
        #             fontsize=10, fontweight='bold', color='red')
        
        ax2.set_title('Weighted Distance', fontsize=16, pad=20)
        ax2.set_ylabel('Distance', fontsize=14)
        ax2.set_xlabel('Method', fontsize=14)
        ax2.grid(True, alpha=0.3)
        ax2.tick_params(axis='both', which='major', labelsize=12)
    
    plt.tight_layout()
    
    print("\n=== Hamming Distance 통계 정보 ===")
    for label in hamming_data.keys():
        data = hamming_data[label]
        print(f"\n{label}:")
        print(f"  평균: {np.mean(data):.3f}")
        print(f"  중앙값: {np.median(data):.3f}")
        print(f"  표준편차: {np.std(data):.3f}")
        print(f"  최솟값: {np.min(data):.3f}")
        print(f"  최댓값: {np.max(data):.3f}")
        print(f"  데이터 개수: {len(data)}")
    
    print("\n=== Weighted Distance 통계 정보 ===")
    for label in weighted_data.keys():
        data = weighted_data[label]
        print(f"\n{label}:")
        print(f"  평균: {np.mean(data):.3f}")
        print(f"  중앙값: {np.median(data):.3f}")
        print(f"  표준편차: {np.std(data):.3f}")
        print(f"  최솟값: {np.min(data):.3f}")
        print(f"  최댓값: {np.max(data):.3f}")
        print(f"  데이터 개수: {len(data)}")
    
    plt.savefig('boxplot_comparison_dis.png', dpi=300, bbox_inches='tight')
    print(f"\n비교 박스플롯이 'boxplot_comparison.png'로 저장되었습니다.")
    
    plt.show()

def draw_all_boxplot():
    import matplotlib.pyplot as plt
    import matplotlib.font_manager as fm
    import numpy as np
    import os
    
    try:
        plt.rcParams['font.family'] = 'AppleGothic'
    except:
        try:
            plt.rcParams['font.family'] = 'Malgun Gothic'
        except:
            plt.rcParams['font.family'] = 'DejaVu Sans'
    plt.rcParams['axes.unicode_minus'] = False
    
    folders = [
        ("evaluated_result", "진한 색상"),
        ("evaluated_result_", "연한 색상")
    ]
    
    data_dict = {}
    labels = []
    folder_info = {}
    
    for folder_name, color_type in folders:
        folder_path = f"{folder_name}/"
        hamming_files = glob(f"{folder_path}hamming_*.csv")
        
        for path in hamming_files:
            filename = path.split("/")[-1].replace(".csv", "")
            
            if "hamming_gemini" in filename:
                base_label = "Gemini"
            elif "hamming_hf" in filename:
                base_label = "XLSR-TIMIT-B0"
            elif "hamming_ginic" in filename:
                base_label = "Ginic-gender-split"
            else:
                base_label = filename.replace("hamming_", "")
            
            if folder_name == "evaluated_result":
                label = f"{base_label}"
            else:
                label = f"{base_label}_"
                
            try:
                df = pd.read_csv(path)
                distances = df[df["distance"] != float('inf')]["distance"].values
                
                data_dict[label] = distances
                labels.append(label)
                folder_info[label] = folder_name
            except Exception as e:
                print(f"파일 읽기 오류 {path}: {e}")
                continue
    
    if not data_dict:
        print("읽을 수 있는 hamming distance 파일이 없습니다.")
        return
    
    result_data = {}
    result_data_ = {}
    
    base_models = ["Gemini", "Ginic-gender-split", "XLSR-TIMIT-B0"]
    
    for label, data in data_dict.items():
        if label.endswith('_'):
            base_model = label[:-1]
            result_data_[base_model] = data
        else:
            result_data[label] = data
    
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 8))
    
    color_mapping = {
        'Gemini': 'steelblue',
        'Ginic-gender-split': 'mediumseagreen', 
        'XLSR-TIMIT-B0': 'mediumpurple'
    }
    
    # 첫 번째 서브플롯: evaluated_result
    if result_data:
        result_labels = [model for model in base_models if model in result_data]
        result_values = [result_data[model] for model in result_labels]
        
        box_plot1 = ax1.boxplot(result_values, tick_labels=result_labels, patch_artist=True)
        
        for patch, label in zip(box_plot1['boxes'], result_labels):
            patch.set_facecolor(color_mapping.get(label, 'darkgray'))
        
        # for i, label in enumerate(result_labels):
        #     data = result_data[label]
        #     median_val = np.median(data)
        #     ax1.text(i+1, median_val, f'{median_val:.3f}', 
        #             horizontalalignment='center', verticalalignment='bottom',
        #             fontsize=10, fontweight='bold', color='red')
        
        ax1.set_title('Intended target pronunciation to Model phoneme transcription', fontsize=16, pad=20)
        ax1.set_ylabel('Hamming Distance', fontsize=14)
        ax1.set_xlabel('Method', fontsize=14)
        ax1.grid(True, alpha=0.3)
        ax1.tick_params(axis='both', which='major', labelsize=12)
        
        ax1.tick_params(axis='x', rotation=45)
    
    if result_data_:
        result_labels_ = [model for model in base_models if model in result_data_]
        result_values_ = [result_data_[model] for model in result_labels_]
        
        box_plot2 = ax2.boxplot(result_values_, tick_labels=result_labels_, patch_artist=True)
        
        light_color_mapping = {
            'Gemini': 'lightblue',
            'Ginic-gender-split': 'lightgreen', 
            'XLSR-TIMIT-B0': 'lavender'
        }
        
        for patch, label in zip(box_plot2['boxes'], result_labels_):
            patch.set_facecolor(light_color_mapping.get(label, 'lightgray'))
        
        # for i, label in enumerate(result_labels_):
        #     data = result_data_[label]
        #     median_val = np.median(data)
        #     ax2.text(i+1, median_val, f'{median_val:.3f}', 
        #             horizontalalignment='center', verticalalignment='bottom',
        #             fontsize=10, fontweight='bold', color='red')
        
        ax2.set_title('HuTr to Model phoneme transcription', fontsize=16, pad=20)
        ax2.set_ylabel('Hamming Distance', fontsize=14)
        ax2.set_xlabel('Method', fontsize=14)
        ax2.grid(True, alpha=0.3)
        ax2.tick_params(axis='both', which='major', labelsize=12)
        
        ax2.tick_params(axis='x', rotation=45)
    
    if result_data and result_data_:
        all_data = list(result_data.values()) + list(result_data_.values())
        all_values = np.concatenate(all_data)
        y_min = np.min(all_values)
        y_max = np.max(all_values)
        
        y_range = y_max - y_min
        y_min_padded = y_min - 0.05 * y_range
        y_max_padded = y_max + 0.05 * y_range
        
        ax1.set_ylim(y_min_padded, y_max_padded)
        ax2.set_ylim(y_min_padded, y_max_padded)
    
    plt.tight_layout()
    
    print("\n=== evaluated_result 폴더 통계 정보 ===")
    for label in result_labels if result_data else []:
        data = result_data[label]
        print(f"\n{label}:")
        print(f"  평균: {np.mean(data):.3f}")
        print(f"  중앙값: {np.median(data):.3f}")
        print(f"  표준편차: {np.std(data):.3f}")
        print(f"  최솟값: {np.min(data):.3f}")
        print(f"  최댓값: {np.max(data):.3f}")
        print(f"  데이터 개수: {len(data)}")
    
    print("\n=== evaluated_result_ 폴더 통계 정보 ===")
    for label in result_labels_ if result_data_ else []:
        data = result_data_[label]
        print(f"\n{label}:")
        print(f"  평균: {np.mean(data):.3f}")
        print(f"  중앙값: {np.median(data):.3f}")
        print(f"  표준편차: {np.std(data):.3f}")
        print(f"  최솟값: {np.min(data):.3f}")
        print(f"  최댓값: {np.max(data):.3f}")
        print(f"  데이터 개수: {len(data)}")
    
    plt.savefig('hamming_distance_subplots.png', dpi=300, bbox_inches='tight')
    print(f"\nHamming Distance 서브플롯 비교가 'hamming_distance_subplots.png'로 저장되었습니다.")
    
    plt.show()


def print_distance(mode, df, save_path=None):
    df = df[df["distance"] != float('inf')]
    distance_mean = df["distance"].mean()
    distance_std = df["distance"].std()
    distance_median = df["distance"].median()
    distance_min = df["distance"].min()
    distance_max = df["distance"].max()
    print(f"======== {mode} ========")
    print(f"Distance mean: {distance_mean}")
    print(f"Distance std: {distance_std}")
    print(f"Distance median: {distance_median}")
    print(f"Distance min: {distance_min}")
    print(f"Distance max: {distance_max}")

    if save_path:
        with open(save_path, "w") as f:
            f.write(f"======== {mode} ========\n")
            f.write(f"Distance mean: {distance_mean}\n")
            f.write(f"Distance std: {distance_std}\n")
            f.write(f"Distance median: {distance_median}\n")
            f.write(f"Distance min: {distance_min}\n")
            f.write(f"Distance max: {distance_max}\n")

def evaluate_pronunciation_distance(filename=None, non_disordered=False):

    calculator = PronunciationDistanceCalculator()
    audio_creator = AudioCreator(
        api_key="sk-RFDhyyJpo0SBUcJdVW-0cIWaifqLeuyyVzsuqM9iqBT3BlbkFJTZRxrTgoeynyQHf4wg2BwW1m9Rhf5qlk2ZUF_P1EAA",
        character_profiles=json.load(open("story/story_850518.json", "r"))["characters"],
        gemini_api_key="AIzaSyBzWB6Jeslbzpby3263i4CufiJNdmbKsr4"
    )


    if filename:
        actual_ipa = audio_creator.transcribe_phoneme_from_audio(filename)
        ground_truth_ipa = calculator.get_ground_truth_ipa(filename)
        actual_ipa = calculator.normalize_ipa_for_panphon(actual_ipa)
        ground_truth_ipa = calculator.normalize_ipa_for_panphon(ground_truth_ipa)
        distance = calculator.calculate_distance(actual_ipa, ground_truth_ipa)
        print(f"Distance: {distance}")

    elif non_disordered:
        for mode in ["hamming_feature_edit_distance", "weighted_feature_edit_distance"]:
            for i in range(20):
                data = []

                paths = glob("evaluation/non-disordered/*.mp4")
                for path in tqdm(paths, desc="Analyzing pronunciation"):
                    if "North_Carolina" in path:
                        tmp = path.split("/")[-1].replace(".mp4", "").split("_")
                        target_word = " ".join(tmp[3:])
                    else:
                        tmp = path.split("/")[-1].replace(".mp4", "").split("_")
                        target_word = " ".join(tmp[2:])
                    actual_ipa = audio_creator.transcribe_phoneme_from_audio(path)

                    ground_truth_ipa = calculator.get_ground_truth_ipa(target_word)
                    actual_ipa = calculator.normalize_ipa_for_panphon(actual_ipa)
                    ground_truth_ipa = calculator.normalize_ipa_for_panphon(ground_truth_ipa)
                    distance = calculator.calculate_distance(actual_ipa, ground_truth_ipa, mode=mode)

                    data.append({
                        "target_word": target_word,
                        "ground_truth_ipa": ground_truth_ipa,
                        "actual_ipa": actual_ipa,
                        "distance": distance
                    })

                df = pd.DataFrame(data)
                if mode == "hamming_feature_edit_distance":
                    df.to_csv(f"hamming/pronunciation_analysis_hamming_{i}.csv", index=False)
                else:
                    df.to_csv(f"weighted/pronunciation_analysis_weighted_{i}.csv", index=False)
    else:
        for mode in ["hamming_feature_edit_distance"]:
            # for i in range(20):
                i = 1
                data = []
                audio_paths = glob("evaluation/disordered/*.mp4")
                gt_file = pd.read_csv("evaluation/disordered/starspeech-disordered.csv", header=0)
                for path in tqdm(audio_paths, desc=f"Analyzing pronunciation of {mode}"):
                    filename = path.split("/")[-1].replace(".mp4", "")
                    if filename.startswith("cleft"): id = "_".join(filename.split("_")[:2]); word = " ".join(filename.split("_")[2:])
                    else: id = "_".join(filename.split("_")[:1]); word = " ".join(filename.split("_")[1:])

                    gt_row = gt_file[(gt_file["ID"] == id) & (gt_file["Word"] == word)]
                    gt_ipa = gt_row['Phonetic Transcription'].iloc[0]
                    gt_ipa = calculator.normalize_ipa_for_panphon(gt_ipa)

                    actual_ipa = audio_creator.transcribe_phoneme_from_audio(path)
                    actual_ipa = calculator.normalize_ipa_for_panphon(actual_ipa)
                    
                    distance = calculator.calculate_distance(actual_ipa, gt_ipa, mode=mode)
                    data.append({
                        "target_word": id,
                        "ground_truth_ipa": gt_ipa,
                        "actual_ipa": actual_ipa,
                        "distance": distance
                    })

                df = pd.DataFrame(data)
                import os
                # os.makedirs(f'{mode}_gemini', exist_ok=True)
                if mode == "hamming_feature_edit_distance":
                    df.to_csv(f"evaluated_result_/hamming_gemini.csv", index=False)
                    print_distance(mode, df, save_path=f"evaluated_result_/hamming_gemini.txt")
                else:
                    df.to_csv(f"evaluated_result_/weighted_gemini.csv", index=False)
                    print_distance(mode, df, save_path=f"evaluated_result_/weighted_gemini.txt")
                
def run_koelabs_models():
    from transformers import AutoModelForCTC, AutoProcessor
    import torch
    import soundfile as sf
    from glob import glob

    model = AutoModelForCTC.from_pretrained("KoelLabs/xlsr-timit-b0")
    processor = AutoProcessor.from_pretrained("KoelLabs/xlsr-timit-b0")

    gt_file = pd.read_csv("evaluation/disordered/starspeech-disordered.csv", header=0)
    calculator = PronunciationDistanceCalculator()

    save_data = []

    for mode in ["hamming_feature_edit_distance", "weighted_feature_edit_distance"]:
        for path in tqdm(glob("evaluation/disordered/*.wav"), desc=f"Analyzing pronunciation of {mode} with HF"):
            filename = path.split("/")[-1].replace(".wav", "")
            if filename.startswith("cleft"): id = "_".join(filename.split("_")[:2]); word = " ".join(filename.split("_")[2:])
            else: id = "_".join(filename.split("_")[:1]); word = " ".join(filename.split("_")[1:])

            gt_row = gt_file[(gt_file["ID"] == id) & (gt_file["Word"] == word)]
            gt_ipa = gt_row['Phonemic Target'].iloc[0]
            gt_ipa = calculator.normalize_ipa_for_panphon(gt_ipa)

            data, sr = sf.read(path)
            input_values = processor(data, return_tensors="pt", sampling_rate=sr).input_values
            with torch.no_grad():
                logits = model(input_values).logits
            predicted_ids = torch.argmax(logits, dim=-1)
            transcription = processor.batch_decode(predicted_ids)[0]
            actual_ipa = calculator.normalize_ipa_for_panphon(transcription)
            
            distance = calculator.calculate_distance(actual_ipa, gt_ipa, mode=mode)
            save_data.append({
                "target_word": id,
                "ground_truth_ipa": gt_ipa,
                "actual_ipa": actual_ipa,
                "distance": distance
            })
        
        df = pd.DataFrame(save_data)
        if mode == "hamming_feature_edit_distance":
            df.to_csv(f"evaluated_result/hamming_hf.csv", index=False)
            print_distance(mode, df, save_path=f"evaluated_result/hamming_hf.txt")
        else:
            df.to_csv(f"evaluated_result/weighted_hf.csv", index=False)
            print_distance(mode, df, save_path=f"evaluated_result/weighted_hf.txt")

def run_ginic_models():
    from glob import glob

    gt_file = pd.read_csv("evaluation/disordered/starspeech-disordered.csv", header=0)
    predicted_file = pd.read_csv("textgrids/transcription.csv", header=0)
    calculator = PronunciationDistanceCalculator()

    save_data = []

    for mode in ["hamming_feature_edit_distance", "weighted_feature_edit_distance"]: # 
        for filename, transcription in tqdm(predicted_file.values, desc=f"Analyzing pronunciation of {mode} with HF"):
            if pd.isna(transcription):
                continue
            if filename.startswith("cleft"): id = "_".join(filename.split("_")[:2]); word = " ".join(filename.split("_")[2:])
            else: id = "_".join(filename.split("_")[:1]); word = " ".join(filename.split("_")[1:])

            gt_row = gt_file[(gt_file["ID"] == id) & (gt_file["Word"] == word)]
            gt_ipa = gt_row['Phonemic Target'].iloc[0]
            gt_ipa = calculator.normalize_ipa_for_panphon(gt_ipa)

            actual_ipa = calculator.normalize_ipa_for_panphon(transcription)
            
            distance = calculator.calculate_distance(actual_ipa, gt_ipa, mode=mode)
            save_data.append({
                "target_word": id,
                "ground_truth_ipa": gt_ipa,
                "actual_ipa": actual_ipa,
                "distance": distance
            })
        
        df = pd.DataFrame(save_data)
        if mode == "hamming_feature_edit_distance":
            df.to_csv(f"evaluated_result/hamming_ginic.csv", index=False)
            print_distance(mode, df, save_path=f"evaluated_result/hamming_ginic.txt")
        else:
            df.to_csv(f"evaluated_result/weighted_ginic.csv", index=False)
            print_distance(mode, df, save_path=f"evaluated_result/weighted_ginic.txt")
        
def convert_mp4_to_wav():
    from pydub import AudioSegment
    from glob import glob
    for mp4_path in glob("evaluation/disordered/*.mp4"):
        wav_path = mp4_path.replace(".mp4", ".wav")
        audio = AudioSegment.from_file(mp4_path, format="mp4")
        audio = audio.set_frame_rate(16000)
        audio.export(wav_path, format="wav")

def read_textgrid():
    from praatio import textgrid
    from glob import glob
    import os
    data = []
    for textgrid_path in glob("evaluation/evaluated_result/textgrids/*.TextGrid"):
        tg = textgrid.openTextgrid(textgrid_path, includeEmptyIntervals=True)
        file_name = os.path.basename(textgrid_path).replace(".TextGrid", "")
        tier = tg.getTier(tg.tierNames[0])

        transcription_parts = [label for _, _, label in tier.entries if label.strip()]
        transcription = " ".join(transcription_parts)

        data.append({
            "filename": file_name,
            "transcription": transcription
        })

    df = pd.DataFrame(data)
    df.to_csv("evaluation/evaluated_result/textgrids/transcription.csv", index=False)
    return data


if __name__ == "__main__":
    # convert_mp4_to_wav()
    # evaluate_survey()
    evaluate_pronunciation_distance(non_disordered=False)
    # run_koelabs_models()
    # run_ginic_models()