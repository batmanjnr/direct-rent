import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export type NotificationType = "message" | "verification" | "listing" | "system";

export const createNotification = async (
  userId: string,
  title: string,
  message: string,
  type: NotificationType,
  link?: string,
  relatedId?: string
) => {
  if (!userId || userId === "unknown") return;

  try {
    await addDoc(collection(db, "notifications"), {
      userId,
      title,
      message,
      type,
      read: false,
      createdAt: serverTimestamp(),
      link: link || null,
      relatedId: relatedId || null,
    });
  } catch (err) {
    console.error("Error creating notification:", err);
  }
};

export const sendPushToToken = async (expoPushToken: string, title: string, body: string, data = {}) => {
  if (!expoPushToken) return;

  const message = {
    to: expoPushToken,
    sound: 'default',
    title,
    body,
    data,
  };

  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });

    const json = await res.json();
    if (json.errors) console.error('Expo push send error', json);
    return json;
  } catch (err) {
    console.error('Failed to send expo push', err);
  }
};
