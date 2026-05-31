import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function getProfileBalance(
  supabase: SupabaseClient,
  userId: string
): Promise<{ balance: number; error?: string }> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('balance')
    .eq('id', userId)
    .single();

  if (error || !profile) {
    return { balance: 0, error: error?.message ?? 'Profile not found' };
  }

  return { balance: Number(profile.balance) };
}

async function setProfileBalance(
  supabase: SupabaseClient,
  userId: string,
  balance: number
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('profiles')
    .update({ balance })
    .eq('id', userId);

  return { error: error?.message };
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const accessToken = authHeader?.split(' ')[1];

    const supabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('transactions')
      .select(`*, carbon_credits ( name )`)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching transactions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch transactions', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const accessToken = authHeader?.split(' ')[1];

    const supabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );

    const body = await request.json();
    const { creditId, type, quantity, price } = body;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const userId = user.id;

    if (!creditId || !type || !quantity || !price) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (type !== 'buy' && type !== 'sell') {
      return NextResponse.json({ error: 'Invalid transaction type' }, { status: 400 });
    }

    const qty = Number(quantity);
    const unitPrice = Number(price);
    if (qty <= 0 || unitPrice < 0) {
      return NextResponse.json({ error: 'Invalid quantity or price' }, { status: 400 });
    }

    const totalAmount = qty * unitPrice;
    const { balance: currentBalance, error: balanceFetchError } = await getProfileBalance(
      supabase,
      userId
    );

    if (balanceFetchError) {
      return NextResponse.json(
        { error: 'Failed to fetch wallet balance', details: balanceFetchError },
        { status: 500 }
      );
    }

    if (type === 'buy' && currentBalance < totalAmount) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    if (type === 'sell') {
      const { data: holding, error: holdingError } = await supabase
        .from('user_carbon_credits')
        .select('id, quantity')
        .eq('user_id', userId)
        .eq('credit_id', creditId)
        .maybeSingle();

      if (holdingError) {
        return NextResponse.json(
          { error: 'Failed to verify carbon credits', details: holdingError.message },
          { status: 500 }
        );
      }

      if (!holding || Number(holding.quantity) < qty) {
        return NextResponse.json(
          { error: 'Insufficient carbon credits to sell' },
          { status: 400 }
        );
      }
    }

    if (type === 'sell') {
      const { data: holding } = await supabase
        .from('user_carbon_credits')
        .select('id, quantity')
        .eq('user_id', userId)
        .eq('credit_id', creditId)
        .single();

      const remaining = Number(holding!.quantity) - qty;

      const { error: creditsError } = await supabase
        .from('user_carbon_credits')
        .update({ quantity: Math.max(0, remaining) })
        .eq('id', holding!.id);

      if (creditsError) {
        return NextResponse.json(
          { error: 'Failed to update user credits', details: creditsError.message },
          { status: 500 }
        );
      }
    }

    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .insert([{
        user_id: userId,
        credit_id: creditId,
        type,
        quantity: qty,
        price: unitPrice,
        total_amount: totalAmount,
        status: 'completed',
      }])
      .select()
      .single();

    if (transactionError) {
      console.error('Error creating transaction:', transactionError);
      return NextResponse.json(
        { error: 'Failed to create transaction', details: transactionError.message },
        { status: 500 }
      );
    }

    const newBalance =
      type === 'buy' ? currentBalance - totalAmount : currentBalance + totalAmount;

    const { error: balanceUpdateError } = await setProfileBalance(
      supabase,
      userId,
      newBalance
    );

    if (balanceUpdateError) {
      return NextResponse.json(
        { error: 'Failed to update wallet balance', details: balanceUpdateError },
        { status: 500 }
      );
    }

    if (type === 'buy') {
      const { data: existing } = await supabase
        .from('user_carbon_credits')
        .select('quantity')
        .eq('user_id', userId)
        .eq('credit_id', creditId)
        .maybeSingle();

      const newQuantity = Number(existing?.quantity ?? 0) + qty;

      const { error: upsertError } = await supabase
        .from('user_carbon_credits')
        .upsert(
          {
            user_id: userId,
            credit_id: creditId,
            quantity: newQuantity,
            purchase_price: unitPrice,
          },
          { onConflict: 'user_id,credit_id' }
        );

      if (upsertError) {
        return NextResponse.json(
          { error: 'Failed to update user credits', details: upsertError.message },
          { status: 500 }
        );
      }

      const { error: updateError } = await supabase.rpc('decrement_credit_quantity', {
        credit_id: creditId,
        decrement_amount: qty,
      });

      if (updateError) {
        console.error('Error updating carbon credit quantity:', updateError);
      }
    }

    return NextResponse.json(
      { data: transaction, balance: newBalance },
      { status: 201 }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
