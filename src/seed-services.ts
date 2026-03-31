import { initializeApp } from 'firebase/app';
import { getFirestore, collection, setDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyD78GYpLbRwI6ewgWy1KzYPNZOOcxcvj8U",
  authDomain: "detailing-prod.firebaseapp.com",
  projectId: "detailing-prod",
  storageBucket: "detailing-prod.firebasestorage.app",
  messagingSenderId: "226380869157",
  appId: "1:226380869157:web:e490bea4e21576b5c599cc"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const services = [
  {
    id: "exterior-wash",
    title: "Exterior wash",
    price: 25,
    currency: "EUR",
    durationMin: 45,
    description: "Hand wash and dry",
    active: true,
    order: 1
  },
  {
    id: "interior-cleaning",
    title: "Interior cleaning",
    price: 40,
    currency: "EUR",
    durationMin: 60,
    description: "Vacuuming and interior wipe down",
    active: true,
    order: 2
  },
  {
    id: "full-detailing",
    title: "Full detailing",
    price: 120,
    currency: "EUR",
    durationMin: 180,
    description: "Interior and exterior detailing",
    active: true,
    order: 3
  }
];

async function seed() {
  for (const service of services) {
    await setDoc(doc(db, "services", service.id), service);
    console.log("Created:", service.id);
  }
  console.log("Done.");
}

seed();