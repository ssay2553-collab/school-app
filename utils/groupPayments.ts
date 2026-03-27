// utils/groupPayments.ts

export interface Payment {
  id: string;
  studentId: string;
  amountPaid: number;
  term: string;
  method: string;
  datePaid: { seconds: number };
  receivedBy: string;
}

export function groupPaymentsByTerm(payments: Payment[]) {
  return payments.reduce<Record<string, Payment[]>>((acc, payment) => {
    if (!acc[payment.term]) {
      acc[payment.term] = [];
    }
    acc[payment.term].push(payment);
    return acc;
  }, {});
}
