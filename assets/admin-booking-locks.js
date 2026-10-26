import { doc, runTransaction } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

// A released time can already belong to another booking. Read its current owner
// in the same transaction as the booking before changing any lock documents.
export async function readBookingLocks(transaction, db, bookingId, booking, { requireOwned = false } = {}) {
  const ids = [...new Set(Array.isArray(booking.lockIds) ? booking.lockIds : [])];
  const refs = ids.map(id => doc(db, "availabilityLocks", id));
  const snapshots = await Promise.all(refs.map(ref => transaction.get(ref)));
  const locks = refs.map((ref, index) => ({
    ref,
    owned: snapshots[index].exists() && snapshots[index].data().bookingId === bookingId,
  }));
  if (requireOwned && (!locks.length || locks.some(lock => !lock.owned))) {
    throw new Error("BOOKING_LOCK_CONFLICT");
  }
  return locks;
}

export async function deleteBookingWithOwnedLocks(db, bookingId) {
  const bookingRef = doc(db, "bookings", bookingId);
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(bookingRef);
    if (!snapshot.exists()) return;
    const locks = await readBookingLocks(transaction, db, bookingId, snapshot.data());
    locks.filter(lock => lock.owned).forEach(lock => transaction.delete(lock.ref));
    transaction.delete(bookingRef);
  });
}
