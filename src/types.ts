export interface Transaction {
  id: string;
  amount: number;
  paidBy: string;
  observation: string;
  timestamp: Date;
  deleted?: boolean;
  isSplit: boolean;
}
