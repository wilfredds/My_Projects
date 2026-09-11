import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBlqapl-8CNrAbeeKcD8kh7Zgzlj_4bkho",
  authDomain: "http://bikeguide-ph.firebaseapp.com/",
  projectId: "bikeguide-ph",
  storageBucket: "bikeguide-ph.firebasestorage.app",
  messagingSenderId: "809855240329",
  appId: "1:809855240329:web:4548c08cdbcc5653ce5e58"
};


const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
