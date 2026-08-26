import { useState, useEffect, useCallback, useMemo } from "react";
import {
  collection,
  documentId,
  getDocs,
  getDocsFromServer,
  query,
  serverTimestamp,
  where,
  addDoc,
  setDoc,
  doc,
  writeBatch,
  limit,
} from "firebase/firestore";
import {
  getDownloadURL,
  ref,
  uploadBytes,
  deleteObject,
} from "firebase/storage";
import * as DocumentPicker from "expo-document-picker";

import { db, storage } from "../../firebaseConfig";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { getTeacherClasses, sortClasses } from "../../lib/classHelpers";
import { sendNotification } from "../../src/services/notificationService";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

import { AssignmentType, Question, VisualItem, PreschoolQuestionType, PublicQuestion } from "../../types/assignments";

export type { AssignmentType, Question };

export interface ClassData {
  id: string;
  name: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const createQuestionId = () =>
  `q_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const createAssignmentCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let result = "";

  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return result;
};

const sanitizeFileName = (name: string) => {
  const extension = name.includes(".")
    ? name.substring(name.lastIndexOf(".")).toLowerCase()
    : "";

  const base = name
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 80);

  return `${base || "assignment"}${extension}`;
};

const getQuestionValidationError = (
  question: Question,
  type: AssignmentType
): string | null => {
  if (type === "rich-text") return null; // Essays don't strictly require structured questions here

  if (!question.text.trim() && type !== 'mathematics') {
    return "Question text or instructions are missing.";
  }

  if (type === "mathematics") {
    const hasOptions = question.options && question.options.filter(opt => opt.trim() !== "").length > 0;

    if (hasOptions) {
      const validOptions = (question.options || []).filter(
        (option) => option.trim().length > 0
      );
      if (validOptions.length < 2) {
        return "Mathematics MCQ questions require at least 2 options.";
      }
    }

    if (!question.visualGroup || question.visualGroup.length === 0) {
      return "Mathematics questions require at least one expression or number.";
    }

    for (let j = 0; j < question.visualGroup.length; j++) {
      const item = question.visualGroup[j];
      const partName = `Part ${j + 1}`;

      if (item.type === 'fraction' || item.type === 'mapping' || item.type === 'vector') {
        const hasNum = item.numerator?.[0]?.value?.trim();
        const hasDen = item.denominator?.[0]?.value?.trim();
        if (!hasNum || !hasDen) {
          const typeLabel = item.type === 'fraction' ? 'Fraction' : item.type === 'mapping' ? 'Mapping' : 'Vector';
          return `${partName}: ${typeLabel} must have both top and bottom values.`;
        }
      }

      if (item.type === 'mixed_fraction') {
        const hasWhole = item.whole?.trim();
        const hasNum = item.numerator?.[0]?.value?.trim();
        const hasDen = item.denominator?.[0]?.value?.trim();
        if (!hasWhole || !hasNum || !hasDen) {
          return `${partName}: Mixed fraction must have a whole number, numerator, and denominator.`;
        }
      }

      if (item.type === 'sqrt' || item.type === 'bar') {
        const hasContent = item.content?.[0]?.value?.trim();
        if (!hasContent) {
          return `${partName}: ${item.type === 'sqrt' ? 'Square root' : 'Bar notation'} content cannot be empty.`;
        }
      }

      if (item.type === 'matrix') {
        const allFilled = item.cells?.every(cell => cell.value?.trim());
        if (!allFilled) {
          return `${partName}: All matrix cells must be filled.`;
        }
      }

      if ((item.type === 'superscript' || item.type === 'subscript') && !item.value?.trim()) {
        return `${partName}: The ${item.type === 'superscript' ? 'exponent' : 'index'} value is missing.`;
      }

      if ((item.type === 'text' || item.type === 'variable' || item.type === 'number') && !item.value?.trim()) {
        return `${partName}: Content is missing.`;
      }
    }

    return null;
  }

  if (type === "preschool") {
    if (!question.type) return "Activity type is not selected.";

    // Text-based tasks like simple addition and fill missing don't require multiple choice options
    const isTextBased = ["simple_addition", "fill_missing"].includes(question.type);

    if (!isTextBased) {
      const validOptions = (question.options || []).filter(
        (option) => option.trim().length > 0
      );

      if (validOptions.length < 2) {
        return "At least 2 options are required for the child to choose from.";
      }
    }

    // Visual activities require at least one visual group item
    const needsVisual = [
      "count_objects",
      "identify_object",
      "odd_one_out",
      "identify_shape",
      "classification",
      "simple_addition",
      "beginning_letter",
      "true_false",
      "ordering",
    ].includes(question.type);

    if (needsVisual && (!question.visualGroup || question.visualGroup.length === 0)) {
      return "This activity requires at least one learning material selected from the library.";
    }

    return null;
  }

  if (type === "mcq") {
    const validOptions = (question.options || []).filter(
      (option) => option.trim().length > 0
    );
    if (validOptions.length < 2) {
      return "Multiple choice questions require at least 2 options.";
    }
  }

  return null;
};

const stripAnswers = (questions: Question[]): PublicQuestion[] => {
  return questions.map((question) => ({
    id: question.id || createQuestionId(),
    text: (question.text || "").trim(),
    options: (question.options || [])
      .filter((opt): opt is string => Boolean(opt))
      .map((option) => option.trim()),
    type: question.type as PreschoolQuestionType,
    count: question.count,
    visualGroup: question.visualGroup,
    points: question.points ?? 1,
  }));
};

const extractAnswers = (questions: Question[]) => {
  return questions.map((question) => ({
    id: question.id || "",
    answer: question.answer?.trim() || "",
  }));
};

/* -------------------------------------------------------------------------- */
/* Hook                                                                       */
/* -------------------------------------------------------------------------- */

export const useUploadAssignment = () => {
  const { appUser } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [fetchingMetadata, setFetchingMetadata] = useState(true);

  const [teacherClasses, setTeacherClasses] = useState<ClassData[]>([]);

  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [type, setType] =
    useState<AssignmentType>("mcq");

  const [dueDate, setDueDate] = useState(
    () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  );

  const [file, setFile] =
    useState<DocumentPicker.DocumentPickerResult | null>(null);

  const [uploadingFile, setUploadingFile] = useState(false);

  const [mcqQuestions, setMcqQuestions] = useState<Question[]>([]);
  const [shortAnswerQuestions, setShortAnswerQuestions] =
    useState<Question[]>([]);
  const [preschoolQuestions, setPreschoolQuestions] =
    useState<Question[]>([]);
  const [mathematicsQuestions, setMathematicsQuestions] =
    useState<Question[]>([]);
  const [essayQuestions, setEssayQuestions] =
    useState<Question[]>([]);

  /* ------------------------------------------------------------------------ */
  /* Teacher metadata                                                         */
  /* ------------------------------------------------------------------------ */

  const teacherClassIds = useMemo(
    () => getTeacherClasses(appUser),
    [appUser?.classes, appUser?.classTeacherOf]
  );

  const teacherClassIdsKey = teacherClassIds.join(",");

  const subjectsKey = (appUser?.subjects || []).join(",");

  useEffect(() => {
    let mounted = true;

    if (!appUser) {
      setFetchingMetadata(false);
      return;
    }

    const fetchMetadata = async () => {
      if (teacherClasses.length === 0) {
        setFetchingMetadata(true);
      }

      try {
        if (teacherClassIds.length > 0) {
          const results: ClassData[] = [];

          for (let i = 0; i < teacherClassIds.length; i += 10) {
            const chunk = teacherClassIds.slice(i, i + 10);

            const q = query(
              collection(db, "classes"),
              where(documentId(), "in", chunk)
            );

            const snap = await getDocs(q);

            results.push(
              ...snap.docs.map((item) => {
                const data = item.data();

                return {
                  id: item.id,
                  name:
                    typeof data.name === "string"
                      ? data.name
                      : item.id,
                };
              })
            );
          }

          if (!mounted) return;

          const sorted = sortClasses(results);

          setTeacherClasses((previous) => {
            const unchanged =
              previous.length === sorted.length &&
              previous.every(
                (item, index) =>
                  item.id === sorted[index].id &&
                  item.name === sorted[index].name
              );

            return unchanged ? previous : sorted;
          });

          setSelectedClassId((current) => {
            if (
              current &&
              sorted.some((item) => item.id === current)
            ) {
              return current;
            }

            return sorted[0]?.id || "";
          });
        } else {
          setTeacherClasses([]);
          setSelectedClassId("");
        }

        if (appUser.subjects?.length) {
          setSelectedSubject((current) => {
            if (
              current &&
              appUser.subjects!.includes(current)
            ) {
              return current;
            }

            return appUser.subjects![0] || "";
          });
        } else {
          setSelectedSubject("");
        }
      } catch (error) {
        console.error("Failed to load assignment metadata:", error);

        if (mounted) {
          showToast({
            message:
              "Unable to load your classes or subjects. Please try again.",
            type: "error",
          });
        }
      } finally {
        if (mounted) {
          setFetchingMetadata(false);
        }
      }
    };

    fetchMetadata();

    return () => {
      mounted = false;
    };
  }, [
    appUser?.uid,
    teacherClassIdsKey,
    subjectsKey,
  ]);

  /* ------------------------------------------------------------------------ */
  /* Current questions                                                        */
  /* ------------------------------------------------------------------------ */

  const questions = useMemo(() => {
    switch (type) {
      case "mcq":
        return mcqQuestions;

      case "short_answer":
        return shortAnswerQuestions;

      case "preschool":
        return preschoolQuestions;

      case "mathematics":
        return mathematicsQuestions;

      case "rich-text":
        return essayQuestions;

      default:
        return [];
    }
  }, [
    type,
    mcqQuestions,
    shortAnswerQuestions,
    preschoolQuestions,
    mathematicsQuestions,
    essayQuestions,
  ]);

  // Auto-initialize first question for interactive types
  useEffect(() => {
    if (questions.length === 0) {
      addQuestion();
    }
  }, [type, questions.length]);

  const setQuestions = useCallback(
    (value: React.SetStateAction<Question[]>) => {
      switch (type) {
        case "mcq":
          setMcqQuestions(value);
          break;

        case "short_answer":
          setShortAnswerQuestions(value);
          break;

        case "preschool":
          setPreschoolQuestions(value);
          break;

        case "mathematics":
          setMathematicsQuestions(value);
          break;

        case "rich-text":
          setEssayQuestions(value);
          break;
      }
    },
    [type]
  );

  /* ------------------------------------------------------------------------ */
  /* Question management                                                      */
  /* ------------------------------------------------------------------------ */

  const addQuestion = useCallback(() => {
    const newQuestion: Question = {
      id: createQuestionId(),
      text: "",
      options: ["", ""],
      points: 1,
    };

    setQuestions((previous) => [
      ...previous,
      newQuestion,
    ]);
  }, [setQuestions]);

  const updateQuestion = useCallback(
    (index: number, text: string) => {
      setQuestions((previous) =>
        previous.map((question, questionIndex) =>
          questionIndex === index
            ? {
                ...question,
                text,
              }
            : question
        )
      );
    },
    [setQuestions]
  );

  const updateOption = useCallback(
    (
      questionIndex: number,
      optionIndex: number,
      text: string
    ) => {
      setQuestions((previous) =>
        previous.map((question, index) => {
          if (index !== questionIndex) {
            return question;
          }

          const options = [...(question.options || [])];

          while (options.length <= optionIndex) {
            options.push("");
          }

          options[optionIndex] = text;

          return {
            ...question,
            options,
          };
        })
      );
    },
    [setQuestions]
  );

  const addOption = useCallback(
    (questionIndex: number) => {
      setQuestions((previous) =>
        previous.map((question, index) =>
          index === questionIndex
            ? {
                ...question,
                options: [
                  ...(question.options || []),
                  "",
                ],
              }
            : question
        )
      );
    },
    [setQuestions]
  );

  const removeQuestion = useCallback(
    (index: number) => {
      setQuestions((previous) =>
        previous.filter(
          (_, questionIndex) =>
            questionIndex !== index
        )
      );
    },
    [setQuestions]
  );

  const updatePreschoolQuestion = useCallback(
    (index: number, updates: Partial<Question>) => {
      setPreschoolQuestions((previous) =>
        previous.map((question, questionIndex) =>
          questionIndex === index
            ? {
                ...question,
                ...updates,
                options: updates.options ?? question.options ?? [],
              }
            : question
        )
      );
    },
    []
  );

  const updateMathematicsQuestion = useCallback(
    (index: number, updates: Partial<Question>) => {
      setMathematicsQuestions((previous) =>
        previous.map((question, questionIndex) =>
          questionIndex === index
            ? {
                ...question,
                ...updates,
              }
            : question
        )
      );
    },
    []
  );

  /* ------------------------------------------------------------------------ */
  /* File validation                                                          */
  /* ------------------------------------------------------------------------ */

  const validateFile = useCallback(
    (result: DocumentPicker.DocumentPickerResult) => {
      if (result.canceled || !result.assets?.[0]) {
        return {
          valid: true,
          message: "",
        };
      }

      const asset = result.assets[0];

      if (
        asset.size &&
        asset.size > MAX_FILE_SIZE
      ) {
        return {
          valid: false,
          message:
            "The assignment file must be 10 MB or smaller.",
        };
      }

      if (
        asset.mimeType &&
        !ALLOWED_FILE_TYPES.includes(asset.mimeType)
      ) {
        return {
          valid: false,
          message:
            "This file type is not supported.",
        };
      }

      return {
        valid: true,
        message: "",
      };
    },
    []
  );

  /* ------------------------------------------------------------------------ */
  /* Assignment validation                                                    */
  /* ------------------------------------------------------------------------ */

  const validateAssignment = useCallback(() => {
    if (!appUser?.uid) {
      return "You must be signed in as a teacher.";
    }

    if (!title.trim()) {
      return "Please enter an assignment title.";
    }

    if (!selectedClassId) {
      return "Please select a class.";
    }

    if (!selectedSubject) {
      return "Please select a subject.";
    }

    if (!(dueDate instanceof Date) || isNaN(dueDate.getTime())) {
      return "Please select a valid due date.";
    }

    if (dueDate.getTime() <= Date.now()) {
      return "The due date must be in the future.";
    }

    if (questions.length === 0) {
      return "Please add at least one question.";
    }

    for (let i = 0; i < questions.length; i++) {
      const error = getQuestionValidationError(questions[i], type);
      if (error) {
        const prefix = type === "preschool" ? "Activity" : "Question";
        return `${prefix} ${i + 1}: ${error}`;
      }
    }

    return null;
  }, [
    appUser?.uid,
    title,
    selectedClassId,
    selectedSubject,
    dueDate,
    type,
    file,
    description,
    questions,
    preschoolQuestions,
  ]);

  /* ------------------------------------------------------------------------ */
  /* Generate unique assignment code                                         */
  /* ------------------------------------------------------------------------ */

  const generateUniqueCode = useCallback(
    async (): Promise<string> => {
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = createAssignmentCode();

        const existing = await getDocs(
          query(
            collection(db, "assignments"),
            where("code", "==", code),
            limit(1)
          )
        );

        if (existing.empty) {
          return code;
        }
      }

      throw new Error(
        "Unable to generate a unique assignment code."
      );
    },
    []
  );

  /* ------------------------------------------------------------------------ */
  /* Upload assignment                                                        */
  /* ------------------------------------------------------------------------ */

  const handleUpload = useCallback(async () => {
    if (loading) return false;

    const validationError = validateAssignment();

    if (validationError) {
      showToast({
        message: validationError,
        type: "error",
      });

      return false;
    }

    if (!appUser?.uid) {
      return false;
    }

    setLoading(true);

    let uploadedStorageRef: ReturnType<typeof ref> | null =
      null;

    try {
      let fileUrl = "";
      let fileName = "";
      let fileSize = 0;
      let fileType = "";

      /* -------------------------------------------------------------------- */
      /* Upload file                                                           */
      /* -------------------------------------------------------------------- */

      if (
        file &&
        !file.canceled &&
        file.assets?.[0]
      ) {
        const fileValidation = validateFile(file);

        if (!fileValidation.valid) {
          showToast({
            message: fileValidation.message,
            type: "error",
          });

          return false;
        }

        setUploadingFile(true);

        const asset = file.assets[0];

        const response = await fetch(asset.uri);

        if (!response.ok) {
          throw new Error(
            "Unable to read the selected file."
          );
        }

        const blob = await response.blob();

        if (blob.size > MAX_FILE_SIZE) {
          throw new Error(
            "The selected file is larger than 10 MB."
          );
        }

        const safeName = sanitizeFileName(
          asset.name || "assignment"
        );

        const storagePath =
          `assignments/${appUser.uid}/` +
          `${Date.now()}_${safeName}`;

        uploadedStorageRef = ref(
          storage,
          storagePath
        );

        await uploadBytes(
          uploadedStorageRef,
          blob,
          {
            contentType:
              asset.mimeType ||
              blob.type ||
              "application/octet-stream",
            customMetadata: {
              uploadedBy: appUser.uid,
              purpose: "assignment",
            },
          }
        );

        fileUrl = await getDownloadURL(
          uploadedStorageRef
        );

        fileName = safeName;
        fileSize = blob.size;
        fileType =
          asset.mimeType ||
          blob.type ||
          "";

        setUploadingFile(false);
      }

      /* -------------------------------------------------------------------- */
      /* Generate code                                                        */
      /* -------------------------------------------------------------------- */

      const code =
        await generateUniqueCode();

      /* -------------------------------------------------------------------- */
      /* Prepare questions                                                    */
      /* -------------------------------------------------------------------- */

      const publicQuestions = stripAnswers(questions);

      const answerKey = extractAnswers(questions);

      /* -------------------------------------------------------------------- */
      /* Create assignment and answer key atomically                          */
      /* -------------------------------------------------------------------- */

      const batch = writeBatch(db);
      const assignmentRef = doc(collection(db, "assignments"));
      const answerKeyRef = doc(db, "assignmentAnswerKeys", assignmentRef.id);

      const assignmentData = {
        title: title.trim(),
        description: description.trim(),
        type,
        classId: selectedClassId,
        subjectId: selectedSubject,
        teacherId: appUser.uid,
        fileUrl,
        fileName,
        fileSize,
        fileType,
        questions: publicQuestions,
        dueDate,
        code,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const answerKeyData = {
        assignmentId: assignmentRef.id,
        teacherId: appUser.uid,
        answers: answerKey,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      batch.set(assignmentRef, assignmentData);
      batch.set(answerKeyRef, answerKeyData);

      await batch.commit();

      showToast({
        message:
          "Assignment submitted! It will be visible to students once approved by the admin.",
        type: "success",
      });

      return true;
    } catch (error) {
      console.error(
        "Failed to create assignment:",
        error
      );

      /* -------------------------------------------------------------------- */
      /* Cleanup orphaned upload                                              */
      /* -------------------------------------------------------------------- */

      if (uploadedStorageRef) {
        try {
          await deleteObject(
            uploadedStorageRef
          );
        } catch (cleanupError) {
          console.warn(
            "Failed to clean up uploaded file:",
            cleanupError
          );
        }
      }

      showToast({
        message:
          error instanceof Error
            ? error.message
            : "Failed to post assignment. Please try again.",
        type: "error",
      });

      return false;
    } finally {
      setLoading(false);
      setUploadingFile(false);
    }
  }, [
    validateAssignment,
    showToast,
    appUser,
    file,
    validateFile,
    generateUniqueCode,
    type,
    questions,
    title,
    description,
    selectedClassId,
    selectedSubject,
    loading,
    uploadingFile,
  ]);

  /* ------------------------------------------------------------------------ */
  /* Date handling                                                            */
  /* ------------------------------------------------------------------------ */

  const handleWebDateChange = useCallback(
    (value: string) => {
      if (!value) return;

      const [year, month, day] =
        value.split("-").map(Number);

      if (
        !year ||
        !month ||
        !day
      ) {
        return;
      }

      setDueDate((previous) => {
        const next = new Date(previous);

        next.setFullYear(
          year,
          month - 1,
          day
        );

        return next;
      });
    },
    []
  );

  const handleWebTimeChange = useCallback(
    (value: string) => {
      if (!value) return;

      const [hours, minutes] =
        value.split(":").map(Number);

      if (
        Number.isNaN(hours) ||
        Number.isNaN(minutes)
      ) {
        return;
      }

      setDueDate((previous) => {
        const next = new Date(previous);

        next.setHours(
          hours,
          minutes,
          0,
          0
        );

        return next;
      });
    },
    []
  );

  /* ------------------------------------------------------------------------ */
  /* Unsaved changes                                                          */
  /* ------------------------------------------------------------------------ */

  const hasUnsavedChanges = useMemo(() => {
    return (
      title.trim().length > 0 ||
      description.trim().length > 0 ||
      selectedClassId.length > 0 ||
      selectedSubject.length > 0 ||
      mcqQuestions.length > 0 ||
      shortAnswerQuestions.length > 0 ||
      preschoolQuestions.length > 0 ||
      mathematicsQuestions.length > 0 ||
      file !== null
    );
  }, [
    title,
    description,
    selectedClassId,
    selectedSubject,
    mcqQuestions,
    shortAnswerQuestions,
    preschoolQuestions,
    mathematicsQuestions,
    file,
  ]);

  /* ------------------------------------------------------------------------ */
  /* Return API                                                               */
  /* ------------------------------------------------------------------------ */

  return {
    loading,
    fetchingMetadata,

    teacherClasses,

    selectedClassId,
    setSelectedClassId,

    selectedSubject,
    setSelectedSubject,

    subjects: appUser?.subjects || [],

    title,
    setTitle,

    description,
    setDescription,

    type,
    setType,

    dueDate,
    setDueDate,

    file,
    setFile,

    uploadingFile,

    questions,

    hasUnsavedChanges,

    addQuestion,
    updateQuestion,
    updateOption,
    addOption,
    removeQuestion,

    updatePreschoolQuestion,
    updateMathematicsQuestion,

    handleUpload,

    handleWebDateChange,
    handleWebTimeChange,
  };
};