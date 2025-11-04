interface UserData {
  userId: string;
  loginTime: string;
  stories?: any;
  currentStory?: any;
}

export function getCurrentUserId(): string | null {
  const userData = localStorage.getItem('rp_user_data');
  return userData ? (JSON.parse(userData) as UserData).userId : null;
}

export function setUserData(userData: UserData) {
  localStorage.setItem('rp_user_data', JSON.stringify(userData));
}

export function clearUserData(): void {
    localStorage.removeItem('rp_user_data');
  }

export function getUserData(): UserData | null {
    try {
      const data = localStorage.getItem('rp_user_data'); // what's the structure of the data?
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

export function setCurrentStory(storyData: any): void {
    const userData = getUserData();
    if (userData) {
      userData.currentStory = storyData;
      setUserData(userData);
    }
  }
  
export function getCurrentStory(): any {
    const userData = getUserData();
    return userData?.currentStory || null;
  }