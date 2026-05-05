export interface Tokens {
  access_token: string;
  refresh_token?: string;
}

export interface LoginCredentials {
  username?: string;
  password?: string;
}

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<Tokens> => {
    // Modify URL based on your backend. Usually /api/token/ or /api/login/
    const BASE_URL = process.env.NEXT_PUBLIC_API_URL ;
    const res = await fetch(`${BASE_URL}/login/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    if (!res.ok) {
      throw new Error('Failed to login. Check your credentials.');
    }

    return res.json(); // typically returns { access: "...", refresh: "..." }
  }
};
