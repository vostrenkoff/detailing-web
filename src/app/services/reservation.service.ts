import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  query,
  where
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

export interface ExistingReservation {
  id: string;
  status?: string;
  booking?: {
    dateKey?: string;
    startMinutes?: number;
    endMinutes?: number;
    durationMin?: number;
    time?: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class ReservationService {
  private firestore = inject(Firestore);

  getReservationsByDate(dateKey: string): Observable<ExistingReservation[]> {
    const ref = collection(this.firestore, 'reservations');
    const q = query(ref, where('booking.dateKey', '==', dateKey));
    return collectionData(q, { idField: 'id' }) as Observable<ExistingReservation[]>;
  }
}