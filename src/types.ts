export interface Transaction {
  id: string;
  amount: number;
  paidBy: string;
  observation: string;
  timestamp: Date;
  deleted?: boolean;
  splitType: 'equal' | 'full' | 'percentage';
  person1Split?: number; // Percentage for person1, e.g., 70 for 70%
}
