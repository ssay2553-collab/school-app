export type Audience = "all" | "teacher" | "student" | "parent";

export interface NewsItem {
  id: string;
  title: string;
  content: string;
  audience: Audience;
  category?: string;
  createdAt?: any; // Firestore timestamp
  expiryDate?: any; // Firestore timestamp for when the news should expire
  mediaUrl?: string | null;    // optional media URL
  mediaType?: "image" | "video" | null; // optional media type
}
