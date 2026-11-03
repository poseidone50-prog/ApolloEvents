import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp 
} from "firebase/firestore";
import { db, auth as firebaseAuth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { toast } from "sonner";

// Local fallback (same implementation as before)
const makeLocalDB = (collectionName) => {
  const getCol = () => JSON.parse(localStorage.getItem(`app_${collectionName}`) || "[]");
  const saveCol = (data) => localStorage.setItem(`app_${collectionName}`, JSON.stringify(data));
  const generateId = () => Math.random().toString(36).substring(2, 12);
  return {
    list: async (sortBy = "-created_date", limitTo = 500) => {
      let data = getCol();
      const orderField = sortBy.startsWith("-") ? sortBy.substring(1) : sortBy;
      const asc = !sortBy.startsWith("-");
      data.sort((a, b) => {
        if (a[orderField] < b[orderField]) return asc ? -1 : 1;
        if (a[orderField] > b[orderField]) return asc ? 1 : -1;
        return 0;
      });
      return data.slice(0, limitTo);
    },
    filter: async (criteria, sortBy = "-created_date", limitTo = 500) => {
      let data = getCol();
      for (const key in criteria) {
        data = data.filter(item => item[key] === criteria[key]);
      }
      return data.slice(0, limitTo);
    },
    create: async (data) => {
      const col = getCol();
      const newItem = { ...data, id: generateId(), created_date: new Date().toISOString(), updated_date: new Date().toISOString() };
      col.push(newItem);
      saveCol(col);
      return newItem;
    },
    update: async (id, data) => {
      const col = getCol();
      const index = col.findIndex(x => x.id === id);
      if (index > -1) {
        col[index] = { ...col[index], ...data, updated_date: new Date().toISOString() };
        saveCol(col);
        return col[index];
      }
      return null;
    },
    delete: async (id) => {
      let col = getCol();
      col = col.filter(x => x.id !== id);
      saveCol(col);
      return true;
    }
  };
};


const extractFirestoreData = (docSnap) => ({ ...docSnap.data(), id: docSnap.id });

const showPermissionError = (err) => {
  if (err.code === 'permission-denied') {
    toast.error("Permesso negato! Devi impostare le regole del database Firebase su 'allow read, write: if true;' dal pannello di controllo Firebase.", { duration: 10000 });
  } else {
    toast.error("Errore di connessione al database Cloud: " + err.message);
  }
};

const sortItemsInMemory = (items, sortBy) => {
  if (!sortBy) return items;
  const orderField = sortBy.startsWith("-") ? sortBy.substring(1) : sortBy;
  const asc = !sortBy.startsWith("-");
  return [...items].sort((a, b) => {
    const valA = a[orderField] ?? a.updated_date ?? a.created_date ?? "";
    const valB = b[orderField] ?? b.updated_date ?? b.created_date ?? "";
    if (valA < valB) return asc ? -1 : 1;
    if (valA > valB) return asc ? 1 : -1;
    return 0;
  });
};

const makeFirestoreDB = (collectionName) => {
  const colRef = collection(db, collectionName);

  const fallback = makeLocalDB(collectionName);

  return {
    list: async (sortBy = "-created_date", limitTo = 1000) => {
      try {
        const snap = await getDocs(colRef);
        const allItems = snap.docs.map(extractFirestoreData);
        const sorted = sortItemsInMemory(allItems, sortBy);
        return limitTo ? sorted.slice(0, limitTo) : sorted;
      } catch (err) {
        if (err.code === 'permission-denied') {
          showPermissionError(err);
          return fallback.list(sortBy, limitTo);
        }
        showPermissionError(err);
        return [];
      }
    },
    filter: async (criteria, sortBy = "-created_date", limitTo = 1000) => {
      try {
        const snap = await getDocs(colRef);
        let data = snap.docs.map(extractFirestoreData);
        for (const [key, value] of Object.entries(criteria)) {
          data = data.filter(item => item[key] === value);
        }
        const sorted = sortItemsInMemory(data, sortBy);
        return limitTo ? sorted.slice(0, limitTo) : sorted;
      } catch (err) {
        if (err.code === 'permission-denied') {
          showPermissionError(err);
          return fallback.filter(criteria, sortBy, limitTo);
        }
        showPermissionError(err);
        return [];
      }
    },
    create: async (data) => {
      try {
        const { id: _ignoreId, ...cleanData } = data || {};
        const payload = { ...cleanData, created_date: new Date().toISOString(), updated_date: new Date().toISOString() };
        const docRef = await addDoc(colRef, payload);
        return { ...payload, id: docRef.id };
      } catch (err) {
        if (err.code === 'permission-denied') {
          showPermissionError(err);
          return fallback.create(data);
        }
        showPermissionError(err);
        throw err;
      }
    },
    update: async (id, data) => {
      try {
        const docRef = doc(db, collectionName, id);
        const { id: _ignoreId, ...cleanData } = data || {};
        const payload = { ...cleanData, updated_date: new Date().toISOString() };
        await updateDoc(docRef, payload);
        return { ...payload, id };
      } catch (err) {
        if (err.code === 'permission-denied') {
          showPermissionError(err);
          return fallback.update(id, data);
        }
        showPermissionError(err);
        throw err;
      }
    },
    delete: async (id) => {
      try {
        const docRef = doc(db, collectionName, id);
        await deleteDoc(docRef);
        return true;
      } catch (err) {
        if (err.code === 'permission-denied') {
          showPermissionError(err);
          return fallback.delete(id);
        }
        showPermissionError(err);
        throw err;
      }
    }
  };
};

export const base44 = {
  auth: {
    me: async () => {
      const user = firebaseAuth.currentUser;
      return user ? { id: user.uid, name: user.displayName || user.email, email: user.email } : null;
    },
    logout: async () => await signOut(firebaseAuth),
    redirectToLogin: () => {
      window.location.href = "/login";
    }
  },
  entities: {
    Article: makeFirestoreDB("articles"),
    Sale: makeFirestoreDB("sales"),
    Supplier: makeFirestoreDB("suppliers"),
    Purchase: makeFirestoreDB("purchases"),
    Contract: makeFirestoreDB("contracts"),
    Customer: makeFirestoreDB("customers"),
    Document: makeFirestoreDB("documents")
  },
  integrations: {
    Core: {
      SendEmail: async ({ to, subject, body }) => {
        const mailtoUrl = `mailto:${encodeURIComponent(to || "")}?subject=${encodeURIComponent(subject || "")}&body=${encodeURIComponent(body || "")}`;
        window.open(mailtoUrl, "_blank");
        return { success: true };
      }
    }
  }
};
