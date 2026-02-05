export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export interface AuthResult {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginInput {
  email: string;
  password: string;
}
