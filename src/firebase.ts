import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'

const config = {
    apiKey: "AIzaSyBUZoLjsOlF_3hogYbS1oKMrEXypv5qBuo",
    authDomain: "stram-project.firebaseapp.com",
    databaseURL: "https://stram-project-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "stram-project",
    storageBucket: "stram-project.firebasestorage.app",
    messagingSenderId: "721137919592",
    appId: "1:721137919592:web:9566ad0ff54659e264fddd"
};

const app = initializeApp(config);
export const database = getDatabase(app);