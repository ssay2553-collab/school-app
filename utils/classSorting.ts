/**
 * Shared utility for sorting classes based on academic levels and numeric order.
 * Standardizes class lists across Signup, Attendance, and Dashboard modules.
 *
 * Priority: Creche > Nursery > KG > Basic/Primary/Grade/Class > JHS > SHS
 */

export const sortClasses = (list: any[]) => {
  return [...list].sort((a, b) => {
    const nameA = (a.name || "").toUpperCase();
    const nameB = (b.name || "").toUpperCase();

    const levelOrder: Record<string, number> = {
      'CRECHE': 1,
      'NURSERY': 2,
      'KG': 3,
      'CLASS': 4,
      'PRIMARY': 4,
      'GRADE': 4,
      'BASIC': 4,
      'JHS': 5,
      'SHS': 6
    };

    const getPriority = (name: string) => {
      // Check for specific level keywords
      for (const key in levelOrder) {
        if (name.includes(key)) return levelOrder[key];
      }
      return 10; // Default priority for unknown levels
    };

    const prioA = getPriority(nameA);
    const prioB = getPriority(nameB);

    if (prioA !== prioB) return prioA - prioB;

    // Within the same level, sort numerically (e.g., Basic 1 < Basic 2)
    const numA = parseInt(nameA.replace(/[^0-9]/g, "")) || 0;
    const numB = parseInt(nameB.replace(/[^0-9]/g, "")) || 0;

    if (numA !== numB) return numA - numB;

    // Final fallback: alphabetical sorting
    return nameA.localeCompare(nameB);
  });
};
