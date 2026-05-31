import {
  fetchUserCarbonCredits,
  fetchUserTransactions,
  fetchUserWalletBalance,
} from '@/lib/api/marketplace';

export async function loadWalletSnapshot() {
  const [userCredits, userTransactions, balance] = await Promise.all([
    fetchUserCarbonCredits(),
    fetchUserTransactions(),
    fetchUserWalletBalance(),
  ]);

  const activeCredits = userCredits.filter(
    (credit: { quantity: number }) => Number(credit.quantity) > 0
  );

  return {
    balance,
    carbonCredits: activeCredits.map((credit: { credit_id: string; quantity: number; carbon_credits: { name: string; vintage: string; certification_body: string; carbon_reduction: number } }) => ({
      id: credit.credit_id,
      name: credit.carbon_credits.name,
      quantity: credit.quantity,
      vintage: credit.carbon_credits.vintage,
      certificationBody: credit.carbon_credits.certification_body,
      carbonReduction: credit.carbon_credits.carbon_reduction * credit.quantity,
    })),
    transactions: userTransactions.map((tx: {
      id: string;
      type: 'buy' | 'sell';
      credit_id: string;
      quantity: number;
      price: number;
      total_amount: number;
      created_at: string;
      status: string;
      tx_hash?: string;
      carbon_credits: { name: string };
    }) => ({
      id: tx.id,
      type: tx.type,
      creditId: tx.credit_id,
      creditName: tx.carbon_credits.name,
      quantity: tx.quantity,
      price: tx.price,
      totalAmount: tx.total_amount,
      timestamp: tx.created_at,
      status: tx.status,
      txHash: tx.tx_hash,
    })),
  };
}
