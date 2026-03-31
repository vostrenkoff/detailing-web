import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

export interface BundleItem {
  id: string;
  title: string;
  description: string;
  price: number;
  duration?: number;
  durationMin?: number;
  imageURL?: string;
  services?: string[];
  active: boolean;
}

export interface ServiceItem {
  id: string;
  title: string;
  description: string;
  price: number;
  durationMin: number;
  active: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ReservationDataService {
  private firestore = inject(Firestore);

  getBundles(): Observable<BundleItem[]> {
    const ref = collection(this.firestore, 'bundles');
    return collectionData(ref, { idField: 'id' }) as Observable<BundleItem[]>;
  }

  getServices(): Observable<ServiceItem[]> {
    const ref = collection(this.firestore, 'services');
    return collectionData(ref, { idField: 'id' }) as Observable<ServiceItem[]>;
  }
}