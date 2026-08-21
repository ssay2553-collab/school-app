import { Timestamp } from "firebase/firestore";

export type AssignmentType = "mcq" | "short_answer" | "preschool" | "mathematics";

export type PreschoolQuestionType =
  | "count_objects"
  | "fill_missing"
  | "simple_addition"
  | "identify_letter"
  | "beginning_letter"
  | "match_case"
  | "identify_object"
  | "odd_one_out"
  | "identify_shape"
  | "true_false"
  | "ordering"
  | "classification";

export interface VisualItem {
  id: string;
  type: 'icon' | 'text' | 'operator' | 'fraction' | 'mixed_fraction' | 'variable' | 'sqrt' | 'bracket' | 'superscript' | 'subscript' | 'mapping' | 'number' | 'vector' | 'matrix' | 'bar';
  value: string;
  count?: number;
  size?: 'small' | 'medium' | 'large';
  isNewLine?: boolean;
  icon?: string;
  whole?: string;
  base?: string;
  numerator?: VisualItem[];
  denominator?: VisualItem[];
  cells?: VisualItem[];
  content?: VisualItem[];
  bracketType?: 'round' | 'square' | 'curly' | 'abs';
}

export interface Question {
  id?: string;
  text: string;
  options?: string[];
  type?: PreschoolQuestionType | string;
  imageCategory?: string;
  count?: number;
  visualGroup?: VisualItem[];
  answer?: string;
  points?: number;
}

export interface Assignment {
  id: string;
  title: string;
  subjectId: string;
  classId: string;
  type: AssignmentType;
  description?: string;
  fileUrl?: string;
  fileName?: string;
  teacherId: string;
  code: string;
  createdAt: Timestamp;
  dueDate?: Timestamp;
  questions?: Question[];
}

export interface PublicQuestion {
  id: string;
  text: string;
  options: string[];
  type?: PreschoolQuestionType;
  imageCategory?: string;
  count?: number;
  visualGroup?: VisualItem[];
  points: number;
}
