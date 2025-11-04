# MORA: AI-Mediated Story-Based practice for Speech Sound Disorder from Clinic to Home


<img width="4412" height="1958" alt="mora" src="https://github.com/user-attachments/assets/57f5f81a-8989-437c-8c98-daa19fbad1f7" />


[**Preprint**](https://arxiv.org/abs/2510.23887)

## 최근 업데이트

### Firebase Firestore 완전 마이그레이션 (2025-11-04)
- ✅ **사용자 정보** (`registered_user.json`) → Firestore `users` collection
- ✅ **스토리 상태** (`user_story.json`) → Firestore `users/{user_id}/stories` sub-collection
- ✅ 메모리 캐싱을 통한 성능 최적화
- ✅ 실시간 데이터 동기화
- ✅ 자동 데이터 마이그레이션 스크립트 제공
- 📄 상세 가이드: [FIRESTORE_COMPLETE_MIGRATION.md](./FIRESTORE_COMPLETE_MIGRATION.md)

## 필수 요구사항

- Python 3.8+
- Node.js 16+
- Firebase 프로젝트 (Firestore 활성화)
- OpenAI API Key
- Gemini API Key

## 설정 방법

### 1. Firebase 설정
```bash
# Firebase service account key를 다운로드하여 저장
cp your-firebase-key.json backend/static/firebase-service-key.json
```

### 2. 데이터 마이그레이션 (최초 1회)
```bash
# 기존 사용자 데이터를 Firestore로 마이그레이션
python migrate_users_to_firestore.py
```

### 3. 환경 변수 설정
```bash
export OPENAI_API_KEY="your-openai-key"
export GEMINI_API_KEY="your-gemini-key"
export FLASK_SECRET_KEY="your-secret-key"
```

### 4. 의존성 설치
```bash
# Python 의존성
pip install -r pip_requirements.txt

# Frontend 의존성
cd frontend
npm install
```

### 5. 실행
```bash
# Development 모드
python main.py

# Production 모드는 DEPLOYMENT.md 참조
```

## 문서

- 📚 [실행 가이드](./documents/RUN_GUIDE.md)
- 🚀 [배포 가이드](./documents/DEPLOYMENT.md)
- 🔊 [오디오 시스템](./documents/AUDIO_README.md)
- 🔄 [Firestore 완전 마이그레이션](./FIRESTORE_COMPLETE_MIGRATION.md)

## 새 사용자 추가 방법

### Firestore Console에서 직접 추가
1. [Firebase Console](https://console.firebase.google.com/) 접속
2. 프로젝트: `nsf-2211428-61124` 선택
3. Firestore Database 이동
4. `users` collection 선택
5. 새 document 추가:
   ```
   Document ID: {user_id}
   Fields:
     - name: (string) "사용자 이름"
     - stories: (array) ["story_850518", "story_855298"]
     - created_at: (string) "2025-11-04T10:00:00"
     - updated_at: (string) "2025-11-04T10:00:00"
   ```

### Python 스크립트로 추가
```python
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime

cred = credentials.Certificate("backend/static/firebase-service-key.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

# 새 사용자 추가
db.collection('users').document('new_user_id').set({
    'name': 'New User',
    'stories': ['story_850518'],
    'created_at': datetime.now().isoformat(),
    'updated_at': datetime.now().isoformat()
})
```

## 라이선스

자세한 내용은 [LICENSE](./LICENSE) 파일을 참조하세요.