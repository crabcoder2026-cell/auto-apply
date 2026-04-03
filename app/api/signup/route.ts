import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createUser, findUserByEmail } from '@/lib/json-store';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await createUser({
      email,
      password: hashedPassword,
      name: name || null,
    });

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error('Signup error:', error);
    const msg = error instanceof Error ? error.message : '';
    if (msg.includes('already exists')) {
      return NextResponse.json({ error: 'User already exists' }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    );
  }
}
