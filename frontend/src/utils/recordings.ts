// Recordings 유틸리티 함수들

export function formatTimestamp(timestamp: string): string {
  try {
    const year = timestamp.substring(0, 4);
    const month = timestamp.substring(4, 6);
    const day = timestamp.substring(6, 8);
    const hour = timestamp.substring(9, 11);
    const minute = timestamp.substring(11, 13);
    const second = timestamp.substring(13, 15);
    
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  } catch (e) {
    return timestamp;
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function getDistanceColor(distance: number): string {
  if (distance <= 0.1) return 'distance-excellent';
  else if (distance <= 1.0) return 'distance-good';
  else if (distance <= 2.0) return 'distance-fair';
  else return 'distance-poor';
}

export function getDistanceLabel(distance: number): string {
  if (distance <= 0.1) return 'Excellent';
  else if (distance <= 1.0) return 'Good';
  else if (distance <= 2.0) return 'Fair';
  else return 'Needs Practice';
}

export interface AccuracyStats {
  excellent: number;
  good: number;
  fair: number;
  needsPractice: number;
  total: number;
}

export function calculateAccuracyStats(storyId: string, storyModes: any[], analysisData: any): AccuracyStats | null {
  if (!analysisData || !analysisData[storyId]) {
    return null;
  }
  
  const storyAnalysis = analysisData[storyId];
  const stats: AccuracyStats = {
    excellent: 0,
    good: 0,
    fair: 0,
    needsPractice: 0,
    total: 0
  };
  
  storyModes.forEach(storyMode => {
    storyMode.recordings.forEach((recording: any) => {
      const modeKey = storyMode.story_mode === 'word' ? 'word_mode' : 'sentence_mode';
      const modeAnalysis = storyAnalysis.analysis?.[modeKey];
      
      if (!modeAnalysis) return;
      
      const recordingName = recording.filename.replace('.wav', '');
      const analysisEntry = modeAnalysis[recordingName];
      
      if (!analysisEntry || !analysisEntry.length) return;
      
      const distances = analysisEntry.map((item: any) => item.distance).filter((d: number) => d !== Infinity);
      if (distances.length === 0) return;
      
      const bestDistance = Math.min(...distances);
      const label = getDistanceLabel(bestDistance);
      
      stats.total++;
      if (label === 'Excellent') stats.excellent++;
      else if (label === 'Good') stats.good++;
      else if (label === 'Fair') stats.fair++;
      else if (label === 'Needs Practice') stats.needsPractice++;
    });
  });
  
  return stats.total > 0 ? stats : null;
}

export function formatTargetSound(sound: string): string {
  const soundDisplayMap: Record<string, string> = {
    'words_with_l_initial': 'L initial',
    'words_with_r_initial': 'R initial',
    'words_with_ch_initial': 'CH initial',
    'words_with_sh_initial': 'SH initial',
    'words_with_th_initial': 'TH initial',
    'words_with_s_initial': 'S initial',
    'words_with_z_initial': 'Z initial',
  };
  
  return soundDisplayMap[sound] || sound.replace('words_with_', '').replace('_initial', '').replace('_final', '').toUpperCase();
}


