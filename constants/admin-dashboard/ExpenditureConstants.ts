export const EXPENDITURE_STRUCTURE: Record<string, string[]> = {
  "Staff & Payroll": [
    "Salaries",
    "Wages (casual workers)",
    "Teacher allowances",
    "Overtime payments",
    "SSNIT / pension contributions",
    "Staff welfare",
    "Bonuses",
    "Recruitment expenses",
    "Staff training",
  ],
  "Academic & Teaching": [
    "Textbooks",
    "Exercise books",
    "Teaching aids",
    "Printing & photocopying",
    "Examination materials",
    "Laboratory materials",
    "Curriculum materials",
    "Educational software subscriptions",
  ],
  Utilities: [
    "Electricity",
    "Water",
    "Internet",
    "Telephone",
    "Generator fuel",
    "Waste collection",
  ],
  "Maintenance & Repairs": [
    "Building maintenance",
    "Plumbing",
    "Electrical repairs",
    "Furniture repairs",
    "Air conditioner servicing",
    "Painting",
    "Cleaning supplies",
  ],
  "ICT & Technology": [
    "Computers",
    "Printers",
    "Software licenses",
    "Website hosting",
    "App subscriptions",
    "Network equipment",
    "Repairs",
    "CCTV",
  ],
  Administration: [
    "Office stationery",
    "Printing",
    "Postage",
    "Bank charges",
    "Office equipment",
    "Meetings",
    "Licenses & registrations",
  ],
  "Transport & Logistics": [
    "Fuel",
    "Vehicle maintenance",
    "Vehicle insurance",
    "Driver allowance",
    "School bus operations",
  ],
  "Student Welfare": [
    "Student feeding",
    "Medical support",
    "Student activities",
    "Awards",
    "Counseling",
  ],
  "Events & Programs": [
    "Speech & prize giving",
    "Sports",
    "Excursions",
    "Graduation",
    "Orientation",
    "Cultural activities",
  ],
  "Security & Safety": [
    "Security personnel",
    "CCTV maintenance",
    "Fire extinguishers",
    "Insurance",
    "Emergency expenses",
  ],
  "Assets & Capital Projects": [
    "Land",
    "Building projects",
    "Furniture",
    "Vehicles",
    "Equipment purchase",
  ],
  "Marketing & Admissions": [
    "Advertising",
    "Flyers",
    "Social media",
    "Website promotion",
    "Admissions campaigns",
  ],
  "Regulatory & Compliance": [
    "Government fees",
    "Accreditation",
    "Audit fees",
    "Legal services",
  ],
  "Miscellaneous / Emergency": [
    "Emergency purchases",
    "Miscellaneous",
    "Contingency",
  ],
};

export const EXPENDITURE_CATEGORIES = Object.keys(EXPENDITURE_STRUCTURE);

export type Expenditure = {
  id: string;
  item: string;
  category?: string;
  subCategory?: string;
  amount: number;
  date: string;
  adminName: string;
  adminRole: string;
  status: "open" | "closed";
  academicYear: string;
  term: string;
  createdAt: any;
};

export type GroupedExpenditure = {
  item: string;
  displayItem: string;
  monthTotal: number;
  termTotal: number;
  count: number;
};
