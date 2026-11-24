import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

let initialRequest;

// Both storefront modules use the same public read at startup.
export function initialShopProducts(db) {
  initialRequest ??= getDocs(query(collection(db, "shopProducts"), where("active", "==", true)));
  return initialRequest;
}
