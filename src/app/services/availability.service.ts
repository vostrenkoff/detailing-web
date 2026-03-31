import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

export interface AvailabilityItem {
  id: string;
  userId: string;
  date: any;
  start: any;
  end: any;
}

@Injectable({
  providedIn: 'root'
})
export class AvailabilityService {
  private firestore = inject(Firestore);

  getAvailability(userId: string): Observable<AvailabilityItem[]> {
    const ref = collection(this.firestore, `users/${userId}/availability`);
    return collectionData(ref, { idField: 'id' }) as Observable<AvailabilityItem[]>;
  }
}