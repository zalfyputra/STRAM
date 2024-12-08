import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'

const config = {
    apiKey: process.env.API_KEY,
    authDomain: process.env.AUTH_DOMAIN,
    databaseURL: "https://stram-project-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: process.env.PROJECT_ID,
    storageBucket: process.env.STORAGE_BUCKET,
    messagingSenderId: process.env.MESSAGING_SENDER_ID,
    appId: process.env.APP_ID,
};

const app = initializeApp(config);
export const database = getDatabase(app);