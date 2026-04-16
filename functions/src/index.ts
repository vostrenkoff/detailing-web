import * as admin from 'firebase-admin';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';

admin.initializeApp();

export const onNewReservation = onDocumentCreated(
  { document: 'reservations/{reservationId}', region: 'europe-central2' },
  async (event) => {
    const reservation = event.data?.data();
    if (!reservation) return;

    const dateKey = reservation.booking?.dateKey ?? 'неизвестна';
    const time = reservation.booking?.time ?? '';

    const message: admin.messaging.Message = {
      topic: 'new-reservation',       // iOS подписывается на этот топик
      notification: {
        title: 'New Reservation!',
        body: `Date: ${dateKey}${time ? ', time: ' + time : ''}`,
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    await admin.messaging().send(message);
    console.log('Push отправлен для резервации:', event.params.reservationId);
  }
);
