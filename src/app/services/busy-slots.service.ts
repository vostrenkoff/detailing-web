import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

export interface BusySlot {
  id: string;
  startMinutes: number;
  endMinutes: number;
  time: string;
  durationMin: number;
  reservationId?: string;
  status?: string;
}

@Injectable({
  providedIn: 'root'
})
export class BusySlotsService {
  private firestore = inject(Firestore, { optional: true });

  getBusySlotsByDate(dateKey: string): Observable<BusySlot[]> {
    const ref = collection(this.firestore!, `busySlots/${dateKey}/slots`);
    return collectionData(ref, { idField: 'id' }) as Observable<BusySlot[]>;
  }
}